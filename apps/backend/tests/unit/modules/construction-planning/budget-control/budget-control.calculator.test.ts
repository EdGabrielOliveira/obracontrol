import { describe, expect, it } from "bun:test";
import Decimal from "decimal.js";
import {
	buildImpactPlan,
	calculateAnalyticLimit,
	calculateBalances,
	normalizeCostAllocations,
} from "../../../../../src/modules/construction-planning/budget-control/budget-control.calculator";
import { budgetAllocationSchema } from "../../../../../src/modules/construction-planning/budget-control/budget-control.schema";

describe("budgetAllocationSchema", () => {
	it("rejects missing budgetItemId", () => {
		expect(() => budgetAllocationSchema.parse({ value: 100 })).toThrow();
	});

	it("rejects row without any allocation basis", () => {
		expect(() =>
			budgetAllocationSchema.parse({ budgetItemId: "item-1" }),
		).toThrow();
	});

	it("rejects row with more than one allocation basis", () => {
		expect(() =>
			budgetAllocationSchema.parse({
				budgetItemId: "item-1",
				value: 100,
				percentage: 50,
			}),
		).toThrow();
		expect(() =>
			budgetAllocationSchema.parse({
				budgetItemId: "item-1",
				quantity: 10,
				value: 100,
			}),
		).toThrow();
	});

	it("accepts quantity alone", () => {
		const parsed = budgetAllocationSchema.parse({
			budgetItemId: "item-1",
			quantity: 10,
		});
		expect(parsed.quantity).toBe(10);
	});

	it("accepts value alone", () => {
		const parsed = budgetAllocationSchema.parse({
			budgetItemId: "item-1",
			value: 1250.5,
		});
		expect(parsed.value).toBe(1250.5);
	});

	it("accepts percentage alone", () => {
		const parsed = budgetAllocationSchema.parse({
			budgetItemId: "item-1",
			percentage: 25,
		});
		expect(parsed.percentage).toBe(25);
	});

	it("rejects non-positive quantity", () => {
		expect(() =>
			budgetAllocationSchema.parse({ budgetItemId: "item-1", quantity: 0 }),
		).toThrow();
	});

	it("rejects percentage outside 0-100", () => {
		expect(() =>
			budgetAllocationSchema.parse({ budgetItemId: "item-1", percentage: 150 }),
		).toThrow();
	});
});

describe("calculateAnalyticLimit", () => {
	it("multiplica quantidade por custo unitario", () => {
		expect(calculateAnalyticLimit(new Decimal(20), new Decimal(100))).toEqual(
			new Decimal(2000),
		);
	});

	it("arredonda em duas casas decimais", () => {
		expect(
			calculateAnalyticLimit(new Decimal("3.14159"), new Decimal(2)),
		).toEqual(new Decimal("6.28"));
	});

	it("retorna zero para quantidade nula de valor", () => {
		expect(calculateAnalyticLimit(new Decimal(0), new Decimal(100))).toEqual(
			new Decimal(0),
		);
	});
});

