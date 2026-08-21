import { createHash, timingSafeEqual } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { ConstructionError } from "./errors";
import { buildPaginatedResponse } from "./pagination";
import { prisma } from "./prisma";

const API_KEY_PREFIX = "obi_";
const KEY_LENGTH = 32;

function hashEqualHex(computed: string, stored: string): boolean {
	const computedBuffer = Buffer.from(computed, "hex");
	const storedBuffer = Buffer.from(stored, "hex");
	if (computedBuffer.length !== storedBuffer.length) return false;
	return timingSafeEqual(computedBuffer, storedBuffer);
}

function generateApiKey(): { prefix: string; fullKey: string; hash: string } {
	const raw = Buffer.from(
		crypto.getRandomValues(new Uint8Array(KEY_LENGTH)),
	).toString("base64url");
	const fullKey = `${API_KEY_PREFIX}${raw}`;
	const prefix = fullKey.slice(0, 11);
	const hash = createHash("sha256").update(fullKey).digest("hex");
	return { prefix, fullKey, hash };
}

export class ApiKeyService {
	async createKey(
		ownerId: string,
		userId: string,
		input: { name: string; expiresInDays?: number; organizationId?: string },
	) {
		if (input.organizationId) {
			const membership = await prisma.organization.findFirst({
				where: {
					id: input.organizationId,
					OR: [
						{ ownerId: userId },
						{ memberships: { some: { userId, revokedAt: null } } },
					],
				},
				select: { id: true },
			});
			if (!membership) {
				throw new ConstructionError(
					"FORBIDDEN",
					"Usuário não possui membership ativa nesta organização",
					403,
				);
			}
		}
		const { prefix, fullKey, hash } = generateApiKey();

		const expiresAt = input.expiresInDays
			? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
			: null;

		await prisma.apiKey.create({
			data: {
				ownerId,
				userId,
				name: input.name,
				keyPrefix: prefix,
				keyHash: hash,
				organizationId: input.organizationId ?? null,
				expiresAt,
			},
		});

		return {
			id: prefix,
			name: input.name,
			key: fullKey,
			expiresAt: expiresAt?.toISOString() ?? null,
		};
	}

	async listKeys(
		ownerId: string,
		userId: string,
		filters: { q?: string; page?: number; limit?: number } = {},
	) {
		const where: Record<string, unknown> = { ownerId, userId, revokedAt: null };
		if (filters.q) {
			where.AND = [{ name: { contains: filters.q } }];
		}
		const page = filters.page ?? 1;
		const limit = filters.limit ?? 10;

		const [data, total] = await Promise.all([
			prisma.apiKey.findMany({
				where: where as Prisma.ApiKeyWhereInput,
				select: {
					id: true,
					keyPrefix: true,
					name: true,
					lastUsedAt: true,
					expiresAt: true,
					createdAt: true,
					organizationId: true,
				},
				orderBy: { createdAt: "desc" },
				skip: (page - 1) * limit,
				take: limit,
			}),
			prisma.apiKey.count({
				where: where as Prisma.ApiKeyWhereInput,
			}),
		]);

		return buildPaginatedResponse(data, total, page, limit);
	}

	async getKey(ownerId: string, userId: string, keyId: string) {
		const key = await prisma.apiKey.findFirst({
			where: { id: keyId, ownerId, userId },
			select: {
				id: true,
				keyPrefix: true,
				name: true,
				lastUsedAt: true,
				expiresAt: true,
				createdAt: true,
				organizationId: true,
			},
		});
		if (!key) {
			throw new ConstructionError("NOT_FOUND", "Chave nao encontrada", 404);
		}
		return key;
	}

	async revokeKey(ownerId: string, userId: string, keyId: string) {
		const key = await prisma.apiKey.findFirst({
			where: { id: keyId, ownerId, userId },
		});
		if (!key) {
			throw new ConstructionError("NOT_FOUND", "Chave nao encontrada", 404);
		}

		await prisma.apiKey.update({
			where: { id: keyId },
			data: { revokedAt: new Date() },
		});

		return { revoked: true };
	}

	async validateKey(fullKey: string): Promise<{
		ownerId: string;
		userId: string;
		keyId: string;
		organizationId?: string | null;
	} | null> {
		if (!fullKey.startsWith(API_KEY_PREFIX)) return null;

		const prefix = fullKey.slice(0, 11);
		const hash = createHash("sha256").update(fullKey).digest("hex");

		const key = await prisma.apiKey.findFirst({
			where: { keyPrefix: prefix, revokedAt: null },
		});

		if (!key) return null;
		if (!hashEqualHex(hash, key.keyHash)) return null;

		if (key.expiresAt && key.expiresAt < new Date()) return null;

		// Update lastUsedAt asynchronously — don't block the request
		prisma.apiKey
			.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
			.catch(() => {
				// Silently ignore update failure
			});

		return {
			ownerId: key.ownerId,
			userId: key.userId,
			keyId: key.id,
			organizationId: key.organizationId,
		};
	}

	async deleteExpired() {
		const result = await prisma.apiKey.deleteMany({
			where: {
				OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { not: null } }],
			},
		});
		return result.count;
	}
}

export const apiKeyService = new ApiKeyService();
