import { beforeAll, describe, expect, it } from "bun:test";
import { auth } from "../../src/lib/auth";
import { prisma } from "../../src/lib/prisma";
import {
	api,
	assertStatus,
	CC_A,
	GESTOR_USER,
	ORG_A,
	OWNER_A,
	resetAndSeedDatabase,
	SUPERVISOR_USER,
	TEST_PASSWORD,
	testApp,
	WORK_A,
	WORK_B,
} from "./setup.dbtest";

/**
 * DEC-004/DEC-005: modelo final de autorizacao.
 * - Papel legado nao autentica (sessao invalidada).
 * - SUPERVISOR sem membership nao acessa obra de outro escopo.
 * - Gerente segue acessando o portfolio das organizacoes vinculadas.
 * - Cadeia fixa: Supervisor solicita contrato ao Gestor do centro e o
 *   contrato so nasce apos a aprovacao.
 */
describe("permission revision - migracao e escopo", () => {
	beforeAll(async () => {
		await resetAndSeedDatabase();
	});

	async function loginAs(email: string, password: string): Promise<string> {
		const loginResponse = await auth.handler(
			new Request("http://localhost:7000/api/auth/sign-in/email", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email, password }),
			}),
		);
		const setCookie = loginResponse.headers.get("set-cookie");
		if (!setCookie) throw new Error(`Login falhou para ${email}`);
		return setCookie.split(";")[0];
	}

	function requestWithCookie(
		cookie: string,
		path: string,
		init: RequestInit = {},
	): Promise<Response> {
		const headers = new Headers(init.headers);
		headers.set("cookie", cookie);
		return testApp.handle(
			new Request(`http://localhost:7000${path}`, { ...init, headers }),
		);
	}

	it("papel legado (OPERADOR) nao autentica em rota protegida", async () => {
		const legacy = await prisma.user.create({
			data: {
				id: "legacy-operador",
				email: "legacy-operador@e2e.obra.bi",
				name: "Operador Legado",
				role: "OPERADOR",
				emailVerified: true,
			},
		});
		const passwordHash = await Bun.password.hash("Legado@2026", {
			algorithm: "bcrypt",
			cost: 10,
		});
		await prisma.account.create({
			data: {
				id: `credential-${legacy.id}`,
				userId: legacy.id,
				accountId: legacy.email,
				providerId: "credential",
				password: passwordHash,
			},
		});

		const cookie = await loginAs("legacy-operador@e2e.obra.bi", "Legado@2026");
		const response = await requestWithCookie(
			cookie,
			`/construction/works/${WORK_A}`,
		);
		expect(response.status).toBe(401);
	});

	it("SUPERVISOR sem membership nao acessa obra do portfolio", async () => {
		const response = await api(
			SUPERVISOR_USER,
			`/construction/works/${WORK_A}`,
		);
		expect(response.status).toBe(404);
		const other = await api(SUPERVISOR_USER, `/construction/works/${WORK_B}`);
		expect(other.status).toBe(404);
	});

	it("OWNER (GERENTE) acessa obra da organizacao vinculada", async () => {
		const ok = await api(OWNER_A, `/construction/works/${WORK_A}`);
		expect(ok.status).toBe(200);
	});

	it("cadeia completa: Supervisor solicita contrato, Gestor do centro aprova e o contrato nasce", async () => {
		// Obra destravada no centro do supervisor/gestor (as obras do seed
		// possuem governanca TRAVADO e bloqueiam mutacoes).
		const chainWork = await prisma.constructionWork.create({
			data: {
				id: "e2e-work-cadeia",
				ownerId: OWNER_A,
				code: "E2E-CADEIA",
				name: "Obra Cadeia",
				costCenterId: CC_A,
				baseDate: new Date("2026-01-01"),
				plannedStart: new Date("2026-01-01"),
				plannedEnd: new Date("2026-12-31"),
				areaM2: 100,
			},
		});

		const supervisor = await prisma.user.create({
			data: {
				id: "supervisor-scoped",
				email: "supervisor-scoped@e2e.obra.bi",
				name: "Supervisor Com Escopo",
				role: "SUPERVISOR",
				emailVerified: true,
			},
		});
		await prisma.organizationMembership.create({
			data: {
				organizationId: ORG_A,
				userId: supervisor.id,
				role: "SUPERVISOR",
			},
		});
		await prisma.costCenterMembership.create({
			data: { costCenterId: CC_A, userId: supervisor.id, role: "SUPERVISOR" },
		});
		const passwordHash = await Bun.password.hash(TEST_PASSWORD, {
			algorithm: "bcrypt",
			cost: 10,
		});
		await prisma.account.create({
			data: {
				id: `credential-${supervisor.id}`,
				userId: supervisor.id,
				accountId: supervisor.email,
				providerId: "credential",
				password: passwordHash,
			},
		});
		const supervisorCookie = await loginAs(supervisor.email, TEST_PASSWORD);
		const gestorCookie = await loginAs("gestor@e2e.obra.bi", TEST_PASSWORD);
		const gerenteCookie = await loginAs("owner-a@e2e.obra.bi", TEST_PASSWORD);

		// 1. Supervisor solicita criacao de contrato -> PENDING sem efeito.
		const pendingResponse = await requestWithCookie(
			supervisorCookie,
			`/construction/works/${chainWork.id}/contracts`,
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					code: "CT-CADEIA",
					supplierName: "Fornecedor Cadeia",
					contractValue: 1000,
					objectDescription: "Servicos de fundacao",
					status: "RASCUNHO",
				}),
			},
		);
		const pendingBody = await assertStatus(pendingResponse, 200);
		expect(pendingBody.status).toBe("PENDING");

		const before = await prisma.contract.count({
			where: { workId: chainWork.id, code: "CT-CADEIA" },
		});
		expect(before).toBe(0);

		// 2. Gestor do mesmo centro aprova -> a cadeia avanca para revisao final.
		const requestId = (pendingBody.approvalRequest as { id?: string }).id;
		expect(requestId).toBeTruthy();

		const decideResponse = await requestWithCookie(
			gestorCookie,
			`/governance/approvals/${requestId}/decide`,
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					decision: "APPROVE",
					reason: "Contrato valido",
				}),
			},
		);
		if (decideResponse.status !== 200) {
			console.log(
				"DECIDE_FALHOU",
				decideResponse.status,
				await decideResponse.text(),
			);
		}
		await assertStatus(decideResponse, 200);

		const managerRequest = await prisma.approvalRequest.findFirst({
			where: {
				actorId: GESTOR_USER,
				actorRole: "GESTOR",
				requiredApproverRole: "GERENTE",
				effectAction: "CONTRACT_CREATE",
				status: "PENDING",
			},
		});
		expect(managerRequest?.id).toBeTruthy();

		const finalDecisionResponse = await requestWithCookie(
			gerenteCookie,
			`/governance/approvals/${managerRequest?.id}/decide`,
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					decision: "APPROVE",
					reason: "Contrato validado pela gerencia",
				}),
			},
		);
		await assertStatus(finalDecisionResponse, 200);

		const after = await prisma.contract.count({
			where: { workId: chainWork.id, code: "CT-CADEIA" },
		});
		expect(after).toBe(1);

		const originalRequest = await prisma.approvalRequest.findFirst({
			where: { id: requestId },
		});
		expect(originalRequest?.status).toBe("APPROVED");
		expect(originalRequest?.executedAt).toBeNull();
		const executedManagerRequest = await prisma.approvalRequest.findUnique({
			where: { id: managerRequest?.id },
		});
		expect(executedManagerRequest?.status).toBe("EXECUTED");
		expect(executedManagerRequest?.executedAt).not.toBeNull();
	});

	it("Gestor de outro centro nao decide solicitacao do centro alheio", async () => {
		const pending = await prisma.approvalRequest.create({
			data: {
				ownerId: OWNER_A,
				actorId: "supervisor-scoped",
				actorRole: "SUPERVISOR",
				organizationId: ORG_A,
				costCenterId: "cc-outro",
				resourceType: "WORK",
				resourceId: WORK_B,
				commandId: "work-delete-fora",
				effectAction: "WORK_DELETE",
				payloadJson: { workId: WORK_B },
				payloadHash: "hash-fora",
				expectedVersion: 1,
				idempotencyKey: "work-delete-fora",
				requiredApproverRole: "GESTOR",
				status: "PENDING",
			},
		});

		const gestorCookie = await loginAs("gestor@e2e.obra.bi", TEST_PASSWORD);
		const response = await requestWithCookie(
			gestorCookie,
			`/governance/approvals/${pending.id}/decide`,
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					decision: "APPROVE",
					reason: "Tentativa fora do centro",
				}),
			},
		);
		await assertStatus(response, 403);
	});
});