describe("normalizeCostAllocations", () => {
	it("aceita alocacoes por valor e deriva o percentual", () => {
		expect(
			normalizeCostAllocations(new Decimal(1000), [
				{ budgetItemId: "a", value: 600 },
				{ budgetItemId: "b", value: 400 },
			]),
		).toEqual([
			{
				budgetItemId: "a",
				basis: "VALUE",
				percentage: 60,
				value: new Decimal(600),
			},
			{
				budgetItemId: "b",
				basis: "VALUE",
				percentage: 40,
				value: new Decimal(400),
			},
		]);
	});

	it("aceita alocacoes por percentual", () => {
		expect(
			normalizeCostAllocations(new Decimal(1000), [
				{ budgetItemId: "a", percentage: 60 },
				{ budgetItemId: "b", percentage: 40 },
			]),
		).toEqual([
			{
				budgetItemId: "a",
				basis: "PERCENTAGE",
				percentage: 60,
				value: new Decimal(600),
			},
			{
				budgetItemId: "b",
				basis: "PERCENTAGE",
				percentage: 40,
				value: new Decimal(400),
			},
		]);
	});

	it("rejeita base mista de valor e percentual no mesmo custo", () => {
		expect(() =>
			normalizeCostAllocations(new Decimal(1000), [
				{ budgetItemId: "a", value: 600 },
				{ budgetItemId: "b", percentage: 40 },
			]),
		).toThrow(/base de alocação/);
	});

	it("arredonda derivacoes percentuais em duas casas", () => {
		const result = normalizeCostAllocations(new Decimal(1000), [
			{ budgetItemId: "a", percentage: 33.33 },
			{ budgetItemId: "b", percentage: 33.33 },
			{ budgetItemId: "c", percentage: 33.34 },
		]);
		expect(result).toEqual([
			{
				budgetItemId: "a",
				basis: "PERCENTAGE",
				percentage: 33.33,
				value: new Decimal("333.30"),
			},
			{
				budgetItemId: "b",
				basis: "PERCENTAGE",
				percentage: 33.33,
				value: new Decimal("333.30"),
			},
			{
				budgetItemId: "c",
				basis: "PERCENTAGE",
				percentage: 33.34,
				value: new Decimal("333.40"),
			},
		]);
	});

	it("distribui o residual de arredondamento para fechar o total exato", () => {
		const result = normalizeCostAllocations(new Decimal("0.05"), [
			{ budgetItemId: "a", percentage: 30 },
			{ budgetItemId: "b", percentage: 30 },
			{ budgetItemId: "c", percentage: 40 },
		]);
		const total = result.reduce(
			(sum, row) => sum.plus(row.value),
			new Decimal(0),
		);
		expect(total.toFixed(2)).toBe("0.05");
		expect(result.map((row) => Number(row.value))).toEqual([0.02, 0.01, 0.02]);
	});

	it("rejeita percentuais que nao fecham 100%", () => {
		expect(() =>
			normalizeCostAllocations(new Decimal(1000), [
				{ budgetItemId: "a", percentage: 50 },
				{ budgetItemId: "b", percentage: 30 },
			]),
		).toThrow(/soma dos percentuais|soma das aloca/);
	});

	it("rejeita valores que nao fecham o valor total do custo", () => {
		expect(() =>
			normalizeCostAllocations(new Decimal(1000), [
				{ budgetItemId: "a", value: 600 },
				{ budgetItemId: "b", value: 300 },
			]),
		).toThrow(/soma das aloca/);
	});

	it("rejeita item de orcamento duplicado", () => {
		expect(() =>
			normalizeCostAllocations(new Decimal(1000), [
				{ budgetItemId: "a", value: 500 },
				{ budgetItemId: "a", value: 500 },
			]),
		).toThrow(/duplicad/);
	});

	it("rejeita alocacao vazia", () => {
		expect(() => normalizeCostAllocations(new Decimal(1000), [])).toThrow();
	});

	it("rejeita base de quantidade em custo", () => {
		expect(() =>
			normalizeCostAllocations(new Decimal(1000), [
				{ budgetItemId: "a", quantity: 10 },
			]),
		).toThrow(/quantidade/);
	});

	it("rejeita valor negativo", () => {
		expect(() =>
			normalizeCostAllocations(new Decimal(1000), [
				{ budgetItemId: "a", value: -5 },
				{ budgetItemId: "b", value: 1005 },
			]),
		).toThrow();
	});
});

