import { defineConfig } from "drizzle-kit";

export default defineConfig({
    dialect: "mysql",
    schema: "schema.ts", // 你的 schema 文件路径
    out: "./drizzle",
    dbCredentials: {
        url: "mysql://root:Admin123@localhost:3306/test",
    },
});

// bunx --bun drizzle-kit push

// bunx drizzle-kit generate          # 生成迁移 SQL 文件
// bunx --bun  drizzle-kit migrate    # 执行迁移,建表
