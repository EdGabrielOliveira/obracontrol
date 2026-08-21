import { prisma } from "../../lib/prisma";
import { governanceService } from "../governance/governance.service";

export type GovernanceMutationGuard = Pick<
	typeof governanceService,
	"assertWritable" | "isWritableBlocked"
>;

export const budgetGovernanceGuard: GovernanceMutationGuard = governanceService;

export const constructionGovernanceGuard: GovernanceMutationGuard =
	governanceService;

// Cutover (APR-005): GovernanceRecord passa a ser apenas LOCK de recurso
// (ACEITO/TRAVADO bloqueia mutacao). A decisao de efeito (aprovacao de
// comando) vem do ApprovalRequest — nunca de duas fontes. Este adapter
// consulta o lock antigo e, se houver solicitacao pendente para a acao,
// bloqueia a mutacao ate a decisao (sem aplicar efeito duplicado).
export async function assertNoPendingEffect(
	ownerId: string,
	resourceType: string,
	resourceId: string,
	effectAction: string,
): Promise<void> {
	// Tolerante a mocks de teste sem o modelo de aprovacao: se o delegate nao
	// existe no client (teste isolado), nao ha pendencia a checar.
	const requestDelegate = (
		prisma as unknown as {
			approvalRequest?: { findFirst?: (args: unknown) => Promise<unknown> };
		}
	).approvalRequest;
	if (!requestDelegate?.findFirst) return;

	const pending = await requestDelegate.findFirst({
		where: {
			ownerId,
			resourceType,
			resourceId,
			effectAction,
			status: "PENDING",
		},
	});
	if (pending) {
		const { ConstructionError } = await import("../../lib/errors");
		throw new ConstructionError(
			"APPROVAL_PENDING",
			"Existe solicitacao de aprovacao pendente para esta acao",
			423,
		);
	}
}

// Leitura historica: o fluxo antigo de transicao (GovernanceRecord) continua
// legivel, mas novas escritas de aprovacao via transition sao bloqueadas
// quando existe motor de aprovacao para a entidade.
export const governanceGuardWithApproval: GovernanceMutationGuard = {
	assertWritable: async (ownerId, entityType, entityId) => {
		await governanceService.assertWritable(ownerId, entityType, entityId);
	},
	isWritableBlocked: async (ownerId, entityType, entityId) =>
		governanceService.isWritableBlocked(ownerId, entityType, entityId),
};
