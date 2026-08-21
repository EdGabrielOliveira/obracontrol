import { beforeEach, describe, expect, it, mock } from "bun:test";

const contractFindFirst = mock(
	async (): Promise<Record<string, unknown> | null> => ({ id: "contract-1" }),
);
const contractServiceCount = mock(async () => 1);
const contractServiceFindMany = mock(async () => [
	{
		id: "service-1",
		description: "Servico 1",
		parentId: null,
		sortOrder: 1,
		quantity: 10,
		unitCost: 50,
		totalCost: 500,
	},
]);
const contractMeasurementFindMany = mock(async () => [
	{
		id: "measurement-1",
		retentionValue: null,
		discountValue: null,
		items: [
			{
				serviceId: "service-1",
				measuredQuantity: 1,
				measuredValue: null,
				measuredPercentage: 100,
				accumulatedQuantity: null,
				accumulatedValue: null,
				accumulatedPercentage: null,
			},
		],
	},
]);
const contractMeasurementCount = mock(async () => 1);
const measurementCreate = mock(async () => ({ id: "measurement-1" }));
const measurementUpdate = mock(async () => ({ id: "measurement-1" }));
const measurementItemCreateMany = mock(async () => ({ count: 1 }));
const measurementItemCreate = mock(async () => ({ id: "cmi-new" }));
const measurementItemUpdate = mock(async () => ({ id: "cmi-1" }));
const measurementItemDelete = mock(async () => ({ id: "cmi-2" }));
const measurementItemDeleteMany = mock(async () => ({ count: 0 }));
const contractPaymentFindMany = mock(async (): Promise<unknown[]> => []);
const measurementFindFirst = mock(
	async (): Promise<Record<string, unknown>> => ({
		id: "measurement-1",
		items: [
			{
				serviceId: "service-1",
				measuredQuantity: 4,
				measuredValue: 200,
				measuredPercentage: 40,
				accumulatedQuantity: 4,
				accumulatedValue: 200,
				accumulatedPercentage: 40,
			},
		],
	}),
);

function makeStoredMeasurement(
	items: Array<Record<string, unknown>>,
): Record<string, unknown> {
	return {
		id: "measurement-1",
		ownerId: "owner-1",
		contractId: "contract-1",
		number: 1,
		date: new Date("2026-07-01"),
		title: "Medicao 1",
		discountValue: null,
		retentionValue: null,
		evidenceNote: null,
		createdBy: null,
		notes: null,
		createdAt: new Date("2026-07-01"),
		updatedAt: new Date("2026-07-01"),
		items,
	};
}

beforeEach(() => {
	measurementCreate.mockClear();
	measurementUpdate.mockClear();
	measurementItemCreateMany.mockClear();
	measurementItemCreate.mockClear();
	measurementItemUpdate.mockClear();
	measurementItemDelete.mockClear();
	measurementItemDeleteMany.mockClear();
});

mock.module("../../../../src/lib/prisma", () => ({
	prisma: {
		contract: { findFirst: contractFindFirst },
		contractService: {
			count: contractServiceCount,
			findMany: contractServiceFindMany,
		},
		contractMeasurement: {
			findMany: contractMeasurementFindMany,
			count: contractMeasurementCount,
			findFirst: measurementFindFirst,
			create: measurementCreate,
			update: measurementUpdate,
		},
		contractPayment: {
			findMany: contractPaymentFindMany,
		},
		$transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
			callback({
				contract: { findFirst: contractFindFirst },
				contractService: {
					count: contractServiceCount,
					findMany: contractServiceFindMany,
				},
				contractMeasurement: {
					create: measurementCreate,
					update: measurementUpdate,
					findFirst: measurementFindFirst,
				},
				contractMeasurementItem: {
					createMany: measurementItemCreateMany,
					create: measurementItemCreate,
					update: measurementItemUpdate,
					delete: measurementItemDelete,
					deleteMany: measurementItemDeleteMany,
				},
			}),
	},
}));

