import { describe, expect, it } from "bun:test";
import { redact } from "../../../src/lib/redact";

describe("redact", () => {
	it("redacts sensitive keys at the top level", () => {
		expect(redact({ password: "abc", name: "Obra A" })).toEqual({
			password: "[redacted]",
			name: "Obra A",
		});
	});

	it("redacts sensitive keys nested inside objects and arrays", () => {
		const input = {
			work: { name: "Obra", budget: { items: [{ apiKey: "k", value: 10 }] } },
			token: "tok",
			docs: [{ cpf: "123" }, { cnpj: "456" }],
		};

		const result = redact(input) as Record<string, unknown>;
		const work = result.work as Record<string, unknown>;
		const budget = work.budget as Record<string, unknown>;
		const items = budget.items as Array<Record<string, unknown>>;

		expect(items[0].apiKey).toBe("[redacted]");
		expect(items[0].value).toBe(10);
		expect(work.name).toBe("Obra");
		expect(result.token).toBe("[redacted]");
		const docs = result.docs as Array<Record<string, unknown>>;
		expect(docs[0].cpf).toBe("[redacted]");
		expect(docs[1].cnpj).toBe("[redacted]");
	});

	it("redacts case-insensitive variants such as API_KEY, keyHash and secret", () => {
		expect(redact({ API_KEY: "k", keyHash: "h", secret: "s" })).toEqual({
			API_KEY: "[redacted]",
			keyHash: "[redacted]",
			secret: "[redacted]",
		});
	});

	it("preserves primitives and non-sensitive structures", () => {
		expect(redact("plain")).toBe("plain");
		expect(redact(null)).toBe(null);
		expect(redact(42)).toBe(42);
		expect(redact([1, "two", { a: 1 }])).toEqual([1, "two", { a: 1 }]);
	});

	it("does not mutate the original object", () => {
		const input = { password: "abc", nested: { token: "t" } };
		redact(input);
		expect(input).toEqual({ password: "abc", nested: { token: "t" } });
	});

	it("passes through class instances such as Prisma Decimal untouched", () => {
		class DecimalLike {
			s = 1;
			e = 0;
			d = [10];

			toJSON() {
				return 10;
			}
		}
		const decimal = new DecimalLike();

		const result = redact({ quantity: decimal, nested: { amount: decimal } });

		expect(result.quantity).toBe(decimal);
		expect((result.nested as Record<string, unknown>).amount).toBe(decimal);
	});

	it("passes through Date instances untouched", () => {
		const date = new Date("2026-01-01T00:00:00.000Z");
		const result = redact({ createdAt: date });
		expect(result.createdAt).toBe(date);
	});
});
