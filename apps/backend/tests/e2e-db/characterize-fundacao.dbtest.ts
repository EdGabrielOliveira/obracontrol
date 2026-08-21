import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { auditWriter } from "../../src/lib/audit-writer";
import { auth, authCookieNames } from "../../src/lib/auth";
import { prisma } from "../../src/lib/prisma";
import {
	ADMIN_USER,
	assertStatus,
	CC_A,
	ensureBudgetVersion,
	ITEM_AD1,
	ITEM_B1,
	jsonBody,
	ORG_A,
	OWNER_A,
	OWNER_B,
	resetAndSeedDatabase,
	testApp,
	WM_A1,
	WORK_A,
	WORK_AD,
	WORK_B,
} from "./setup.dbtest";

const WORK_C = "e2e-work-c";
const CONTRACT_C = "e2e-contract-c";
const CONTRACT_B = "e2e-contract-b";
const ITEM_AD2 = "e2e-item-ad2";

// Caracterizacao (Fase 1 - Fundacao de Acesso e Integridade): estes testes
// registram o comportamento ATUAL falho do sistema antes da implementacao do
// plano. Todos devem FALHAR agora e PASSAR apos as tarefas 2-6.

const DELEGATED = "e2e-delegated";
const DELEGATED_B = "e2e-delegated-b";
const COOKIE_USER = "e2e-cookie-user";
const TEST_PASSWORD =
	process.env.E2E_TEST_PASSWORD ?? ["Senha", "Forte", "123"].join("");

const mySessions: Record<string, string> = {};

async function apiAs(
	userId: string,
	path: string,
	init: RequestInit = {},
): Promise<Response> {
	const headers = new Headers(init.headers);
	headers.set("cookie", mySessions[userId]);
	return testApp.handle(
		new Request(`http://localhost:7000${path}`, { ...init, headers }),
	);
}

async function createUser(
	id: string,
	email: string,
	name: string,
	role: string,
): Promise<void> {
	await prisma.user.create({
		data: { id, email, name, role, emailVerified: true },
	});
	const passwordHash = await Bun.password.hash(TEST_PASSWORD, {
		algorithm: "bcrypt",
		cost: 10,
	});
	await prisma.account.create({
		data: {
			id: `credential-${id}`,
			userId: id,
			accountId: email,
			providerId: "credential",
			password: passwordHash,
		},
	});
}

async function login(userId: string, email: string): Promise<void> {
	const loginResponse = await auth.handler(
		new Request("http://localhost:7000/api/auth/sign-in/email", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email, password: TEST_PASSWORD }),
		}),
	);
	const setCookie = loginResponse.headers.get("set-cookie");
	if (!setCookie) {
		throw new Error(`Login de seed falhou para ${email}`);
	}
	expect(setCookie).toContain(`${authCookieNames.sessionToken}=`);
	expect(setCookie).not.toContain("better-auth.session_token=");
	mySessions[userId] =
		setCookie
			.split(/,(?=\s*(?:better-auth|__Secure-better-auth)\.)/)
			.find((cookie) => cookie.includes(`${authCookieNames.sessionToken}=`))
			?.split(";")[0] ?? "";
}

async function forceAuditWriteFailure(fn: () => Promise<void>): Promise<void> {
	const originalWrite = auditWriter.write;
	auditWriter.write = (async () => {
		throw new Error("audit-write-forced-failure");
	}) as typeof auditWriter.write;
	try {
		await fn();
	} finally {
		auditWriter.write = originalWrite;
	}
}

