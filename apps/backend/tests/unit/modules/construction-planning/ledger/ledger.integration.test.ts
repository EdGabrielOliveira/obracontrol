import { describe, expect, it } from "bun:test";
import Decimal from "decimal.js";
import type { ConstructionError } from "../../../../../src/lib/errors";
import {
	assertDuePartsDoNotExceedIncurred,
	buildMeasurementEvents,
	commitmentSourceOf,
	competenceOf,
	nextVersionedSourceId,
	reverseLedgerEvents,
	roundCurrency,
	splitMeasurementValue,
} from "../../../../../src/modules/construction-planning/ledger/ledger.integration";

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

const base = {
	scope,
	workId: "work-1",
	budgetItemIdentityId: "identity-1",
	budgetVersionItemId: "version-item-1",
	sourceType: "CONTRACT_MEASUREMENT",
	sourceId: "measurement-1",
	competence: "2026-06",
	occurredAt: new Date("2026-06-20"),
	approvalDecisionId: null,
};

describe("ledger integration", () => {
	it("splitMeasurementValue reconcilia bruto, desconto, retencao, tributo e liquido", () => {
		const parts = splitMeasurementValue(
			[
				{ serviceId: "s1", accumulatedValue: 370 },
				{ serviceId: "s2", accumulatedValue: 30 },
			],
			{
				discountValue: 20,
				retentionValue: 30,
				taxValue: 10,
			},
		);

		expect(parts.grossValue).toBe(400);
		expect(parts.commercialDiscount).toBe(20);
		expect(parts.retention).toBe(30);
		expect(parts.tax).toBe(10);
		expect(parts.incurredNet).toBe(380);
		expect(parts.dueSupplier).toBe(340);
		expect(parts.incurredNet).toBe(
			roundCurrency(parts.dueSupplier + parts.retention + parts.tax),
		);
	});

	it("splitMeasurementValue usa measuredValue como fallback do acumulado", () => {
		const parts = splitMeasurementValue(
			[
				{ serviceId: "s1", measuredValue: 100 },
				{ serviceId: "s2", measuredValue: 50 },
			],
			{},
		);

		expect(parts.grossValue).toBe(150);
		expect(parts.incurredNet).toBe(150);
		expect(parts.dueSupplier).toBe(150);
	});

	it("splitMeasurementValue trata itens sem valor como zero", () => {
		const parts = splitMeasurementValue([{ serviceId: "s1" }], {});
		expect(parts.grossValue).toBe(0);
		expect(parts.incurredNet).toBe(0);
		expect(parts.dueSupplier).toBe(0);
	});

	it("assertDuePartsDoNotExceedIncurred rejeita retencao acima do incorrido", () => {
		const parts = splitMeasurementValue(
			[{ serviceId: "s1", accumulatedValue: 100 }],
			{ retentionValue: 150 },
		);
		expect(parts.dueSupplier).toBe(-50);
		let error: ConstructionError | undefined;
		try {
			assertDuePartsDoNotExceedIncurred(parts);
		} catch (err) {
			error = err as ConstructionError;
		}
		expect(error?.code).toBe("MEASUREMENT_DUE_PARTS_EXCEED_INCURRED");
	});

	it("buildMeasurementEvents cria incorrido e componentes de devido apenas positivos", () => {
		const events = buildMeasurementEvents(base, {
			incurredNet: 380,
			dueSupplier: 340,
			retention: 30,
			tax: 10,
		});

		expect(events).toHaveLength(4);
		expect(events[0]).toMatchObject({
			eventType: "INCURRED_CREATE",
			componentId: "fornecedor",
			sourceId: "measurement-1",
		});
		expect(events.map((e) => e.componentId)).toEqual([
			"fornecedor",
			"fornecedor",
			"retencao",
			"tributo",
		]);
		expect(events.map((e) => Number(e.amount))).toEqual([380, 340, 30, 10]);
	});

	it("buildMeasurementEvents omite componentes zerados", () => {
		const events = buildMeasurementEvents(base, {
			incurredNet: 100,
			dueSupplier: 100,
			retention: 0,
			tax: 0,
		});

		expect(events).toHaveLength(2);
		expect(events.map((e) => e.componentId)).toEqual([
			"fornecedor",
			"fornecedor",
		]);
	});

	it("competenceOf extrai o mes da competencia em UTC", () => {
		expect(competenceOf(new Date("2026-06-20T00:00:00Z"))).toBe("2026-06");
		expect(competenceOf(new Date("2026-01-05T00:00:00Z"))).toBe("2026-01");
	});

	it("reverseLedgerEvents mapeia cada evento para o tipo oposto", () => {
		const events = reverseLedgerEvents([
			{
				eventType: "COMMITMENT_INCREASE",
				componentId: "BASE",
				amount: new Decimal(100),
			},
			{
				eventType: "COMMITMENT_REDUCTION",
				componentId: "AMENDMENT",
				amount: new Decimal(10),
			},
			{
				eventType: "INCURRED_CREATE",
				componentId: "fornecedor",
				amount: new Decimal(80),
			},
			{
				eventType: "DUE_CREATE",
				componentId: "retencao",
				amount: new Decimal(5),
			},
			{
				eventType: "DUE_CREATE",
				componentId: "tributo",
				amount: new Decimal(5),
			},
			{
				eventType: "PAYMENT_CREATE",
				componentId: "fornecedor",
				amount: new Decimal(70),
			},
		]);

		expect(events.map((e) => e.eventType)).toEqual([
			"COMMITMENT_REDUCTION",
			"COMMITMENT_INCREASE",
			"INCURRED_REVERSAL",
			"DUE_CANCEL",
			"DUE_CANCEL",
			"PAYMENT_REVERSAL",
		]);
		expect(events[0].amount).toEqual(new Decimal(100));
		expect(events[5].amount).toEqual(new Decimal(70));
	});

	it("reverseLedgerEvents e inversa do forward", () => {
		const original = {
			eventType: "DUE_CREATE",
			componentId: "fornecedor",
			amount: new Decimal(50),
		};
		const [reversed] = reverseLedgerEvents([original]);
		expect(reversed.eventType).toBe("DUE_CANCEL");
		const [back] = reverseLedgerEvents([reversed]);
		expect(back.eventType).toBe("DUE_CREATE");
		expect(back.componentId).toBe("fornecedor");
		expect(back.amount).toEqual(new Decimal(50));
	});

	it("nextVersionedSourceId versiona compromissos sem colisao", () => {
		expect(nextVersionedSourceId("svc-1", 0)).toBe("svc-1#1");
		expect(nextVersionedSourceId("svc-1", 1)).toBe("svc-1#2");
		expect(commitmentSourceOf("svc-1#3")).toBe("svc-1");
	});

	it("splitMeasurementValue inclui tributo na reconciliacao", () => {
		const parts = splitMeasurementValue(
			[{ serviceId: "s1", accumulatedValue: 200 }],
			{ discountValue: 20, retentionValue: 10, taxValue: 5 },
		);
		expect(parts.grossValue).toBe(200);
		expect(parts.incurredNet).toBe(180);
		expect(parts.dueSupplier).toBe(165);
		expect(parts.incurredNet).toBe(
			roundCurrency(parts.dueSupplier + parts.retention + parts.tax),
		);
	});

	it("buildMeasurementEvents usa tributo como componente proprio", () => {
		const events = buildMeasurementEvents(base, {
			incurredNet: 180,
			dueSupplier: 165,
			retention: 10,
			tax: 5,
		});
		expect(events.map((e) => Number(e.amount))).toEqual([180, 165, 10, 5]);
		expect(events[3].componentId).toBe("tributo");
		expect(events[3].eventType).toBe("DUE_CREATE");
	});
});
