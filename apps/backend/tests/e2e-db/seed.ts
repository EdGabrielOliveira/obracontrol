import { auth } from "../../src/lib/auth";
import { prisma } from "../../src/lib/prisma";

export const OWNER_A = "e2e-owner-a";
export const OWNER_B = "e2e-owner-b";
export const GESTOR_USER = "e2e-user-gestor";
export const ADMIN_USER = "e2e-user-admin";
export const SUPERVISOR_USER = "e2e-user-supervisor";

export const CC_A = "e2e-cc-a";
export const ORG_A = "e2e-org-a";
export const COMPANY_A = "e2e-company-a";
export const WORK_A = "00000000-0000-4000-8000-0000000000a1";
export const WORK_B = "00000000-0000-4000-8000-0000000000b1";
export const IMPORT_A = "e2e-import-a";
export const IMPORT_B = "e2e-import-b";
export const ITEM_A_STAGE = "e2e-item-a-stage";
export const ITEM_A1 = "e2e-item-a1";
export const ITEM_B_STAGE = "e2e-item-b-stage";
export const ITEM_B1 = "e2e-item-b1";
export const CONTRACT_A = "e2e-contract-a";
export const SERVICE_A1 = "e2e-service-a1";
export const WM_A1 = "e2e-wm-a1";

export const ORG_AD = "e2e-org-ad";
export const COMPANY_AD = "e2e-company-ad";
export const CC_AD = "e2e-cc-ad";
export const WORK_AD = "00000000-0000-4000-8000-0000000000ad";
export const IMPORT_AD = "e2e-import-ad";
export const ITEM_AD1 = "e2e-item-ad1";

export const TEST_PASSWORD =
	process.env.E2E_TEST_PASSWORD ?? ["Senha", "Forte", "123"].join("");

export const SEED_USERS = [
	{
		id: OWNER_A,
		email: "owner-a@e2e.obra.bi",
		name: "Owner A",
		role: "GERENTE",
	},
	{
		id: OWNER_B,
		email: "owner-b@e2e.obra.bi",
		name: "Owner B",
		role: "GERENTE",
	},
	{
		id: GESTOR_USER,
		email: "gestor@e2e.obra.bi",
		name: "Gestor",
		role: "GESTOR",
	},
	{
		id: SUPERVISOR_USER,
		email: "supervisor@e2e.obra.bi",
		name: "Supervisor",
		role: "SUPERVISOR",
	},
	{ id: ADMIN_USER, email: "admin@e2e.obra.bi", name: "Admin", role: "ADMIN" },
];

const sessionCookies: Record<string, string> = {};

export function sessionCookie(userId: string): string {
	const cookie = sessionCookies[userId];
	if (!cookie) {
		throw new Error(`Cookie de sessao nao criado para ${userId}`);
	}
	return cookie;
}

export async function truncateAllTables(): Promise<void> {
	const rows: Array<{ name: string }> = await prisma.$queryRaw`
		SELECT name FROM sqlite_master
		WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
	`;
	await prisma.$executeRaw`PRAGMA foreign_keys = OFF`;
	for (const row of rows) {
		if (row.name === "_prisma_migrations") continue;
		const escapedName = row.name.replaceAll('"', '""');
		await prisma.$executeRawUnsafe(`DELETE FROM "${escapedName}"`);
	}
	await prisma.$executeRaw`PRAGMA foreign_keys = ON`;
}

