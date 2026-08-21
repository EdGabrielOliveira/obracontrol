import type { Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma";

export type AnalyticsContractRow = {
	supplierId: string | null;
	supplierName: string | null;
	contractValue: Prisma.Decimal;
	measurements: Array<{
		items: Array<{ measuredValue: Prisma.Decimal | null }>;
	}>;
	payments: Array<{ value: Prisma.Decimal; paidValue: Prisma.Decimal }>;
	quotations?: Array<{
		proposals: Array<{
			supplierId: string | null;
			supplierName: string;
			value: Prisma.Decimal;
			isWinner: boolean;
		}>;
		rounds: Array<{ events: Array<{ id: string }> }>;
	}>;
};

export async function listContractsForAnalytics(
	ownerId: string,
	filters?: { workId?: string },
): Promise<AnalyticsContractRow[]> {
	const where: Prisma.ContractWhereInput = { ownerId };
	if (filters?.workId) where.workId = filters.workId;
	return prisma.contract.findMany({
		where,
		select: {
			supplierId: true,
			supplierName: true,
			contractValue: true,
			measurements: {
				select: { items: { select: { measuredValue: true } } },
			},
			payments: { select: { value: true, paidValue: true } },
			quotations: {
				select: {
					proposals: {
						select: {
							supplierId: true,
							supplierName: true,
							value: true,
							isWinner: true,
						},
					},
					rounds: { select: { events: { select: { id: true } } } },
				},
			},
		},
	});
}
