import { Database } from "bun:sqlite";

// const db = new Database("mydb.sqlite", { strict: true });
// const db = new Database("mydb.sqlite", { readonly: true, strict: true });
// db.run("PRAGMA journal_mode = WAL;"); // 提高单写多读效率
// db.run("PRAGMA wal_checkpoint(TRUNCATE);"); // 执行检查点并截断 WAL 文件，不产生 -wal 或 -shm 文件

const db = new Database("", { strict: true }); // In-memory database

class Message {
  $message!: string;
}

let query = db.query("SELECT $message;")
query.as(Message);
const result = query.all({ message: "Hello world" }) as Message[];

for (const row of result) {
  console.log(row.$message);
}


class User {
  message!: string;
}

query = db.query("select 'Hello world' as message;").as(User);
const user = query.get() as User;
console.log(user.message);

query = db.query("SELECT sqlite_version();") // SQLite 3.38.0 之后，支持 JSONB
console.log(query.get());

db.close(false);
