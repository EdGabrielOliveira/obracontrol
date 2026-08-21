import { describe, expect, it, mock } from "bun:test";
import Decimal from "decimal.js";

const createWorkMeasurement = mock(
	async (
		_ownerId: string,
		_workId: string,
		input: {
			items: Array<Record<string, unknown>>;
		},
	) => ({
		id: "measurement-1",
		date: new Date("2026-08-04"),
		title: "Medicao 1",
		items: input.items.map((item, index) => ({
			id: `measurement-item-${index + 1}`,
			...item,
		})),
	}),
);
const updateWorkMeasurement = mock(async () => null);
const getLatestWorkMeasurementQuantities = mock(async () => ({
	"budget-item-1": new Decimal(0),
}));
const apply = mock(async () => ({
	status: "APPROVED",
	requiresApproval: false,
	availableBalance: 1500,
	projectedBalance: 1000,
	allocations: [
		{
			budgetItemId: "budget-item-1",
			impactId: "impact-1",
			status: "APPROVED",
			amount: 500,
			availableBalance: 1500,
			projectedBalance: 1000,
		},
	],
}));
const replaceSourceImpact = mock(async () => ({
	status: "APPROVED",
	requiresApproval: false,
	availableBalance: 1800,
	projectedBalance: 1600,
	allocations: [
		{
			budgetItemId: "budget-item-1",
			impactId: "impact-2",
			status: "APPROVED",
			amount: 200,
			availableBalance: 1800,
			projectedBalance: 1600,
		},
	],
}));

mock.module(
	"../../../../src/modules/construction-planning/work-measurement.repository",
	() => ({
		createWorkMeasurement,
		updateWorkMeasurement,
		getLatestWorkMeasurementQuantities,
		getWorkMeasurementById: mock(async () => null),
		listWorkMeasurements: mock(async () => ({
			data: [],
			total: 0,
			page: 1,
			limit: 10,
		})),
		deleteWorkMeasurement: mock(async () => null),
		getWorkMeasurementMapDetail: mock(async () => ({})),
		getWorkMeasurementReports: mock(async () => ({})),
		getWorkMeasurementReportById: mock(async () => ({})),
		getWorkMeasurementSummary: mock(async () => ({})),
	}),
);

mock.module(
	"../../../../src/modules/construction-planning/budget-control/budget-control.repository",
	() => ({
		getBudgetItemReferences: mock(async () => ({
			found: [
				{
					budgetItemId: "budget-item-1",
					operationalBudgetItemId: "budget-item-1",
					index: "1.1",
					identityId: "identity-1",
					versionItemId: "version-item-1",
					quantity: new Decimal(20),
					unitCost: new Decimal(100),
				},
			],
			missing: [],
		})),
		findActiveImpactsBySource: mock(async () => []),
	}),
);

mock.module(
	"../../../../src/modules/construction-planning/budget-control/budget-control.service",
	() => ({
		budgetControlService: { apply, replaceSourceImpact },
	}),
);

mock.module(
	"../../../../src/modules/construction-planning/measurement-coverage.service",
	() => ({
		measurementCoverageService: {
			hasCoveragesForWorkMeasurement: mock(async () => false),
		},
	}),
);

let workPeriod = {
	plannedStart: null,
	plannedEnd: null,
} as { plannedStart: string | null; plannedEnd: string | null };

mock.module("../../../../src/modules/construction-planning/repository", () => ({
	getWorkOrThrow: mock(async () => ({
		id: "work-1",
		...workPeriod,
	})),
}));

function setWorkPeriod(plannedStart: string | null, plannedEnd: string | null) {
	workPeriod = { plannedStart, plannedEnd };
}

mock.module(
	"../../../../src/modules/construction-planning/governance-guard",
	() => ({
		assertNoPendingEffect: mock(async () => undefined),
		constructionGovernanceGuard: {
			assertWritable: mock(async () => undefined),
			isWritableBlocked: mock(async () => false),
		},
	}),
);

