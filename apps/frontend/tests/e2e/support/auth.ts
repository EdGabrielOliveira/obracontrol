import { expect, type Page } from "@playwright/test";

export type E2eCredentials = {
	email: string;
	password: string;
};

export const visualE2eCredentials: E2eCredentials = {
	email: process.env.E2E_TEST_EMAIL ?? "admin@e2e.obra.bi",
	password: process.env.E2E_TEST_PASSWORD ?? "SenhaForte123",
};

export async function signIn(
	page: Page,
	credentials: E2eCredentials,
): Promise<void> {
	await page.goto("/auth/login");
	await page.getByLabel("Email").fill(credentials.email);
	await page.getByLabel("Senha").fill(credentials.password);
	await page.getByRole("button", { name: "Entrar" }).click();
	await expect(page).toHaveURL(/\/app(?:\/dashboard)?(?:\?|$)/);
}
