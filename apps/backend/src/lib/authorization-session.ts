import {
	type AuthorizationRole,
	isAuthorizationRole,
	normalizeRole,
} from "./authorization";
import { prisma } from "./prisma";

export type AuthorizationSession = {
	user: { id: string; name: string; email: string; role: AuthorizationRole };
	organizations: Array<{ id: string; name: string }>;
	costCenters: Array<{ id: string; organizationId: string; name: string }>;
	capabilities: {
		canManageUsers: boolean;
		canAdministerCompanies: boolean;
		canManageScopedCompanies?: boolean;
		canManageStructure?: boolean;
		canManageApiKeys: boolean;
		canViewAudit?: boolean;
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
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: {
			id: true,
			name: true,
			email: true,
			role: true,
			workspaceId: true,
		},
	});
	if (!user) {
		throw new Error("AuthorizationSession: usuario nao encontrado");
	}
	const [companyMemberships, orgMemberships, ccMemberships] = await Promise.all(
		[
			prisma.companyMembership.findMany({
				where: {
					userId,
					revokedAt: null,
					company: { workspaceId: user.workspaceId ?? null },
				},
				select: {
					company: {
						select: {
							organizations: {
								select: {
									id: true,
									name: true,
									costCenters: {
										select: { id: true, organizationId: true, name: true },
									},
								},
							},
						},
					},
				},
			}),
			prisma.organizationMembership.findMany({
				where: {
					userId,
					revokedAt: null,
					organization: { workspaceId: user.workspaceId ?? null },
				},
				select: {
					organizationId: true,
					organization: {
						select: {
							id: true,
							name: true,
							costCenters: {
								select: { id: true, organizationId: true, name: true },
							},
						},
					},
				},
			}),
			prisma.costCenterMembership.findMany({
				where: {
					userId,
					revokedAt: null,
					costCenter: { workspaceId: user.workspaceId ?? null },
				},
				select: {
					costCenterId: true,
					costCenter: {
						select: { id: true, organizationId: true, name: true },
					},
				},
			}),
		],
	);

	const normalizedRole = normalizeRole(user.role);
	if (!isAuthorizationRole(normalizedRole)) {
		throw new Error("AuthorizationSession: papel de usuario invalido");
	}
	const role = normalizedRole as AuthorizationRole;

	const organizationList = orgMemberships.map((m) => ({
		id: m.organization.id,
		name: m.organization.name,
	}));
	const companyOrganizations = companyMemberships.flatMap(
		(m) => m.company.organizations,
	);
	const organizations = [...organizationList];
	if (role === "GERENTE") {
		organizations.push(
			...companyOrganizations.map((org) => ({ id: org.id, name: org.name })),
		);
	}
	const costCenters = ccMemberships.map((m) => ({
		id: m.costCenter.id,
		organizationId: m.costCenter.organizationId,
		name: m.costCenter.name,
	}));
	if (role === "GERENTE") {
		costCenters.push(...companyOrganizations.flatMap((org) => org.costCenters));
	}
	if (role === "GESTOR") {
		const orgCenters = orgMemberships.flatMap(
			(m) => m.organization.costCenters ?? [],
		);
		costCenters.push(...orgCenters);
	}
	const uniqueOrganizations = [
		...new Map(organizations.map((org) => [org.id, org])).values(),
	];
	const uniqueCostCenters = [
		...new Map(costCenters.map((cc) => [cc.id, cc])).values(),
	];

	return {
		user: { id: user.id, name: user.name, email: user.email, role },
		organizations: uniqueOrganizations,
		costCenters: uniqueCostCenters,
		capabilities: {
			canManageUsers: role === "ADMIN" || role === "GERENTE",
			canAdministerCompanies: role === "ADMIN",
			canManageScopedCompanies: role === "ADMIN" || role === "GERENTE",
			canManageStructure: role !== "SUPERVISOR",
			canManageApiKeys: role === "ADMIN",
			canViewAudit: role === "ADMIN" || role === "GERENTE",
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
