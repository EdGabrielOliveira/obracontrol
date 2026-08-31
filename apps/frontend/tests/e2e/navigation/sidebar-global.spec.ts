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

test("abre orçamento imediatamente mesmo com a API atrasada", async ({
	page,
}) => {
	await signIn(page, visualE2eCredentials);
	await page.goto("/app/obras");
	await page.getByRole("link", { name: "Obra A", exact: true }).click();
	await expect(page).toHaveURL(/\/app\/obras\/[^/]+/);

	await page.route("**/construction/works/*/budget**", async (route) => {
		if (route.request().method() !== "GET") {
			await route.continue();
			return;
		}
		await new Promise((resolve) => setTimeout(resolve, 3000));
		await route.continue();
	});

	const startedAt = performance.now();
	await page.getByRole("link", { name: "Orçamento", exact: true }).click();
	await expect(page).toHaveURL(/\/orcamento(?:\?|$)/, { timeout: 500 });
	expect(performance.now() - startedAt).toBeLessThan(200);
	await expect(page.getByRole("status")).toBeVisible({ timeout: 1000 });
});
