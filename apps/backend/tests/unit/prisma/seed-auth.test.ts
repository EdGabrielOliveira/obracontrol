import { describe, expect, it } from "bun:test";
import { createSeedUsers } from "../../../prisma/seed-auth";

describe("createSeedUsers", () => {
	it("creates credential accounts without using public sign-up", async () => {
		const users: Array<{
			key: string;
			email: string;
			name: string;
			role: string;
		}> = [
			{
				key: "admin",
				email: "admin@example.com",
				name: "Admin",
				role: "ADMIN",
			},
		];
		const createdUsers: Array<Record<string, unknown>> = [];
		const createdAccounts: Array<Record<string, unknown>> = [];

		const client = {
			user: {
				create: async ({ data }: { data: Record<string, unknown> }) => {
					createdUsers.push(data);
					return { id: data.id as string };
				},
			},
			account: {
				create: async ({ data }: { data: Record<string, unknown> }) => {
					createdAccounts.push(data);
				},
			},
		};

		const ids = await createSeedUsers(client, users, "ObraControl@2026");

		expect(ids.get("admin")).toBe("seed-admin");
		expect(createdUsers).toEqual([
			{
				id: "seed-admin",
				email: "admin@example.com",
				name: "Admin",
				emailVerified: true,
				role: "ADMIN",
			},
		]);
		expect(createdAccounts).toHaveLength(1);
		expect(createdAccounts[0]).toMatchObject({
			id: "credential-seed-admin",
			userId: "seed-admin",
			accountId: "admin@example.com",
			providerId: "credential",
		});
		expect(
			await Bun.password.verify(
				"ObraControl@2026",
				createdAccounts[0].password as string,
			),
		).toBe(true);
	});
});
