import { expect, test } from "@playwright/test";
import { signIn, visualE2eCredentials } from "../support/auth";

test("renderiza os dashboards e relatórios críticos com valores visíveis", async ({
	page,
}) => {
	await signIn(page, visualE2eCredentials);

	await expect(
		page.getByRole("heading", { name: "ObraControl", exact: true }),
	).toBeVisible();
	await expect(page.getByText("Total cadastrado").first()).toBeVisible();
	await page.screenshot({
		path: "test-results/visual/dashboard-critical.png",
		fullPage: true,
	});

	await page.goto("/app/obras");
	const firstWork = page.getByRole("link", { name: "Obra A" }).first();
	await expect(firstWork).toBeVisible();
	await firstWork.click();
	await expect(page).toHaveURL(/\/app\/obras\/[^/]+/);
	const workUrl = new URL(page.url()).pathname;
	await page.goto(`${workUrl}/orcamento`);
	await expect(page.getByText("Total medido")).toBeVisible();
	await page.screenshot({
		path: "test-results/visual/budget-critical.png",
		fullPage: true,
	});

	await page.goto("/app/centros-de-custo");
	const firstCostCenter = page
		.getByRole("link", { name: "Centro de Custo A" })
		.first();
	await expect(firstCostCenter).toBeVisible();
	const costCenterHref = await firstCostCenter.getAttribute("href");
	if (!costCenterHref) throw new Error("Centro de custo sem link de detalhe");
	await page.goto(`${costCenterHref}/relatorios`);
	await expect(page.getByText("Relatório do Centro de Custo")).toBeVisible();
	await expect(page.getByText("Orçamento Total")).toBeVisible();
	await expect(page.getByText("Total Gasto")).toBeVisible();
	await page.screenshot({
		path: "test-results/visual/cost-center-report-critical.png",
		fullPage: true,
	});
});
