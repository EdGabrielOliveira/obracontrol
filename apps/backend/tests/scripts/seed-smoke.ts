import { resolveBudgetAnalysisVersion } from "../../src/lib/budget-version-adapter";
import { prisma } from "../../src/lib/prisma";
import { ConstructionBIService } from "../../src/modules/construction-planning/bi/bi-service";
import * as constructionRepository from "../../src/modules/construction-planning/repository";
import { scheduleVersionService } from "../../src/modules/construction-planning/schedule/schedule-version.service";
import * as workMeasurementRepository from "../../src/modules/construction-planning/work-measurement.repository";

const biService = new ConstructionBIService({
	...constructionRepository,
	...workMeasurementRepository,
});

function assert(condition: unknown, message: string): asserts condition {
	if (!condition) throw new Error(`SMOKE_ASSERT: ${message}`);
}

async function validateContractingScenarios(adminId: string) {
	const quotationGroups = await prisma.quotation.groupBy({
		by: ["status"],
		where: { ownerId: adminId },
		_count: { _all: true },
	});
	const quotationCountByStatus = Object.fromEntries(
		quotationGroups.map((group) => [group.status, group._count._all]),
	);
	const expectedQuotations: Record<string, number> = {
		EM_COTACAO: 2,
		NEGOCIACAO: 2,
		ESCOLHIDA: 2,
		CONTRATADA: 2,
	};
	for (const [status, expected] of Object.entries(expectedQuotations)) {
		assert(
			quotationCountByStatus[status] === expected,
			`cotacoes ${status}: esperado ${expected}, obtido ${quotationCountByStatus[status] ?? 0}`,
		);
	}

	const quotations = await prisma.quotation.findMany({
		where: { ownerId: adminId },
		include: {
			_count: { select: { proposals: true, budgetItems: true } },
		},
	});
	for (const quotation of quotations) {
		assert(
			quotation._count.budgetItems > 0,
			`cotacao sem itens vinculados: ${quotation.title}`,
		);
		if (quotation.status === "EM_COTACAO") {
			assert(
				quotation._count.proposals === 0,
				`cotacao EM_COTACAO com propostas: ${quotation.title}`,
			);
		} else {
			assert(
				quotation._count.proposals >= 2,
				`cotacao ${quotation.status} com menos de 2 propostas: ${quotation.title}`,
			);
		}
	}

	const winnerProposals = await prisma.quotationProposal.findMany({
		where: {
			quotationId: { in: quotations.map((quotation) => quotation.id) },
			isWinner: true,
		},
		select: { quotationId: true, supplierName: true },
	});
	const winnerByQuotation = new Map(
		winnerProposals.map((proposal) => [
			proposal.quotationId,
			proposal.supplierName,
		]),
	);
	const escolhidas = quotations.filter((q) => q.status === "ESCOLHIDA");
	for (const quotation of escolhidas) {
		assert(
			winnerByQuotation.has(quotation.id),
			`cotacao ESCOLHIDA sem vencedor: ${quotation.title}`,
		);
		assert(
			quotation.contractId === null,
			`cotacao ESCOLHIDA com contrato vinculado: ${quotation.title}`,
		);
	}
	const contratadas = quotations.filter((q) => q.status === "CONTRATADA");
	for (const quotation of contratadas) {
		assert(
			quotation.contractId !== null,
			`cotacao CONTRATADA sem contrato: ${quotation.title}`,
		);
		assert(
			winnerByQuotation.has(quotation.id),
			`cotacao CONTRATADA sem vencedor: ${quotation.title}`,
		);
		const contract = await prisma.contract.findUnique({
			where: { id: quotation.contractId },
			select: { status: true, contractRequestId: true },
		});
		assert(
			contract?.status === "RASCUNHO",
			`contrato da cotacao CONTRATADA nao esta em RASCUNHO: ${quotation.title}`,
		);
		assert(
			contract?.contractRequestId === null,
			`contrato da cotacao nao pode nascer de solicitacao: ${quotation.title}`,
		);
	}

	const requestGroups = await prisma.contractRequest.groupBy({
		by: ["status"],
		where: { ownerId: adminId },
		_count: { _all: true },
	});
	const requestCountByStatus = Object.fromEntries(
		requestGroups.map((group) => [group.status, group._count._all]),
	);
	assert(
		requestCountByStatus.EM_ESPERA === 2,
		`solicitacoes EM_ESPERA: esperado 2, obtido ${requestCountByStatus.EM_ESPERA ?? 0}`,
	);
	assert(
		requestCountByStatus.ACEITA === 2,
		`solicitacoes ACEITA: esperado 2, obtido ${requestCountByStatus.ACEITA ?? 0}`,
	);

	const requests = await prisma.contractRequest.findMany({
		where: { ownerId: adminId },
		include: { _count: { select: { items: true } } },
	});
	for (const request of requests) {
		assert(request._count.items > 0, `solicitacao sem itens: ${request.title}`);
		assert(
			request.confirmedBatchId !== null,
			`solicitacao sem lote confirmado: ${request.title}`,
		);
	}

	const proposalCountByBatch = await prisma.contractRequestProposal.groupBy({
		by: ["batchId"],
		where: { ownerId: adminId },
		_count: { _all: true },
	});
	for (const request of requests) {
		const count = proposalCountByBatch.find(
			(group) => group.batchId === request.confirmedBatchId,
		)?._count._all;
		assert(
			count !== undefined && count >= 2,
			`solicitacao com menos de 2 propostas: ${request.title}`,
		);
	}

	const proposalSuppliers = await prisma.contractRequestProposal.findMany({
		where: { ownerId: adminId },
		select: { normalizedCnpj: true, supplierName: true, workId: true },
	});
	for (const proposal of proposalSuppliers) {
		const supplier = await prisma.constructionSupplier.findFirst({
			where: { ownerId: adminId, document: proposal.normalizedCnpj },
			select: { id: true },
		});
		assert(
			supplier !== null,
			`fornecedor da proposta nao cadastrado: ${proposal.supplierName}`,
		);
		const linked = await prisma.constructionWorkSupplier.findFirst({
			where: {
				ownerId: adminId,
				workId: proposal.workId,
				supplierId: supplier.id,
			},
			select: { id: true },
		});
		assert(
			linked !== null,
			`fornecedor da proposta nao vinculado a obra: ${proposal.supplierName}`,
		);
	}

	const batches = await prisma.importBatch.findMany({
		where: { ownerId: adminId, model: "quotation-map" },
		include: { _count: { select: { rows: true } } },
	});
	for (const batch of batches) {
		assert(
			batch.status === "CONFIRMED",
			`lote de mapa de cotacao nao confirmado: ${batch.id}`,
		);
		assert(
			batch._count.rows > 0,
			`lote de mapa de cotacao sem linhas: ${batch.id}`,
		);
	}

	const acceptedRequests = requests.filter((r) => r.status === "ACEITA");
	for (const request of acceptedRequests) {
		assert(
			request.contractId !== null,
			`solicitacao aceita sem contrato: ${request.title}`,
		);
		assert(
			request.acceptedProposalId !== null,
			`solicitacao aceita sem proposta aceita: ${request.title}`,
		);
		const contract = await prisma.contract.findUnique({
			where: { id: request.contractId },
			select: { status: true, contractRequestId: true, supplierId: true },
		});
		assert(
			contract?.status === "RASCUNHO",
			`contrato de solicitacao aceita nao esta em RASCUNHO: ${request.title}`,
		);
		assert(
			contract?.contractRequestId === request.id,
			`contrato nao aponta para a solicitacao aceita: ${request.title}`,
		);
		const services = await prisma.contractService.count({
			where: { contractId: request.contractId },
		});
		assert(
			services > 0,
			`contrato de solicitacao aceita sem servicos: ${request.title}`,
		);
	}

	const pendingRequests = requests.filter((r) => r.status === "EM_ESPERA");
	for (const request of pendingRequests) {
		assert(
			request.contractId === null,
			`solicitacao EM_ESPERA com contrato: ${request.title}`,
		);
	}

	console.log(
		`CONTRATACAO: cotacoes=${quotations.length} (EM_COTACAO=${quotationCountByStatus.EM_COTACAO} NEGOCIACAO=${quotationCountByStatus.NEGOCIACAO} ESCOLHIDA=${quotationCountByStatus.ESCOLHIDA} CONTRATADA=${quotationCountByStatus.CONTRATADA}) solicitacoes=${requests.length} (EM_ESPERA=${requestCountByStatus.EM_ESPERA} ACEITA=${requestCountByStatus.ACEITA})`,
	);
}