describe("contract measurement repository", () => {
	it("derives measured value and accumulated totals from service quantity and unit cost", async () => {
		const { createMeasurement } = await import(
			"../../../../src/modules/construction-planning/contract-measurement.repository"
		);

		await createMeasurement("owner-1", "contract-1", {
			date: "2026-07-29",
			title: "Medicao 1",
			items: [{ serviceId: "service-1", measuredQuantity: 4 }],
		});

		expect(measurementItemCreateMany).toHaveBeenCalledWith({
			data: [
				expect.objectContaining({
					serviceId: "service-1",
					measuredQuantity: 4,
					measuredValue: 200,
					measuredPercentage: 40,
					accumulatedQuantity: 4,
					accumulatedValue: 200,
					accumulatedPercentage: 40,
				}),
			],
		});
	});

	it("derives measured values when listing existing measurements with null measured value", async () => {
		const { listMeasurements } = await import(
			"../../../../src/modules/construction-planning/contract-measurement.repository"
		);

		const result = await listMeasurements("owner-1", "contract-1");

		expect(result.data[0].items[0]).toMatchObject({
			serviceId: "service-1",
			measuredQuantity: 1,
			measuredValue: 50,
			measuredPercentage: 100,
			accumulatedQuantity: 1,
			accumulatedValue: 50,
			accumulatedPercentage: 100,
		});
	});

	it("derives measured values in measurement detail totals for existing rows", async () => {
		measurementFindFirst.mockResolvedValueOnce({
			id: "measurement-1",
			items: [
				{
					serviceId: "service-1",
					measuredQuantity: 1,
					measuredValue: null,
					measuredPercentage: 100,
					accumulatedQuantity: null,
					accumulatedValue: null,
					accumulatedPercentage: null,
				},
			],
		});
		const { getMeasurementDetail } = await import(
			"../../../../src/modules/construction-planning/contract-measurement.repository"
		);

		const result = await getMeasurementDetail(
			"owner-1",
			"contract-1",
			"measurement-1",
		);

		expect(result?.totals.measuredCurrent).toBe(50);
		expect(result?.totals.measuredAccumulated).toBe(50);
		expect(result?.serviceTree[0]).toMatchObject({
			measuredCurrent: { quantity: 1, value: 50, percentage: 100 },
			measuredAccumulated: { quantity: 1, value: 50, percentage: 100 },
			balance: { quantity: 9, value: 450, percentage: 90 },
		});
	});

	it("normalizes measurement detail totals to currency precision", async () => {
		contractFindFirst.mockResolvedValueOnce({
			id: "contract-1",
			contractValue: 100,
		});
		measurementFindFirst.mockResolvedValueOnce({
			id: "measurement-1",
			items: [
				{
					serviceId: "service-1",
					measuredQuantity: null,
					measuredValue: 0.1,
					measuredPercentage: null,
					accumulatedQuantity: null,
					accumulatedValue: 0.1,
					accumulatedPercentage: null,
				},
				{
					serviceId: "service-2",
					measuredQuantity: null,
					measuredValue: 0.2,
					measuredPercentage: null,
					accumulatedQuantity: null,
					accumulatedValue: 0.2,
					accumulatedPercentage: null,
				},
			],
		});
		const { getMeasurementDetail } = await import(
			"../../../../src/modules/construction-planning/contract-measurement.repository"
		);

		const result = await getMeasurementDetail(
			"owner-1",
			"contract-1",
			"measurement-1",
		);

		expect(result?.totals).toMatchObject({
			measuredCurrent: 0.3,
			measuredAccumulated: 0.3,
			balance: 99.7,
		});
	});

	it("getServiceTotals retorna mapa serviceId -> totalCost apenas para servicos do contrato", async () => {
		contractServiceFindMany.mockImplementation(async () => [
			{
				id: "service-1",
				description: "Servico 1",
				parentId: null,
				sortOrder: 1,
				quantity: 10,
				unitCost: 50,
				totalCost: 500,
			},
			{
				id: "service-2",
				description: "Servico 2",
				parentId: null,
				sortOrder: 2,
				quantity: 5,
				unitCost: 100,
				totalCost: 500,
			},
		]);
		const { getServiceTotals } = await import(
			"../../../../src/modules/construction-planning/contract-measurement.repository"
		);

		const result = await getServiceTotals("owner-1", "contract-1", [
			"service-1",
			"service-2",
			"fora-do-contrato",
		]);

		expect(result).toEqual({ "service-1": 500, "service-2": 500 });
	});

	it("createMeasurement persiste override como false e sem evidencia (decisao por papel)", async () => {
		measurementFindFirst.mockImplementation(async () =>
			makeStoredMeasurement([]),
		);
		const { createMeasurement } = await import(
			"../../../../src/modules/construction-planning/contract-measurement.repository"
		);

		const result = await createMeasurement("owner-1", "contract-1", {
			number: 1,
			date: "2026-07-01",
			title: "Medicao 1",
			items: [
				{
					serviceId: "service-1",
					measuredValue: 500,
					accumulatedValue: 600,
				},
			],
		});

		expect(measurementCreate).toHaveBeenCalledWith({
			data: expect.objectContaining({
				balanceOverride: false,
				evidenceNote: null,
			}),
		});
		expect(measurementItemCreateMany).toHaveBeenCalled();
		expect(result?.id).toBe("measurement-1");
	});

	it("createMeasurement revalida serviceId pertence ao contrato (422 INVALID_SERVICE)", async () => {
		contractServiceCount.mockImplementation(async () => 0);
		const { createMeasurement } = await import(
			"../../../../src/modules/construction-planning/contract-measurement.repository"
		);

		const promise = createMeasurement("owner-1", "contract-1", {
			date: "2026-07-29",
			title: "Medicao 1",
			items: [{ serviceId: "fora-do-contrato", measuredValue: 100 }],
		});

		await expect(promise).rejects.toMatchObject({
			code: "INVALID_SERVICE",
			status: 422,
		});
		expect(measurementCreate).not.toHaveBeenCalled();
		expect(measurementItemCreateMany).not.toHaveBeenCalled();
	});

	it("updateMeasurement diff-based preserva ids de itens nao alterados (sem deleteMany+createMany)", async () => {
		measurementFindFirst.mockImplementation(async () =>
			makeStoredMeasurement([
				{
					id: "cmi-1",
					measurementId: "measurement-1",
					serviceId: "service-1",
					measuredQuantity: 10,
					measuredValue: 500,
					measuredPercentage: 10,
					accumulatedQuantity: null,
					accumulatedValue: null,
					accumulatedPercentage: null,
				},
				{
					id: "cmi-2",
					measurementId: "measurement-1",
					serviceId: "service-2",
					measuredQuantity: 5,
					measuredValue: 250,
					measuredPercentage: 5,
					accumulatedQuantity: null,
					accumulatedValue: null,
					accumulatedPercentage: null,
				},
			]),
		);
		contractServiceCount.mockImplementation(async () => 2);
		contractServiceFindMany.mockImplementation(async () => [
			{
				id: "service-1",
				description: "Servico 1",
				parentId: null,
				sortOrder: 1,
				quantity: 10,
				unitCost: 50,
				totalCost: 500,
			},
			{
				id: "service-3",
				description: "Servico 3",
				parentId: null,
				sortOrder: 3,
				quantity: 2,
				unitCost: 50,
				totalCost: 100,
			},
		]);
		const { updateMeasurement } = await import(
			"../../../../src/modules/construction-planning/contract-measurement.repository"
		);

		const result = await updateMeasurement(
			"owner-1",
			"contract-1",
			"measurement-1",
			{
				title: "Atualizada",
				items: [
					{ serviceId: "service-1", measuredValue: 600 },
					{ serviceId: "service-3", measuredValue: 100 },
				],
			},
		);

		expect(result?.id).toBe("measurement-1");
		expect(measurementItemUpdate).toHaveBeenCalledWith({
			where: { id: "cmi-1" },
			data: expect.objectContaining({
				serviceId: "service-1",
				measuredValue: 600,
			}),
		});
		expect(measurementItemCreate).toHaveBeenCalledWith({
			data: expect.objectContaining({
				measurementId: "measurement-1",
				serviceId: "service-3",
				measuredValue: 100,
			}),
		});
		expect(measurementItemDelete).toHaveBeenCalledWith({
			where: { id: "cmi-2" },
		});
		expect(measurementItemDeleteMany).not.toHaveBeenCalled();
		expect(measurementItemCreateMany).not.toHaveBeenCalled();
	});

	it("updateMeasurement revalida serviceId pertence ao contrato (422 INVALID_SERVICE)", async () => {
		measurementFindFirst.mockImplementation(async () =>
			makeStoredMeasurement([
				{
					id: "cmi-1",
					measurementId: "measurement-1",
					serviceId: "service-1",
					measuredQuantity: 10,
					measuredValue: 500,
					measuredPercentage: 10,
					accumulatedQuantity: null,
					accumulatedValue: null,
					accumulatedPercentage: null,
				},
			]),
		);
		contractServiceCount.mockImplementation(async () => 0);
		const { updateMeasurement } = await import(
			"../../../../src/modules/construction-planning/contract-measurement.repository"
		);

		const promise = updateMeasurement(
			"owner-1",
			"contract-1",
			"measurement-1",
			{
				items: [{ serviceId: "fora-do-contrato", measuredValue: 100 }],
			},
		);

		await expect(promise).rejects.toMatchObject({
			code: "INVALID_SERVICE",
			status: 422,
		});
		expect(measurementUpdate).not.toHaveBeenCalled();
		expect(measurementItemDeleteMany).not.toHaveBeenCalled();
		expect(measurementItemCreateMany).not.toHaveBeenCalled();
	});

	it("updateMeasurement sem items nao toca itens existentes", async () => {
		measurementFindFirst.mockImplementation(async () =>
			makeStoredMeasurement([
				{
					id: "cmi-1",
					measurementId: "measurement-1",
					serviceId: "service-1",
					measuredQuantity: 10,
					measuredValue: 500,
					measuredPercentage: 10,
					accumulatedQuantity: null,
					accumulatedValue: null,
					accumulatedPercentage: null,
				},
			]),
		);
		const { updateMeasurement } = await import(
			"../../../../src/modules/construction-planning/contract-measurement.repository"
		);

		const result = await updateMeasurement(
			"owner-1",
			"contract-1",
			"measurement-1",
			{
				title: "Somente titulo",
			},
		);

		expect(
			(result?.items as Array<Record<string, unknown>>)?.map((i) => i.id),
		).toEqual(["cmi-1"]);
		expect(measurementItemUpdate).not.toHaveBeenCalled();
		expect(measurementItemDelete).not.toHaveBeenCalled();
		expect(measurementItemDeleteMany).not.toHaveBeenCalled();
		expect(measurementItemCreateMany).not.toHaveBeenCalled();
	});
});

