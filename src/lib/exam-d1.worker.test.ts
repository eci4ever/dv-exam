import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("Worker D1 test harness", () => {
	it("applies the application migrations to isolated D1 storage", async () => {
		const result = await env.DB.prepare(
			"SELECT name FROM sqlite_schema WHERE type = 'table' AND name = ?",
		)
			.bind("auditEvent")
			.first<{ name: string }>();

		expect(result?.name).toBe("auditEvent");
	});
});