async function validateCompaniesUsersGovernance(adminId: string) {
	const companies = await prisma.company.findMany({
		where: { ownerId: adminId },
		include: { _count: { select: { organizations: true } } },
	});
	assert(
		companies.length === 2,
		`empresas: esperado 2, obtido ${companies.length}`,
	);
	const atlasCompany = companies.find((c) => c.document === "60123456000170");
	const secretariaCompany = companies.find(
		(c) => c.document === "46324178000199",
	);
	assert(
		atlasCompany?._count.organizations === 2,
		"Grupo Atlas S.A. deve ter 2 organizacoes vinculadas",
	);
	assert(
		secretariaCompany?._count.organizations === 1,
		"Secretaria deve ter 1 organizacao vinculada",
	);

	const organizations = await prisma.organization.findMany({
		where: { ownerId: adminId },
	});
	assert(
		organizations.every(
			(org) => org.companyId !== null && org.managerName && org.address,
		),
		"organizacoes sem empresa/gerente/endereco vinculados",
	);
	const costCenters = await prisma.costCenter.findMany({
		where: { ownerId: adminId },
	});
	assert(
		costCenters.every((cc) => cc.managerName && cc.address),
		"centros de custo sem gerente/endereco",
	);
	const works = await prisma.constructionWork.findMany({
		where: { ownerId: adminId },
		select: { id: true, address: true },
	});
	assert(
		works.length === 36 && works.every((work) => work.address),
		`obras sem endereco: ${works.length}/36`,
	);

	const userCount = await prisma.user.count();
	assert(userCount === 10, `usuarios: esperado 10, obtido ${userCount}`);
	const gerente = await prisma.user.findUnique({
		where: { email: "gerente@obracontrol.dev" },
		include: { workMemberships: true },
	});
	assert(
		gerente?.workMemberships.length === 12,
		`gerente deve ter 12 memberships de obra, obtido ${gerente?.workMemberships.length}`,
	);
	const supervisorObra = await prisma.user.findUnique({
		where: { email: "supervisor.obra@obracontrol.dev" },
		include: { workMemberships: true },
	});
	assert(
		supervisorObra?.workMemberships.length === 3,
		`supervisor-obra deve ter 3 memberships de obra, obtido ${supervisorObra?.workMemberships.length}`,
	);

	const invitations = await prisma.userInvitation.findMany();
	assert(
		invitations.length === 2,
		`convites: esperado 2, obtido ${invitations.length}`,
	);
	const pendingInvites = invitations.filter(
		(invite) => invite.acceptedAt === null,
	);
	const acceptedInvites = invitations.filter(
		(invite) => invite.acceptedAt !== null,
	);
	assert(
		pendingInvites.length === 1 && acceptedInvites.length === 1,
		"esperado 1 convite pendente e 1 aceito",
	);
	assert(
		pendingInvites[0]?.email === "gestor.convidado@grupoatlas.com.br",
		"convite pendente deve apontar para o gestor convidado",
	);

	const grants = await prisma.userScopeGrant.count();
	assert(grants === 6, `scope grants: esperado 6, obtido ${grants}`);

	const workGovernance = await prisma.governanceRecord.findMany({
		where: { ownerId: adminId, entityType: "WORK" },
	});
	const statusCounts = workGovernance.reduce<Record<string, number>>(
		(acc, record) => {
			acc[record.status] = (acc[record.status] ?? 0) + 1;
			return acc;
		},
		{},
	);
	for (const status of ["RASCUNHO", "EM_REVISAO", "ACEITO", "TRAVADO"]) {
		assert(
			statusCounts[status] === 2,
			`governanca WORK ${status}: esperado 2, obtido ${statusCounts[status] ?? 0}`,
		);
	}
	const budgetGovernance = await prisma.governanceRecord.count({
		where: { ownerId: adminId, entityType: "BUDGET_VERSION" },
	});
	assert(
		budgetGovernance === 2,
		`governanca BUDGET_VERSION: esperado 2, obtido ${budgetGovernance}`,
	);

	const pendingApprovals = await prisma.approvalRequest.findMany({
		where: { ownerId: adminId, status: "PENDING" },
	});
	assert(
		pendingApprovals.length === 4,
		`aprovacoes pendentes: esperado 4, obtido ${pendingApprovals.length}`,
	);
	const effectActions = pendingApprovals.map((a) => a.effectAction).sort();
	assert(
		JSON.stringify(effectActions) ===
			JSON.stringify(
				[
					"CONTRACT_MEASUREMENT_APPROVE",
					"COST_APPROVE",
					"PAYMENT_CONFIRM",
					"WORK_MEASUREMENT_APPROVE",
				].sort(),
			),
		`effectActions divergentes: ${effectActions.join(",")}`,
	);
	const gestorDecided = pendingApprovals.find(
		(a) => a.requiredApproverRole === "GESTOR",
	);
	assert(
		gestorDecided !== undefined,
		"nenhuma aprovacao pendente requer papel GESTOR",
	);
	assert(
		pendingApprovals.every((a) => a.payloadHash.length === 64),
		"payloadHash de aprovacao invalido",
	);

	const approved = await prisma.approvalRequest.count({
		where: { ownerId: adminId, status: "APPROVED" },
	});
	const rejected = await prisma.approvalRequest.count({
		where: { ownerId: adminId, status: "REJECTED" },
	});
	assert(
		approved === 1 && rejected === 1,
		`aprovacoes decididas: esperado 1 aprovada e 1 rejeitada, obtido ${approved}/${rejected}`,
	);
	const decisions = await prisma.approvalDecision.count();
	assert(decisions === 2, `decisoes: esperado 2, obtido ${decisions}`);
	const notifications = await prisma.notification.count();
	assert(
		notifications === 3,
		`notificacoes: esperado 3, obtido ${notifications}`,
	);

	console.log(
		`EMPRESAS/USUARIOS/GOVERNANCA: empresas=${companies.length} orgsVinculadas=${organizations.length} usuarios=${userCount} membershipsObra=${gerente?.workMemberships.length ?? 0}+${supervisorObra?.workMemberships.length ?? 0} convites=${invitations.length} grants=${grants} governancaWORK=${workGovernance.length} aprovacoesPendentes=${pendingApprovals.length} decididas=${approved + rejected} notificacoes=${notifications}`,
	);
}

