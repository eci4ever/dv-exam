import { drizzle } from "drizzle-orm/d1";

/** Creates a typed Drizzle client from the Cloudflare D1 binding. */
export function getDb(database: D1Database) {
	return drizzle(database);
}
