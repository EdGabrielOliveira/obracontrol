import { roundCurrency } from "../../../lib/math-utils";
import { toFiniteNumber } from "../../../lib/number-utils";

export type ContractServiceSummary = {
	id: string;
	description: string;
	type: string;
	contractValue: number;
	balance: number;
	measuredCurrent: number;
	measuredAccumulated: number;
	measuredPercentage: number;
};

export type ContractTotals = {
	contractValue: number;
	totalServicesValue: number;
	totalMeasured: number;
	measuredPercentage: number;
	totalPaid: number;
	retentionTotal: number;
	discountTotal: number;
	balance: number;
};

export type ContractAggregate = {
	contract: {
		id: string;
		code: string;
		supplierName: string;
		title: string | null;
		status: string;
		contractValue: number;
	};
	services: ContractServiceSummary[];
	totals: ContractTotals;
	measurementsCount: number;
	paymentsCount: number;
};

type ServiceRow = {
	id: string;
	description: string;
	type: string;
	quantity?: number | null;
	unitCost?: number | null;
	totalCost?: number | null;
};

type MeasurementWithItems = {
	id: string;
	date: Date | null;
	number: number | null;
	items: Array<{
		serviceId: string;
		measuredQuantity?: number | null;
		measuredValue?: number | null;
		measuredPercentage?: number | null;
		accumulatedQuantity?: number | null;
		accumulatedValue?: number | null;
		accumulatedPercentage?: number | null;
	}>;
};

type PaymentRow = {
	id: string;
	value?: number | null;
	paidValue?: number | null;
	retentionValue?: number | null;
	discountValue?: number | null;
	status: string;
};

export type ContractAmendmentLike = {
	kind: string;
	value?: number | null;
};

export function contractTotal(
	contractValue: number,
	amendments: ContractAmendmentLike[],
): number {
	return roundCurrency(
		amendments.reduce(
			(sum, amendment) =>
				amendment.kind === "ADITIVO"
					? sum + toFiniteNumber(amendment.value)
					: sum - toFiniteNumber(amendment.value),
			contractValue,
		),
	);
}

function effectiveServiceCost(service: ServiceRow): number {
	const explicit = toFiniteNumber(service.totalCost);
	if (explicit > 0) return explicit;
	const qty = toFiniteNumber(service.quantity);
	const uc = toFiniteNumber(service.unitCost);
	return qty * uc;
}

export function calculateContractAggregate(params: {
	contract: {
		id: string;
		code: string;
		supplierName: string;
		title: string | null;
		status: string;
		contractValue: number;
	};
	services: ServiceRow[];
	measurements: MeasurementWithItems[];
	payments: PaymentRow[];
	amendments?: ContractAmendmentLike[];
}): ContractAggregate {
	const {
		contract,
		services,
		measurements,
		payments,
		amendments = [],
	} = params;

	const servicesMap = new Map(
		services.map((s) => [s.id, effectiveServiceCost(s)]),
	);

	const approvedMeasurements = measurements;

	const latestByService = new Map<
		string,
		{
			accumulatedValue: number;
			measuredValue: number;
			measuredPercentage: number;
		}
	>();

	for (const measurement of approvedMeasurements) {
		for (const item of measurement.items) {
			const serviceCost = servicesMap.get(item.serviceId) ?? 0;
			const accVal = toFiniteNumber(item.accumulatedValue);
			const measVal = toFiniteNumber(item.measuredValue);
			const measPct = toFiniteNumber(item.measuredPercentage);
			const accPct = toFiniteNumber(item.accumulatedPercentage);

			const effectiveValue =
				accVal > 0
					? accVal
					: measVal > 0
						? measVal
						: measPct > 0 && serviceCost > 0
							? (measPct / 100) * serviceCost
							: 0;

			const effectivePercentage =
				accPct > 0
					? accPct
					: measPct > 0
						? measPct
						: serviceCost > 0
							? (effectiveValue / serviceCost) * 100
							: 0;

			latestByService.set(item.serviceId, {
				accumulatedValue: effectiveValue,
				measuredValue: measVal,
				measuredPercentage: effectivePercentage,
			});
		}
	}

	const serviceSummaries: ContractServiceSummary[] = services.map((s) => {
		const contractValue = servicesMap.get(s.id) ?? 0;
		const latest = latestByService.get(s.id);
		const measuredAccumulated = latest?.accumulatedValue ?? 0;
		return {
			id: s.id,
			description: s.description,
			type: s.type,
			contractValue,
			measuredCurrent: latest?.measuredValue ?? 0,
			measuredAccumulated,
			measuredPercentage:
				contractValue > 0 ? (measuredAccumulated / contractValue) * 100 : 0,
			balance: contractValue - measuredAccumulated,
		};
	});

	const totalServicesValue = services.reduce(
		(sum, s) => sum + effectiveServiceCost(s),
		0,
	);

	let totalMeasured = 0;
	for (const svcBlob of latestByService.values()) {
		totalMeasured += svcBlob.accumulatedValue;
	}

	const totalPaid = payments
		.filter((p) => p.status === "PAGO")
		.reduce((sum, p) => sum + toFiniteNumber(p.paidValue), 0);

	const retentionTotal = payments.reduce(
		(sum, p) => sum + toFiniteNumber(p.retentionValue),
		0,
	);

	const discountTotal = payments.reduce(
		(sum, p) => sum + toFiniteNumber(p.discountValue),
		0,
	);

	const contractValue = contractTotal(
		toFiniteNumber(contract.contractValue),
		amendments,
	);

	return {
		contract: {
			id: contract.id,
			code: contract.code,
			supplierName: contract.supplierName,
			title: contract.title,
			status: contract.status,
			contractValue,
		},
		services: serviceSummaries,
		totals: {
			contractValue,
			totalServicesValue,
			totalMeasured,
			measuredPercentage:
				contractValue > 0 ? (totalMeasured / contractValue) * 100 : 0,
			totalPaid,
			retentionTotal,
			discountTotal,
			balance: contractValue - totalPaid,
		},
		measurementsCount: approvedMeasurements.length,
		paymentsCount: payments.filter((p) => p.status === "PAGO").length,
	};
}
