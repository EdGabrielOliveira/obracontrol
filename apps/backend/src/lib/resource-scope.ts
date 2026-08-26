import {
	type AuthorizationRole,
	isAuthorizationRole,
	normalizeRole,
	roleToScopeAccess,
	type ScopeAccessFlags,
} from "./authorization";
import { prisma } from "./prisma";
import { requestContext } from "./request-context";

export type ScopeContextRole = AuthorizationRole;

export type ScopeContext = {
	actorId: string;
	resourceType: "ORGANIZATION" | "COST_CENTER" | "WORK";
	resourceOwnerId: string;
	workspaceId?: string;
	path: {
		organizationId: string;
		costCenterId: string | null;
		workId: string | null;
	};
	role: ScopeContextRole | null;
	canRead: boolean;
	canWrite: boolean;
	canApprove: boolean;
	canAdmin: boolean;
	canAudit?: boolean;
};

export type ScopeResource = {
	organizationId?: string;
	costCenterId?: string;
	workId?: string;
};

export type PortfolioPath = {
	organizationId: string;
	costCenterId: string | null;
	workId: string;
};

type ResourceChain = {
	organizationId: string;
	costCenterId: string | null;
	workId: string | null;
	ownerId: string;
	workspaceId: string | null;
};

type MembershipSet = {
	organizationIds: string[];
	costCenterIds: string[];
	workIds: string[];
};

function deniedContext(
	actorId: string,
	resourceType: ScopeContext["resourceType"],
): ScopeContext {
	return {
		actorId,
		resourceType,
		resourceOwnerId: "",
		workspaceId: "",
		path: { organizationId: "", costCenterId: null, workId: null },
		role: null,
		canRead: false,
		canWrite: false,
		canApprove: false,
		canAdmin: false,
		canAudit: false,
	};
}

function grantedContext(
	actorId: string,
	chain: ResourceChain,
	resourceType: ScopeContext["resourceType"],
	role: AuthorizationRole,
): ScopeContext {
	const access = roleToScopeAccess(role);
	return {
		actorId,
		resourceType,
		resourceOwnerId: chain.ownerId,
		workspaceId: chain.workspaceId ?? "",
		path: {
			organizationId: chain.organizationId,
			costCenterId: chain.costCenterId,
			workId: chain.workId,
		},
		role,
		canRead: access.canRead,
		canWrite: access.canWrite,
		canApprove: access.canApprove,
		canAdmin: access.canAdmin,
		canAudit: access.canAudit,
	};
}

async function resolveWorkChain(workId: string): Promise<ResourceChain | null> {
	const work = await prisma.constructionWork.findUnique({
		where: { id: workId },
		select: { id: true, ownerId: true, workspaceId: true, costCenterId: true },
	});
	if (!work) return null;
	const costCenter = await prisma.costCenter.findUnique({
		where: { id: work.costCenterId },
		select: { id: true, organizationId: true },
	});
	if (!costCenter) return null;
	const organization = await prisma.organization.findUnique({
		where: { id: costCenter.organizationId },
		select: { id: true, ownerId: true, workspaceId: true },
	});
	if (!organization) return null;
	return {
		organizationId: organization.id,
		costCenterId: costCenter.id,
		workId: work.id,
		// `ownerId` permanece como contexto de compatibilidade para os
		// registros operacionais legados. Em rotas de obra ele precisa ser o
		// autor da própria obra (e não o autor da organização); a autorização
		// entre administradores é garantida pelo workspace logo abaixo.
		ownerId: work.ownerId,
		workspaceId: work.workspaceId ?? organization.workspaceId,
	};
}

async function resolveCostCenterChain(
	costCenterId: string,
): Promise<ResourceChain | null> {
	const costCenter = await prisma.costCenter.findUnique({
		where: { id: costCenterId },
		select: { id: true, organizationId: true },
	});
	if (!costCenter) return null;
	const organization = await prisma.organization.findUnique({
		where: { id: costCenter.organizationId },
		select: { id: true, ownerId: true, workspaceId: true },
	});
	if (!organization) return null;
	return {
		organizationId: organization.id,
		costCenterId: costCenter.id,
		workId: null,
		ownerId: organization.ownerId,
		workspaceId: organization.workspaceId,
	};
}

async function resolveOrganizationChain(
	organizationId: string,
): Promise<ResourceChain | null> {
	const organization = await prisma.organization.findUnique({
		where: { id: organizationId },
		select: { id: true, ownerId: true, workspaceId: true },
	});
	if (!organization) return null;
	return {
		organizationId: organization.id,
		costCenterId: null,
		workId: null,
		ownerId: organization.ownerId,
		workspaceId: organization.workspaceId,
	};
}

