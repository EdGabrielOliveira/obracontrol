import { expect, test } from "@playwright/test";
import { signIn, visualE2eCredentials } from "../support/auth";

test("mantém a navegação global disponível dentro do contexto da obra", async ({
	page,
}) => {
	await signIn(page, visualE2eCredentials);
	await page.goto("/app/obras");
	await page.getByRole("link", { name: "Obra A", exact: true }).click();

	await expect(page.getByRole("link", { name: "Início", exact: true })).toBeVisible();
	await expect(
		page.getByRole("link", { name: "Notificações", exact: true }),
	).toBeVisible();
});
