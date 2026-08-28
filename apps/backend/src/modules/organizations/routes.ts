import { Elysia, t } from "elysia";
import { parseAsOfDate } from "../../lib/as-of-date";
import { assertRoleCan, normalizeRole } from "../../lib/authorization";
import { requireRole } from "../../lib/authorization-middleware";
import { cepClient } from "../../lib/cep-client";
import { handleConstructionError } from "../../lib/construction-error-handler";
import { ConstructionError } from "../../lib/errors";
import { prisma } from "../../lib/prisma";
import { resolveAuth } from "../../lib/resolve-auth";
import { resolveResourceScope } from "../../lib/resource-scope";
import { auditService } from "../audit/audit.service";
import { exportService } from "../construction-planning/export.service";
import { constructionBIWorksFilterSchema } from "../construction-planning/schema";
import { pdfReportService } from "../construction-planning/statistics/pdf-report.service";
import { orgBIService } from "./bi";
import { companyService, type StructuredAddressInput } from "./company.service";
import * as repo from "./repository";
import {
	costCenterFilterSchema,
	createCostCenterSchema,
	createOrganizationSchema,
	updateCostCenterSchema,
	updateOrganizationSchema,
} from "./schema";

function companyAccessFor(
	role: string | null | undefined,
	workspaceId?: string | null,
	companyIds?: string[],
) {
	return {
		canAccessAllCompanies: normalizeRole(role) === "ADMIN",
		workspaceId: workspaceId ?? undefined,
		companyIds:
			companyIds ?? (normalizeRole(role) === "ADMIN" ? undefined : []),
	};
}

async function companyAccessForUser(user: {
	id: string;
	role?: string | null;
	workspaceId?: string | null;
}) {
	if (normalizeRole(user.role) === "ADMIN")
		return companyAccessFor(user.role, user.workspaceId);
	if (normalizeRole(user.role) !== "GERENTE")
		return companyAccessFor(user.role, user.workspaceId);
	const [memberships, organizationMemberships] = await Promise.all([
		prisma.companyMembership.findMany({
			where: {
				userId: user.id,
				revokedAt: null,
				company: user.workspaceId
					? { workspaceId: user.workspaceId }
					: { workspaceId: null },
			},
			select: { companyId: true },
		}),
		prisma.organizationMembership.findMany({
			where: {
				userId: user.id,
				revokedAt: null,
				organization: user.workspaceId
					? { workspaceId: user.workspaceId }
					: { workspaceId: null },
			},
			select: { organization: { select: { companyId: true } } },
		}),
	]);
	return companyAccessFor(user.role, user.workspaceId, [
		...new Set([
			...memberships.map((m) => m.companyId),
			...organizationMemberships.flatMap((m) =>
				m.organization.companyId ? [m.organization.companyId] : [],
			),
		]),
	]);
}

async function assertCompanyManagement(
	user: { id: string; role?: string | null; workspaceId?: string | null },
	companyId: string,
) {
	if (normalizeRole(user.role) === "ADMIN") return;
	if (normalizeRole(user.role) !== "GERENTE") {
		throw new ConstructionError(
			"FORBIDDEN",
			"Somente Admin ou Gerente do escopo podem administrar a empresa",
			403,
		);
	}
	const company = await prisma.company.findFirst({
		where: {
			id: companyId,
			workspaceId: user.workspaceId ?? null,
		},
		select: { organizations: { select: { id: true } } },
	});
	if (!company)
		throw new ConstructionError("NOT_FOUND", "Empresa nao encontrada", 404);
	const directMembership = await prisma.companyMembership.findFirst({
		where: { companyId, userId: user.id, revokedAt: null },
		select: { id: true },
	});
	if (directMembership) return;
	for (const organization of company.organizations) {
		const scope = await resolveResourceScope(user.id, {
			organizationId: organization.id,
		});
		if (scope.canWrite) return;
	}
	throw new ConstructionError(
		"FORBIDDEN",
		"Empresa fora do escopo do Gerente",
		403,
	);
}