beforeAll(async () => {
	await resetAndSeedDatabase();

	await createUser(
		DELEGATED,
		"delegated@e2e.obra.bi",
		"Membro Delegado",
		"GERENTE",
	);
	await createUser(
		DELEGATED_B,
		"delegated-b@e2e.obra.bi",
		"Membro Obra B",
		"GERENTE",
	);
	await createUser(COOKIE_USER, "cookie@e2e.obra.bi", "Cookie E2E", "GERENTE");
	for (const [id, email] of [
		[OWNER_A, "owner-a@e2e.obra.bi"],
		[OWNER_B, "owner-b@e2e.obra.bi"],
		[ADMIN_USER, "admin@e2e.obra.bi"],
		[DELEGATED, "delegated@e2e.obra.bi"],
		[DELEGATED_B, "delegated-b@e2e.obra.bi"],
		[COOKIE_USER, "cookie@e2e.obra.bi"],
	] as const) {
		await login(id, email);
	}

	const sessionResponse = await auth.handler(
		new Request("http://localhost:7000/api/auth/get-session", {
			headers: { cookie: mySessions[COOKIE_USER] },
		}),
	);
	expect(sessionResponse.status).toBe(200);

	const logoutResponse = await auth.handler(
		new Request("http://localhost:7000/api/auth/sign-out", {
			method: "POST",
			headers: {
				cookie: mySessions[COOKIE_USER],
				Origin: "http://localhost:7000",
			},
		}),
	);
	const logoutCookies = logoutResponse.headers.get("set-cookie") ?? "";
	expect(logoutCookies).toContain(`${authCookieNames.sessionToken}=`);
	expect(logoutCookies).toContain("Max-Age=0");

	await prisma.organizationMembership.createMany({
		data: [{ organizationId: ORG_A, userId: DELEGATED, role: "GERENTE" }],
	});
	await prisma.costCenterMembership.createMany({
		data: [{ costCenterId: CC_A, userId: DELEGATED, role: "GERENTE" }],
	});

	const workC = await prisma.constructionWork.create({
		data: {
			id: WORK_C,
			ownerId: OWNER_A,
			code: "E2E-OBRA-C",
			name: "Obra C",
			costCenterId: CC_A,
			baseDate: new Date("2026-01-01"),
			plannedStart: new Date("2026-01-01"),
			plannedEnd: new Date("2026-12-31"),
			areaM2: 400,
		},
	});
	await prisma.contract.createMany({
		data: [
			{
				id: CONTRACT_C,
				ownerId: OWNER_A,
				workId: workC.id,
				code: "CT-C",
				supplierName: "Fornecedor C",
				contractValue: 50000,
				status: "RASCUNHO",
			},
			{
				id: CONTRACT_B,
				ownerId: OWNER_A,
				workId: WORK_B,
				code: "CT-B",
				supplierName: "Fornecedor B",
				contractValue: 10000,
				status: "RASCUNHO",
			},
		],
	});
	await prisma.constructionBudgetItem.create({
		data: {
			id: ITEM_AD2,
			ownerId: ADMIN_USER,
			workId: WORK_AD,
			importId: "e2e-import-ad",
			parentId: null,
			index: "2",
			type: "ITEM",
			description: "Servico Admin 2",
			unit: "m2",
			quantity: 100,
			unitCost: 1000,
			totalCost: 100000,
			computedStatus: "NOT_STARTED",
			sortOrder: 2,
		},
	});
});

afterAll(async () => {
	await prisma.$disconnect();
});

describe("1. escopo — owner A, membro delegado e owner B", () => {
	it("membro delegado com membership GERENTE le medicao de owner A", async () => {
		const res = await apiAs(
			DELEGATED,
			`/construction/works/${WORK_A}/work-measurements/${WM_A1}`,
		);
		await assertStatus(res, 200);
	});

	it("membro delegado ve medicao de owner A na listagem da obra", async () => {
		const res = await apiAs(
			DELEGATED,
			`/construction/works/${WORK_A}/work-measurements`,
		);
		const body = await assertStatus(res, 200);
		const items = body.data as Array<{ id: string }>;
		expect(items.some((m) => m.id === WM_A1)).toBe(true);
	});

	it("membro delegado cria contrato e a autoria vai para o dono do recurso", async () => {
		const res = await apiAs(
			DELEGATED,
			`/construction/works/${WORK_B}/contracts`,
			await jsonBody({
				code: "CT-DELEGADO",
				supplierName: "Fornecedor Delegado",
				contractValue: 5000,
				objectDescription: "Servicos de fundacao",
			}),
		);
		const body = await assertStatus(res, 200);
		// DEC-005: GERENTE executa direto e a resposta e CommandResult EXECUTED.
		expect(body.status).toBe("EXECUTED");
		const data = body.data as Record<string, unknown>;
		expect(data.ownerId).toBe(OWNER_A);
	});

	it("membro delegado nao furta a trava de governanca de owner A", async () => {
		const res = await apiAs(
			DELEGATED,
			`/construction/works/${WORK_A}/contracts`,
			await jsonBody({
				code: "CT-FURADO",
				supplierName: "Fornecedor Furado",
				contractValue: 1000,
				objectDescription: "Servicos de fundacao",
			}),
		);
		expect(res.status).toBe(423);
		const leaked = await prisma.contract.findFirst({
			where: { workId: WORK_A, code: "CT-FURADO" },
		});
		expect(leaked).toBeNull();
	});

	it("usuario sem membership no centro da obra nao acessa obra A", async () => {
		const res = await apiAs(DELEGATED_B, `/construction/works/${WORK_A}`);
		await assertStatus(res, 404);
	});

	it("membro de outra organizacao (owner B) nao acessa recursos de owner A", async () => {
		const res = await apiAs(
			OWNER_B,
			`/construction/works/${WORK_A}/work-measurements/${WM_A1}`,
		);
		await assertStatus(res, 404);
	});
});

