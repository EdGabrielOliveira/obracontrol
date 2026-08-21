import Decimal from "decimal.js";
import { roundCurrency } from "../../../lib/math-utils";
import { toFiniteNumber } from "../../../lib/number-utils";
import * as analyticsRepository from "./supplier-analytics.repository";

export type SupplierAnalyticsItem = {
	supplierId: string | null;
	supplierName: string;
	contractCount: number;
	contractedAmount: number;
	measuredAmount: number;
	paidAmount: number;
	openAmount: number;
	roundCount: number;
	proposalCount: number;
	negotiationCount: number;
	awardedValue: number;
	reductionAmount: number | null;
	reductionPercent: number | null;
	participationPercent: number | null;
};

export type SupplierAnalyticsSort =
	| "contractCount"
	| "contractedAmount"
	| "measuredAmount"
	| "paidAmount";

export type SupplierAnalyticsFilters = {
	q?: string;
	workId?: string;
	sort?: SupplierAnalyticsSort;
	order?: "asc" | "desc";
	page?: number;
	limit?: number;
};

export function aggregateSupplierAnalytics(
	rows: analyticsRepository.AnalyticsContractRow[],
	filters: {
		q?: string;
		sort?: SupplierAnalyticsSort;
		order?: "asc" | "desc";
	} = {},
): SupplierAnalyticsItem[] {
	const decimal = (value: unknown) => new Decimal(toFiniteNumber(value));
	const bySupplier = new Map<string, SupplierAnalyticsItem>();
	for (const row of rows) {
		const key = row.supplierId ?? "";
		const group = bySupplier.get(key) ?? {
			supplierId: row.supplierId,
			supplierName: row.supplierName ?? "Sem fornecedor",
			contractCount: 0,
			contractedAmount: 0,
			measuredAmount: 0,
			paidAmount: 0,
			openAmount: 0,
			roundCount: 0,
			proposalCount: 0,
			negotiationCount: 0,
			awardedValue: 0,
			reductionAmount: 0,
			reductionPercent: null,
			participationPercent: null,
		};
		group.contractCount += 1;
		group.contractedAmount = Number(
			decimal(group.contractedAmount).plus(decimal(row.contractValue)),
		);
		for (const measurement of row.measurements) {
			for (const item of measurement.items) {
				group.measuredAmount = Number(
					decimal(group.measuredAmount).plus(decimal(item.measuredValue)),
				);
			}
		}
		for (const payment of row.payments) {
			group.paidAmount = Number(
				decimal(group.paidAmount).plus(decimal(payment.paidValue)),
			);
			group.openAmount = Number(
				decimal(group.openAmount).plus(
					decimal(payment.value).minus(decimal(payment.paidValue)),
				),
			);
		}
		for (const quotation of row.quotations ?? []) {
			group.roundCount += quotation.rounds.length;
			group.negotiationCount += quotation.rounds.reduce(
				(total, round) => total + round.events.length,
				0,
			);
			group.proposalCount += quotation.proposals.length;
			const proposals = quotation.proposals;
			const awarded = proposals.find(
				(proposal) =>
					proposal.isWinner &&
					(proposal.supplierId === row.supplierId ||
						proposal.supplierName === row.supplierName),
			);
			if (awarded) {
				group.awardedValue = Number(
					decimal(group.awardedValue).plus(decimal(awarded.value)),
				);
				const baseline = proposals
					.filter(
						(proposal) =>
							proposal.supplierId === row.supplierId ||
							proposal.supplierName === row.supplierName,
					)
					.reduce(
						(total, proposal) => total.plus(decimal(proposal.value)),
						new Decimal(0),
					);
				group.reductionAmount = Number(
					decimal(group.reductionAmount ?? 0).plus(
						baseline.minus(decimal(awarded.value)).greaterThan(0)
							? baseline.minus(decimal(awarded.value))
							: new Decimal(0),
					),
				);
			}
		}
		bySupplier.set(key, group);
	}

	let items = [...bySupplier.values()];
	if (filters.q) {
		const needle = filters.q.toLowerCase();
		items = items.filter((item) =>
			item.supplierName.toLowerCase().includes(needle),
		);
	}

	const sort = filters.sort ?? "contractedAmount";
	const order = filters.order ?? "desc";
	items.sort((a, b) => {
		const diff = a[sort] - b[sort];
		return order === "desc" ? -diff : diff;
	});

	return items.map((item) => ({
		...item,
		contractedAmount: roundCurrency(item.contractedAmount),
		measuredAmount: roundCurrency(item.measuredAmount),
		paidAmount: roundCurrency(item.paidAmount),
		openAmount: roundCurrency(item.openAmount),
		awardedValue: roundCurrency(item.awardedValue),
		reductionAmount:
			item.reductionAmount === null
				? null
				: roundCurrency(item.reductionAmount),
		reductionPercent:
			item.contractedAmount > 0 && item.reductionAmount !== null
				? roundCurrency((item.reductionAmount / item.contractedAmount) * 100)
				: null,
		participationPercent:
			item.proposalCount > 0
				? roundCurrency((item.contractCount / item.proposalCount) * 100)
				: null,
	}));
}

export class SupplierAnalyticsService {
	constructor(private readonly repository = analyticsRepository) {}

	async list(ownerId: string, filters: SupplierAnalyticsFilters = {}) {
		const rows = await this.repository.listContractsForAnalytics(ownerId, {
			workId: filters.workId,
		});
		const items = aggregateSupplierAnalytics(rows, {
			q: filters.q,
			sort: filters.sort,
			order: filters.order,
		});
		const page = Math.max(1, filters.page ?? 1);
		const limit = Math.min(100, Math.max(1, filters.limit ?? 50));
		const start = (page - 1) * limit;
		const data = items.slice(start, start + limit);
		return {
			items: data,
			data,
			total: items.length,
			page,
			limit,
			totalPages: Math.ceil(items.length / limit),
		};
	}
}

export const supplierAnalyticsService = new SupplierAnalyticsService();