describe("getPaymentBalance", () => {
	it("usa o total derivado (base + aditivos) e desconsidera pagamentos EM_ABERTO", async () => {
		contractFindFirst.mockImplementationOnce(async () => ({
			id: "contract-1",
			contractValue: 1000,
			amendments: [
				{ kind: "ADITIVO", value: 200 },
				{ kind: "REDUCAO", value: 100 },
			],
		}));
		contractPaymentFindMany.mockImplementationOnce(async () => [
			{ id: "p-1", status: "PAGO", paidValue: 300 },
			{ id: "p-2", status: "EM_ABERTO", paidValue: 900 },
		]);
		const { getPaymentBalance } = await import(
			"../../../../src/modules/construction-planning/contract-measurement.repository"
		);

		const result = await getPaymentBalance("owner-1", "contract-1");

		expect(result).toEqual({ derivedTotal: 1100, totalPaid: 300 });
	});

	it("exclui o pagamento em edicao do total pago", async () => {
		contractFindFirst.mockImplementationOnce(async () => ({
			id: "contract-1",
			contractValue: 1000,
			amendments: [],
		}));
		contractPaymentFindMany.mockImplementationOnce(async () => [
			{ id: "p-1", status: "PAGO", paidValue: 800 },
			{ id: "p-2", status: "PAGO", paidValue: 400 },
		]);
		const { getPaymentBalance } = await import(
			"../../../../src/modules/construction-planning/contract-measurement.repository"
		);

		const result = await getPaymentBalance("owner-1", "contract-1", {
			excludePaymentId: "p-1",
		});

		expect(result).toEqual({ derivedTotal: 1000, totalPaid: 400 });
	});

	it("arredonda o total derivado com centavos fracionados (saldo exibido vs gate)", async () => {
		contractFindFirst.mockImplementationOnce(async () => ({
			id: "contract-1",
			contractValue: 100.005,
			amendments: [{ kind: "ADITIVO", value: 0.005 }],
		}));
		contractPaymentFindMany.mockImplementationOnce(async () => []);
		const { getPaymentBalance } = await import(
			"../../../../src/modules/construction-planning/contract-measurement.repository"
		);

		const result = await getPaymentBalance("owner-1", "contract-1");

		expect(result).toEqual({ derivedTotal: 100.01, totalPaid: 0 });
	});

	it("retorna null quando o contrato nao existe", async () => {
		contractFindFirst.mockImplementationOnce(
			async (): Promise<Record<string, unknown> | null> => null,
		);
		const { getPaymentBalance } = await import(
			"../../../../src/modules/construction-planning/contract-measurement.repository"
		);

		const result = await getPaymentBalance("owner-1", "contract-1");

		expect(result).toBeNull();
	});
});

describe("getContractAggregate com aditivos", () => {
	it("deriva totalContracted e balance pelos aditivos", async () => {
		contractFindFirst.mockImplementationOnce(async () => ({
			id: "contract-1",
			ownerId: "owner-1",
			code: "CT-001",
			supplierName: "Fornecedor",
			title: null,
			status: "EM_ANDAMENTO",
			contractValue: 1000,
			services: [],
			measurements: [],
			payments: [{ id: "p-1", status: "PAGO", paidValue: 300 }],
			amendments: [
				{ kind: "ADITIVO", value: 500 },
				{ kind: "REDUCAO", value: 200 },
			],
		}));
		const { getContractAggregate } = await import(
			"../../../../src/modules/construction-planning/contract-measurement.repository"
		);

		const result = await getContractAggregate("owner-1", "contract-1");

		expect(result?.totals.totalContracted).toBe(1300);
		expect(result?.totals.totalPaid).toBe(300);
		expect(result?.totals.balance).toBe(1000);
	});
});
