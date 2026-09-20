import { describe, expect, test } from 'bun:test';
import { decode } from '@msgpack/msgpack';

import { CONFIG_FORMAT_VERSION, compileConfigCsv, parseConfigCsv, parseLegacyRecords } from './csv.ts';

const fixture = `Monster table,,,,,,
Id,,Name,Enabled,SkillIds,BigValue,Rate
int,,string,bool,[int],long,float
,,,,,,
ID,planner note,name,enabled,skills,long value,rate
1001,hidden note,Slime,1,101;102,9007199254740991,0.5
1002,,Wolf,false,,,
`;

describe('game CSV config compiler', () => {
    test('keeps five-header-row sheets but publishes typed compact rows', () => {
        const table = parseConfigCsv(fixture, 'Monster');
        expect(table.columns.map((column) => column.name)).toEqual(['Id', 'Name', 'Enabled', 'SkillIds', 'BigValue', 'Rate']);
        expect(table.rows).toEqual([
            [1001, 'Slime', true, [101, 102], 9_007_199_254_740_991, 0.5],
            [1002, 'Wolf', false, [], 0, 0],
        ]);
    });

    test('retains the previous raw string record export', () => {
        expect(parseLegacyRecords(fixture, 'Monster')).toEqual([
            { Id: '1001', Name: 'Slime', Enabled: '1', SkillIds: '101;102', BigValue: '9007199254740991', Rate: '0.5' },
            { Id: '1002', Name: 'Wolf', Enabled: 'false', SkillIds: '', BigValue: '', Rate: '' },
        ]);
    });

    test('emits schema-checked MessagePack, object types, and optional Zod validation', () => {
        const compiled = compileConfigCsv(fixture, 'Monster');
        expect(decode(compiled.bytes)).toEqual(compiled.envelope);
        expect(compiled.envelope[0]).toBe(CONFIG_FORMAT_VERSION);
        expect(compiled.typescript).toContain('export type MonsterWireRow = readonly [');
        expect(compiled.typescript).toContain("import * as z from 'zod';");
        expect(compiled.typescript).toContain('export const MonsterSchema = z.object({');
        expect(compiled.typescript).toContain('export type Monster = z.infer<typeof MonsterSchema>;');
        expect(compiled.typescript).toContain('export interface MonsterDecodeOptions {');
        expect(compiled.typescript).toContain('const configResult = MonsterSchema.safeParse(config);');
        expect(compiled.typescript).toContain('private readonly byId = new Map<number, Monster>();');
        expect(compiled.typescript).not.toContain('constructor(readonly rows: readonly MonsterWireRow[])');
        expect(compiled.typescript).toContain('decodeMonster');
    });

    test('reports the planner row and field for invalid data', () => {
        expect(() => parseConfigCsv(fixture.replace('1001,hidden', 'bad,hidden'), 'Monster')).toThrow(
            'Monster.csv row 6, column Id: expected int, got "bad"',
        );
        expect(() => parseConfigCsv(fixture.replace('9007199254740991', '9007199254740992'), 'Monster')).toThrow(
            'Monster.csv row 6, column BigValue: expected long',
        );
    });
});
