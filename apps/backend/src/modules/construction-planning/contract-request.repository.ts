import type { Prisma } from "@prisma/client";

export type ContractRequestDetail = {
	id: string;
	ownerId: string;
	workId: string;
	title: string;
	serviceType: string;
	description: string | null;
	startDate: string | null;
	endDate: string | null;
	status: string;
	confirmedBatchId: string | null;
	acceptedProposalId: string | null;
	acceptedAt: string | null;
	acceptedBy: string | null;
	contractId: string | null;
	createdBy: string | null;
	items: Array<{ budgetItemId: string; quantity: number; sortOrder: number }>;
};

export function serializeRequest(request: {
	id: string;
	ownerId: string;
	workId: string;
	title: string;
	serviceType: string;
	description: string | null;
	startDate: Date | null;
	endDate: Date | null;
	status: string;
	confirmedBatchId: string | null;
	acceptedProposalId: string | null;
	acceptedAt: Date | null;
	acceptedBy: string | null;
	contractId: string | null;
	createdBy: string | null;
	items: Array<{
		budgetItemId: string;
		quantity: Prisma.Decimal;
		sortOrder: number;
	}>;
}): ContractRequestDetail {
	return {
		id: request.id,
		ownerId: request.ownerId,
		workId: request.workId,
		title: request.title,
		serviceType: request.serviceType,
		description: request.description,
		startDate: request.startDate?.toISOString() ?? null,
		endDate: request.endDate?.toISOString() ?? null,
		status: request.status,
		confirmedBatchId: request.confirmedBatchId,
		acceptedProposalId: request.acceptedProposalId,
		acceptedAt: request.acceptedAt?.toISOString() ?? null,
		acceptedBy: request.acceptedBy,
		contractId: request.contractId,
		createdBy: request.createdBy,
		items: request.items.map((item) => ({
			budgetItemId: item.budgetItemId,
			quantity: Number(item.quantity),
			sortOrder: item.sortOrder,
		})),
	};
}

export const contractRequestRepository = {
	serializeRequest,

	async findWithItems(
		db: Prisma.TransactionClient | typeof import("../../lib/prisma")["prisma"],
		ownerId: string,
		workId: string,
		requestId: string,
	) {
		return db.contractRequest.findFirst({
			where: { id: requestId, ownerId, workId },
			include: { items: { orderBy: { sortOrder: "asc" } } },
		});
	},

	async createWithItems(
		db: Prisma.TransactionClient,
		input: {
			ownerId: string;
			workId: string;
			title: string;
			serviceType: string;
			description: string | null;
			startDate: Date | null;
			endDate: Date | null;
			createdBy: string | null;
			items: Array<{ budgetItemId: string; quantity: Prisma.Decimal }>;
		},
	) {
		return db.contractRequest.create({
			data: {
				ownerId: input.ownerId,
				workId: input.workId,
				title: input.title,
				serviceType: input.serviceType,
				description: input.description,
				startDate: input.startDate,
				endDate: input.endDate,
				createdBy: input.createdBy,
				items: {
					create: input.items.map((item, sortOrder) => ({
						ownerId: input.ownerId,
						workId: input.workId,
						budgetItemId: item.budgetItemId,
						quantity: item.quantity,
						sortOrder,
					})),
				},
			},
			include: { items: { orderBy: { sortOrder: "asc" } } },
		});
	},
};
