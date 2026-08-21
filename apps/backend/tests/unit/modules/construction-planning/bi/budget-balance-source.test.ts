import { describe, expect, it, mock } from "bun:test";

const availabilityMock = mock(async () => [
	{
		budgetItemId: "item-1",
		limit: 10000,
		approvedCommitted: 4000,
		approvedConsumed: 2000,
		pendingImpact: 500,
		availableBalance: 4000,
		projectedBalance: 3500,
	},
]);

const summarizeMock = mock(async () => ({
	committed: "4000",
	incurred: "2000",
	dueOpen: "800",
	paid: "1200",
	generalIncurredUncommitted: "0",
	contracts: {
		contractedValue: "0",
		amendmentNet: "0",
		measuredGross: "0",
		dueOpen: "0",
		paid: "0",
	},
}));

const budgetViewMock = mock(async () => ({
	items: [{ id: "item-1" }],
}));

mock.module(
	"../../../../../src/modules/construction-planning/budget-control/budget-control.service",
	() => ({
		budgetControlService: {
			getAvailability: availabilityMock,
		},
	}),
);

mock.module(
	"../../../../../src/modules/construction-planning/ledger/ledger.service",
	() => ({
		summarizeLedger: summarizeMock,
	}),
);

mock.module(
	"../../../../../src/modules/construction-planning/works/works.repository",
	() => ({
		getWorkWithItems: budgetViewMock,
	}),
);

describe("budget-balance-source", () => {
	it("retorna saldo oficial com campos de exibicao e cobertura", async () => {
		const { getOfficialWorkBalance } = await import(
			"../../../../../src/modules/construction-planning/bi/budget-balance-source"
		);
		const balance = await getOfficialWorkBalance("owner-1", "work-1");
		expect(balance.availableBalance).toBe(4000);
		expect(balance.dueOpen).toBe(800);
		expect(balance.paid).toBe(1200);
		expect(balance.sourceMode).toBe("LIVE");
		expect(["AVAILABLE", "PARTIAL", "UNAVAILABLE"]).toContain(balance.coverage);
		expect(balance.items).toHaveLength(1);
	});

	it("marca cobertura PARTIAL quando a obra nao tem itens de orcamento", async () => {
		budgetViewMock.mockResolvedValue({ items: [] });
		const { getOfficialWorkBalance } = await import(
			"../../../../../src/modules/construction-planning/bi/budget-balance-source"
		);
		const balance = await getOfficialWorkBalance("owner-1", "work-1");
		expect(balance.coverage).toBe("PARTIAL");
		expect(balance.availableBalance).toBe(0);
	});

	it("reflete a mesma algebra do ledger (fixture MET-MVP-001)", async () => {
		availabilityMock.mockResolvedValue([
			{
				budgetItemId: "item-1",
				limit: 1000,
				approvedCommitted: 700,
				approvedConsumed: 400,
				pendingImpact: 0,
				availableBalance: 300,
				projectedBalance: 300,
			},
		]);
		summarizeMock.mockResolvedValue({
			committed: "700",
			incurred: "400",
			dueOpen: "150",
			paid: "250",
			generalIncurredUncommitted: "0",
			contracts: {
				contractedValue: "0",
				amendmentNet: "0",
				measuredGross: "0",
				dueOpen: "0",
				paid: "0",
			},
		});
		budgetViewMock.mockResolvedValue({ items: [{ id: "item-1" }] });
		const { getOfficialWorkBalance } = await import(
			"../../../../../src/modules/construction-planning/bi/budget-balance-source"
		);
		const balance = await getOfficialWorkBalance("owner-1", "work-1");

		// MET-MVP-001: committed 700 / incurred 400 / dueOpen 150 / paid 250.
		// O saldo oficial usa a mesma algebra do ledger: consumo aprovado dos
		// impactos (400) igual ao incorrido; devido e pago vindos do summary.
		expect(balance.approvedCommitted).toBe(700);
		expect(balance.approvedConsumed).toBe(400);
		expect(balance.dueOpen).toBe(150);
		expect(balance.paid).toBe(250);
		expect(balance.availableBalance).toBe(300);
		expect(balance.coverage).toBe("AVAILABLE");
	});
});