export async function resetAndSeedDatabase(): Promise<void> {
	await truncateAllTables();

	await prisma.user.createMany({
		data: SEED_USERS.map((user) => ({
			id: user.id,
			email: user.email,
			name: user.name,
			role: user.role,
			emailVerified: true,
		})),
	});

	const passwordHash = await Bun.password.hash(TEST_PASSWORD, {
		algorithm: "bcrypt",
		cost: 10,
	});
	for (const user of SEED_USERS) {
		await prisma.account.create({
			data: {
				id: `credential-${user.id}`,
				userId: user.id,
				accountId: user.email,
				providerId: "credential",
				password: passwordHash,
			},
		});
	}

	for (const user of SEED_USERS) {
		const loginResponse = await auth.handler(
			new Request("http://localhost:7000/api/auth/sign-in/email", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: user.email, password: TEST_PASSWORD }),
			}),
		);
		const setCookie = loginResponse.headers.get("set-cookie");
		if (!setCookie) {
			throw new Error(`Login de seed falhou para ${user.email}`);
		}
		sessionCookies[user.id] = setCookie.split(";")[0];
	}

	const [companyA, companyAd] = await Promise.all([
		prisma.company.create({
			data: {
				id: COMPANY_A,
				ownerId: OWNER_A,
				name: "Empresa A",
				contractTemplate: "modelo.docx",
				contractTemplateType: "DOCX",
				contractTemplateBlob: Buffer.from("PK\\u0003\\u0004e2e-docx"),
			},
		}),
		prisma.company.create({
			data: {
				id: COMPANY_AD,
				ownerId: ADMIN_USER,
				name: "Empresa Admin",
				contractTemplate: "modelo.docx",
				contractTemplateType: "DOCX",
				contractTemplateBlob: Buffer.from("PK\\u0003\\u0004e2e-docx"),
			},
		}),
	]);

	const [orgA, orgAd] = await Promise.all([
		prisma.organization.create({
			data: {
				id: ORG_A,
				ownerId: OWNER_A,
				name: "Organizacao A",
				companyId: companyA.id,
			},
		}),
		prisma.organization.create({
			data: {
				id: ORG_AD,
				ownerId: ADMIN_USER,
				name: "Organizacao Admin",
				companyId: companyAd.id,
			},
		}),
	]);

	const [ccA, ccAd] = await Promise.all([
		prisma.costCenter.create({
			data: {
				id: CC_A,
				ownerId: OWNER_A,
				name: "Centro de Custo A",
				organizationId: orgA.id,
			},
		}),
		prisma.costCenter.create({
			data: {
				id: CC_AD,
				ownerId: ADMIN_USER,
				name: "Centro de Custo Admin",
				organizationId: orgAd.id,
			},
		}),
	]);

	const [workA, workB, workAd] = await Promise.all([
		prisma.constructionWork.create({
			data: {
				id: WORK_A,
				ownerId: OWNER_A,
				code: "E2E-OBRA-A",
				name: "Obra A",
				costCenterId: ccA.id,
				baseDate: new Date("2026-01-01"),
				plannedStart: new Date("2026-01-01"),
				plannedEnd: new Date("2026-12-31"),
				areaM2: 500,
			},
		}),
		prisma.constructionWork.create({
			data: {
				id: WORK_B,
				ownerId: OWNER_A,
				code: "E2E-OBRA-B",
				name: "Obra B",
				costCenterId: ccA.id,
				baseDate: new Date("2026-01-01"),
				plannedStart: new Date("2026-01-01"),
				plannedEnd: new Date("2026-12-31"),
				areaM2: 800,
			},
		}),
		prisma.constructionWork.create({
			data: {
				id: WORK_AD,
				ownerId: ADMIN_USER,
				code: "E2E-OBRA-AD",
				name: "Obra Admin",
				costCenterId: ccAd.id,
				baseDate: new Date("2026-01-01"),
				plannedStart: new Date("2026-01-01"),
				plannedEnd: new Date("2026-12-31"),
				areaM2: 300,
			},
		}),
	]);

	const [importA, importB, importAd] = await Promise.all([
		prisma.constructionImport.create({
			data: {
				id: IMPORT_A,
				ownerId: OWNER_A,
				workId: workA.id,
				fileName: "seed-a.xlsx",
				sheetName: "seed-a.xlsx",
				rowCount: 2,
				importedSections: ["Obra", "Orcamento"],
				status: "IMPORTED",
			},
		}),
		prisma.constructionImport.create({
			data: {
				id: IMPORT_B,
				ownerId: OWNER_A,
				workId: workB.id,
				fileName: "seed-b.xlsx",
				sheetName: "seed-b.xlsx",
				rowCount: 2,
				importedSections: ["Obra", "Orcamento"],
				status: "IMPORTED",
			},
		}),
		prisma.constructionImport.create({
			data: {
				id: IMPORT_AD,
				ownerId: ADMIN_USER,
				workId: workAd.id,
				fileName: "seed-ad.xlsx",
				sheetName: "seed-ad.xlsx",
				rowCount: 1,
				importedSections: ["Obra", "Orcamento"],
				status: "IMPORTED",
			},
		}),
	]);

	await prisma.constructionWork.update({
		where: { id: workA.id },
		data: { activeImportId: importA.id },
	});
	await prisma.constructionWork.update({
		where: { id: workB.id },
		data: { activeImportId: importB.id },
	});
	await prisma.constructionWork.update({
		where: { id: workAd.id },
		data: { activeImportId: importAd.id },
	});

	await prisma.constructionBudgetItem.createMany({
		data: [
			{
				id: ITEM_A_STAGE,
				ownerId: OWNER_A,
				workId: workA.id,
				importId: importA.id,
				parentId: null,
				index: "1",
				type: "STAGE",
				description: "Etapa A",
				totalCost: 0,
				computedStatus: "NOT_STARTED",
				sortOrder: 1,
			},
			{
				id: ITEM_A1,
				ownerId: OWNER_A,
				workId: workA.id,
				importId: importA.id,
				parentId: ITEM_A_STAGE,
				index: "1.1",
				type: "ITEM",
				description: "Servico A",
				unit: "m2",
				quantity: 100,
				unitCost: 1000,
				totalCost: 100000,
				computedStatus: "NOT_STARTED",
				sortOrder: 2,
			},
			{
				id: ITEM_B_STAGE,
				ownerId: OWNER_A,
				workId: workB.id,
				importId: importB.id,
				parentId: null,
				index: "1",
				type: "STAGE",
				description: "Etapa B",
				totalCost: 0,
				computedStatus: "NOT_STARTED",
				sortOrder: 1,
			},
			{
				id: ITEM_B1,
				ownerId: OWNER_A,
				workId: workB.id,
				importId: importB.id,
				parentId: ITEM_B_STAGE,
				index: "1.1",
				type: "ITEM",
				description: "Servico B",
				unit: "m2",
				quantity: 100,
				unitCost: 1000,
				totalCost: 100000,
				computedStatus: "NOT_STARTED",
				sortOrder: 2,
			},
			{
				id: ITEM_AD1,
				ownerId: ADMIN_USER,
				workId: workAd.id,
				importId: importAd.id,
				parentId: null,
				index: "1",
				type: "ITEM",
				description: "Servico Admin",
				unit: "m2",
				quantity: 100,
				unitCost: 1000,
				totalCost: 100000,
				computedStatus: "NOT_STARTED",
				sortOrder: 1,
			},
		],
	});

	const contract = await prisma.contract.create({
		data: {
			id: CONTRACT_A,
			ownerId: OWNER_A,
			workId: workA.id,
			code: "CT-001",
			supplierName: "Fornecedor A",
			contractValue: 50000,
			status: "RASCUNHO",
		},
	});

	await prisma.contractService.create({
		data: {
			id: SERVICE_A1,
			contractId: contract.id,
			type: "ITEM",
			description: "Servico de Contrato A",
			unit: "m2",
			quantity: 30,
			unitCost: 1000,
			totalCost: 30000,
			budgetItemId: ITEM_A1,
			sortOrder: 1,
		},
	});

	const wm = await prisma.workMeasurement.create({
		data: {
			id: WM_A1,
			ownerId: OWNER_A,
			workId: workA.id,
			number: 1,
			date: new Date("2026-06-15"),
			title: "Medicao 1 da Obra A",
		},
	});

	await prisma.workMeasurementItem.create({
		data: {
			measurementId: wm.id,
			budgetItemId: ITEM_A1,
			measuredQuantity: 50,
			measuredValue: 50000,
			measuredPercentage: 50,
			accumulatedQuantity: 50,
			accumulatedValue: 50000,
			accumulatedPercentage: 50,
		},
	});

	const changedAt = new Date("2026-07-01");
	await prisma.governanceRecord.createMany({
		data: [
			{
				ownerId: OWNER_A,
				entityType: "BUDGET",
				entityId: workA.id,
				status: "ACEITO",
				version: 1,
				changedBy: OWNER_A,
				changedAt,
			},
			{
				ownerId: OWNER_A,
				entityType: "WORK_MEASUREMENTS",
				entityId: workA.id,
				status: "ACEITO",
				version: 1,
				changedBy: OWNER_A,
				changedAt,
			},
			{
				ownerId: OWNER_A,
				entityType: "CONTRACT",
				entityId: workA.id,
				status: "ACEITO",
				version: 1,
				changedBy: OWNER_A,
				changedAt,
			},
			{
				ownerId: OWNER_A,
				entityType: "BI_SNAPSHOT",
				entityId: workA.id,
				status: "ACEITO",
				version: 1,
				changedBy: OWNER_A,
				changedAt,
			},
			{
				ownerId: OWNER_A,
				entityType: "SCHEDULE",
				entityId: workA.id,
				status: "TRAVADO",
				version: 1,
				changedBy: OWNER_A,
				changedAt,
			},
			{
				ownerId: ADMIN_USER,
				entityType: "WORK",
				entityId: workAd.id,
				status: "TRAVADO",
				version: 1,
				changedBy: ADMIN_USER,
				changedAt,
			},
			{
				ownerId: ADMIN_USER,
				entityType: "CONTRACT",
				entityId: workAd.id,
				status: "TRAVADO",
				version: 1,
				changedBy: ADMIN_USER,
				changedAt,
			},
		],
	});

	await prisma.workMembership.createMany({
		data: [
			{ workId: workA.id, userId: OWNER_A, role: "GERENTE" },
			{ workId: workB.id, userId: OWNER_A, role: "GERENTE" },
			{ workId: workAd.id, userId: ADMIN_USER, role: "ADMIN" },
		],
	});
	await prisma.organizationMembership.createMany({
		data: [
			{ organizationId: orgA.id, userId: OWNER_A, role: "GERENTE" },
			{ organizationId: orgA.id, userId: GESTOR_USER, role: "GESTOR" },
			{ organizationId: orgAd.id, userId: ADMIN_USER, role: "ADMIN" },
		],
	});
	await prisma.costCenterMembership.createMany({
		data: [
			{ costCenterId: ccA.id, userId: GESTOR_USER, role: "GESTOR" },
			{ costCenterId: ccA.id, userId: OWNER_A, role: "GERENTE" },
			{ costCenterId: ccAd.id, userId: ADMIN_USER, role: "ADMIN" },
		],
	});
}