mock.module("../../../../src/lib/transaction-retry", () => ({
	withSerializableRetry: async (operation: (tx: unknown) => Promise<unknown>) =>
		operation({}),
}));

mock.module("../../../../src/lib/prisma", () => ({ prisma: {} }));
mock.module("../../../../src/lib/audit-writer", () => ({
	writeAudit: mock(async () => undefined),
}));
mock.module("../../../../src/modules/audit/audit.service", () => ({
	auditService: { log: mock(async () => undefined) },
}));
mock.module("../../../../src/modules/governance/approval.service", () => ({
	submitApproval: mock(async () => ({ status: "APPROVED" })),
}));

describe("WorkMeasurementService quantity-first flow", () => {
	it("derives fields and creates an approved budget consumption", async () => {
		const { WorkMeasurementService } = await import(
			"../../../../src/modules/construction-planning/work-measurement.service"
		);
		const service = new WorkMeasurementService({
			assertWritable: mock(async () => undefined),
			isWritableBlocked: mock(async () => false),
		});

		const result = await service.create(
			"owner-1",
			"work-1",
			{
				date: "2026-08-04",
				title: "Medicao 1",
				items: [{ budgetItemId: "budget-item-1", measuredQuantity: 5 }],
				balanceOverride: false,
			},
			{ userId: "user-1", role: "ADMIN" },
		);

		expect(createWorkMeasurement).toHaveBeenCalledWith(
			"owner-1",
			"work-1",
			expect.objectContaining({
				items: [
					expect.objectContaining({
						measuredQuantity: 5,
						measuredValue: 500,
						measuredPercentage: 25,
						accumulatedQuantity: 5,
						accumulatedValue: 500,
						accumulatedPercentage: 25,
					}),
				],
			}),
			expect.anything(),
		);
		expect(apply).toHaveBeenCalledWith(
			"owner-1",
			"work-1",
			expect.objectContaining({
				sourceType: "WORK_MEASUREMENT",
				allocations: [{ budgetItemId: "budget-item-1", quantity: 5 }],
				allowPending: false,
			}),
			expect.anything(),
			expect.anything(),
		);
		expect(result.items[0]).toMatchObject({
			measuredValue: 500,
			impactStatus: "APPROVED",
		});
	});

	it("replaces the prior source impact during update", async () => {
		const { WorkMeasurementService } = await import(
			"../../../../src/modules/construction-planning/work-measurement.service"
		);
		const service = new WorkMeasurementService({
			assertWritable: mock(async () => undefined),
			isWritableBlocked: mock(async () => false),
		});
		const repository = await import(
			"../../../../src/modules/construction-planning/work-measurement.repository"
		);
		(
			repository.getWorkMeasurementById as ReturnType<typeof mock>
		).mockResolvedValueOnce({
			id: "measurement-1",
			items: [],
		});
		(updateWorkMeasurement as ReturnType<typeof mock>).mockResolvedValueOnce({
			id: "measurement-1",
			items: [{ budgetItemId: "budget-item-1", measuredQuantity: 2 }],
		});

		await service.update(
			"owner-1",
			"work-1",
			"measurement-1",
			{
				items: [{ budgetItemId: "budget-item-1", measuredQuantity: 2 }],
				balanceOverride: false,
			},
			{ userId: "user-1", role: "ADMIN" },
		);

		expect(replaceSourceImpact).toHaveBeenCalledWith(
			"owner-1",
			"work-1",
			expect.objectContaining({
				sourceType: "WORK_MEASUREMENT",
				sourceId: "measurement-1",
			}),
			expect.anything(),
			expect.anything(),
		);
	});
});

