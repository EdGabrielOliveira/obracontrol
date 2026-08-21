import { beforeEach, describe, expect, it, mock } from "bun:test";

const create = mock(async () => ({
	id: "admin-1",
	name: "Administrador",
	email: "admin@example.com",
	role: "ADMIN",
	emailVerified: true,
}));

mock.module("../../../../src/env", () => ({
	env: {
		TRUSTED_PROXY: null,
	},
}));
mock.module("../../../../src/modules/auth/admin-registration.service", () => ({
	adminRegistrationService: { create },
}));

const { adminRegistrationRoutes } = await import(
	"../../../../src/modules/auth/admin-registration.routes"
);

describe("admin registration route", () => {
	beforeEach(() => mock.clearAllMocks());

	it("exposes the public POST contract without creating a session", async () => {
		const response = await adminRegistrationRoutes.handle(
			new Request("http://localhost/api/auth/admin-signup", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					email: "admin@example.com",
					password: "SenhaForte123",
					authorizationKey: "authorization-key",
				}),
			}),
		);

		expect(response.status).toBe(201);
		expect(await response.json()).toEqual({
			id: "admin-1",
			name: "Administrador",
			email: "admin@example.com",
			role: "ADMIN",
			emailVerified: true,
		});
		expect(create).toHaveBeenCalledWith({
			email: "admin@example.com",
			password: "SenhaForte123",
			authorizationKey: "authorization-key",
		});
	});
});
