import type { Prisma } from "@prisma/client";
import type { z } from "zod";
import { buildPaginatedResponse } from "../../lib/pagination";
import { prisma } from "../../lib/prisma";
import {
	getAccessibleCostCenterIds,
	getAccessibleOrgIds,
} from "../../lib/scope-access";
import { ensureWorkspaceForUser } from "../../lib/workspace";
import { getCostCenterReport as getCCReport } from "../construction-planning/management.repository";
import type {
	CostCenterFilter,
	OrganizationFilter,
	structuredAddressSchema,
} from "./schema";

type StructuredAddress = z.infer<typeof structuredAddressSchema>;

function addressCreateInput(address: StructuredAddress) {
	return {
		zipCode: address.zipCode.replace(/\D/g, ""),
		street: address.street?.trim() ?? "",
		district: address.district?.trim() ?? "",
		number: address.number?.trim() ?? "",
		city: address.city.trim(),
		state: address.state.trim().toUpperCase(),
		complement: address.complement?.trim() || null,
		latitude: address.latitude ?? null,
		longitude: address.longitude ?? null,
	};
}

export async function createOrganization(
	ownerId: string,
	data: {
		name: string;
		companyId?: string;
		managerName?: string;
		address?: string;
		structuredAddress?: StructuredAddress | null;
	},
) {
	const workspaceId = await ensureWorkspaceForUser(ownerId);
	return prisma.$transaction(async (tx) => {
		const company = data.companyId
			? await tx.company.findFirst({
					where: {
						id: data.companyId,
						workspaceId,
					},
					select: { ownerId: true },
				})
			: null;
		const resourceOwnerId = company?.ownerId ?? ownerId;
		const address = data.structuredAddress
			? await tx.address.create({
					data: addressCreateInput(data.structuredAddress),
				})
			: null;
		return tx.organization.create({
			data: {
				ownerId: resourceOwnerId,
				workspaceId,
				name: data.name,
				companyId: data.companyId || null,
				managerName: data.managerName?.trim() || null,
				address: data.address?.trim() || null,
				structuredAddressId: address?.id ?? null,
			},
			include: { structuredAddress: true },
		});
	});
}

export async function listOrganizations(
	ownerId: string,
	filters: Partial<OrganizationFilter> = {},
	options: { includeCompany?: boolean } = {},
) {
	const accessibleIds = await getAccessibleOrgIds(ownerId);
	const where: Prisma.OrganizationWhereInput = { id: { in: accessibleIds } };
	if (filters.q) {
		where.OR = [{ name: { contains: filters.q } }];
	}
	const page = filters.page ?? 1;
	const limit = filters.limit ?? 10;

	const [data, total] = await Promise.all([
		prisma.organization.findMany({
			where,
			include: {
				_count: { select: { costCenters: true } },
				...(options.includeCompany
					? { company: { select: { id: true, name: true } } }
					: {}),
			},
			orderBy: { createdAt: "desc" },
			skip: (page - 1) * limit,
			take: limit,
		}),
		prisma.organization.count({ where }),
	]);

	return buildPaginatedResponse(data, total, page, limit);
}

export async function getOrganizationById(
	ownerId: string,
	id: string,
	options: { includeCompany?: boolean } = {},
) {
	const accessibleIds = await getAccessibleOrgIds(ownerId);
	if (!accessibleIds.includes(id)) return null;
	const accessibleCostCenterIds = await getAccessibleCostCenterIds(ownerId);
	return prisma.organization.findFirst({
		where: { id },
		include: {
			costCenters: { where: { id: { in: accessibleCostCenterIds } } },
			structuredAddress: true,
			...(options.includeCompany
				? { company: { select: { id: true, name: true } } }
				: {}),
		},
	});
}

export async function updateOrganization(
	ownerId: string,
	id: string,
	data: {
		name?: string;
		companyId?: string;
		managerName?: string;
		address?: string;
		structuredAddress?: StructuredAddress | null;
	},
) {
	const accessibleIds = await getAccessibleOrgIds(ownerId);
	if (!accessibleIds.includes(id)) return null;
	const org = await prisma.organization.findFirst({
		where: { id },
	});
	if (!org) return null;
	if (data.companyId) {
		const company = await prisma.company.findFirst({
			where: {
				id: data.companyId,
				...(org.workspaceId
					? { workspaceId: org.workspaceId }
					: { workspaceId: null }),
			},
			select: { id: true },
		});
		if (!company) return null;
	}

	const updateData: Record<string, unknown> = {};
	if (data.name !== undefined) updateData.name = data.name;
	if (data.companyId !== undefined)
		updateData.companyId = data.companyId || null;
	if (data.managerName !== undefined)
		updateData.managerName = data.managerName || null;
	if (data.address !== undefined) updateData.address = data.address || null;
	if (data.structuredAddress !== undefined) {
		if (data.structuredAddress) {
			const address = await prisma.address.create({
				data: addressCreateInput(data.structuredAddress),
			});
			updateData.structuredAddressId = address.id;
		} else {
			updateData.structuredAddressId = null;
		}
	}

	return prisma.organization.update({
		where: { id },
		data: updateData,
		include: { structuredAddress: true },
	});
}

