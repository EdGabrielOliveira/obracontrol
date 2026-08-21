import { createHash } from "node:crypto";
import {
	type LoginAttemptStore,
	MemoryLoginAttemptStore,
} from "./login-attempt-store";

export const MAX_LOGIN_ATTEMPTS = 5;
export const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;
const ATTEMPT_KEY = "login";

const storePromise: Promise<LoginAttemptStore> = Promise.resolve(
	new MemoryLoginAttemptStore(),
);

async function attemptStore(): Promise<LoginAttemptStore> {
	return storePromise;
}

function emailKey(email: string): string {
	return email.toLowerCase();
}

export async function checkLoginBruteForce(
	email: string,
	options: { max?: number; windowMs?: number } = {},
): Promise<boolean> {
	const max = options.max ?? MAX_LOGIN_ATTEMPTS;
	const windowMs = options.windowMs ?? LOGIN_LOCKOUT_MS;
	const { count } = await (await attemptStore()).peek(
		ATTEMPT_KEY,
		emailKey(email),
		windowMs,
	);
	return count < max;
}

export async function recordLoginFailure(
	email: string,
	options: { max?: number; windowMs?: number } = {},
): Promise<{ allowed: boolean; count: number }> {
	const max = options.max ?? MAX_LOGIN_ATTEMPTS;
	const windowMs = options.windowMs ?? LOGIN_LOCKOUT_MS;
	const result = await (await attemptStore()).record(
		ATTEMPT_KEY,
		emailKey(email),
		windowMs,
		max,
	);
	return { allowed: result.allowed, count: result.count };
}

export async function clearLoginAttempts(email: string): Promise<void> {
	await (await attemptStore()).clear(ATTEMPT_KEY, emailKey(email));
}

export function hashLoginEmail(email: string): string {
	return createHash("sha256").update(email.toLowerCase()).digest("hex");
}

function validatePasswordStrength(password: string): string | null {
	if (password.length < 8) return "A senha deve ter pelo menos 8 caracteres";
	if (!/[A-Z]/.test(password))
		return "A senha deve conter pelo menos 1 letra maiuscula";
	if (!/[a-z]/.test(password))
		return "A senha deve conter pelo menos 1 letra minuscula";
	if (!/[0-9]/.test(password)) return "A senha deve conter pelo menos 1 numero";
	return null;
}

export const passwordPolicy = {
	validate: (password: string) => {
		const error = validatePasswordStrength(password);
		if (error) return error;
		return true;
	},
};