async function smoke() {
	const admin = await prisma.user.findUnique({
		where: { email: "admin@admin.com" },
		select: { id: true },
	});
	if (!admin) throw new Error("admin nao encontrado");

	const works = await prisma.constructionWork.findMany({
		where: { ownerId: admin.id },
		select: { id: true, code: true },
		take: 3,
	});

	for (const work of works) {
		const bi = await biService.getWorkBI(admin.id, work.id);
		const budgetVersion = await resolveBudgetAnalysisVersion(
			admin.id,
			work.id,
			{},
		);
		const scheduleViews = await scheduleVersionService.getScheduleVersions(
			admin.id,
			work.id,
		);
		console.log(
			`${work.code}: BI mode=${bi.sourceMode} pv=${bi.summary?.plannedValue ?? "n/a"} ev=${bi.summary?.earnedValue ?? "n/a"} ac=${bi.summary?.actualCost ?? "n/a"} quality=${bi.qualityIssues?.length ?? 0} | budgetVersion=${budgetVersion.budgetVersionId ? "ok" : "null"} scheduleVersions=${scheduleViews.length}`,
		);
	}

	await validateContractingScenarios(admin.id);
	await validateCompaniesUsersGovernance(admin.id);
	console.log("SMOKE_OK");
}

smoke()
	.catch((error) => {
		console.error("SMOKE_FAIL", error);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
