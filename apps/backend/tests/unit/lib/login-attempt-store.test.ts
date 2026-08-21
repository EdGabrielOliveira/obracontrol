import { beforeEach, describe, expect, test } from "bun:test";
import {
	MemoryLoginAttemptStore,
	resetLoginAttemptStores,
} from "../../../src/lib/login-attempt-store";

describe("MemoryLoginAttemptStore", () => {
	beforeEach(() => {
		resetLoginAttemptStores();
	});

	test("record incrementa e respeita o maximo por janela", async () => {
		const store = new MemoryLoginAttemptStore();

		const first = await store.record("login", "user-a", 60_000, 3);
		expect(first).toMatchObject({ count: 1, allowed: true });
		await store.record("login", "user-a", 60_000, 3);
		const third = await store.record("login", "user-a", 60_000, 3);
		expect(third).toMatchObject({ count: 3, allowed: true });
		const blocked = await store.record("login", "user-a", 60_000, 3);
		expect(blocked.allowed).toBe(false);
		expect(blocked.retryAfter).toBeGreaterThan(0);
	});

	test("record nao incrementa quando ja bloqueado (janela fixa)", async () => {
		const store = new MemoryLoginAttemptStore();
		for (let i = 0; i < 3; i++) {
			await store.record("login", "user-a", 60_000, 3);
		}
		const blocked = await store.record("login", "user-a", 60_000, 3);
		expect(blocked.count).toBe(3);
	});

	test("peek nao muta o estado", async () => {
		const store = new MemoryLoginAttemptStore();
		await store.record("login", "user-a", 60_000, 5);
		await store.peek("login", "user-a", 60_000);
		const peek = await store.peek("login", "user-a", 60_000);
		expect(peek.count).toBe(1);
	});

	test("tentativas expiram fora da janela", async () => {
		const store = new MemoryLoginAttemptStore();
		await store.record("login", "user-a", 20, 5);
		await new Promise((resolve) => setTimeout(resolve, 30));
		const after = await store.peek("login", "user-a", 20);
		expect(after.count).toBe(0);
	});

	test("clear zera o contador do usuario", async () => {
		const store = new MemoryLoginAttemptStore();
		await store.record("login", "user-a", 60_000, 5);
		await store.clear("login", "user-a");
		const peek = await store.peek("login", "user-a", 60_000);
		expect(peek.count).toBe(0);
	});

	test("usuarios sao isolados entre si", async () => {
		const store = new MemoryLoginAttemptStore();
		for (let i = 0; i < 5; i++) {
			await store.record("login", "user-a", 60_000, 5);
		}
		const blocked = await store.record("login", "user-a", 60_000, 5);
		expect(blocked.allowed).toBe(false);
		const other = await store.record("login", "user-b", 60_000, 5);
		expect(other.allowed).toBe(true);
		expect(other.count).toBe(1);
	});

	test("chaves diferentes nao compartilham buckets", async () => {
		const store = new MemoryLoginAttemptStore();
		await store.record("login", "user-a", 60_000, 5);
		await store.record("other", "user-a", 60_000, 5);
		expect((await store.peek("other", "user-a", 60_000)).count).toBe(1);
	});
});
