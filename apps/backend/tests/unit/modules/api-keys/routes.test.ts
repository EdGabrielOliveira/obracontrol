import { beforeEach, describe, expect, it, mock } from "bun:test";
import { ConstructionError } from "../../../../src/lib/errors";

const getSessionUser = mock(
	async (): Promise<{ id: string; role?: string }> => ({
		id: "seed-admin-user",
		role: "ADMIN",
	}),
);
const findUser = mock(async () => ({ role: "ADMIN" }));

const listKeys = mock(
	async (): Promise<{
		data: Array<Record<string, unknown>>;
		total: number;
		page: number;
		limit: number;
		totalPages: number;
		hasNextPage: boolean;
		hasPreviousPage: boolean;
	}> => ({
		data: [],
		total: 0,
		page: 1,
		limit: 10,
		totalPages: 0,
		hasNextPage: false,
		hasPreviousPage: false,
	}),
);

mock.module("../../../../src/lib/auth", () => ({
	auth: {
		api: { getSession: mock(async () => null) },
	},
}));

mock.module("../../../../src/lib/auth-middleware", () => ({
	getSessionUser,
}));

mock.module("../../../../src/lib/prisma", () => ({
	prisma: {
		user: { findUnique: findUser },
		apiKey: {
			create: mock(async () => ({})),
			findMany: mock(async () => []),
			count: mock(async () => 0),
			findFirst: mock(async () => null),
			update: mock(async () => ({})),
			deleteMany: mock(async () => ({ count: 0 })),
		},
	},
}));

mock.module("../../../../src/lib/api-key.service", () => ({
	apiKeyService: {
		createKey: mock(async () => ({
			id: "obi_key_000",
			name: "",
			key: "obi_ignored_in_tests",
			expiresAt: null,
		})),
		listKeys,
		getKey: mock(async () => ({})),
		revokeKey: mock(async () => ({ revoked: true })),
		validateKey: mock(async () => null),
		deleteExpired: mock(async () => 0),
	},
}));

describe("apiKeyRoutes", () => {
	beforeEach(() => {
		mock.clearAllMocks();
		getSessionUser.mockResolvedValue({ id: "seed-admin-user", role: "ADMIN" });
		findUser.mockResolvedValue({ role: "ADMIN" });
	});

	it("permits GET /api-keys for ADMIN", async () => {
		const { apiKeyRoutes } = await import(
			"../../../../src/modules/api-keys/routes"
		);

		const response = await apiKeyRoutes.handle(
			new Request("http://localhost/api-keys?page=1&limit=20"),
		);

		expect(response.status).toBe(200);
		const json = await response.json();
		expect(json.data).toBeArray();
		expect(listKeys).toHaveBeenCalledWith(
			"seed-admin-user",
			"seed-admin-user",
			{
				page: 1,
				limit: 20,
			},
		);
	});

	it("returns 403 for GERENTE on GET /api-keys", async () => {
		getSessionUser.mockResolvedValue({
			id: "seed-admin-user",
			role: "GERENTE",
		});
		findUser.mockResolvedValue({ role: "GERENTE" });
		const { apiKeyRoutes } = await import(
			"../../../../src/modules/api-keys/routes"
		);

		const response = await apiKeyRoutes.handle(
			new Request("http://localhost/api-keys?page=1&limit=20"),
		);

		expect(response.status).toBe(403);
		expect(await response.json()).toEqual({
			message: "Voce nao tem permissao para executar esta acao",
			errors: [],
		});
		expect(listKeys).not.toHaveBeenCalled();
	});

	it("loads role from the database when the session user has no role", async () => {
		getSessionUser.mockResolvedValue({ id: "seed-admin-user" });
		findUser.mockResolvedValueOnce({ role: "GERENTE" });
		const { apiKeyRoutes } = await import(
			"../../../../src/modules/api-keys/routes"
		);

		const forbidden = await apiKeyRoutes.handle(
			new Request("http://localhost/api-keys"),
		);
		expect(forbidden.status).toBe(403);
		expect(listKeys).not.toHaveBeenCalled();

		findUser.mockResolvedValueOnce({ role: "ADMIN" });
		const allowed = await apiKeyRoutes.handle(
			new Request("http://localhost/api-keys"),
		);
		expect(allowed.status).toBe(200);
		expect(findUser).toHaveBeenCalledWith({
			where: { id: "seed-admin-user" },
			select: { role: true, banned: true },
		});
	});

	it("returns 401 when not authenticated", async () => {
		getSessionUser.mockImplementationOnce(async () => {
			throw new ConstructionError("UNAUTHORIZED", "Login obrigatorio", 401);
		});
		const { apiKeyRoutes } = await import(
			"../../../../src/modules/api-keys/routes"
		);

		const response = await apiKeyRoutes.handle(
			new Request("http://localhost/api-keys"),
		);

		expect(response.status).toBe(401);
		expect(listKeys).not.toHaveBeenCalled();
	});
});
