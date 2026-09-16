import { SQL } from "bun";
import { drizzle } from 'drizzle-orm/bun-sql/mysql';
import { eq } from 'drizzle-orm';

import { usersTable } from './schema';

const client = new SQL({
    adapter: "mysql",
    hostname: "localhost",
    username: "root",
    password: "Admin123",
    database: "test",
    idleTimeout: 10,
    connectTimeout: 5,
    max: 20,
    onconnect: (client) => {
        console.log('Connected to database');
    }
});

await client.connect();
const db = drizzle({ client });

const result = await db.execute(`select version() as version`)
console.log(result);

const user: typeof usersTable.$inferInsert = {
    name: 'John',
    age: 30,
    email: 'john@example.com',
};

try {
    await db.insert(usersTable).values(user);
    console.log('New user created!')

    const users = await db.select().from(usersTable);
    console.log('Getting all users from the database: ', users)

    await db
        .update(usersTable)
        .set({ age: 31 })
        .where(eq(usersTable.email, user.email));
    console.log('User info updated!')

    await db.delete(usersTable).where(eq(usersTable.email, user.email));
    console.log('User deleted!')
} catch (error) {
    console.error('Error occurred:', error);
} finally {
    await client.close();
}

await Bun.sleep(1000);
