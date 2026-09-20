import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { encode } from '@msgpack/msgpack';
import { parse } from 'csv-parse/sync';

/** Wire-format version for [version, schemaHash, rows]. */
export const CONFIG_FORMAT_VERSION = 1;

const HEADER_ROWS = 5;
const ARRAY_DELIMITER = ';';
const MIN_INT32 = -2_147_483_648;
const MAX_INT32 = 2_147_483_647;

export type ConfigValueType = 'int' | 'long' | 'float' | 'bool' | 'string';
export type ConfigScalar = number | boolean | string;
export type ConfigValue = ConfigScalar | readonly ConfigScalar[];
export type ConfigRow = readonly ConfigValue[];
export type ConfigEnvelope = readonly [number, string, readonly ConfigRow[]];

export interface ConfigColumn {
    /** Index in the original CSV row, including hidden planner-note columns. */
    readonly csvIndex: number;
    /** Index in the compact MessagePack row. */
    readonly valueIndex: number;
    readonly name: string;
    readonly type: ConfigValueType;
    readonly isArray: boolean;
    readonly annotation: string;
    readonly comment: string;
}

export interface CsvConfigTable {
    readonly tableName: string;
    readonly title: string;
    readonly columns: readonly ConfigColumn[];
    readonly rawRows: readonly (readonly string[])[];
    readonly rows: readonly ConfigRow[];
    readonly schemaHash: string;
}

export interface CompiledConfig {
    readonly table: CsvConfigTable;
    readonly envelope: ConfigEnvelope;
    readonly bytes: Uint8Array;
    readonly typescript: string;
}

export interface ConfigManifestEntry {
    readonly file: string;
    readonly tableName: string;
    readonly schemaHash: string;
    readonly rowCount: number;
    readonly byteLength: number;
    readonly sha256: string;
}

export interface ConfigManifest {
    readonly formatVersion: number;
    readonly entries: readonly ConfigManifestEntry[];
}

interface RawLayout {
    readonly title: string;
    readonly names: readonly string[];
    readonly types: readonly string[];
    readonly annotations: readonly string[];
    readonly comments: readonly string[];
    readonly dataRows: readonly (readonly string[])[];
}

function parseRawLayout(content: string, tableName: string): RawLayout {
    // This retains the original parser's BOM/comment/trim/strict-row behaviour.
    const rows = parse(content, {
        trim: true,
        bom: true,
        encoding: 'utf-8',
        comment: '#',
        skip_empty_lines: true,
    }) as string[][];

    if (rows.length < HEADER_ROWS) {
        throw new Error(`${tableName}.csv requires ${HEADER_ROWS} header rows (title/name/type/annotation/comment)`);
    }

    const [title = [], names = [], types = [], annotations = [], comments = []] = rows;
    return {
        title: title[0] ?? '',
        names,
        types,
        annotations,
        comments,
        dataRows: rows.slice(HEADER_ROWS),
    };
}

function parseType(tableName: string, fieldName: string, sourceType: string): Pick<ConfigColumn, 'type' | 'isArray'> {
    const arrayMatch = /^\[([a-z]+)\]$/.exec(sourceType);
    const isArray = arrayMatch !== null;
    const type = (arrayMatch?.[1] ?? sourceType) as ConfigValueType;
    if (!['int', 'long', 'float', 'bool', 'string'].includes(type)) {
        throw new Error(`${tableName}.csv column ${fieldName}: unsupported type ${JSON.stringify(sourceType)}`);
    }
    return { type, isArray };
}

function buildColumns(tableName: string, layout: RawLayout): readonly ConfigColumn[] {
    const columns: ConfigColumn[] = [];
    const seen = new Set<string>();

    for (let csvIndex = 0; csvIndex < layout.names.length; csvIndex += 1) {
        const name = layout.names[csvIndex]?.trim() ?? '';
        // Existing sheets deliberately use blank columns for planner notes.
        if (name === '') continue;
        if (seen.has(name)) throw new Error(`${tableName}.csv: duplicate field ${JSON.stringify(name)}`);

        const sourceType = layout.types[csvIndex]?.trim() ?? '';
        if (sourceType === '') throw new Error(`${tableName}.csv column ${name}: a type is required`);

        seen.add(name);
        columns.push({
            csvIndex,
            valueIndex: columns.length,
            name,
            ...parseType(tableName, name, sourceType),
            annotation: layout.annotations[csvIndex]?.trim() ?? '',
            comment: layout.comments[csvIndex]?.trim() ?? '',
        });
    }
    if (columns.length === 0) throw new Error(`${tableName}.csv: no publishable columns`);
    return columns;
}