async function resolveActiveMemberships(
	actorId: string,
): Promise<MembershipSet> {
	const [organizationMemberships, costCenterMemberships, workMemberships] =
		await Promise.all([
			prisma.organizationMembership.findMany({
				where: { userId: actorId, revokedAt: null },
				select: { organizationId: true },
			}),
			prisma.costCenterMembership.findMany({
				where: { userId: actorId, revokedAt: null },
				select: { costCenterId: true },
			}),
			prisma.workMembership.findMany({
				where: { userId: actorId, revokedAt: null },
				select: { workId: true },
			}),
		]);
	return {
		organizationIds: organizationMemberships.map((m) => m.organizationId),
		costCenterIds: costCenterMemberships.map((m) => m.costCenterId),
		workIds: workMemberships.map((m) => m.workId),
	};
}

export async function resolveResourceScope(
	actorId: string,
	resource: ScopeResource,
): Promise<ScopeContext> {
	const user = await prisma.user.findUnique({
		where: { id: actorId },
		select: { role: true, banned: true, workspaceId: true },
	});
	if (!user || user.banned) {
		return deniedContext(actorId, "ORGANIZATION");
	}
	const normalized = normalizeRole(user.role);
	if (!isAuthorizationRole(normalized)) {
		return deniedContext(actorId, "ORGANIZATION");
	}
	const role = normalized as AuthorizationRole;

	const resourceType: ScopeContext["resourceType"] = resource.workId
		? "WORK"
		: resource.costCenterId
			? "COST_CENTER"
			: "ORGANIZATION";

	const chain = resource.workId
		? await resolveWorkChain(resource.workId)
		: resource.costCenterId
			? await resolveCostCenterChain(resource.costCenterId)
			: resource.organizationId
				? await resolveOrganizationChain(resource.organizationId)
				: null;
	if (!chain) return deniedContext(actorId, resourceType);
	if (
		user.workspaceId &&
		chain.workspaceId &&
		chain.workspaceId !== user.workspaceId
	) {
		return deniedContext(actorId, resourceType);
	}
	chain.workspaceId = chain.workspaceId ?? user.workspaceId;
	const apiKeyOrgScope = requestContext.getApiKeyOrgScope();
	if (apiKeyOrgScope && chain.organizationId !== apiKeyOrgScope) {
		return deniedContext(actorId, resourceType);
	}

	if (role === "ADMIN") {
		return grantedContext(actorId, chain, resourceType, "ADMIN");
	}

	const memberships = await resolveActiveMemberships(actorId);

	if (role === "GERENTE") {
		if (!memberships.organizationIds.includes(chain.organizationId)) {
			return deniedContext(actorId, resourceType);
		}
		return grantedContext(actorId, chain, resourceType, "GERENTE");
	}

	if (role === "GESTOR" || role === "SUPERVISOR") {
		const hasOrganizationAccess = memberships.organizationIds.includes(
			chain.organizationId,
		);
		const hasCostCenterAccess = chain.costCenterId
			? memberships.costCenterIds.includes(chain.costCenterId)
			: false;

		// Gestor pode receber uma organização inteira ou apenas centros de
		// custo. Supervisor sempre fica limitado ao centro explicitamente
		// direcionado. A obra herda o acesso do centro pai.
		if (role === "SUPERVISOR") {
			if (resourceType === "ORGANIZATION" || !hasCostCenterAccess) {
				return deniedContext(actorId, resourceType);
			}
		} else if (
			(resourceType === "ORGANIZATION" && !hasOrganizationAccess) ||
			(resourceType !== "ORGANIZATION" &&
				!hasOrganizationAccess &&
				!hasCostCenterAccess)
		) {
			return deniedContext(actorId, resourceType);
		}
		if (resourceType === "WORK") {
			// A Gestor assigned to an organization inherits every work below it;
			// work-level assignments only restrict a Gestor assigned to CCs.
			if (!(role === "GESTOR" && hasOrganizationAccess)) {
				const restrictedWorkIds = await resolveRestrictedWorkIds(
					actorId,
					memberships,
				);
				if (
					restrictedWorkIds.length > 0 &&
					(chain.workId === null || !restrictedWorkIds.includes(chain.workId))
				) {
					return deniedContext(actorId, resourceType);
				}
			}
		}
		return grantedContext(actorId, chain, resourceType, role);
	}

	return deniedContext(actorId, resourceType);
}

async function resolveRestrictedWorkIds(
	actorId: string,
	memberships: MembershipSet,
): Promise<string[]> {
	const workMemberships = await prisma.workMembership.findMany({
		where: { userId: actorId, revokedAt: null },
		select: {
			work: {
				select: {
					id: true,
					costCenterId: true,
				},
			},
		},
	});
	const assignedCenters = new Set(memberships.costCenterIds);
	const validWorkIds = workMemberships
		.filter((membership) => assignedCenters.has(membership.work.costCenterId))
		.map((membership) => membership.work.id);
	return [...new Set(validWorkIds)].sort();
}

