import { expect, test } from "@playwright/test";
import { signIn } from "../support/auth";

const E2E_EMAIL = "owner-a@e2e.obra.bi";
const E2E_PASSWORD = "SenhaForte123";

test.describe("autenticação e isolamento de escopo", () => {
	test("redireciona usuário anônimo para o login", async ({ page }) => {
		await page.goto("/app");

		await expect(page).toHaveURL(/\/auth\/login\?redirect=%2Fapp/);
		await expect(page.getByLabel("Email")).toBeVisible();
	});

	test("faz login e carrega a tela inicial", async ({ page }) => {
		await signIn(page, { email: E2E_EMAIL, password: E2E_PASSWORD });

		await expect(page).toHaveTitle("Dashboard - ObraControl");
		await expect(page.getByRole("heading", { name: "ObraControl" })).toBeVisible();
		await expect(page.getByRole("link", { name: "Obras", exact: true })).toBeVisible();
		await expect(
			page.getByRole("link", { name: "Auditoria", exact: true }),
		).toBeVisible();
	});

	test("mantém o isolamento de obras entre owners", async ({ page }) => {
		await signIn(page, { email: E2E_EMAIL, password: E2E_PASSWORD });

		const response = await page.request.get(
			"/construction/works/00000000-0000-4000-8000-0000000000ad/overview",
		);
		await expect([403, 404]).toContain(response.status());
	});

	test("expõe o cronograma no contexto da obra", async ({ page }) => {
		await signIn(page, { email: E2E_EMAIL, password: E2E_PASSWORD });
		await page.goto("/app/obras");
		await page.getByRole("link", { name: "Obra A", exact: true }).click();

		await expect(page).toHaveURL(
			/\/app\/obras\/00000000-0000-4000-8000-0000000000a1(?:\?|$)/,
		);
		await page.goto(
			"/app/obras/00000000-0000-4000-8000-0000000000a1/cronograma",
		);
		await expect(
			page.getByRole("heading", {
				level: 1,
				name: "Editar cronograma",
				exact: true,
			}),
		).toBeVisible();
	});
});