function valueError(tableName: string, rowNumber: number, column: ConfigColumn, message: string): Error {
    return new Error(`${tableName}.csv row ${rowNumber}, column ${column.name}: ${message}`);
}

function defaultScalar(type: ConfigValueType): ConfigScalar {
    if (type === 'string') return '';
    if (type === 'bool') return false;
    return 0;
}

function parseScalar(raw: string, tableName: string, rowNumber: number, column: ConfigColumn): ConfigScalar {
    const value = raw.trim();
    if (value === '') return defaultScalar(column.type);
    const invalid = () => valueError(tableName, rowNumber, column, `expected ${column.type}, got ${JSON.stringify(raw)}`);

    switch (column.type) {
        case 'int': {
            if (!/^[+-]?\d+$/.test(value)) throw invalid();
            const parsed = Number(value);
            if (!Number.isSafeInteger(parsed) || parsed < MIN_INT32 || parsed > MAX_INT32) throw invalid();
            return parsed;
        }
        case 'long': {
            if (!/^[+-]?\d+$/.test(value)) throw invalid();
            const parsed = Number(value);
            // Cocos uses JS number by default: never publish a rounded long.
            if (!Number.isSafeInteger(parsed)) throw invalid();
            return parsed;
        }
        case 'float': {
            const parsed = Number(value);
            if (!Number.isFinite(parsed)) throw invalid();
            return parsed;
        }
        case 'bool':
            if (value === '1' || value.toLowerCase() === 'true') return true;
            if (value === '0' || value.toLowerCase() === 'false') return false;
            throw invalid();
        case 'string':
            return raw;
    }
}

function parseValue(raw: string, tableName: string, rowNumber: number, column: ConfigColumn): ConfigValue {
    if (!column.isArray) return parseScalar(raw, tableName, rowNumber, column);
    if (raw.trim() === '') return [];
    return raw.split(ARRAY_DELIMITER).map((item, index) => {
        if (item.trim() === '') {
            throw valueError(tableName, rowNumber, column, `array item ${index + 1} is empty`);
        }
        return parseScalar(item, tableName, rowNumber, column);
    });
}

function schemaHash(tableName: string, columns: readonly ConfigColumn[]): string {
    // Planner comments and foreign-key annotations are not wire-layout changes.
    const source = JSON.stringify({
        formatVersion: CONFIG_FORMAT_VERSION,
        tableName,
        columns: columns.map(({ name, type, isArray }) => ({ name, type, isArray })),
    });
    return createHash('sha256').update(source).digest('hex');
}

/** Parses the existing five-row game table layout into compact, typed rows. */
export function parseConfigCsv(content: string, tableName: string): CsvConfigTable {
    const layout = parseRawLayout(content, tableName);
    const columns = buildColumns(tableName, layout);
    const rows = layout.dataRows.map((rawRow, dataIndex) => columns.map((column) =>
        parseValue(rawRow[column.csvIndex] ?? '', tableName, HEADER_ROWS + dataIndex + 1, column),
    ));

    return {
        tableName,
        title: layout.title,
        columns,
        rawRows: layout.dataRows,
        rows,
        schemaHash: schemaHash(tableName, columns),
    };
}

/** Compatibility API for the previous MessagePack array-of-string-records output. */
export function parseLegacyRecords(content: string, tableName: string): readonly Record<string, string>[] {
    const layout = parseRawLayout(content, tableName);
    const columns = buildColumns(tableName, layout);
    return layout.dataRows.map((rawRow) => Object.fromEntries(
        columns.map((column) => [column.name, rawRow[column.csvIndex] ?? '']),
    ));
}

function pascalCase(value: string): string {
    const identifier = value.replace(/[^A-Za-z0-9]+/g, ' ').trim().split(/\s+/)
        .filter(Boolean)
        .map((word) => word[0]!.toUpperCase() + word.slice(1)).join('');
    return identifier === '' ? 'Config' : /^\d/.test(identifier) ? `Config${identifier}` : identifier;
}