describe("normalizeCostAllocations - tolerancia formal de rateio (CUS-001)", () => {
	it("soma exata sem perda de centavos e aceita", () => {
		const result = normalizeCostAllocations(new Decimal("1000.00"), [
			{ budgetItemId: "a", value: 600.5 },
			{ budgetItemId: "b", value: 399.5 },
		]);
		const total = result.reduce(
			(sum, row) => sum.plus(row.value),
			new Decimal(0),
		);
		expect(total.toFixed(2)).toBe("1000.00");
	});

	it("diferenca de um centavo e aceita (residual distribuido)", () => {
		const result = normalizeCostAllocations(new Decimal("1000.00"), [
			{ budgetItemId: "a", percentage: 33.33 },
			{ budgetItemId: "b", percentage: 33.33 },
			{ budgetItemId: "c", percentage: 33.34 },
		]);
		const total = result.reduce(
			(sum, row) => sum.plus(row.value),
			new Decimal(0),
		);
		expect(total.toFixed(2)).toBe("1000.00");
	});

	it("tolerancia de R$ 0,10 no limite aceita soma divergente em 0,10", () => {
		const result = normalizeCostAllocations(new Decimal("100.00"), [
			{ budgetItemId: "a", value: 50 },
			{ budgetItemId: "b", value: 49.9 },
		]);
		const total = result.reduce(
			(sum, row) => sum.plus(row.value),
			new Decimal(0),
		);
		expect(total.toFixed(2)).toBe("99.90");
	});

	it("divergencia acima da tolerancia de R$ 0,10 e rejeitada (0,11)", () => {
		expect(() =>
			normalizeCostAllocations(new Decimal("100.00"), [
				{ budgetItemId: "a", value: 50 },
				{ budgetItemId: "b", value: 49.89 },
			]),
		).toThrow(/soma das aloca/);
	});

	it("custo de R$ 0,00 com alocacao por valor nao e aceita (valor deve ser positivo)", () => {
		expect(() =>
			normalizeCostAllocations(new Decimal(0), [
				{ budgetItemId: "a", value: 0 },
			]),
		).toThrow(/positivo/);
	});

	it("percentual de 100% com custo zero nao perde centavos", () => {
		const result = normalizeCostAllocations(new Decimal(0), [
			{ budgetItemId: "a", percentage: 100 },
		]);
		expect(result[0].value.toFixed(2)).toBe("0.00");
	});
});

describe("calculateBalances", () => {
	const base = {
		budgetItemId: "item-1",
		limit: new Decimal(2000),
		approvedCommitted: new Decimal(500),
		independentConsumed: new Decimal(300),
		uncoveredContractConsumed: new Decimal(0),
		pendingImpact: new Decimal(0),
	};

	it("calcula saldo disponivel e projetado", () => {
		expect(calculateBalances(base)).toEqual({
			budgetItemId: "item-1",
			limit: 2000,
			approvedCommitted: 500,
			approvedConsumed: 300,
			pendingImpact: 0,
			availableBalance: 1200,
			projectedBalance: 1200,
		});
	});

	it("projeta saldo descontando pendencias", () => {
		expect(
			calculateBalances({ ...base, pendingImpact: new Decimal(200) })
				.projectedBalance,
		).toBe(1000);
	});

	it("conversao coberta por compromisso nao reduz o pool duas vezes", () => {
		const result = calculateBalances({
			...base,
			independentConsumed: new Decimal(0),
			uncoveredContractConsumed: new Decimal(0),
		});
		expect(result.availableBalance).toBe(1500);
	});

	it("consumo de contrato descoberto subtrai do saldo", () => {
		expect(
			calculateBalances({
				...base,
				uncoveredContractConsumed: new Decimal(250),
			}).availableBalance,
		).toBe(950);
	});

	it("permite saldo negativo quando ha excesso", () => {
		expect(
			calculateBalances({
				...base,
				approvedCommitted: new Decimal(2500),
			}).availableBalance,
		).toBe(-800);
	});
});

describe("buildImpactPlan", () => {
	const base = {
		budgetItemId: "item-1",
		limit: new Decimal(2000),
		approvedCommitted: new Decimal(500),
		independentConsumed: new Decimal(300),
		uncoveredContractConsumed: new Decimal(0),
		pendingImpact: new Decimal(0),
		impactType: "CONSUMPTION" as const,
	};

	it("aprova impacto dentro do saldo", () => {
		expect(buildImpactPlan({ ...base, amount: new Decimal(1200) })).toEqual({
			budgetItemId: "item-1",
			impactType: "CONSUMPTION",
			status: "APPROVED",
			amount: new Decimal(1200),
			availableBalance: 1200,
			projectedBalance: 0,
		});
	});

	it("deixa pendente impacto acima do saldo", () => {
		const plan = buildImpactPlan({ ...base, amount: new Decimal(1300) });
		expect(plan.status).toBe("PENDING_APPROVAL");
		expect(plan.availableBalance).toBe(1200);
		expect(plan.projectedBalance).toBe(-100);
	});

	it("considera pendencias existentes na projecao", () => {
		const plan = buildImpactPlan({
			...base,
			pendingImpact: new Decimal(200),
			amount: new Decimal(1000),
		});
		expect(plan.status).toBe("APPROVED");
		expect(plan.projectedBalance).toBe(0);
	});
});
