import { beforeEach, describe, expect, it, mock } from "bun:test";

const createUser = mock(async () => ({
	id: "admin-1",
	name: "Administrador",
	email: "admin@example.com",
	role: "ADMIN",
	emailVerified: true,
}));

mock.module("../../../../src/env", () => ({
	env: {
		ADMIN_REGISTRATION_KEY: "authorization-key-for-tests",
	},
}));
mock.module("../../../../src/modules/users/service", () => ({
	userService: { create: createUser },
}));

const { adminRegistrationService } = await import(
	"../../../../src/modules/auth/admin-registration.service"
);

describe("admin registration service", () => {
	beforeEach(() => mock.clearAllMocks());

	it("creates an ADMIN with a verified email after validating the key", async () => {
		const result = await adminRegistrationService.create({
			email: " Admin@Example.com ",
			password: "SenhaForte123",
			authorizationKey: "authorization-key-for-tests",
		});

		expect(createUser).toHaveBeenCalledWith({
			name: "Administrador",
			email: "admin@example.com",
			password: "SenhaForte123",
			role: "ADMIN",
		});
		expect(result).toEqual({
			id: "admin-1",
			name: "Administrador",
			email: "admin@example.com",
			role: "ADMIN",
			emailVerified: true,
		});
	});

	it("rejects an invalid authorization key without creating a user", async () => {
		await expect(
			adminRegistrationService.create({
				email: "admin@example.com",
				password: "SenhaForte123",
				authorizationKey: "wrong-key",
			}),
		).rejects.toMatchObject({
			code: "INVALID_ADMIN_REGISTRATION_KEY",
			status: 403,
		});
		expect(createUser).not.toHaveBeenCalled();
	});

	it("rejects a password outside the existing password policy", async () => {
		await expect(
			adminRegistrationService.create({
				email: "admin@example.com",
				password: "fraca",
				authorizationKey: "authorization-key-for-tests",
			}),
		).rejects.toMatchObject({ code: "INVALID_PASSWORD", status: 422 });
		expect(createUser).not.toHaveBeenCalled();
	});
});