function assertStructuralRole(role: string | null | undefined) {
	const normalized = normalizeRole(role);
	if (normalized === "SUPERVISOR") {
		throw new ConstructionError(
			"FORBIDDEN",
			"Supervisor nao pode alterar a estrutura",
			403,
		);
	}
}

async function assertOrganizationCreation(
	user: { id: string; role?: string | null },
	companyId?: string,
) {
	const role = normalizeRole(user.role);
	if (role === "ADMIN") return;
	if (role !== "GERENTE" || !companyId) {
		throw new ConstructionError(
			"FORBIDDEN",
			"Somente Admin ou Gerente do escopo podem criar organizacoes",
			403,
		);
	}
	await assertCompanyManagement(user, companyId);
}

export const organizationController = new Elysia({
	prefix: "/organizations",
	name: "organizations",
})
	.onError(handleConstructionError)
	.use(resolveAuth)
	.use(requireRole("read"))
	.get(
		"/address/cep/:cep",
		async ({ params }) => cepClient.lookup(params.cep),
		{
			params: t.Object({ cep: t.String({ minLength: 8, maxLength: 9 }) }),
			detail: {
				tags: ["Organizations"],
				summary: "Consultar endereço por CEP",
				description:
					"Consulta um CEP em serviço externo best-effort e retorna dados para preenchimento manual, sem persistir a resposta.",
			},
		},
	)
	.get(
		"/cost-centers",
		async ({ query, user }) => {
			const parsed = costCenterFilterSchema.safeParse(query);
			const filters = parsed.success ? parsed.data : {};
			return repo.listAllCostCenters(user.id, filters);
		},
		{
			detail: {
				tags: ["Cost Centers"],
				summary: "Listar todos os centros de custo",
				description:
					"Lista os centros de custo acessíveis ao ator autenticado, com filtro textual e paginação.",
			},
		},
	)
	.get(
		"/cost-centers/:ccId",
		async ({ params, user }) => {
			const cc = await repo.getCostCenterByIdOnly(user.id, params.ccId);
			if (!cc)
				throw new ConstructionError(
					"NOT_FOUND",
					"Centro de custo nao encontrado",
					404,
				);
			return cc;
		},
		{
			detail: {
				tags: ["Cost Centers"],
				summary: "Detalhar centro de custo",
				description:
					"Retorna um centro de custo acessível ao ator, incluindo seus dados cadastrais e relacionamento pai.",
			},
		},
	)
	.get(
		"/",
		async ({ query, user }) => {
			const { organizationFilterSchema } = await import("./schema");
			const parsed = organizationFilterSchema.safeParse(query);
			const filters = parsed.success ? parsed.data : {};
			return normalizeRole(user.role) === "ADMIN"
				? repo.listOrganizations(user.id, filters, { includeCompany: true })
				: repo.listOrganizations(user.id, filters);
		},
		{
			detail: {
				tags: ["Organizations"],
				summary: "Listar organizações",
				description:
					"Lista as organizações acessíveis ao ator autenticado, com filtro textual e paginação.",
			},
		},
	)
	.get(
		"/:id",
		async ({ params, user }) => {
			const org =
				normalizeRole(user.role) === "ADMIN"
					? await repo.getOrganizationById(user.id, params.id, {
							includeCompany: true,
						})
					: await repo.getOrganizationById(user.id, params.id);
			if (!org) {
				throw new ConstructionError("NOT_FOUND", "Orgao nao encontrado", 404);
			}
			return org;
		},
		{
			detail: {
				tags: ["Organizations"],
				summary: "Detalhar organização",
				description:
					"Retorna uma organização acessível e seus centros de custo vinculados.",
			},
		},
	)
	.get(
		"/:id/cost-centers",
		async ({ params, query, user }) => {
			const org = await repo.getOrganizationById(user.id, params.id);
			if (!org) {
				throw new ConstructionError("NOT_FOUND", "Orgao nao encontrado", 404);
			}
			const { costCenterFilterSchema } = await import("./schema");
			const parsed = costCenterFilterSchema.safeParse(query);
			const filters = parsed.success ? parsed.data : {};
			return repo.listCostCenters(user.id, params.id, filters);
		},
		{
			detail: {
				tags: ["Organizations"],
				summary: "Listar centros de custo da organização",
				description:
					"Lista os centros de custo acessíveis dentro da organização indicada, com filtros e paginação.",
			},
		},
	)
	.get(
		"/:id/cost-centers/:ccId",
		async ({ params, user }) => {
			const cc = await repo.getCostCenterById(user.id, params.id, params.ccId);
			if (!cc) {
				throw new ConstructionError(
					"NOT_FOUND",
					"Centro de custo nao encontrado",
					404,
				);
			}
			return cc;
		},
		{
			detail: {
				tags: ["Organizations"],
				summary: "Detalhar centro de custo da organização",
				description:
					"Retorna o centro de custo indicado dentro da organização e suas obras vinculadas.",
			},
		},
	)
	.get(
		"/:id/cost-centers/:ccId/bi",
		async ({ params, query, user }) => {
			const parsed = constructionBIWorksFilterSchema.safeParse(query);
			const filter = parsed.success ? parsed.data : {};
			const hasFilter = Object.values(filter).some(
				(value) => value !== undefined,
			);
			return orgBIService.getCostCenterBI(
				user.id,
				params.id,
				params.ccId,
				hasFilter ? filter : undefined,
				parseAsOfDate(parsed.success ? parsed.data.asOfDate : undefined),
			);
		},
		{
			detail: {
				tags: ["Organizations"],
				summary: "Consultar BI do centro de custo",
				description:
					"Calcula os indicadores agregados das obras do centro de custo conforme os filtros e a data de referência.",
			},
		},
	)
	.get(
		"/:id/bi",
		async ({ params, query, user }) => {
			const parsed = constructionBIWorksFilterSchema.safeParse(query);
			const filter = parsed.success ? parsed.data : {};
			const hasFilter = Object.values(filter).some(
				(value) => value !== undefined,
			);
			return orgBIService.getOrganizationBI(
				user.id,
				params.id,
				hasFilter ? filter : undefined,
				parseAsOfDate(parsed.success ? parsed.data.asOfDate : undefined),
			);
		},
		{
			detail: {
				tags: ["Organizations"],
				summary: "Consultar BI da organização",
				description:
					"Calcula os indicadores agregados das obras da organização conforme os filtros e a data de referência.",
			},
		},
	)
	.get(
		"/:id/reports",
		async ({ params, user }) => {
			const scope = await resolveResourceScope(user.id, {
				organizationId: params.id,
			});
			if (!scope.canRead) {
				throw new ConstructionError("NOT_FOUND", "Orgao nao encontrado", 404);
			}
			const report = await repo.getOrganizationReport(
				scope.resourceOwnerId,
				params.id,
			);
			if (!report) {
				throw new ConstructionError("NOT_FOUND", "Orgao nao encontrado", 404);
			}
			return report;
		},
		{
			detail: {
				tags: ["Organizations"],
				summary: "Consultar relatório da organização",
				description:
					"Retorna o relatório consolidado da organização no escopo autorizado.",
			},
		},
	)
	.get(
		"/:id/cost-centers/:ccId/reports",
		async ({ params, user }) => {
			const scope = await resolveResourceScope(user.id, {
				costCenterId: params.ccId,
			});
			if (!scope.canRead) {
				throw new ConstructionError(
					"NOT_FOUND",
					"Centro de custo nao encontrado",
					404,
				);
			}
			const report = await repo.getCostCenterReport(
				scope.resourceOwnerId,
				params.ccId,
			);
			if (!report) {
				throw new ConstructionError(
					"NOT_FOUND",
					"Centro de custo nao encontrado",
					404,
				);
			}
			return report;
		},
		{
			detail: {
				tags: ["Organizations"],
				summary: "Consultar relatório do centro de custo",
				description:
					"Retorna o relatório consolidado do centro de custo no escopo autorizado.",
			},
		},
	)
	.get(
		"/:id/reports/pdf",
		async ({ params, user }) => {
			const scope = await resolveResourceScope(user.id, { organizationId: params.id });
			if (!scope.canRead) {
				throw new ConstructionError("NOT_FOUND", "Organização não encontrada", 404);
			}
			return pdfReportService.generateOrganizationPdf(scope.resourceOwnerId, params.id);
		},
		{
			detail: {
				tags: ["Organizations"],
				summary: "Baixar relatório PDF da organização",
				description:
					"Gera e baixa o relatório PDF da organização indicada após validar o escopo de leitura.",
			},
		},
	)
	.get(
		"/:id/export/estatisticas",
		({ params, user }) =>
			exportService.exportOrganizationStatistics(user.id, params.id),
		{ detail: { tags: ["Export", "Organizations"] } },
	)
	.get(
		"/:id/cost-centers/:ccId/export/estatisticas",
		({ params, user }) =>
			exportService.exportCostCenterStatistics(user.id, params.id, params.ccId),
		{ detail: { tags: ["Export", "Organizations"] } },
	)
	.get(
		"/:id/cost-centers/:ccId/reports/pdf",
		async ({ params, user }) => {
			const scope = await resolveResourceScope(user.id, { costCenterId: params.ccId });
			if (!scope.canRead) {
				throw new ConstructionError("NOT_FOUND", "Centro de custo não encontrado", 404);
			}
			return pdfReportService.generateCostCenterPdf(scope.resourceOwnerId, params.ccId);
		},
		{
			detail: {
				tags: ["Organizations"],
				summary: "Baixar relatório PDF do centro de custo",
				description:
					"Gera e baixa o relatório PDF do centro de custo indicado após validar o escopo de leitura.",
			},
		},
	)
	.use(requireRole("write"))
	.patch(
		"/cost-centers/:ccId",
		async ({ params, body, user }) => {
			assertStructuralRole(user.role);
			const { updateCostCenterSchema } = await import("./schema");
			const parsed = updateCostCenterSchema.safeParse(body);
			if (!parsed.success)
				throw new ConstructionError("INVALID_INPUT", "Dados invalidos", 400);
			const previous = await prisma.costCenter.findUnique({
				where: { id: params.ccId },
			});
			const cc = await repo.updateCostCenterByIdOnly(
				user.id,
				params.ccId,
				parsed.data,
			);
			if (!cc)
				throw new ConstructionError(
					"NOT_FOUND",
					"Centro de custo nao encontrado",
					404,
				);
			auditService.log({
				userId: user.id,
				ownerId: (cc as { ownerId?: string }).ownerId ?? user.id,
				action: "UPDATE",
				entityType: "COST_CENTER",
				entityId: params.ccId,
				entityDescription: `Centro de Custo ${(cc as { name?: string }).name ?? ""}`,
				previousState: previous
					? {
							name: (previous as { name?: string }).name,
							code: (previous as { code?: string | null }).code ?? null,
						}
					: null,
				newState: {
					name: (cc as { name?: string }).name,
					code: (cc as { code?: string | null }).code ?? null,
				},
			});
			return cc;
		},
		{ detail: { tags: ["Cost Centers"] } },
	)
	.delete(
		"/cost-centers/:ccId",
		async ({ params, user }) => {
			assertStructuralRole(user.role);
			const old = await prisma.costCenter.findUnique({
				where: { id: params.ccId },
			});
			const cc = await repo.deleteCostCenterByIdOnly(user.id, params.ccId);
			if (!cc)
				throw new ConstructionError(
					"NOT_FOUND",
					"Centro de custo nao encontrado",
					404,
				);
			if (old) {
				auditService.log({
					userId: user.id,
					ownerId: (old as { ownerId?: string }).ownerId ?? user.id,
					action: "DELETE",
					entityType: "COST_CENTER",
					entityId: params.ccId,
					entityDescription: `Centro de Custo ${old.name}`,
					previousState: old as unknown as Record<string, unknown>,
				});
			}
			return new Response(null, { status: 204 });
		},
		{ detail: { tags: ["Cost Centers"] } },
	)
	.post(
		"/",
		async ({ body, user }) => {
			const parsed = createOrganizationSchema.safeParse(body);
			if (!parsed.success) {
				throw new ConstructionError("INVALID_INPUT", "Dados invalidos", 400);
			}
			await assertOrganizationCreation(user, parsed.data.companyId);
			const org = await repo.createOrganization(user.id, parsed.data);
			if (org) {
				auditService.log({
					userId: user.id,
					ownerId: (org as { ownerId?: string }).ownerId ?? user.id,
					action: "CREATE",
					entityType: "ORGANIZATION",
					entityId: (org as { id: string }).id,
					entityDescription: `Organização ${(org as { name?: string }).name ?? ""}`,
					newState: {
						name: (org as { name?: string }).name,
						cnpj: (org as { cnpj?: string | null }).cnpj ?? null,
					},
				});
			}
			return org;
		},
		{ detail: { tags: ["Organizations"] } },
	)
	.patch(
		"/:id",
		async ({ params, body, user }) => {
			assertStructuralRole(user.role);
			const scope = await resolveResourceScope(user.id, {
				organizationId: params.id,
			});
			if (!scope.canWrite)
				throw new ConstructionError(
					"FORBIDDEN",
					"Organizacao fora do escopo",
					403,
				);
			const parsed = updateOrganizationSchema.safeParse(body);
			if (!parsed.success) {
				throw new ConstructionError("INVALID_INPUT", "Dados invalidos", 400);
			}
			if (parsed.data.companyId !== undefined) {
				if (normalizeRole(user.role) === "GERENTE" && parsed.data.companyId) {
					await assertCompanyManagement(user, parsed.data.companyId);
				} else if (normalizeRole(user.role) !== "ADMIN") {
					throw new ConstructionError(
						"FORBIDDEN",
						"Somente Admin ou Gerente do escopo podem alterar o vinculo da organizacao",
						403,
					);
				}
			}
			const previous = await prisma.organization.findUnique({
				where: { id: params.id },
			});
			const org = await repo.updateOrganization(
				user.id,
				params.id,
				parsed.data,
			);
			if (!org) {
				throw new ConstructionError("NOT_FOUND", "Orgao nao encontrado", 404);
			}
			auditService.log({
				userId: user.id,
				ownerId: scope.resourceOwnerId,
				action: "UPDATE",
				entityType: "ORGANIZATION",
				entityId: params.id,
				entityDescription: `Organização ${(org as { name?: string }).name ?? ""}`,
				previousState: previous
					? {
							name: (previous as { name?: string }).name,
							cnpj: (previous as { cnpj?: string | null }).cnpj ?? null,
						}
					: null,
				newState: {
					name: (org as { name?: string }).name,
					cnpj: (org as { cnpj?: string | null }).cnpj ?? null,
				},
			});
			return org;
		},
		{ detail: { tags: ["Organizations"] } },
	)
	.delete(
		"/:id",
		async ({ params, user }) => {
			assertStructuralRole(user.role);
			const scope = await resolveResourceScope(user.id, {
				organizationId: params.id,
			});
			if (!scope.canWrite)
				throw new ConstructionError(
					"FORBIDDEN",
					"Organizacao fora do escopo",
					403,
				);
			const old = await prisma.organization.findUnique({
				where: { id: params.id },
			});
			const org = await repo.deleteOrganization(user.id, params.id);
			if (!org) {
				throw new ConstructionError("NOT_FOUND", "Orgao nao encontrado", 404);
			}
			if (old) {
				auditService.log({
					userId: user.id,
					ownerId: scope.resourceOwnerId,
					action: "DELETE",
					entityType: "ORGANIZATION",
					entityId: params.id,
					entityDescription: `Organização ${old.name}`,
					previousState: old as unknown as Record<string, unknown>,
				});
			}
			return new Response(null, { status: 204 });
		},
		{ detail: { tags: ["Organizations"] } },
	)
	.post(
		"/:id/cost-centers",
		async ({ params, body, user }) => {
			assertStructuralRole(user.role);
			const scope = await resolveResourceScope(user.id, {
				organizationId: params.id,
			});
			if (!scope.canWrite)
				throw new ConstructionError(
					"FORBIDDEN",
					"Organizacao fora do escopo",
					403,
				);
			const parsed = createCostCenterSchema.safeParse(body);
			if (!parsed.success) {
				throw new ConstructionError("INVALID_INPUT", "Dados invalidos", 400);
			}
			const org = await repo.getOrganizationById(user.id, params.id);
			if (!org) {
				throw new ConstructionError("NOT_FOUND", "Orgao nao encontrado", 404);
			}
			const cc = await repo.createCostCenter(user.id, params.id, parsed.data);
			if (cc) {
				auditService.log({
					userId: user.id,
					ownerId: scope.resourceOwnerId,
					action: "CREATE",
					entityType: "COST_CENTER",
					entityId: (cc as { id: string }).id,
					entityDescription: `Centro de Custo ${(cc as { name?: string }).name ?? ""}`,
					newState: {
						name: (cc as { name?: string }).name,
						code: (cc as { code?: string | null }).code ?? null,
					},
				});
			}
			return cc;
		},
		{ detail: { tags: ["Organizations"] } },
	)
	.patch(
		"/:id/cost-centers/:ccId",
		async ({ params, body, user }) => {
			assertStructuralRole(user.role);
			const scope = await resolveResourceScope(user.id, {
				costCenterId: params.ccId,
			});
			if (!scope.canWrite)
				throw new ConstructionError(
					"FORBIDDEN",
					"Centro de custo fora do escopo",
					403,
				);
			const parsed = updateCostCenterSchema.safeParse(body);
			if (!parsed.success) {
				throw new ConstructionError("INVALID_INPUT", "Dados invalidos", 400);
			}
			const previous = await prisma.costCenter.findUnique({
				where: { id: params.ccId },
			});
			const cc = await repo.updateCostCenter(
				user.id,
				params.id,
				params.ccId,
				parsed.data,
			);
			if (!cc) {
				throw new ConstructionError(
					"NOT_FOUND",
					"Centro de custo nao encontrado",
					404,
				);
			}
			auditService.log({
				userId: user.id,
				ownerId: scope.resourceOwnerId,
				action: "UPDATE",
				entityType: "COST_CENTER",
				entityId: params.ccId,
				entityDescription: `Centro de Custo ${(cc as { name?: string }).name ?? ""}`,
				previousState: previous
					? {
							name: (previous as { name?: string }).name,
							code: (previous as { code?: string | null }).code ?? null,
						}
					: null,
				newState: {
					name: (cc as { name?: string }).name,
					code: (cc as { code?: string | null }).code ?? null,
				},
			});
			return cc;
		},
		{ detail: { tags: ["Organizations"] } },
	)
	.delete(
		"/:id/cost-centers/:ccId",
		async ({ params, user }) => {
			assertStructuralRole(user.role);
			const scope = await resolveResourceScope(user.id, {
				costCenterId: params.ccId,
			});
			if (!scope.canWrite)
				throw new ConstructionError(
					"FORBIDDEN",
					"Centro de custo fora do escopo",
					403,
				);
			const old = await prisma.costCenter.findUnique({
				where: { id: params.ccId },
			});
			const cc = await repo.deleteCostCenter(user.id, params.id, params.ccId);
			if (!cc) {
				throw new ConstructionError(
					"NOT_FOUND",
					"Centro de custo nao encontrado",
					404,
				);
			}
			if (old) {
				auditService.log({
					userId: user.id,
					ownerId: scope.resourceOwnerId,
					action: "DELETE",
					entityType: "COST_CENTER",
					entityId: params.ccId,
					entityDescription: `Centro de Custo ${old.name}`,
					previousState: old as unknown as Record<string, unknown>,
				});
			}
			return new Response(null, { status: 204 });
		},
		{ detail: { tags: ["Organizations"] } },
	)
	// EMP-003 (DEC-013): Empresa (tenant acima de Organization).
	// DEC-005: ADMIN possui escopo global; GERENTE administra empresas do seu
	// escopo. A leitura permanece disponível para os demais papéis.
	.use(requireRole("read"))
	.get(
		"/companies",
		async ({ user }) =>
			companyService.list(user.id, await companyAccessForUser(user)),
		{
			detail: {
				tags: ["Companies"],
				summary: "Listar empresas",
				description:
					"Lista as empresas disponíveis para o ator autenticado, sem expor o blob do template contratual.",
			},
		},
	)
	.post(
		"/companies",
		async ({ body, user }) => {
			assertRoleCan(user.role, "admin");
			return companyService.create(user.id, body);
		},
		{
			body: t.Object({
				name: t.String(),
				document: t.Optional(t.Nullable(t.String())),
				tradeName: t.Optional(t.Nullable(t.String())),
				addressCity: t.Optional(t.Nullable(t.String())),
				addressState: t.Optional(t.Nullable(t.String())),
				structuredAddress: t.Optional(
					t.Nullable(
						t.Object({
							zipCode: t.String(),
							street: t.Optional(t.String()),
							district: t.Optional(t.String()),
							number: t.Optional(t.String()),
							city: t.String(),
							state: t.String({ minLength: 2, maxLength: 2 }),
							complement: t.Optional(t.Nullable(t.String())),
							latitude: t.Optional(t.Nullable(t.Number())),
							longitude: t.Optional(t.Nullable(t.Number())),
						}),
					),
				),
				contactEmail: t.Optional(t.Nullable(t.String())),
				contactPhone: t.Optional(t.Nullable(t.String())),
				managerName: t.Optional(t.Nullable(t.String())),
			}),
			detail: {
				tags: ["Companies"],
				summary: "Criar empresa",
				description:
					"Cria uma empresa e valida o cadastro informado, enriquecendo o CNPJ quando o serviço externo estiver disponível.",
			},
		},
	)
	.post(
		"/companies/with-template",
		async ({ body, user }) => {
			assertRoleCan(user.role, "admin");
			if (!body.file) {
				throw new ConstructionError(
					"MISSING_FILE",
					"Arquivo DOCX obrigatorio",
					400,
				);
			}
			let structuredAddress: StructuredAddressInput | null | undefined =
				body.structuredAddress as StructuredAddressInput | null | undefined;
			if (typeof structuredAddress === "string") {
				try {
					structuredAddress = JSON.parse(
						structuredAddress,
					) as StructuredAddressInput;
				} catch {
					throw new ConstructionError(
						"INVALID_ADDRESS",
						"Endereco estruturado invalido",
						400,
					);
				}
			}
			return companyService.createWithTemplate(
				user.id,
				{
					name: body.name,
					document: body.document,
					tradeName: body.tradeName,
					addressCity: body.addressCity,
					addressState: body.addressState,
					structuredAddress,
					contactEmail: body.contactEmail,
					contactPhone: body.contactPhone,
					managerName: body.managerName,
				},
				body.file,
			);
		},
		{
			body: t.Object({
				name: t.String(),
				document: t.Optional(t.Nullable(t.String())),
				tradeName: t.Optional(t.Nullable(t.String())),
				addressCity: t.Optional(t.Nullable(t.String())),
				addressState: t.Optional(t.Nullable(t.String())),
				structuredAddress: t.Optional(
					t.Union([
						t.String(),
						t.Nullable(
							t.Object({
								zipCode: t.String(),
								street: t.Optional(t.String()),
								district: t.Optional(t.String()),
								number: t.Optional(t.String()),
								city: t.String(),
								state: t.String({ minLength: 2, maxLength: 2 }),
								complement: t.Optional(t.Nullable(t.String())),
								latitude: t.Optional(t.Nullable(t.Number())),
								longitude: t.Optional(t.Nullable(t.Number())),
							}),
						),
					]),
				),
				contactEmail: t.Optional(t.Nullable(t.String())),
				contactPhone: t.Optional(t.Nullable(t.String())),
				managerName: t.Optional(t.Nullable(t.String())),
				file: t.File(),
			}),
			detail: {
				tags: ["Companies"],
				summary: "Criar empresa com template",
				description:
					"Cria uma empresa atomicamente com um template DOCX validado para instrumentos contratuais.",
			},
		},
	)
	.get(
		"/companies/:companyId",
		async ({ params, user }) =>
			companyService.get(
				user.id,
				params.companyId,
				await companyAccessForUser(user),
			),
		{
			detail: {
				tags: ["Companies"],
				summary: "Detalhar empresa",
				description:
					"Retorna os dados cadastrais e metadados do template de uma empresa, sem expor seu conteúdo binário.",
			},
		},
	)
	.patch(
		"/companies/:companyId",
		async ({ params, body, user }) => {
			await assertCompanyManagement(user, params.companyId);
			return companyService.update(
				user.id,
				params.companyId,
				body,
				await companyAccessForUser(user),
			);
		},
		{
			body: t.Object({
				name: t.Optional(t.String()),
				document: t.Optional(t.Nullable(t.String())),
				tradeName: t.Optional(t.Nullable(t.String())),
				addressCity: t.Optional(t.Nullable(t.String())),
				addressState: t.Optional(t.Nullable(t.String())),
				structuredAddress: t.Optional(
					t.Nullable(
						t.Object({
							zipCode: t.String(),
							street: t.Optional(t.String()),
							district: t.Optional(t.String()),
							number: t.Optional(t.String()),
							city: t.String(),
							state: t.String({ minLength: 2, maxLength: 2 }),
							complement: t.Optional(t.Nullable(t.String())),
							latitude: t.Optional(t.Nullable(t.Number())),
							longitude: t.Optional(t.Nullable(t.Number())),
						}),
					),
				),
				contactEmail: t.Optional(t.Nullable(t.String())),
				contactPhone: t.Optional(t.Nullable(t.String())),
				managerName: t.Optional(t.Nullable(t.String())),
			}),
			detail: {
				tags: ["Companies"],
				summary: "Atualizar empresa",
				description:
					"Atualiza os dados cadastrais da empresa conforme a capability administrativa do ator.",
			},
		},
	)
	.delete(
		"/companies/:companyId",
		async ({ params, user }) => {
			await assertCompanyManagement(user, params.companyId);
			await companyService.delete(
				user.id,
				params.companyId,
				await companyAccessForUser(user),
			);
			return new Response(null, { status: 204 });
		},
		{
			detail: {
				tags: ["Companies"],
				summary: "Excluir empresa",
				description:
					"Exclui a empresa indicada após validar a capability administrativa e suas dependências.",
			},
		},
	)
	.post(
		"/companies/:companyId/link/:orgId",
		async ({ params, user }) => {
			await assertCompanyManagement(user, params.companyId);
			return companyService.linkOrganization(
				user.id,
				params.companyId,
				params.orgId,
				await companyAccessForUser(user),
			);
		},
		{
			detail: {
				tags: ["Companies"],
				summary: "Vincular organização à empresa",
				description:
					"Vincula uma organização existente à empresa administrada pelo ator.",
			},
		},
	)
	.post(
		"/companies/:companyId/template",
		async ({ params, body, user }) => {
			await assertCompanyManagement(user, params.companyId);
			if (!body.file) {
				throw new ConstructionError("MISSING_FILE", "Arquivo obrigatorio", 400);
			}
			return companyService.uploadContractTemplate(
				user.id,
				params.companyId,
				body.file,
				await companyAccessForUser(user),
			);
		},
		{
			body: t.Object({ file: t.File() }),
			detail: {
				tags: ["Companies"],
				summary: "Atualizar template da empresa",
				description:
					"Substitui o template DOCX vigente da empresa após validar seu conteúdo.",
			},
		},
	)
	.get(
		"/companies/:companyId/template",
		async ({ params, user }) => {
			const template = await companyService.downloadContractTemplate(
				user.id,
				params.companyId,
				companyAccessFor(user.role, user.workspaceId),
			);
			return new Response(new Blob([template.bytes.buffer as ArrayBuffer]), {
				headers: {
					"content-type": template.contentType,
					"content-disposition": `attachment; filename="${template.filename}"`,
				},
			});
		},
		{
			detail: {
				tags: ["Companies"],
				summary: "Baixar template da empresa",
				description:
					"Baixa o template DOCX privado da empresa após validar o acesso atual do ator.",
			},
		},
	);