export async function deleteOrganization(ownerId: string, id: string) {
	const accessibleIds = await getAccessibleOrgIds(ownerId);
	if (!accessibleIds.includes(id)) return null;
	const org = await prisma.organization.findFirst({
		where: { id },
	});
	if (!org) return null;
	await prisma.organization.delete({ where: { id } });
	return org;
}

export async function createCostCenter(
	ownerId: string,
	organizationId: string,
	data: {
		name: string;
		managerName?: string;
		address?: string;
		structuredAddress?: StructuredAddress | null;
	},
) {
	const accessibleOrgIds = await getAccessibleOrgIds(ownerId);
	if (!accessibleOrgIds.includes(organizationId)) return null;
	const organization = await prisma.organization.findFirst({
		where: { id: organizationId },
		select: { id: true, ownerId: true, workspaceId: true },
	});
	return prisma.$transaction(async (tx) => {
		const address = data.structuredAddress
			? await tx.address.create({
					data: addressCreateInput(data.structuredAddress),
				})
			: null;
		return tx.costCenter.create({
			data: {
				ownerId: organization?.ownerId ?? ownerId,
				...(organization?.workspaceId
					? { workspaceId: organization.workspaceId }
					: {}),
				organizationId,
				name: data.name,
				managerName: data.managerName?.trim() || null,
				address: data.address?.trim() || null,
				structuredAddressId: address?.id ?? null,
			},
			include: { structuredAddress: true },
		});
	});
}

export async function listCostCenters(
	ownerId: string,
	organizationId: string,
	filters: Partial<CostCenterFilter> = {},
) {
	const accessibleIds = await getAccessibleCostCenterIds(ownerId);
	const where: Prisma.CostCenterWhereInput = {
		id: { in: accessibleIds },
		organizationId,
	};
	if (filters.q) {
		where.OR = [{ name: { contains: filters.q } }];
	}
	const page = filters.page ?? 1;
	const limit = filters.limit ?? 10;

	const [data, total] = await Promise.all([
		prisma.costCenter.findMany({
			where,
			include: { structuredAddress: true },
			orderBy: { createdAt: "desc" },
			skip: (page - 1) * limit,
			take: limit,
		}),
		prisma.costCenter.count({ where }),
	]);

	return buildPaginatedResponse(data, total, page, limit);
}

export async function getCostCenterById(
	ownerId: string,
	organizationId: string,
	id: string,
) {
	const accessibleIds = await getAccessibleCostCenterIds(ownerId);
	if (!accessibleIds.includes(id)) return null;
	return prisma.costCenter.findFirst({
		where: { id, organizationId },
		include: { works: true, structuredAddress: true },
	});
}

export async function updateCostCenter(
	ownerId: string,
	organizationId: string,
	id: string,
	data: {
		name?: string;
		organizationId?: string;
		managerName?: string;
		address?: string;
		structuredAddress?: StructuredAddress | null;
	},
) {
	const accessibleIds = await getAccessibleCostCenterIds(ownerId);
	const cc = await prisma.costCenter.findFirst({
		where: { id: { in: accessibleIds }, organizationId },
	});
	if (!cc) return null;

	const updateData: Record<string, unknown> = {};
	if (data.name !== undefined) updateData.name = data.name;
	if (data.managerName !== undefined)
		updateData.managerName = data.managerName || null;
	if (data.address !== undefined) updateData.address = data.address || null;
	if (data.structuredAddress !== undefined) {
		if (data.structuredAddress) {
			const address = await prisma.address.create({
				data: addressCreateInput(data.structuredAddress),
			});
			updateData.structuredAddressId = address.id;
		} else {
			updateData.structuredAddressId = null;
		}
	}
	if (data.organizationId !== undefined) {
		const accessibleOrgIds = await getAccessibleOrgIds(ownerId);
		if (!accessibleOrgIds.includes(data.organizationId)) return null;
		const targetOrg = await prisma.organization.findFirst({
			where: { id: data.organizationId },
		});
		if (!targetOrg) return null;
		updateData.organizationId = data.organizationId;
	}

	return prisma.costCenter.update({
		where: { id },
		data: updateData,
		include: { structuredAddress: true },
	});
}

export async function deleteCostCenter(
	ownerId: string,
	organizationId: string,
	id: string,
) {
	const accessibleIds = await getAccessibleCostCenterIds(ownerId);
	const cc = await prisma.costCenter.findFirst({
		where: { id: { in: accessibleIds }, organizationId },
	});
	if (!cc) return null;
	await prisma.costCenter.delete({ where: { id } });
	return cc;
}

