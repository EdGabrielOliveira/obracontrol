import { beforeEach, describe, expect, it, mock } from "bun:test";

const workFindFirst = mock(
	async (): Promise<{ id: string } | null> => ({ id: "work-1" }),
);
const budgetItemFindMany = mock(
	async (): Promise<{ id: string }[]> => [{ id: "budget-1" }],
);
const workMeasurementFindMany = mock(
	async (): Promise<{ id: string }[]> => [{ id: "wm-1" }],
);
const constructionMeasurementFindMany = mock(
	async (): Promise<{ id: string }[]> => [{ id: "cm-1" }],
);
const actualCostFindMany = mock(
	async (): Promise<{ id: string }[]> => [{ id: "ac-1" }],
);
const scheduleRevisionFindMany = mock(
	async (): Promise<{ id: string }[]> => [{ id: "rev-1" }],
);
const importFindMany = mock(
	async (): Promise<{ id: string }[]> => [{ id: "imp-1" }],
);
const contractFindMany = mock(
	async (): Promise<{ id: string }[]> => [{ id: "ct-1" }],
);
const snapshotFindMany = mock(
	async (): Promise<{ id: string }[]> => [{ id: "snap-1" }],
);
const contractMeasurementFindMany = mock(
	async (): Promise<{ id: string }[]> => [{ id: "ctm-1" }],
);
const contractPaymentFindMany = mock(
	async (): Promise<{ id: string }[]> => [{ id: "pay-1" }],
);
const amendmentFindMany = mock(
	async (): Promise<{ id: string }[]> => [{ id: "amend-1" }],
);
const approvalRequestFindMany = mock(
	async (): Promise<
		Array<{
			id: string;
			resourceType: string;
			resourceId: string;
			payloadJson: unknown;
		}>
	> => [],
);
const governanceRecordFindMany = mock(
	async (): Promise<{ id: string }[]> => [{ id: "gov-1" }],
);
const auditFindMany = mock(
	async (): Promise<
		Array<{
			id: string;
			userId: string;
			action: string;
			entityType: string;
			entityId: string;
			entityDescription: string | null;
			previousState: unknown;
			newState: unknown;
			metadata: unknown;
			createdAt: Date;
			user: { id: string; name: string; email: string };
		}>
	> => [],
);
const auditCount = mock(async () => 0);

mock.module("../../../../src/lib/prisma", () => ({
	prisma: {
		constructionWork: { findFirst: workFindFirst },
		constructionBudgetItem: { findMany: budgetItemFindMany },
		workMeasurement: { findMany: workMeasurementFindMany },
		constructionMeasurement: { findMany: constructionMeasurementFindMany },
		constructionActualCost: { findMany: actualCostFindMany },
		constructionScheduleRevision: { findMany: scheduleRevisionFindMany },
		constructionImport: { findMany: importFindMany },
		contract: { findMany: contractFindMany },
		workMetricsSnapshotRecord: { findMany: snapshotFindMany },
		contractMeasurement: { findMany: contractMeasurementFindMany },
		contractPayment: { findMany: contractPaymentFindMany },
		constructionContractAmendment: { findMany: amendmentFindMany },
		approvalRequest: { findMany: approvalRequestFindMany },
		governanceRecord: { findMany: governanceRecordFindMany },
		auditLog: { findMany: auditFindMany, count: auditCount },
	},
}));

const { resolveWorkEntityIds, listWorkAudit } = await import(
	"../../../../src/modules/audit/work-audit.repository"
);