describe("WorkMeasurementService measurement date period (MED-001)", () => {
	function service() {
		return new (require("../../../../src/modules/construction-planning/work-measurement.service").WorkMeasurementService)(
			{
				assertWritable: mock(async () => undefined),
				isWritableBlocked: mock(async () => false),
			},
		);
	}

	it("aceita a data inicial da obra (limite inclusivo)", async () => {
		setWorkPeriod("2026-01-01", "2026-12-31");

		await expect(
			service().create(
				"owner-1",
				"work-1",
				{
					date: "2026-01-01",
					title: "Medicao 1",
					items: [{ budgetItemId: "budget-item-1", measuredQuantity: 1 }],
					balanceOverride: false,
				},
				{ userId: "user-1", role: "ADMIN" },
			),
		).resolves.toBeTruthy();
	});

	it("aceita a data final da obra (limite inclusivo)", async () => {
		setWorkPeriod("2026-01-01", "2026-12-31");

		await expect(
			service().create(
				"owner-1",
				"work-1",
				{
					date: "2026-12-31",
					title: "Medicao 1",
					items: [{ budgetItemId: "budget-item-1", measuredQuantity: 1 }],
					balanceOverride: false,
				},
				{ userId: "user-1", role: "ADMIN" },
			),
		).resolves.toBeTruthy();
	});

	it("rejeita data antes do inicio da obra", async () => {
		setWorkPeriod("2026-01-01", "2026-12-31");

		await expect(
			service().create(
				"owner-1",
				"work-1",
				{
					date: "2025-12-31",
					title: "Medicao 1",
					items: [{ budgetItemId: "budget-item-1", measuredQuantity: 1 }],
					balanceOverride: false,
				},
				{ userId: "user-1", role: "ADMIN" },
			),
		).rejects.toMatchObject({
			code: "MEASUREMENT_DATE_OUT_OF_PERIOD",
			status: 422,
			message:
				"Data da medicao fora do periodo da obra (permitido: 2026-01-01 a 2026-12-31)",
		});
	});

	it("rejeita data depois do fim da obra", async () => {
		setWorkPeriod("2026-01-01", "2026-12-31");

		await expect(
			service().create(
				"owner-1",
				"work-1",
				{
					date: "2027-01-01",
					title: "Medicao 1",
					items: [{ budgetItemId: "budget-item-1", measuredQuantity: 1 }],
					balanceOverride: false,
				},
				{ userId: "user-1", role: "ADMIN" },
			),
		).rejects.toMatchObject({
			code: "MEASUREMENT_DATE_OUT_OF_PERIOD",
			status: 422,
			message:
				"Data da medicao fora do periodo da obra (permitido: 2026-01-01 a 2026-12-31)",
		});
	});

	it("normaliza por dia UTC: data com fuso horario cai no mesmo dia de negocio", async () => {
		setWorkPeriod("2026-01-01", "2026-12-31");

		// 2026-06-15T23:30:00Z e o dia 15 em UTC; o dia de negocio e comparado
		// pelo dia UTC, nao pelo instante nem pela string.
		await expect(
			service().create(
				"owner-1",
				"work-1",
				{
					date: "2026-06-15T23:30:00.000Z",
					title: "Medicao 1",
					items: [{ budgetItemId: "budget-item-1", measuredQuantity: 1 }],
					balanceOverride: false,
				},
				{ userId: "user-1", role: "ADMIN" },
			),
		).resolves.toBeTruthy();
	});

	it("ignora a checagem quando a obra nao tem datas planejadas", async () => {
		setWorkPeriod(null, null);

		await expect(
			service().create(
				"owner-1",
				"work-1",
				{
					date: "1999-01-01",
					title: "Medicao 1",
					items: [{ budgetItemId: "budget-item-1", measuredQuantity: 1 }],
					balanceOverride: false,
				},
				{ userId: "user-1", role: "ADMIN" },
			),
		).resolves.toBeTruthy();
	});
});

