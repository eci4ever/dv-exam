import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** A configured examination period, such as a mid-year or final examination. */
export const examSessions = sqliteTable("exam_sessions", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	name: text("name").notNull(),
	startsAt: text("starts_at").notNull(),
	endsAt: text("ends_at").notNull(),
	status: text("status").notNull().default("draft"),
	createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
