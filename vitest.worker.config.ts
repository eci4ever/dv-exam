import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [
		cloudflareTest(async () => ({
			main: "./test/worker-entry.ts",
			wrangler: { configPath: "./wrangler.jsonc" },
			miniflare: {
				bindings: {
					TEST_MIGRATIONS: await readD1Migrations(
						path.resolve(import.meta.dirname, "migrations"),
					),
				},
			},
		})),
	],
	test: {
		include: ["src/**/*.worker.test.ts"],
		setupFiles: ["./test/worker-setup.ts"],
	},
});
