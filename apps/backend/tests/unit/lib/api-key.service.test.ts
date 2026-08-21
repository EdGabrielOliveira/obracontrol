import { beforeEach, describe, expect, it, mock } from "bun:test";
import { createHash } from "node:crypto";

const findFirst = mock(async (): Promise<unknown> => null);
const update = mock(async () => ({}));
const organizationFindFirst = mock(async (): Promise<unknown> => null);
const apiKeyCreate = mock(async () => ({}));

mock.module("../../../src/lib/prisma", () => ({
	prisma: {
		apiKey: {
			create: apiKeyCreate,
			findMany: mock(async () => []),
			count: mock(async () => 0),
			findFirst,
			update,
			deleteMany: mock(async () => ({ count: 0 })),
		},
		organization: { findFirst: organizationFindFirst },
	},
}));

const { ApiKeyService } = await import("../../../src/lib/api-key.service");
const service = new ApiKeyService();

function makeKey() {
	const raw = Buffer.from("0123456789abcdef0123456789abcdef").toString(
		"base64url",
	);
	const fullKey = `obi_${raw}`;
	const prefix = fullKey.slice(0, 11);
	const hash = createHash("sha256").update(fullKey).digest("hex");
	return { fullKey, prefix, hash };
}

describe("ApiKeyService.validateKey", () => {
	beforeEach(() => {
		mock.clearAllMocks();
	});

	it("returns the key identity when the stored hash matches", async () => {
		const { fullKey, prefix, hash } = makeKey();
		findFirst.mockResolvedValue({
			id: "k1",
			ownerId: "o1",
			userId: "u1",
			keyHash: hash,
			expiresAt: null,
			revokedAt: null,
		});

		const result = await service.validateKey(fullKey);

		expect(findFirst).toHaveBeenCalledWith({
			where: { keyPrefix: prefix, revokedAt: null },
		});
		expect(result).toEqual({ ownerId: "o1", userId: "u1", keyId: "k1" });
		expect(update).toHaveBeenCalledWith({
			where: { id: "k1" },
			data: { lastUsedAt: expect.any(Date) },
		});
	});

	it("returns null when the stored hash differs", async () => {
		const { fullKey } = makeKey();
		findFirst.mockResolvedValue({
			id: "k1",
			ownerId: "o1",
			userId: "u1",
			keyHash: "ff".repeat(32),
			expiresAt: null,
			revokedAt: null,
		});

		expect(await service.validateKey(fullKey)).toBeNull();
	});

	it("returns null when the key is expired", async () => {
		const { fullKey, hash } = makeKey();
		findFirst.mockResolvedValue({
			id: "k1",
			ownerId: "o1",
			userId: "u1",
			keyHash: hash,
			expiresAt: new Date(Date.now() - 1000),
			revokedAt: null,
		});

		expect(await service.validateKey(fullKey)).toBeNull();
	});

	it("returns null for a key without the expected prefix", async () => {
		expect(await service.validateKey(`sk_${"x".repeat(40)}`)).toBeNull();
		expect(findFirst).not.toHaveBeenCalled();
	});
});

describe("ApiKeyService organization scope", () => {
	beforeEach(() => mock.clearAllMocks());

	it("rejects a scope without active membership", async () => {
		await expect(
			service.createKey("owner", "user", {
				name: "integration",
				organizationId: "org-other",
			}),
		).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
		expect(apiKeyCreate).not.toHaveBeenCalled();
	});

	it("persists the selected organization scope", async () => {
		organizationFindFirst.mockResolvedValue({ id: "org-1" });
		await service.createKey("owner", "user", {
			name: "integration",
			organizationId: "org-1",
		});
		expect(apiKeyCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ organizationId: "org-1" }),
			}),
		);
	});
});
