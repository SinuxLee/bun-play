import { SQL } from "bun";

// Connect to a MySQL or MariaDB database
const sql = new SQL({
    adapter: "mysql",
    hostname: "localhost",
    username: "root",
    password: "Admin123",
    database: "fft_ci",
});

async function getAllAndCheck(table: string) {
    if (table === "history") return;
    const items = await sql`SELECT * FROM ${sql(table)}`;
    for (const item of items) {
        Object.entries(item).forEach(([key, value]) => {
            if (value === null) return;

            if (typeof value !== "string") return;
            if (value.trim() === "") return;

            if (value.includes("vm3.")
                || value.includes("vm3-")
                || value.includes("apa.")
                || value.includes("apa-")) {
                console.log(`Table: ${table}, Name: ${item.name}, Key: ${key}, Value: "${value}"`);
            }
        });
    }
}

async function main() {
    let tables = await sql`show tables;`;
    for (const { Tables_in_fft_ci: table } of tables) {
        await getAllAndCheck(table);
    }
}

main().catch((error) => {
    console.error("Error in main function:", error);
});