export async function resolvePortfolioScope(actorId: string): Promise<{
	actorId: string;
	paths: PortfolioPath[];
}> {
	const user = await prisma.user.findUnique({
		where: { id: actorId },
		select: { role: true, banned: true, workspaceId: true },
	});
	if (!user || user.banned || !isAuthorizationRole(user.role)) {
		return { actorId, paths: [] };
	}
	const role = user.role as AuthorizationRole;

	const candidates: PortfolioPath[] = [];

	if (role === "ADMIN") {
		const works = await prisma.constructionWork.findMany({
			where: user.workspaceId ? { workspaceId: user.workspaceId } : undefined,
			select: {
				id: true,
				costCenter: { select: { id: true, organizationId: true } },
			},
		});
		for (const work of works) {
			candidates.push({
				organizationId: work.costCenter?.organizationId ?? "",
				costCenterId: work.costCenter?.id ?? null,
				workId: work.id,
			});
		}
	} else if (role === "GERENTE") {
		const orgMemberships = await prisma.organizationMembership.findMany({
			where: { userId: actorId, revokedAt: null },
			select: {
				organization: {
					select: {
						id: true,
						costCenters: {
							select: { id: true, works: { select: { id: true } } },
						},
					},
				},
			},
		});
		for (const membership of orgMemberships) {
			for (const costCenter of membership.organization.costCenters) {
				for (const work of costCenter.works) {
					candidates.push({
						organizationId: membership.organization.id,
						costCenterId: costCenter.id,
						workId: work.id,
					});
				}
			}
		}
	} else if (role === "GESTOR" || role === "SUPERVISOR") {
		const [orgMemberships, ccMemberships, workMemberships] = await Promise.all([
			prisma.organizationMembership.findMany({
				where: { userId: actorId, revokedAt: null },
				select: {
					organizationId: true,
					organization: {
						select: {
							id: true,
							costCenters: {
								select: { id: true, works: { select: { id: true } } },
							},
						},
					},
				},
			}),
			prisma.costCenterMembership.findMany({
				where: { userId: actorId, revokedAt: null },
				select: {
					costCenter: {
						select: {
							id: true,
							organizationId: true,
							works: { select: { id: true } },
						},
					},
				},
			}),
			prisma.workMembership.findMany({
				where: { userId: actorId, revokedAt: null },
				select: {
					work: {
						select: {
							id: true,
							costCenter: { select: { id: true, organizationId: true } },
						},
					},
				},
			}),
		]);
		const grantedOrgIds = new Set(
			orgMemberships.map((membership) => membership.organizationId),
		);
		const grantedCenterIds = new Set<string>();
		const centers = new Map<
			string,
			{ id: string; organizationId: string; works: Array<{ id: string }> }
		>();
		if (role === "GESTOR") {
			for (const membership of orgMemberships) {
				for (const costCenter of membership.organization?.costCenters ?? []) {
					grantedCenterIds.add(costCenter.id);
					centers.set(costCenter.id, {
						id: costCenter.id,
						organizationId: membership.organizationId,
						works: costCenter.works,
					});
				}
			}
		}
		for (const membership of ccMemberships) {
			const costCenter = membership.costCenter;
			if (!costCenter) continue;
			grantedCenterIds.add(costCenter.id);
			centers.set(costCenter.id, costCenter);
			grantedOrgIds.add(costCenter.organizationId);
		}

		const validWorkIds = new Set(
			workMemberships
				.filter(
					(membership) =>
						membership.work.costCenter &&
						(grantedCenterIds.has(membership.work.costCenter.id) ||
							grantedOrgIds.has(membership.work.costCenter.organizationId)),
				)
				.map((membership) => membership.work.id),
		);
		const restrictionActive =
			!(role === "GESTOR" && orgMemberships.length > 0) &&
			validWorkIds.size > 0;
		for (const costCenter of centers.values()) {
			if (!grantedOrgIds.has(costCenter.organizationId)) continue;
			for (const work of costCenter.works) {
				if (restrictionActive && !validWorkIds.has(work.id)) continue;
				candidates.push({
					organizationId: costCenter.organizationId,
					costCenterId: costCenter.id,
					workId: work.id,
				});
			}
		}
	}

	const byKey = new Map<string, PortfolioPath>();
	for (const path of candidates) {
		byKey.set(
			`${path.organizationId}::${path.costCenterId ?? ""}::${path.workId}`,
			path,
		);
	}

	const paths = [...byKey.values()].sort(
		(a, b) =>
			a.organizationId.localeCompare(b.organizationId) ||
			(a.costCenterId ?? "").localeCompare(b.costCenterId ?? "") ||
			a.workId.localeCompare(b.workId),
	);

	return { actorId, paths };
}

export type { ScopeAccessFlags };