function typeScriptType(column: ConfigColumn): string {
    const scalar = column.type === 'string' ? 'string' : column.type === 'bool' ? 'boolean' : 'number';
    return column.isArray ? `readonly ${scalar}[]` : scalar;
}

function typeScriptPropertyName(name: string): string {
    return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : JSON.stringify(name);
}

/** Generates a Cocos-friendly tuple type plus a schema-checked decoder. */
export function generateTypescript(table: CsvConfigTable): string {
    const identifier = pascalCase(table.tableName);
    const idColumn = table.columns.find((column) => column.name.toLowerCase() === 'id');
    const wireTuple = table.columns.map((column) =>
        `    ${column.name.replace(/[^A-Za-z0-9_$]/g, '_')}: ${typeScriptType(column)},`,
    ).join('\n');
    const indexes = table.columns.map((column) => `    ${JSON.stringify(column.name)}: ${column.valueIndex},`).join('\n');
    const objectProperties = table.columns
        .filter((column) => column !== idColumn)
        .map((column) => `    readonly ${typeScriptPropertyName(column.name)}: ${typeScriptType(column)},`)
        .join('\n');
    const objectFromWire = table.columns
        .filter((column) => column !== idColumn)
        .map((column) => `                ${typeScriptPropertyName(column.name)}: row[${column.valueIndex}],`)
        .join('\n');
    const lookup = idColumn === undefined ? `
    constructor(readonly rows: readonly ${identifier}Row[]) {}
` : `
    private readonly byId = new Map<number, ${identifier}>();

    constructor(rows: readonly ${identifier}WireRow[]) {
        for (const row of rows) {
            const id = row[${idColumn.valueIndex}];
            if (typeof id !== 'number' || this.byId.has(id)) throw new Error('invalid ${table.tableName} Id');
            this.byId.set(id, {
${objectFromWire}
            });
        }
    }

    find(id: number): ${identifier} | undefined {
        return this.byId.get(id);
    }

    get(id: number): ${identifier} {
        const config = this.byId.get(id);
        if (!config) throw new Error('${table.tableName} not found: ' + id);
        return config;
    }

    entries(): IterableIterator<[number, ${identifier}]> {
        return this.byId.entries();
    }
`;

    return `// Generated by apps/parser/csv.ts. Do not edit by hand.
import { decode } from '@msgpack/msgpack';

export const ${identifier}FormatVersion = ${CONFIG_FORMAT_VERSION};
export const ${identifier}SchemaHash = ${JSON.stringify(table.schemaHash)};
/** Compact on-wire layout. Id exists only long enough to build ${identifier}Table. */
export type ${identifier}WireRow = readonly [
${wireTuple}
];
/** @deprecated Use ${identifier}WireRow for binary-level code or ${identifier} for business code. */
export type ${identifier}Row = ${identifier}WireRow;
export interface ${identifier} {
${objectProperties}
}
export const ${identifier}Field = {
${indexes}
} as const;

export class ${identifier}Table {${lookup}}
export function decode${identifier}(bytes: Uint8Array): ${identifier}Table {
    const envelope = decode(bytes);
    if (!Array.isArray(envelope) || envelope.length !== 3) throw new Error('invalid ${table.tableName} config envelope');
    const [version, hash, rows] = envelope;
    if (version !== ${identifier}FormatVersion || hash !== ${identifier}SchemaHash) {
        throw new Error('${table.tableName} config/client schema mismatch');
    }
    if (!Array.isArray(rows)) throw new Error('invalid ${table.tableName} config rows');
    return new ${identifier}Table(rows as ${identifier}WireRow[]);
}
`;
}

export function compileConfigCsv(content: string, tableName: string): CompiledConfig {
    const table = parseConfigCsv(content, tableName);
    const envelope: ConfigEnvelope = [CONFIG_FORMAT_VERSION, table.schemaHash, table.rows];
    return { table, envelope, bytes: encode(envelope), typescript: generateTypescript(table) };
}

export async function compileConfigFile(inputPath: string): Promise<CompiledConfig> {
    return compileConfigCsv(await fs.readFile(inputPath, 'utf8'), path.parse(inputPath).name);
}

