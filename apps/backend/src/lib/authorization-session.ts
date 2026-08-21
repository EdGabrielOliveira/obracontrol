import type { AuthorizationRole } from "./authorization";
import { prisma } from "./prisma";

export type AuthorizationSession = {
	user: { id: string; name: string; email: string; role: AuthorizationRole };
	organizations: Array<{ id: string; name: string }>;
	costCenters: Array<{ id: string; organizationId: string; name: string }>;
	capabilities: {
		canManageUsers: boolean;
		canAdministerCompanies: boolean;
		canManageApiKeys: boolean;
		canDecideSupervisorRequests: boolean;
		canReviewExecutedSupervisorRequests: boolean;
		canRequestSupervisorDecisionReversal: boolean;
		canDecideGestorRequests: boolean;
		canFinalizeContracts: boolean;
	};
};

export async function buildAuthorizationSession(
	userId: string,
): Promise<AuthorizationSession> {
	const [user, orgMemberships, ccMemberships] = await Promise.all([
		prisma.user.findUnique({
			where: { id: userId },
			select: { id: true, name: true, email: true, role: true },
		}),
		prisma.organizationMembership.findMany({
			where: { userId, revokedAt: null },
			select: {
				organizationId: true,
				organization: { select: { id: true, name: true } },
			},
		}),
		prisma.costCenterMembership.findMany({
			where: { userId, revokedAt: null },
			select: {
				costCenterId: true,
				costCenter: { select: { id: true, organizationId: true, name: true } },
			},
		}),
	]);

	if (!user) {
		throw new Error("AuthorizationSession: usuario nao encontrado");
	}

	const role = user.role as AuthorizationRole;

	const organizations = orgMemberships.map((m) => ({
		id: m.organization.id,
		name: m.organization.name,
	}));
	const costCenters = ccMemberships.map((m) => ({
		id: m.costCenter.id,
		organizationId: m.costCenter.organizationId,
		name: m.costCenter.name,
	}));

	return {
		user: { id: user.id, name: user.name, email: user.email, role },
		organizations,
		costCenters,
		capabilities: {
			canManageUsers: role === "ADMIN" || role === "GERENTE",
			canAdministerCompanies: role === "ADMIN",
			canManageApiKeys: role === "ADMIN",
			canDecideSupervisorRequests:
				role === "ADMIN" || role === "GERENTE" || role === "GESTOR",
			canReviewExecutedSupervisorRequests:
				role === "ADMIN" || role === "GERENTE",
			canRequestSupervisorDecisionReversal:
				role === "ADMIN" || role === "GERENTE",
			canDecideGestorRequests: role === "ADMIN" || role === "GERENTE",
			canFinalizeContracts: role === "ADMIN" || role === "GERENTE",
		},
	};
}