describe("WorkMeasurementService override (MED-004)", () => {
	function service() {
		return new (require("../../../../src/modules/construction-planning/work-measurement.service").WorkMeasurementService)(
			{
				assertWritable: mock(async () => undefined),
				isWritableBlocked: mock(async () => false),
			},
		);
	}

	const input = {
		date: "2026-08-04",
		title: "Medicao com override",
		items: [{ budgetItemId: "budget-item-1", measuredQuantity: 5 }],
		balanceOverride: true,
		evidenceNote: "Execucao extraordinaria aprovada em reuniao",
	};

	it("condicao normal: ADMIN com nota de evidencia pode exceder o saldo", async () => {
		await expect(
			service().create("owner-1", "work-1", input, {
				userId: "user-1",
				role: "ADMIN",
			}),
		).resolves.toBeTruthy();
		expect(apply).toHaveBeenCalledWith(
			"owner-1",
			"work-1",
			expect.objectContaining({ allowPending: true }),
			expect.anything(),
			expect.anything(),
		);
	});

	it("ausencia de permissao: GERENTE nao pode executar override (403)", async () => {
		await expect(
			service().create("owner-1", "work-1", input, {
				userId: "user-1",
				role: "GERENTE",
			}),
		).rejects.toMatchObject({
			code: "GOVERNANCE_OVERRIDE_REQUIRED",
			status: 403,
			message: "Somente ADMIN pode executar override administrativo",
		});
	});

	it("nota de evidencia obrigatoria: ADMIN sem evidenceNote (422)", async () => {
		await expect(
			service().create(
				"owner-1",
				"work-1",
				{
					date: "2026-08-04",
					title: "Medicao com override",
					items: [{ budgetItemId: "budget-item-1", measuredQuantity: 5 }],
					balanceOverride: true,
				},
				{ userId: "user-1", role: "ADMIN" },
			),
		).rejects.toMatchObject({
			code: "OVERRIDE_REASON_REQUIRED",
			status: 422,
			message: "Nota de evidencia obrigatoria para override",
		});
	});

	it("sobreposicao: atualizacao com override exige itens e nota (422 sem itens)", async () => {
		const repository = await import(
			"../../../../src/modules/construction-planning/work-measurement.repository"
		);
		(
			repository.getWorkMeasurementById as ReturnType<typeof mock>
		).mockResolvedValueOnce({
			id: "measurement-1",
			items: [],
		});
		(updateWorkMeasurement as ReturnType<typeof mock>).mockResolvedValueOnce({
			id: "measurement-1",
			items: [],
		});

		await expect(
			service().update(
				"owner-1",
				"work-1",
				"measurement-1",
				{
					balanceOverride: true,
					evidenceNote: "Ajuste apos revisao",
				},
				{ userId: "user-1", role: "ADMIN" },
			),
		).rejects.toMatchObject({
			code: "INVALID_MEASUREMENT_OVERRIDE",
			status: 422,
			message: "Override de medicao exige itens",
		});
	});

	it("sobreposicao: atualizacao com itens e override ADMIN valida nota e aplica", async () => {
		const repository = await import(
			"../../../../src/modules/construction-planning/work-measurement.repository"
		);
		(
			repository.getWorkMeasurementById as ReturnType<typeof mock>
		).mockResolvedValueOnce({
			id: "measurement-1",
			items: [],
		});
		(updateWorkMeasurement as ReturnType<typeof mock>).mockResolvedValueOnce({
			id: "measurement-1",
			items: [{ budgetItemId: "budget-item-1", measuredQuantity: 5 }],
		});

		await expect(
			service().update(
				"owner-1",
				"work-1",
				"measurement-1",
				{
					items: [{ budgetItemId: "budget-item-1", measuredQuantity: 5 }],
					balanceOverride: true,
					evidenceNote: "Ajuste apos revisao",
				},
				{ userId: "user-1", role: "ADMIN" },
			),
		).resolves.toBeTruthy();
		expect(replaceSourceImpact).toHaveBeenCalledWith(
			"owner-1",
			"work-1",
			expect.objectContaining({
				sourceType: "WORK_MEASUREMENT",
				sourceId: "measurement-1",
			}),
			expect.anything(),
			expect.anything(),
		);
	});
});