export async function writeCompiledConfig(compiled: CompiledConfig, outputPath: string, typesPath?: string): Promise<ConfigManifestEntry> {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, compiled.bytes);
    if (typesPath !== undefined) {
        await fs.mkdir(path.dirname(typesPath), { recursive: true });
        await fs.writeFile(typesPath, compiled.typescript, 'utf8');
    }
    return {
        file: path.basename(outputPath),
        tableName: compiled.table.tableName,
        schemaHash: compiled.table.schemaHash,
        rowCount: compiled.table.rows.length,
        byteLength: compiled.bytes.byteLength,
        sha256: createHash('sha256').update(compiled.bytes).digest('hex'),
    };
}

export async function compileConfigDirectory(inputDirectory: string, outputDirectory: string, typesDirectory?: string): Promise<ConfigManifest> {
    const files = (await fs.readdir(inputDirectory, { withFileTypes: true }))
        .filter((entry) => entry.isFile() && path.extname(entry.name).toLowerCase() === '.csv')
        .map((entry) => entry.name).sort((a, b) => a.localeCompare(b));
    const entries: ConfigManifestEntry[] = [];
    for (const file of files) {
        const compiled = await compileConfigFile(path.join(inputDirectory, file));
        const name = path.parse(file).name;
        entries.push(await writeCompiledConfig(
            compiled,
            path.join(outputDirectory, `${name}.bin`),
            typesDirectory === undefined ? undefined : path.join(typesDirectory, `${name}.gen.ts`),
        ));
    }
    const manifest: ConfigManifest = { formatVersion: CONFIG_FORMAT_VERSION, entries };
    await fs.mkdir(outputDirectory, { recursive: true });
    await fs.writeFile(path.join(outputDirectory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    return manifest;
}

function usage(): string {
    return [
        'Usage:',
        '  bun apps/parser/csv.ts [input.csv] [output.bin] [--ts-out output.gen.ts]',
        '  bun apps/parser/csv.ts --all [input-directory] [output-directory] [--ts-out types-directory]',
        '  bun apps/parser/csv.ts [input.csv] [output.msgpack] --legacy-records',
    ].join('\n');
}

export async function main(args: readonly string[]): Promise<void> {
    const all = args[0] === '--all';
    const legacy = args.includes('--legacy-records');
    // Bun owns --types, so use a tool-specific option that Bun passes through.
    const typeIndex = args.indexOf('--ts-out');
    if (typeIndex !== -1 && args[typeIndex + 1] === undefined) throw new Error('--ts-out requires a path');
    let typesPath = typeIndex === -1 ? undefined : path.resolve(args[typeIndex + 1]!);
    const positional = args.filter((argument, index) =>
        argument !== '--all'
        && argument !== '--legacy-records'
        && (typeIndex === -1 || (index !== typeIndex && index !== typeIndex + 1)),
    );
    const csvDirectory = path.resolve(import.meta.dir, '../../csv');

    if (all) {
        if (legacy || positional.length > 2) throw new Error(usage());
        const manifest = await compileConfigDirectory(
            path.resolve(positional[0] ?? csvDirectory),
            path.resolve(positional[1] ?? path.join(import.meta.dir, 'output')),
            typesPath,
        );
        console.log(`Compiled ${manifest.entries.length} tables`);
        return;
    }

    if (positional.length > 2) throw new Error(usage());
    const input = path.resolve(positional[0] ?? path.join(csvDirectory, 'ActivityBar.csv'));
    const output = path.resolve(positional[1] ?? path.resolve(import.meta.dir, '../../data.msgpack'));
    if (legacy) {
        const records = parseLegacyRecords(await fs.readFile(input, 'utf8'), path.parse(input).name);
        await fs.mkdir(path.dirname(output), { recursive: true });
        await fs.writeFile(output, encode(records));
        console.log(`Compiled ${records.length} legacy records`);
        return;
    }

    typesPath = './scripts/parser.ts'
    const entry = await writeCompiledConfig(await compileConfigFile(input), output, typesPath);
    console.log(`Compiled ${entry.tableName}: ${entry.rowCount} rows, ${entry.byteLength} bytes`);
}

if (import.meta.main) {
    main(Bun.argv.slice(2)).catch((error: unknown) => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    });
}
