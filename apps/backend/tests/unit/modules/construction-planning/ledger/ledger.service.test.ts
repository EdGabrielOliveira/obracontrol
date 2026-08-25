import { beforeEach, describe, expect, it, mock } from "bun:test";
import Decimal from "decimal.js";
import type { ConstructionError } from "../../../../../src/lib/errors";
import type { LedgerEventInput } from "../../../../../src/modules/construction-planning/ledger/ledger.types";

const ledgerCreate = mock<
	(args: { data: Record<string, unknown> }) => Promise<Record<string, unknown>>
>(async (args) => ({ id: "ledger-1", createdAt: new Date(), ...args.data }));
const ledgerFindUnique = mock<() => Promise<Record<string, unknown> | null>>(
	async () => null,
);
const ledgerGroupBy = mock<
	(args: { by: string[]; where: Record<string, unknown> }) => Promise<
		Array<{
			eventType: string;
			componentId?: string | null;
			_sum: { amount: number | null } | null;
		}>
	>
>(async () => []);
const identityFindFirst = mock<
	(args: {
		where: { id: string; ownerId: string; workId: string };
	}) => Promise<{
		id: string;
	} | null>
>(async () => ({ id: "identity-1" }));
const versionItemFindFirst = mock<
	(args: { where: { id: string; identityId: string } }) => Promise<{
		id: string;
	} | null>
>(async () => ({ id: "version-item-1" }));
const txLedgerCreate = mock<
	(args: { data: Record<string, unknown> }) => Promise<Record<string, unknown>>
>(async (args) => ({ id: "ledger-1", createdAt: new Date(), ...args.data }));
const txLedgerFindUnique = mock<() => Promise<Record<string, unknown> | null>>(
	async () => null,
);
const approvalDecisionFindFirst = mock<
	(args: { where: { id: string } }) => Promise<{
		id: string;
	} | null>
>(async () => ({ id: "decision-1" }));
const contractFindMany = mock(async (): Promise<unknown[]> => []);

const transactionMock = mock<
	(
		callback: (tx: Record<string, unknown>) => Promise<unknown>,
	) => Promise<unknown>
>(async (callback) =>
	callback({
		constructionLedgerEvent: {
			create: txLedgerCreate,
			findUnique: txLedgerFindUnique,
		},
		budgetItemIdentity: { findFirst: identityFindFirst },
		budgetVersionItem: { findFirst: versionItemFindFirst },
		contract: { findMany: contractFindMany },
		approvalDecision: { findFirst: approvalDecisionFindFirst },
	}),
);

mock.module("../../../../../src/lib/prisma", () => ({
	prisma: {
		constructionLedgerEvent: {
			create: ledgerCreate,
			findUnique: ledgerFindUnique,
			groupBy: ledgerGroupBy,
		},
		budgetItemIdentity: { findFirst: identityFindFirst },
		budgetVersionItem: { findFirst: versionItemFindFirst },
		contract: { findMany: contractFindMany },
		$transaction: transactionMock,
	},
}));

const scope = {
	actorId: "user-1",
	resourceType: "WORK" as const,
	resourceOwnerId: "owner-1",
	path: { organizationId: "org-1", costCenterId: "cc-1", workId: "work-1" },
	role: "GERENTE" as const,
	canRead: true,
	canWrite: true,
	canApprove: false,
	canAdmin: false,
};

function baseInput(): LedgerEventInput {
	return {
		scope,
		workId: "work-1",
		budgetItemIdentityId: "identity-1",
		budgetVersionItemId: "version-item-1",
		eventType: "INCURRED_CREATE",
		sourceType: "CONTRACT_MEASUREMENT",
		sourceId: "measurement-1",
		componentId: "fornecedor",
		amount: new Decimal("100"),
		competence: "2026-06",
		occurredAt: new Date("2026-06-20"),
		approvalDecisionId: "decision-1",
	};
}

