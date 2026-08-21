type SeedUser = {
	key: string;
	email: string;
	name: string;
	role: string;
};

type SeedAuthClient = {
	user: {
		create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
	};
	account: {
		create(args: { data: Record<string, unknown> }): Promise<unknown>;
	};
};

export async function createSeedUsers(
	client: SeedAuthClient,
	users: readonly SeedUser[],
	password: string,
): Promise<Map<string, string>> {
	const passwordHash = await Bun.password.hash(password, {
		algorithm: "bcrypt",
		cost: 10,
	});
	const userIdByKey = new Map<string, string>();

	for (const user of users) {
		const id = `seed-${user.key}`;
		const createdUser = await client.user.create({
			data: {
				id,
				email: user.email,
				name: user.name,
				emailVerified: true,
				role: user.role,
			},
		});
		await client.account.create({
			data: {
				id: `credential-${createdUser.id}`,
				userId: createdUser.id,
				accountId: createdUser.id,
				providerId: "credential",
				issuer: "local:credential",
				password: passwordHash,
			},
		});
		userIdByKey.set(user.key, createdUser.id);
	}

	return userIdByKey;
}
