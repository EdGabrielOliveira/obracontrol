import { api } from "./api";

export type AdminRegistrationInput = {
	email: string;
	password: string;
	authorizationKey: string;
};

export type AdminRegistrationResponse = {
	id: string;
	name: string;
	email: string;
	role: "ADMIN";
	emailVerified: boolean;
};

export async function registerAdminAccount(
	input: AdminRegistrationInput,
): Promise<AdminRegistrationResponse> {
	const { data } = await api.post<AdminRegistrationResponse>(
		"/api/auth/admin-signup",
		input,
	);
	return data;
}
