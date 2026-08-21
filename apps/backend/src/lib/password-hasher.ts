import bcrypt from "bcryptjs";

const PASSWORD_ROUNDS = 10;

/**
 * Runtime-neutral password hashing used by Better Auth and user provisioning.
 * bcryptjs preserves compatibility with the existing bcrypt hashes generated
 * by Bun while also running under the Workers Node compatibility layer.
 */
export async function hashPassword(password: string): Promise<string> {
	return bcrypt.hash(password, PASSWORD_ROUNDS);
}

export async function verifyPassword(
	hash: string,
	password: string,
): Promise<boolean> {
	return bcrypt.compare(password, hash);
}
