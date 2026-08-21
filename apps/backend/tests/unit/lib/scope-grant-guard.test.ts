import { describe, expect, it } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const SRC_ROOT = resolve(import.meta.dir, "../../../src");

function listSourceFiles(dir: string): string[] {
	const files: string[] = [];
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) {
			files.push(...listSourceFiles(full));
		} else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
			files.push(full);
		}
	}
	return files;
}

describe("AUTH-03 - ScopeGrant fora do runtime", () => {
	it("service e repository legados de grants nao existem", () => {
		expect(
			existsSync(join(SRC_ROOT, "modules", "users", "scope-grant.service.ts")),
		).toBe(false);
		expect(
			existsSync(
				join(SRC_ROOT, "modules", "users", "scope-grant.repository.ts"),
			),
		).toBe(false);
	});

	it("nenhum arquivo de src referencia userScopeGrant/ScopeGrant", () => {
		const offenders = listSourceFiles(SRC_ROOT)
			.map((file) => ({
				file,
				content: readFileSync(file, "utf8"),
			}))
			.filter(
				({ content }) =>
					content.includes("userScopeGrant") ||
					content.includes("scope-grant") ||
					content.includes("ScopeGrant"),
			)
			.map(({ file }) => file.replace(SRC_ROOT, "src"));
		expect(offenders).toEqual([]);
	});
});