describe("ledger service", () => {
	beforeEach(() => {
		mock.clearAllMocks();
		ledgerCreate.mockImplementation(
			async (args: { data: Record<string, unknown> }) => ({
				id: "ledger-1",
				createdAt: new Date(),
				...args.data,
			}),
		);
		ledgerGroupBy.mockImplementation(async () => []);
		txLedgerCreate.mockImplementation(
			async (args: { data: Record<string, unknown> }) => ({
				id: "ledger-1",
				createdAt: new Date(),
				...args.data,
			}),
		);
		txLedgerFindUnique.mockResolvedValue(null);
		approvalDecisionFindFirst.mockResolvedValue({ id: "decision-1" });
		identityFindFirst.mockImplementation(
			async (args: {
				where: { id: string; ownerId: string; workId: string };
			}) => (args.where.workId === "work-1" ? { id: "identity-1" } : null),
		);
		versionItemFindFirst.mockResolvedValue({ id: "version-item-1" });
		contractFindMany.mockResolvedValue([]);
	});

	it("appendLedgerEvent valida valor positivo", async () => {
		const { appendLedgerEvent } = await import(
			"../../../../../src/modules/construction-planning/ledger/ledger.service"
		);
		let error: ConstructionError | undefined;
		try {
			await appendLedgerEvent({
				...baseInput(),
				amount: new Decimal("-5"),
			});
		} catch (err) {
			error = err as ConstructionError;
		}
		expect(error?.code).toBe("LEDGER_AMOUNT_NOT_POSITIVE");
		expect(txLedgerCreate).not.toHaveBeenCalled();
	});

	it("appendLedgerEvent persiste evento com chave idempotente", async () => {
		const { appendLedgerEvent } = await import(
			"../../../../../src/modules/construction-planning/ledger/ledger.service"
		);
		const result = await appendLedgerEvent(baseInput());

		expect(result.id).toBe("ledger-1");
		expect(txLedgerCreate).toHaveBeenCalledWith({
			data: expect.objectContaining({
				ownerId: "owner-1",
				workId: "work-1",
				budgetItemIdentityId: "identity-1",
				budgetVersionItemId: "version-item-1",
				eventType: "INCURRED_CREATE",
				sourceType: "CONTRACT_MEASUREMENT",
				sourceId: "measurement-1",
				componentId: "fornecedor",
				competence: "2026-06",
			}),
		});
	});

	it("appendLedgerEvent rejeita duplicidade com erro de conflito", async () => {
		txLedgerFindUnique.mockResolvedValue({ id: "ledger-exists" });
		const { appendLedgerEvent } = await import(
			"../../../../../src/modules/construction-planning/ledger/ledger.service"
		);
		let error: ConstructionError | undefined;
		try {
			await appendLedgerEvent(baseInput());
		} catch (err) {
			error = err as ConstructionError;
		}
		expect(error?.code).toBe("LEDGER_EVENT_DUPLICATE");
		expect(txLedgerCreate).not.toHaveBeenCalled();
	});

	it("appendLedgerEvent rejeita item orcamentario de outra obra", async () => {
		const { appendLedgerEvent } = await import(
			"../../../../../src/modules/construction-planning/ledger/ledger.service"
		);
		let error: ConstructionError | undefined;
		try {
			await appendLedgerEvent({ ...baseInput(), workId: "work-outra" });
		} catch (err) {
			error = err as ConstructionError;
		}
		expect(error?.code).toBe("LEDGER_BUDGET_ITEM_OTHER_WORK");
		expect(txLedgerCreate).not.toHaveBeenCalled();
	});

	it("appendLedgerEvent rejeita decisao de aprovacao nao aprovada", async () => {
		approvalDecisionFindFirst.mockResolvedValue(null);
		const { appendLedgerEvent } = await import(
			"../../../../../src/modules/construction-planning/ledger/ledger.service"
		);
		let error: ConstructionError | undefined;
		try {
			await appendLedgerEvent(baseInput());
		} catch (err) {
			error = err as ConstructionError;
		}
		expect(error?.code).toBe("LEDGER_APPROVAL_NOT_APPROVED");
		expect(txLedgerCreate).not.toHaveBeenCalled();
	});

	it("appendLedgerEvent aceita decisao de aprovacao aprovada", async () => {
		const { appendLedgerEvent } = await import(
			"../../../../../src/modules/construction-planning/ledger/ledger.service"
		);
		const result = await appendLedgerEvent(baseInput());

		expect(result.id).toBe("ledger-1");
		expect(txLedgerCreate).toHaveBeenCalledWith({
			data: expect.objectContaining({
				approvalDecisionId: "decision-1",
			}),
		});
	});

	it("appendLedgerEvent sem decisao de aprovacao registra com id nulo", async () => {
		const { appendLedgerEvent } = await import(
			"../../../../../src/modules/construction-planning/ledger/ledger.service"
		);
		const input = { ...baseInput(), approvalDecisionId: null };
		const result = await appendLedgerEvent(input);

		expect(result.id).toBe("ledger-1");
		expect(approvalDecisionFindFirst).not.toHaveBeenCalled();
		expect(txLedgerCreate).toHaveBeenCalledWith({
			data: expect.objectContaining({
				approvalDecisionId: null,
			}),
		});
	});

	it("appendLedgerEvent registra budgetImpactId quando informado", async () => {
		const { appendLedgerEvent } = await import(
			"../../../../../src/modules/construction-planning/ledger/ledger.service"
		);
		const input = { ...baseInput(), budgetImpactId: "impact-1" };
		const result = await appendLedgerEvent(input);

		expect(result.id).toBe("ledger-1");
		expect(txLedgerCreate).toHaveBeenCalledWith({
			data: expect.objectContaining({
				budgetImpactId: "impact-1",
			}),
		});
	});

	it("appendLedgerEvent registra com budgetImpactId nulo quando omitido", async () => {
		const { appendLedgerEvent } = await import(
			"../../../../../src/modules/construction-planning/ledger/ledger.service"
		);
		await appendLedgerEvent(baseInput());

		expect(txLedgerCreate).toHaveBeenCalledWith({
			data: expect.objectContaining({
				budgetImpactId: null,
			}),
		});
	});

	it("persiste compromisso, conversao e consumo independente para a mesma identidade", async () => {
		const { appendLedgerEvent } = await import(
			"../../../../../src/modules/construction-planning/ledger/ledger.service"
		);
		const fixture = [
			{
				...baseInput(),
				eventType: "COMMITMENT_INCREASE",
				sourceType: "CONTRACT_SERVICE",
				sourceId: "contract-service-1",
				componentId: "BASE",
				amount: new Decimal("500"),
			},
			{
				...baseInput(),
				eventType: "INCURRED_CREATE",
				sourceType: "CONTRACT_MEASUREMENT",
				sourceId: "contract-measurement-item-1",
				componentId: "BASE",
				amount: new Decimal("300"),
			},
			{
				...baseInput(),
				eventType: "INCURRED_CREATE",
				sourceType: "WORK_MEASUREMENT",
				sourceId: "work-measurement-item-1",
				componentId: "BASE",
				amount: new Decimal("200"),
			},
		] as const;

		for (const input of fixture) {
			await appendLedgerEvent(input);
		}

		expect(txLedgerCreate).toHaveBeenCalledTimes(3);
		const calls = txLedgerCreate.mock.calls.map((call) => call[0].data);
		for (const data of calls) {
			expect(data.budgetItemIdentityId).toBe("identity-1");
			expect(data.budgetVersionItemId).toBe("version-item-1");
		}
		const keys = calls.map(
			(data) =>
				`${data.eventType}|${data.sourceType}|${data.sourceId}|${data.componentId}`,
		);
		expect(new Set(keys).size).toBe(3);
		expect(calls.map((data) => data.sourceId)).toEqual([
			"contract-service-1",
			"contract-measurement-item-1",
			"work-measurement-item-1",
		]);
	});

	it("summarizeLedger aplica a algebra da fixture MET-MVP-001", async () => {
		ledgerGroupBy.mockImplementation(
			async (args: { by: string[]; where: Record<string, unknown> }) => {
				if (args.by.includes("componentId")) {
					return [
						{
							eventType: "COMMITMENT_INCREASE",
							componentId: "BASE",
							_sum: { amount: 750 },
						},
						{
							eventType: "COMMITMENT_REDUCTION",
							componentId: "AMENDMENT",
							_sum: { amount: 50 },
						},
						{
							eventType: "INCURRED_CREATE",
							componentId: "fornecedor",
							_sum: { amount: 360 },
						},
						{
							eventType: "INCURRED_REVERSAL",
							componentId: "fornecedor",
							_sum: { amount: 10 },
						},
						{
							eventType: "DUE_CREATE",
							componentId: "fornecedor",
							_sum: { amount: 350 },
						},
						{
							eventType: "DUE_CREATE",
							componentId: "retencao",
							_sum: { amount: 30 },
						},
						{
							eventType: "DUE_CREATE",
							componentId: "tributo",
							_sum: { amount: 10 },
						},
						{
							eventType: "DUE_CANCEL",
							componentId: "fornecedor",
							_sum: { amount: 10 },
						},
						{
							eventType: "PAYMENT_CREATE",
							componentId: "fornecedor",
							_sum: { amount: 270 },
						},
						{
							eventType: "PAYMENT_REVERSAL",
							componentId: "fornecedor",
							_sum: { amount: 20 },
						},
					];
				}
				return [
					{ eventType: "COMMITMENT_INCREASE", _sum: { amount: 750 } },
					{ eventType: "COMMITMENT_REDUCTION", _sum: { amount: 50 } },
					{ eventType: "INCURRED_CREATE", _sum: { amount: 410 } },
					{ eventType: "INCURRED_REVERSAL", _sum: { amount: 10 } },
					{ eventType: "DUE_CREATE", _sum: { amount: 410 } },
					{ eventType: "DUE_CANCEL", _sum: { amount: 10 } },
					{ eventType: "PAYMENT_CREATE", _sum: { amount: 270 } },
					{ eventType: "PAYMENT_REVERSAL", _sum: { amount: 20 } },
				];
			},
		);

		const { summarizeLedger } = await import(
			"../../../../../src/modules/construction-planning/ledger/ledger.service"
		);
		const summary = await summarizeLedger("owner-1", "work-1", new Date());

		expect(summary.committed).toBe("700.00");
		expect(summary.incurred).toBe("400.00");
		expect(summary.dueOpen).toBe("150.00");
		expect(summary.paid).toBe("250.00");
		expect(summary.generalIncurredUncommitted).toBe("50.00");
		expect(summary.contracts.contractedValue).toBe("700.00");
		expect(summary.contracts.amendmentNet).toBe("-50.00");
		expect(summary.contracts.measuredGross).toBe("350.00");
		expect(summary.contracts.dueOpen).toBe("130.00");
		expect(summary.contracts.paid).toBe("250.00");
		expect(ledgerGroupBy).toHaveBeenCalledTimes(2);
	});

	it("summarizeLedger sem eventos retorna zeros validos", async () => {
		ledgerGroupBy.mockResolvedValue([]);
		const { summarizeLedger } = await import(
			"../../../../../src/modules/construction-planning/ledger/ledger.service"
		);
		const summary = await summarizeLedger("owner-1", "work-1", new Date());

		expect(summary.committed).toBe("0.00");
		expect(summary.incurred).toBe("0.00");
		expect(summary.dueOpen).toBe("0.00");
		expect(summary.paid).toBe("0.00");
		expect(summary.generalIncurredUncommitted).toBe("0.00");
		expect(summary.contracts.contractedValue).toBe("0.00");
		expect(summary.contracts.amendmentNet).toBe("0.00");
		expect(summary.contracts.measuredGross).toBe("0.00");
	});

	it("summarizeLedger considera somente eventos de contratos operacionais", async () => {
		contractFindMany.mockResolvedValueOnce([
			{
				services: [{ id: "service-active" }],
				measurements: [{ id: "measurement-active" }],
				payments: [{ id: "payment-active" }],
				amendments: [{ id: "amendment-active" }],
			},
		]);
		ledgerGroupBy.mockResolvedValue([]);
		const { summarizeLedger } = await import(
			"../../../../../src/modules/construction-planning/ledger/ledger.service"
		);

		await summarizeLedger("owner-1", "work-1", new Date());

		expect(contractFindMany).toHaveBeenCalledWith({
			where: {
				ownerId: "owner-1",
				workId: "work-1",
				status: { in: ["EM_ANDAMENTO", "PARALISADO", "FINALIZADO"] },
			},
			select: expect.any(Object),
		});
		const globalWhere = ledgerGroupBy.mock.calls[0]?.[0]?.where;
		expect(globalWhere).toMatchObject({
			AND: [
				expect.any(Object),
				{
					OR: expect.arrayContaining([
						{
							sourceType: "CONTRACT_SERVICE",
							sourceId: { startsWith: "service-active#" },
						},
					]),
				},
			],
		});
	});
});
