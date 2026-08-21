import { env } from "../../env";
import { ConstructionError } from "../../lib/errors";
import { passwordPolicy } from "../../lib/password-policy";
import { userService } from "../users/service";

export type AdminRegistrationInput = {
	email: string;
	password: string;
	authorizationKey: string;
};

type AdminRegistrationResponse = {
	id: string;
	name: string;
	email: string;
	role: string;
	emailVerified: boolean;
};

function constantTimeEquals(left: string, right: string): boolean {
	const leftBytes = new TextEncoder().encode(left);
	const rightBytes = new TextEncoder().encode(right);
	const length = Math.max(leftBytes.length, rightBytes.length);
	let difference = leftBytes.length ^ rightBytes.length;

	for (let index = 0; index < length; index += 1) {
		difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
	}

	return difference === 0;
}

export const adminRegistrationService = {
	async create(
		input: AdminRegistrationInput,
	): Promise<AdminRegistrationResponse> {
		if (
			!constantTimeEquals(input.authorizationKey, env.ADMIN_REGISTRATION_KEY)
		) {
			throw new ConstructionError(
				"INVALID_ADMIN_REGISTRATION_KEY",
				"Chave de autorizacao invalida",
				403,
			);
		}

		const passwordError = passwordPolicy.validate(input.password);
		if (typeof passwordError === "string") {
			throw new ConstructionError("INVALID_PASSWORD", passwordError, 422);
		}

		const email = input.email.trim().toLowerCase();
		const user = await userService.create({
			name: "Administrador",
			email,
			password: input.password,
			role: "ADMIN",
		});

		return {
			id: user.id,
			name: user.name,
			email: user.email,
			role: user.role,
			emailVerified: user.emailVerified,
		};
	},
};