describe("2. concorrencia — duas medicoes e dois pagamentos consomem o mesmo saldo", () => {
	it("duas medicoes simultaneas nao excedem o saldo do item de orcamento", async () => {
		await ensureBudgetVersion(ADMIN_USER, WORK_AD);
		const payload = (number: number) =>
			jsonBody({
				number,
				date: "2026-06-15",
				title: "Medicao concorrente",
				items: [
					{
						budgetItemId: ITEM_AD1,
						measuredQuantity: 60,
					},
				],
			});
		const [r1, r2] = await Promise.all([
			apiAs(
				ADMIN_USER,
				`/construction/works/${WORK_AD}/work-measurements`,
				await payload(100),
			),
			apiAs(
				ADMIN_USER,
				`/construction/works/${WORK_AD}/work-measurements`,
				await payload(101),
			),
		]);
		const okCount = [r1.status, r2.status].filter((s) => s === 200).length;
		expect(okCount).toBe(1);

		const rows = await prisma.workMeasurement.findMany({
			where: {
				workId: WORK_AD,
				items: { some: { budgetItemId: ITEM_AD1 } },
			},
			include: { items: true },
		});
		const consumed = rows.reduce(
			(sum, m) =>
				sum + m.items.reduce((s, i) => s + Number(i.accumulatedValue ?? 0), 0),
			0,
		);
		expect(rows.length).toBe(1);
		expect(consumed).toBeLessThanOrEqual(100000);
	});

	it("dois pagamentos simultaneos nao excedem o valor devido do contrato", async () => {
		const payload = () =>
			jsonBody({
				date: "2026-07-01",
				value: 40000,
				paidValue: 40000,
				status: "PAGO",
			});
		const [r1, r2] = await Promise.all([
			apiAs(
				OWNER_A,
				`/construction/works/${WORK_C}/contracts/${CONTRACT_C}/payments`,
				await payload(),
			),
			apiAs(
				OWNER_A,
				`/construction/works/${WORK_C}/contracts/${CONTRACT_C}/payments`,
				await payload(),
			),
		]);
		const okCount = [r1.status, r2.status].filter((s) => s === 200).length;
		expect(okCount).toBe(1);

		const payments = await prisma.contractPayment.findMany({
			where: { contractId: CONTRACT_C },
		});
		const totalPaid = payments
			.filter((p) => p.status === "PAGO")
			.reduce((sum, p) => sum + Number(p.paidValue), 0);
		expect(payments.length).toBe(1);
		expect(totalPaid).toBeLessThanOrEqual(50000);
	});
});

describe("3. autoria — createdBy forjado e ignorado", () => {
	it("medicao ignora createdBy forjado e registra o ator autenticado", async () => {
		await ensureBudgetVersion(OWNER_A, WORK_B);
		const res = await apiAs(
			OWNER_A,
			`/construction/works/${WORK_B}/work-measurements`,
			await jsonBody({
				date: "2026-06-15",
				title: "Medicao forjada",
				createdBy: OWNER_B,
				items: [
					{
						budgetItemId: ITEM_B1,
						measuredQuantity: 10,
					},
				],
			}),
		);
		const body = (await res.json()) as { createdBy?: string | null };
		expect(res.status).toBe(200);
		expect(body.createdBy).toBe(OWNER_A);
	});

	it("contrato ignora createdBy forjado e registra o ator autenticado", async () => {
		const res = await apiAs(
			OWNER_A,
			`/construction/works/${WORK_B}/contracts`,
			await jsonBody({
				code: "CT-FORJADO",
				supplierName: "Fornecedor Forjado",
				contractValue: 1000,
				objectDescription: "Servicos de fundacao",
				createdBy: OWNER_B,
			}),
		);
		const body = (await res.json()) as {
			status?: string;
			data?: { createdBy?: string | null };
		};
		expect(res.status).toBe(200);
		expect(body.status).toBe("EXECUTED");
		expect(body.data?.createdBy).toBe(OWNER_A);
	});
});

describe("4. auditoria — falha de auditoria deve reverter a mutacao ou ser recuperavel", () => {
	it("falha de auditoria na medicao com override reverte a mutacao", async () => {
		await forceAuditWriteFailure(async () => {
			const res = await apiAs(
				ADMIN_USER,
				`/construction/works/${WORK_AD}/work-measurements`,
				await jsonBody({
					date: "2026-06-15",
					title: "Medicao com auditoria quebrada",
					balanceOverride: true,
					evidenceNote: "Caracterizacao de falha de auditoria",
					items: [
						{
							budgetItemId: ITEM_AD2,
							measuredQuantity: 150,
						},
					],
				}),
			);
			expect(res.status).not.toBe(200);

			const persisted = await prisma.workMeasurement.findFirst({
				where: { title: "Medicao com auditoria quebrada" },
			});
			expect(persisted).toBeNull();

			const auditRows = await prisma.auditLog.count({
				where: {
					entityDescription: { contains: "Medicao com auditoria quebrada" },
				},
			});
			expect(auditRows).toBe(0);
		});
	});

	it("falha de auditoria no aditivo de contrato reverte a mutacao", async () => {
		await forceAuditWriteFailure(async () => {
			const res = await apiAs(
				OWNER_A,
				`/construction/works/${WORK_B}/contracts/${CONTRACT_B}/amendments`,
				await jsonBody({
					kind: "ADITIVO",
					value: 1000,
					reason: "Caracterizacao de falha de auditoria",
					date: "2026-07-01",
				}),
			);
			expect(res.status).not.toBe(200);

			const persisted = await prisma.constructionContractAmendment.count({
				where: {
					contractId: CONTRACT_B,
					reason: "Caracterizacao de falha de auditoria",
				},
			});
			expect(persisted).toBe(0);
		});
	});
});