export async function listAllCostCenters(
	ownerId: string,
	filters: Partial<CostCenterFilter> = {},
) {
	const accessibleIds = await getAccessibleCostCenterIds(ownerId);
	const page = filters.page ?? 1;
	const limit = filters.limit ?? 10;
	const where: Prisma.CostCenterWhereInput = { id: { in: accessibleIds } };
	if (filters.q) {
		where.OR = [{ name: { contains: filters.q } }];
	}

	const [data, total] = await Promise.all([
		prisma.costCenter.findMany({
			where,
			include: {
				organization: { select: { id: true, name: true } },
				structuredAddress: true,
			},
			orderBy: { createdAt: "desc" },
			skip: (page - 1) * limit,
			take: limit,
		}),
		prisma.costCenter.count({ where }),
	]);

	return buildPaginatedResponse(data, total, page, limit);
}

export async function getCostCenterByIdOnly(ownerId: string, ccId: string) {
	const accessibleIds = await getAccessibleCostCenterIds(ownerId);
	if (!accessibleIds.includes(ccId)) return null;
	const cc = await prisma.costCenter.findFirst({
		where: { id: ccId },
		include: {
			organization: { select: { id: true, name: true } },
			structuredAddress: true,
		},
	});
	if (!cc) return null;
	return cc;
}

export async function updateCostCenterByIdOnly(
	ownerId: string,
	ccId: string,
	data: {
		name?: string;
		organizationId?: string;
		managerName?: string;
		address?: string;
		structuredAddress?: StructuredAddress | null;
	},
) {
	const accessibleIds = await getAccessibleCostCenterIds(ownerId);
	if (!accessibleIds.includes(ccId)) return null;
	const cc = await prisma.costCenter.findFirst({
		where: { id: ccId },
	});
	if (!cc) return null;
	const updateData: Record<string, unknown> = {};
	if (data.name !== undefined) updateData.name = data.name;
	if (data.managerName !== undefined)
		updateData.managerName = data.managerName || null;
	if (data.address !== undefined) updateData.address = data.address || null;
	if (data.structuredAddress !== undefined) {
		if (data.structuredAddress) {
			const address = await prisma.address.create({
				data: addressCreateInput(data.structuredAddress),
			});
			updateData.structuredAddressId = address.id;
		} else {
			updateData.structuredAddressId = null;
		}
	}
	if (data.organizationId !== undefined) {
		const accessibleOrgIds = await getAccessibleOrgIds(ownerId);
		if (!accessibleOrgIds.includes(data.organizationId)) return null;
		const targetOrg = await prisma.organization.findFirst({
			where: { id: data.organizationId },
		});
		if (!targetOrg) return null;
		updateData.organizationId = data.organizationId;
	}
	return prisma.costCenter.update({
		where: { id: ccId },
		data: updateData,
		include: { structuredAddress: true },
	});
}

export async function deleteCostCenterByIdOnly(ownerId: string, ccId: string) {
	const accessibleIds = await getAccessibleCostCenterIds(ownerId);
	if (!accessibleIds.includes(ccId)) return null;
	const cc = await prisma.costCenter.findFirst({
		where: { id: ccId },
	});
	if (!cc) return null;
	await prisma.costCenter.delete({ where: { id: ccId } });
	return cc;
}

export async function getOrganizationReport(ownerId: string, orgId: string) {
	const accessibleOrgIds = await getAccessibleOrgIds(ownerId);
	if (!accessibleOrgIds.includes(orgId)) return null;

	const org = await prisma.organization.findFirst({
		where: { id: orgId },
		select: { id: true, name: true },
	});
	if (!org) return null;

	const accessibleCcIds = await getAccessibleCostCenterIds(ownerId);
	const costCenters = await prisma.costCenter.findMany({
		where: { id: { in: accessibleCcIds }, organizationId: orgId },
		select: { id: true, name: true },
	});

	const reports = await Promise.all(
		costCenters.map(async (cc) => {
			const report = await getCCReport(ownerId, cc.id);
			return report;
		}),
	);

	const validReports = reports.filter(
		(r): r is NonNullable<typeof r> => r !== null,
	);

	const totalWorks = validReports.reduce((s, r) => s + r.summary.totalWorks, 0);
	const totalBudgeted = validReports.reduce(
		(s, r) => s + r.summary.totalBudgeted,
		0,
	);
	const totalSpent = validReports.reduce((s, r) => s + r.summary.totalSpent, 0);

	return {
		organization: { id: org.id, name: org.name },
		costCenters: validReports.map((r) => ({
			id: r.costCenter.id,
			name: r.costCenter.name,
			works: r.summary.totalWorks,
			budgeted: r.summary.totalBudgeted,
			spent: r.summary.totalSpent,
		})),
		summary: {
			totalCostCenters: costCenters.length,
			totalWorks,
			totalBudgeted,
			totalSpent,
			balance: totalBudgeted - totalSpent,
		},
	};
}

export { getCCReport as getCostCenterReport };