describe("work-audit.repository", () => {
	beforeEach(() => {
		workFindFirst.mockClear();
		budgetItemFindMany.mockClear();
		workMeasurementFindMany.mockClear();
		constructionMeasurementFindMany.mockClear();
		actualCostFindMany.mockClear();
		scheduleRevisionFindMany.mockClear();
		importFindMany.mockClear();
		contractFindMany.mockClear();
		snapshotFindMany.mockClear();
		contractMeasurementFindMany.mockClear();
		contractPaymentFindMany.mockClear();
		amendmentFindMany.mockClear();
		approvalRequestFindMany.mockClear();
		governanceRecordFindMany.mockClear();
		auditFindMany.mockClear();
		auditCount.mockClear();
		workFindFirst.mockResolvedValue({ id: "work-1" });
		budgetItemFindMany.mockResolvedValue([{ id: "budget-1" }]);
		workMeasurementFindMany.mockResolvedValue([{ id: "wm-1" }]);
		constructionMeasurementFindMany.mockResolvedValue([{ id: "cm-1" }]);
		actualCostFindMany.mockResolvedValue([{ id: "ac-1" }]);
		scheduleRevisionFindMany.mockResolvedValue([{ id: "rev-1" }]);
		importFindMany.mockResolvedValue([{ id: "imp-1" }]);
		contractFindMany.mockResolvedValue([{ id: "ct-1" }]);
		snapshotFindMany.mockResolvedValue([{ id: "snap-1" }]);
		contractMeasurementFindMany.mockResolvedValue([{ id: "ctm-1" }]);
		contractPaymentFindMany.mockResolvedValue([{ id: "pay-1" }]);
		amendmentFindMany.mockResolvedValue([{ id: "amend-1" }]);
		approvalRequestFindMany.mockResolvedValue([]);
		governanceRecordFindMany.mockResolvedValue([{ id: "gov-1" }]);
		auditFindMany.mockResolvedValue([]);
		auditCount.mockResolvedValue(0);
	});

	it("resolve: retorna a obra e todas as entidades filhas do dono", async () => {
		const ids = await resolveWorkEntityIds("owner-1", "work-1");

		expect(ids).toEqual(
			expect.arrayContaining([
				"work-1",
				"budget-1",
				"wm-1",
				"cm-1",
				"ac-1",
				"rev-1",
				"imp-1",
				"ct-1",
				"ctm-1",
				"pay-1",
				"amend-1",
				"gov-1",
			]),
		);
		expect(workFindFirst).toHaveBeenCalledWith(
			expect.objectContaining({ where: { id: "work-1", ownerId: "owner-1" } }),
		);
		expect(contractFindMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({
					workId: "work-1",
					ownerId: "owner-1",
				}),
			}),
		);
	});

	it("resolve: nao consulta filhos quando a obra nao pertence ao dono", async () => {
		workFindFirst.mockResolvedValueOnce(null);

		const ids = await resolveWorkEntityIds("owner-2", "work-1");

		expect(ids).toEqual([]);
		expect(budgetItemFindMany).not.toHaveBeenCalled();
		expect(contractFindMany).not.toHaveBeenCalled();
	});

	it("resolve: filtra approval requests pelo workId do payload ou WORK no resourceId", async () => {
		approvalRequestFindMany.mockResolvedValueOnce([
			{
				id: "req-1",
				resourceType: "BUDGET_VERSION_ACTIVATE",
				resourceId: "x",
				payloadJson: { workId: "work-1" },
			},
			{
				id: "req-2",
				resourceType: "WORK",
				resourceId: "work-1",
				payloadJson: null,
			},
			{
				id: "req-3",
				resourceType: "COST_APPROVE",
				resourceId: "y",
				payloadJson: { workId: "work-other" },
			},
			{
				id: "req-4",
				resourceType: "CONTRACT_MEASUREMENT_APPROVE",
				resourceId: "z",
				payloadJson: {},
			},
		]);

		const ids = await resolveWorkEntityIds("owner-1", "work-1");

		expect(ids).toEqual(expect.arrayContaining(["req-1", "req-2"]));
		expect(ids).not.toEqual(expect.arrayContaining(["req-3", "req-4"]));
		expect(approvalRequestFindMany).toHaveBeenCalledWith(
			expect.objectContaining({ where: { ownerId: "owner-1" } }),
		);
	});

	it("list: consulta auditLog com ownerId, entityId in resolvidos e filtros opcionais", async () => {
		auditFindMany.mockResolvedValueOnce([
			{
				id: "a-1",
				userId: "u1",
				action: "CREATE",
				entityType: "WORK",
				entityId: "work-1",
				entityDescription: null,
				previousState: null,
				newState: {},
				metadata: null,
				createdAt: new Date("2026-01-01T00:00:00.000Z"),
				user: { id: "u1", name: "User", email: "u@test.com" },
			},
		]);
		auditCount.mockResolvedValueOnce(1);

		const result = await listWorkAudit("owner-1", "work-1", {
			page: 1,
			limit: 50,
			entityType: "WORK",
			action: "CREATE",
			userId: "u1",
		});

		expect(auditFindMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					ownerId: "owner-1",
					entityId: { in: expect.arrayContaining(["work-1"]) },
					entityType: "WORK",
					action: "CREATE",
					userId: "u1",
				},
				orderBy: { createdAt: "desc" },
				skip: 0,
				take: 50,
				include: { user: { select: { id: true, name: true, email: true } } },
			}),
		);
		expect(result).toMatchObject({ total: 1, page: 1, limit: 50 });
		expect(result.data[0]?.navigationTarget).toEqual({
			path: "/app/obras/work-1",
			label: "Abrir obra",
		});
	});

	it("list: obra inexistente retorna pagina vazia sem consultar auditLog", async () => {
		workFindFirst.mockResolvedValueOnce(null);

		const result = await listWorkAudit("owner-2", "work-1", {
			page: 1,
			limit: 50,
		});

		expect(result).toMatchObject({ data: [], total: 0, page: 1, limit: 50 });
		expect(auditFindMany).not.toHaveBeenCalled();
		expect(auditCount).not.toHaveBeenCalled();
	});
});
