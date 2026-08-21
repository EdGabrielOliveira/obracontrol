import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createImportStorage } from "../../../src/lib/import-storage";

function sha256Of(bytes: Uint8Array): string {
	return createHash("sha256").update(bytes).digest("hex");
}

describe("import-storage", () => {
	let dir: string;
	let storage: ReturnType<typeof createImportStorage>;

	beforeAll(async () => {
		dir = await mkdtemp(join(tmpdir(), "obracontrol-import-storage-"));
		storage = createImportStorage({ directory: dir });
	});

	afterAll(async () => {
		await rm(dir, { recursive: true, force: true });
	});

	async function* chunks(
		data: Uint8Array,
		size = 3,
	): AsyncIterable<Uint8Array> {
		for (let i = 0; i < data.length; i += size) {
			yield data.subarray(i, i + size);
		}
	}

	it("put persiste o arquivo em disco e devolve storageKey e sha256 do conteudo", async () => {
		const content = new TextEncoder().encode(
			"arquivo-bruto-de-importacao-xlsx",
		);
		const expiresAt = new Date(Date.now() + 60_000);

		const result = await storage.put("batch-1", chunks(content), expiresAt);

		expect(result.storageKey).toContain("batch-1");
		expect(result.sha256).toBe(sha256Of(content));
		const persisted = await readFile(join(dir, result.storageKey));
		expect(new TextDecoder().decode(persisted)).toBe(
			"arquivo-bruto-de-importacao-xlsx",
		);
	});

	it("chunks devolve exatamente os bytes gravados pelo put", async () => {
		const content = new TextEncoder().encode("outro-arquivo-de-teste");
		const { storageKey } = await storage.put(
			"batch-2",
			chunks(content),
			new Date(Date.now() + 60_000),
		);

		const received: Uint8Array[] = [];
		for await (const part of storage.chunks(storageKey)) {
			received.push(part);
		}
		const joined = new Uint8Array(
			received.reduce((sum, part) => sum + part.length, 0),
		);
		let offset = 0;
		for (const part of received) {
			joined.set(part, offset);
			offset += part.length;
		}
		expect(new TextDecoder().decode(joined)).toBe("outro-arquivo-de-teste");
	});

	it("remove apaga o arquivo do disco", async () => {
		const content = new TextEncoder().encode("para-remover");
		const { storageKey } = await storage.put(
			"batch-3",
			chunks(content),
			new Date(Date.now() + 60_000),
		);

		await storage.remove(storageKey);

		expect(await readFile(join(dir, storageKey)).catch(() => null)).toBeNull();
	});

	it("rejeita storageKey fora do diretorio configurado (traversal)", async () => {
		const content = new TextEncoder().encode("x");
		const { storageKey } = await storage.put(
			"batch-4",
			chunks(content),
			new Date(Date.now() + 60_000),
		);

		expect(() => storage.chunks(`../../etc/passwd`)).toThrow();
		expect(storageKey).not.toContain("..");
	});
});
