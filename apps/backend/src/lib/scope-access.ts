import type { ScopeAccessFlags } from "./authorization";
import { prisma } from "./prisma";
import { resolvePortfolioScope, resolveResourceScope } from "./resource-scope";

export type ScopeAccess = ScopeAccessFlags;

export async function resolveScopeAccess(
	userId: string,
	scopeType: "organization" | "costCenter" | "work",
	scopeId: string,
): Promise<ScopeAccess> {
	const resource =
		scopeType === "organization"
			? { organizationId: scopeId }
			: scopeType === "costCenter"
				? { costCenterId: scopeId }
				: { workId: scopeId };
	const scope = await resolveResourceScope(userId, resource);
	return {
		canRead: scope.canRead,
		canWrite: scope.canWrite,
		canApprove: scope.canApprove,
		canAdmin: scope.canAdmin,
	};
}

export async function getAccessibleWorkIds(userId: string): Promise<string[]> {
	const { paths } = await resolvePortfolioScope(userId);
	return paths.map((p) => p.workId);
}

export async function getAccessibleOrgIds(userId: string): Promise<string[]> {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { role: true, banned: true },
	});
	if (user?.role === "ADMIN") {
		const orgs = await prisma.organization.findMany({ select: { id: true } });
		return orgs.map((o) => o.id);
	}
	const memberships = await prisma.organizationMembership.findMany({
		where: { userId, revokedAt: null },
		select: { organizationId: true },
	});
	return [...new Set(memberships.map((m) => m.organizationId))];
}

export async function getAccessibleCostCenterIds(
	userId: string,
): Promise<string[]> {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { role: true, banned: true },
	});
	if (user?.role === "ADMIN") {
		const ccs = await prisma.costCenter.findMany({ select: { id: true } });
		return ccs.map((c) => c.id);
	}
	if (user?.role === "GERENTE") {
		const orgMemberships = await prisma.organizationMembership.findMany({
			where: { userId, revokedAt: null },
			select: {
				organization: { select: { costCenters: { select: { id: true } } } },
			},
		});
		const ccIds = new Set<string>();
		for (const om of orgMemberships) {
			for (const cc of om.organization.costCenters) ccIds.add(cc.id);
		}
		return [...ccIds];
	}
	const ccMemberships = await prisma.costCenterMembership.findMany({
		where: { userId, revokedAt: null },
		select: { costCenterId: true },
	});
	return [...new Set(ccMemberships.map((m) => m.costCenterId))];
}

export async function getUserScopes(userId: string) {
	const [orgMemberships, ccMemberships, workMemberships] = await Promise.all([
		prisma.organizationMembership.findMany({
			where: { userId, revokedAt: null },
		}),
		prisma.costCenterMembership.findMany({
			where: { userId, revokedAt: null },
		}),
		prisma.workMembership.findMany({ where: { userId, revokedAt: null } }),
	]);
	return { orgMemberships, ccMemberships, workMemberships };
}
