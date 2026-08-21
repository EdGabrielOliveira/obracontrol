import { expect, test } from "@playwright/test";
import { signIn, visualE2eCredentials } from "../support/auth";

const preview = {
	batchId: "e2e-batch-1",
	batchVersion: 1,
	model: "custos",
	version: "1.0",
	fileSha256: "a".repeat(64),
	expiresAt: "2099-01-01T00:00:00.000Z",
	page: 1,
	pageSize: 100,
	rows: [
		{
			id: "row-1",
			sheet: "Custos Realizados",
			rowNumber: 2,
			values: { Descrição: "Custo E2E", Valor: 100 },
			status: "VALID",
			issues: [],
		},
	],
	summary: { total: 1, valid: 1, invalid: 0, warnings: 0 },
	impact: { create: 1, update: 0, reject: 0, amount: "100" },
};

test("importa planilha com preview e confirmação", async ({ page }) => {
	await signIn(page, visualE2eCredentials);
	await page.goto("/app/obras");
	const workLink = page.getByRole("link", { name: "Obra A" }).first();
	await expect(workLink).toBeVisible();
	const workPath = await workLink.getAttribute("href");
	if (!workPath) throw new Error("Obra sem link de detalhe");

	await page.route("**/construction/works/*/import-batches", async (route) => {
		if (route.request().method() !== "POST") return route.continue();
		await route.fulfill({
			status: 201,
			contentType: "application/json",
			body: JSON.stringify(preview),
		});
	});
	await page.route(
		"**/construction/works/*/import-batches/e2e-batch-1/selectable-row-ids",
		(route) =>
			route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({ batchId: "e2e-batch-1", rowIds: ["row-1"] }),
			}),
	);
	await page.route(
		"**/construction/works/*/import-batches/e2e-batch-1**",
		async (route) => {
			if (route.request().url().includes("selectable-row-ids")) {
				return route.fulfill({
					status: 200,
					contentType: "application/json",
					body: JSON.stringify({ batchId: "e2e-batch-1", rowIds: ["row-1"] }),
				});
			}
			if (route.request().method() === "GET") {
				return route.fulfill({
					status: 200,
					contentType: "application/json",
					body: JSON.stringify(preview),
				});
			}
			if (route.request().method() === "POST") {
				return route.fulfill({
					status: 200,
					contentType: "application/json",
					body: JSON.stringify({
						importId: "e2e-import-1",
						approvalRequestId: null,
						status: "APPROVED",
					}),
				});
			}
			return route.continue();
		},
	);

	await page.goto(`${workPath}/custos`);
	await page.getByRole("button", { name: "Importar planilha" }).click();
	await expect(page.getByRole("dialog")).toBeVisible();
	await page
		.locator('input[type="file"]')
		.setInputFiles({
			name: "custos-e2e.xlsx",
			mimeType:
				"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			buffer: Buffer.from("e2e-fixture"),
		});

	await expect(page.getByText("Custo E2E")).toBeVisible();
	await expect(
		page.getByRole("button", { name: /Confirmar/ }),
	).toBeEnabled();
	await page.getByRole("button", { name: /Confirmar/ }).click();
	await expect(page.getByText(/Importa.*confirmada/)).toBeVisible();
});

test("exporta o workbook completo e inicia o download", async ({ page }) => {
	await signIn(page, visualE2eCredentials);
	await page.goto("/app/obras");
	const workLink = page.getByRole("link", { name: "Obra A" }).first();
	const workPath = await workLink.getAttribute("href");
	if (!workPath) throw new Error("Obra sem link de detalhe");

	await page.route("**/construction/works/*/export/completo**", (route) =>
		route.fulfill({
			status: 200,
			contentType:
				"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			headers: {
				"Content-Disposition": 'attachment; filename="obra-completa.xlsx"',
			},
			body: Buffer.from("PK\\u0003\\u0004e2e-workbook"),
		}),
	);

	await page.goto(`${workPath}/configuracoes?tab=relatorios`);
	const downloadPromise = page.waitForEvent("download");
	await page.getByRole("button", { name: "Completo", exact: true }).click();
	const download = await downloadPromise;
	await expect.poll(() => download.suggestedFilename()).toBe("obra-completa.xlsx");
});
