import { prisma } from "../../../lib/prisma";

export type WorkIdentityRow = {
	id: string;
	code: string;
	name: string;
};

export type ContractExecutionNode = {
	id: string;
	code: string;
	supplierName: string;
	contractValue: number;
	amendmentNet: number;
	status: string;
	linkedBudgetItems: Array<{
		id: string;
		index: string;
		description: string;
	}>;
};

export type ScheduleVersionIdentity = {
	id: string;
	label: string;
	versionNumber: number;
};

export type ExecutionViewRepository = {
	getWorkIdentity(
		ownerId: string,
		workId: string,
	): Promise<WorkIdentityRow | null>;
	listContractExecutionNodes(
		ownerId: string,
		workId: string,
		asOfDate?: Date,
	): Promise<ContractExecutionNode[]>;
	getScheduleVersionIdentity(
		ownerId: string,
		workId: string,
	): Promise<ScheduleVersionIdentity | null>;
};

export const prismaExecutionViewRepository: ExecutionViewRepository = {
	async getWorkIdentity(ownerId, workId) {
		const work = await prisma.constructionWork.findFirst({
			where: { ownerId, id: workId },
			select: { id: true, code: true, name: true },
		});
		return work;
	},

	async listContractExecutionNodes(ownerId, workId, asOfDate) {
		const contracts = await prisma.contract.findMany({
			where: {
				ownerId,
				workId,
				...(asOfDate ? { createdAt: { lte: asOfDate } } : {}),
			},
			select: {
				id: true,
				code: true,
				supplierName: true,
				contractValue: true,
				status: true,
				amendments: {
					select: { value: true },
				},
				services: {
					where: { budgetItemId: { not: null } },
					select: {
						budgetItemId: true,
						budgetItem: {
							select: { id: true, index: true, description: true },
						},
					},
				},
			},
			orderBy: { createdAt: "asc" },
		});

		return contracts.map((contract) => {
			const amendmentNet = contract.amendments.reduce(
				(sum, amendment) => sum + Number(amendment.value),
				0,
			);
			return {
				id: contract.id,
				code: contract.code,
				supplierName: contract.supplierName,
				contractValue: Number(contract.contractValue) + amendmentNet,
				amendmentNet,
				status: contract.status,
				linkedBudgetItems: contract.services.flatMap((service) =>
					service.budgetItem
						? [
								{
									id: service.budgetItem.id,
									index: service.budgetItem.index,
									description: service.budgetItem.description,
								},
							]
						: [],
				),
			};
		});
	},

	async getScheduleVersionIdentity(ownerId, workId) {
		const version = await prisma.scheduleVersion.findFirst({
			where: { ownerId, workId, isActive: true },
			select: { id: true, label: true, versionNumber: true },
			orderBy: { versionNumber: "desc" },
		});
		return version;
	},
};
