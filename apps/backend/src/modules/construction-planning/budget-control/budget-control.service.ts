import type { Prisma } from "@prisma/client";
import Decimal from "decimal.js";
import { ConstructionError } from "../../../lib/errors";
import type { ScopeContext } from "../../../lib/resource-scope";
import { withSerializableRetry } from "../../../lib/transaction-retry";
import { competenceOf } from "../ledger/ledger.integration";
import { appendLedgerEvent } from "../ledger/ledger.service";
import type { LedgerEventType } from "../ledger/ledger.types";
import {
	buildImpactPlan,
	calculateBalances,
} from "./budget-control.calculator";
import {
	type BudgetImpactRow,
	createImpact,
	findActiveImpactsBySource,
	findImpactById,
	findImpactByKey,
	getBalanceRows,
	getBudgetItemReferences,
	setImpactStatus,
} from "./budget-control.repository";
import type {
	ApplyBudgetImpactInput,
	BudgetApplyContext,
	BudgetBalance,
	BudgetImpactAllocationResult,
	BudgetItemReferenceRow,
	BudgetMutationResult,
	BudgetPreview,
	BudgetPreviewInput,
} from "./budget-control.types";

const STATUS_PENDING = "PENDING";
const STATUS_APPROVED = "APPROVED";
const STATUS_REJECTED = "REJECTED";

type InternalBalance = {
	budgetItemId: string;
	limit: Decimal;
	approvedCommitted: Decimal;
	independentConsumed: Decimal;
	uncoveredContractConsumed: Decimal;
	pendingImpact: Decimal;
};

function impactEventType(
	impactType: "COMMITMENT" | "CONSUMPTION",
	amount: Decimal,
): string {
	if (impactType === "COMMITMENT") {
		return amount.isNegative() ? "COMMITMENT_REDUCTION" : "COMMITMENT_INCREASE";
	}
	return amount.isNegative() ? "INCURRED_REVERSAL" : "INCURRED_CREATE";
}

const REVERSAL_EVENT_BY_IMPACT: Record<string, string> = {
	COMMITMENT: "COMMITMENT_REDUCTION",
	CONSUMPTION: "INCURRED_REVERSAL",
};

function roundNumber(value: Decimal): number {
	return Number(value.toDecimalPlaces(2));
}

function balanceFromRow(row: InternalBalance): BudgetBalance {
	return calculateBalances(row);
}

export class BudgetControlService {
	async preview(
		ownerId: string,
		workId: string,
		input: BudgetPreviewInput,
	): Promise<BudgetPreview> {
		const refs = await this.resolveReferences(
			ownerId,
			workId,
			input.allocations,
		);
		const balances = await this.getBalances(ownerId, workId, refs);

		const items: BudgetBalance[] = [];
		let totalImpact = 0;
		let requiresApproval = false;
		for (const allocation of input.allocations) {
			const ref = refs.found.find(
				(r) => r.budgetItemId === allocation.budgetItemId,
			);
			if (!ref) continue;
			const balance = balances[ref.budgetItemId];
			if (!balance) continue;
			const amount = this.allocationAmount(allocation, ref, input);
			const plan = buildImpactPlan({
				budgetItemId: allocation.budgetItemId,
				impactType: "CONSUMPTION",
				amount,
				limit: this.analyticLimit(ref),
				approvedCommitted: balance.approvedCommitted,
				independentConsumed: balance.independentConsumed,
				uncoveredContractConsumed: balance.uncoveredContractConsumed,
				pendingImpact: balance.pendingImpact,
			});
			items.push({
				...balanceFromRow(balance),
				projectedBalance: plan.projectedBalance,
			});
			totalImpact += Number(amount);
			if (plan.status === "PENDING_APPROVAL") requiresApproval = true;
		}
		return { items, totalImpact, requiresApproval };
	}

	async getAvailability(
		ownerId: string,
		workId: string,
		budgetItemIds: string[],
	): Promise<BudgetBalance[]> {
		const refs = await this.resolveReferences(
			ownerId,
			workId,
			budgetItemIds.map((budgetItemId) => ({ budgetItemId })),
		);
		const balances = await this.getBalances(ownerId, workId, refs);
		return budgetItemIds
			.map((budgetItemId) => {
				const balance = balances[budgetItemId];
				return balance ? balanceFromRow(balance) : undefined;
			})
			.filter((balance): balance is BudgetBalance => balance !== undefined);
	}

	async apply(
		ownerId: string,
		workId: string,
		input: ApplyBudgetImpactInput,
		_ctx: BudgetApplyContext,
		tx?: Prisma.TransactionClient,
	): Promise<BudgetMutationResult> {
		if (!input.allocations || input.allocations.length === 0) {
			throw new ConstructionError(
				"BUDGET_ITEM_REQUIRED",
				"Informe ao menos uma alocação de item de orçamento",
				422,
			);
		}
		if (
			input.impactType !== "COMMITMENT" &&
			input.impactType !== "CONSUMPTION"
		) {
			throw new ConstructionError(
				"BUDGET_ALLOCATION_MISMATCH",
				"Tipo de impacto inválido",
				422,
			);
		}

		const execute = async (
			tx: Prisma.TransactionClient,
		): Promise<BudgetMutationResult> => {
			const refs = await this.resolveReferences(
				ownerId,
				workId,
				input.allocations,
				tx,
			);
			const balances = await this.getBalances(ownerId, workId, refs, tx);

			const results: BudgetImpactAllocationResult[] = [];
			let requiresApproval = false;
			let firstAvailable = 0;
			let firstProjected = 0;

			for (const allocation of input.allocations) {
				const ref = refs.found.find(
					(r) => r.budgetItemId === allocation.budgetItemId,
				);
				if (!ref) continue;
				const balance = balances[ref.budgetItemId];
				if (!balance) continue;

				const amount = this.allocationAmount(allocation, ref, input);
				const plan = buildImpactPlan({
					budgetItemId: allocation.budgetItemId,
					impactType: input.impactType,
					amount,
					limit: this.analyticLimit(ref),
					approvedCommitted: balance.approvedCommitted,
					independentConsumed: balance.independentConsumed,
					uncoveredContractConsumed: balance.uncoveredContractConsumed,
					pendingImpact: balance.pendingImpact,
				});
				if (
					plan.status === "PENDING_APPROVAL" &&
					input.allowPending === false
				) {
					throw new ConstructionError(
						"BUDGET_BALANCE_EXCEEDED",
						"Saldo orcamentario insuficiente",
						422,
					);
				}

				const key = {
					sourceType: input.sourceType,
					sourceId: input.sourceId,
					componentId: input.componentId ?? ref.budgetItemId,
					impactType: input.impactType,
					budgetVersionItemId: ref.versionItemId,
				};

				const existing = await findImpactByKey(tx, key);
				let impact = existing;
				if (!impact) {
					impact = await createImpact(tx, {
						ownerId,
						workId,
						budgetItemIdentityId: ref.identityId,
						budgetVersionItemId: ref.versionItemId,
						sourceType: input.sourceType,
						sourceId: input.sourceId,
						componentId: key.componentId,
						impactType: input.impactType,
						status:
							plan.status === "APPROVED" ? STATUS_APPROVED : STATUS_PENDING,
						quantity: allocation.quantity
							? new Decimal(allocation.quantity)
							: null,
						budgetUnitCostSnapshot: ref.unitCost,
						operationUnitCost:
							allocation.quantity && plan.amount.greaterThan(0)
								? plan.amount.div(allocation.quantity)
								: null,
						amount: plan.amount,
						effectiveAt: plan.status === "APPROVED" ? new Date() : null,
					});
				}

				if (!existing && impact.status === STATUS_APPROVED) {
					await this.appendImpactLedger(
						tx,
						{
							scope: this.scopeOf(ownerId),
							workId,
							budgetItemIdentityId: ref.identityId,
							budgetVersionItemId: ref.versionItemId,
							sourceType: input.sourceType,
							sourceId: input.sourceId,
							componentId: key.componentId,
							amount: impact.amount,
							competence: input.competence ?? competenceOf(new Date()),
							occurredAt: input.occurredAt ?? new Date(),
							budgetImpactId: impact.id,
						},
						impactEventType(
							input.impactType as "COMMITMENT" | "CONSUMPTION",
							impact.amount,
						),
					);
				} else if (impact.status === STATUS_PENDING) {
					requiresApproval = true;
				}

				results.push({
					budgetItemId: allocation.budgetItemId,
					impactId: impact.id,
					impactType: input.impactType,
					status:
						impact.status === STATUS_APPROVED
							? STATUS_APPROVED
							: impact.status === STATUS_REJECTED
								? STATUS_REJECTED
								: "PENDING_APPROVAL",
					amount: roundNumber(impact.amount),
					availableBalance: plan.availableBalance,
					projectedBalance: plan.projectedBalance,
				});
				if (results.length === 1) {
					firstAvailable = plan.availableBalance;
					firstProjected = plan.projectedBalance;
				}
			}

			return {
				status: requiresApproval ? "PENDING_APPROVAL" : "APPROVED",
				requiresApproval,
				availableBalance: firstAvailable,
				projectedBalance: firstProjected,
				allocations: results,
			};
		};

		if (tx) return execute(tx);
		return withSerializableRetry(execute);
	}

	async replaceSourceImpact(
		ownerId: string,
		workId: string,
		input: ApplyBudgetImpactInput,
		ctx: BudgetApplyContext,
		tx?: Prisma.TransactionClient,
	): Promise<BudgetMutationResult> {
		const execute = async (
			transaction: Prisma.TransactionClient,
		): Promise<BudgetMutationResult> => {
			const active = await findActiveImpactsBySource(
				transaction,
				ownerId,
				workId,
				input.sourceType,
				input.sourceId,
			);
			for (const impact of active.filter(
				(candidate) => candidate.impactType === input.impactType,
			)) {
				if (impact.status === STATUS_APPROVED) {
					await this.reverse(ownerId, impact.id, ctx, transaction);
				} else if (impact.status === STATUS_PENDING) {
					await this.reject(ownerId, impact.id, ctx, transaction);
				}
			}
			return this.apply(ownerId, workId, input, ctx, transaction);
		};

		if (tx) return execute(tx);
		return withSerializableRetry(execute);
	}

	async approve(
		ownerId: string,
		impactId: string,
		_ctx: BudgetApplyContext,
		tx?: Prisma.TransactionClient,
	): Promise<BudgetMutationResult> {
		if (tx) return this.approveCore(ownerId, impactId, _ctx, tx);
		return withSerializableRetry((transaction) =>
			this.approveCore(ownerId, impactId, _ctx, transaction),
		);
	}

	private async approveCore(
		ownerId: string,
		impactId: string,
		_ctx: BudgetApplyContext,
		tx: Prisma.TransactionClient,
	): Promise<BudgetMutationResult> {
		const impact = await findImpactById(ownerId, impactId, tx);
		if (!impact) {
			throw new ConstructionError(
				"NOT_FOUND",
				"Impacto orçamentário não encontrado",
				404,
			);
		}
		if (impact.status !== STATUS_PENDING) {
			throw new ConstructionError(
				"BUDGET_CONCURRENT_UPDATE",
				"Impacto não está pendente de aprovação",
				409,
			);
		}
		const effectiveAt = new Date();
		const approved = await setImpactStatus(tx, impact.id, STATUS_APPROVED, {
			effectiveAt,
		});
		if (!approved) {
			throw new ConstructionError(
				"NOT_FOUND",
				"Impacto orçamentário não encontrado",
				404,
			);
		}

		const eventType = impactEventType(
			impact.impactType as "COMMITMENT" | "CONSUMPTION",
			impact.amount,
		);
		if (eventType) {
			await this.appendImpactLedger(
				tx,
				{
					scope: this.scopeOf(ownerId),
					workId: impact.workId,
					budgetItemIdentityId: impact.budgetItemIdentityId,
					budgetVersionItemId: impact.budgetVersionItemId,
					sourceType: impact.sourceType,
					sourceId: impact.sourceId,
					componentId: impact.componentId,
					amount: impact.amount,
					competence: competenceOf(effectiveAt),
					occurredAt: effectiveAt,
					budgetImpactId: impact.id,
				},
				eventType,
			);
		}

		return this.resultFromImpact(impact, approved);
	}

	async reject(
		ownerId: string,
		impactId: string,
		_ctx: BudgetApplyContext,
		tx?: Prisma.TransactionClient,
	): Promise<void> {
		const execute = async (tx: Prisma.TransactionClient): Promise<void> => {
			const impact = await findImpactById(ownerId, impactId, tx);
			if (!impact) {
				throw new ConstructionError(
					"NOT_FOUND",
					"Impacto orçamentário não encontrado",
					404,
				);
			}
			if (impact.status !== STATUS_PENDING) {
				throw new ConstructionError(
					"BUDGET_CONCURRENT_UPDATE",
					"Impacto não está pendente de aprovação",
					409,
				);
			}
			await setImpactStatus(tx, impact.id, STATUS_REJECTED);
		};

		if (tx) return execute(tx);
		await withSerializableRetry(execute);
	}

	async reverse(
		ownerId: string,
		impactId: string,
		_ctx: BudgetApplyContext,
		tx?: Prisma.TransactionClient,
	): Promise<BudgetMutationResult> {
		const execute = async (
			tx: Prisma.TransactionClient,
		): Promise<BudgetMutationResult> => {
			const impact = await findImpactById(ownerId, impactId, tx);
			if (!impact) {
				throw new ConstructionError(
					"NOT_FOUND",
					"Impacto orçamentário não encontrado",
					404,
				);
			}
			if (impact.status !== STATUS_APPROVED || impact.reversedAt !== null) {
				throw new ConstructionError(
					"BUDGET_CONCURRENT_UPDATE",
					"Apenas impactos aprovados podem ser revertidos",
					409,
				);
			}

			const reversal = await createImpact(tx, {
				ownerId: impact.ownerId,
				workId: impact.workId,
				budgetItemIdentityId: impact.budgetItemIdentityId,
				budgetVersionItemId: impact.budgetVersionItemId,
				sourceType: impact.sourceType,
				sourceId: impact.sourceId,
				componentId: impact.componentId,
				impactType: "REVERSAL",
				status: STATUS_APPROVED,
				quantity: impact.quantity,
				budgetUnitCostSnapshot: impact.budgetUnitCostSnapshot,
				operationUnitCost: impact.operationUnitCost,
				amount: impact.amount,
				parentImpactId: impact.id,
				effectiveAt: new Date(),
			});

			const eventType = REVERSAL_EVENT_BY_IMPACT[impact.impactType];
			if (eventType) {
				await this.appendImpactLedger(
					tx,
					{
						scope: this.scopeOf(ownerId),
						workId: impact.workId,
						budgetItemIdentityId: impact.budgetItemIdentityId,
						budgetVersionItemId: impact.budgetVersionItemId,
						sourceType: impact.sourceType,
						sourceId: impact.sourceId,
						componentId: impact.componentId,
						amount: impact.amount,
						competence: competenceOf(new Date()),
						occurredAt: new Date(),
						budgetImpactId: reversal.id,
					},
					eventType,
				);
			}

			await setImpactStatus(tx, impact.id, STATUS_APPROVED, {
				reversedAt: new Date(),
			});

			return {
				status: "APPROVED",
				requiresApproval: false,
				availableBalance: 0,
				projectedBalance: 0,
				allocations: [
					{
						budgetItemId: impact.budgetItemIdentityId,
						impactId: reversal.id,
						impactType: "REVERSAL",
						status: "APPROVED",
						amount: roundNumber(impact.amount),
						availableBalance: 0,
						projectedBalance: 0,
					},
				],
			};
		};

		if (tx) return execute(tx);
		return withSerializableRetry(execute);
	}

	private async resolveReferences(
		ownerId: string,
		workId: string,
		allocations: Array<{ budgetItemId: string }>,
		tx?: Prisma.TransactionClient,
	) {
		const budgetItemIds = allocations.map((a) => a.budgetItemId);
		const resolved = await getBudgetItemReferences(
			ownerId,
			workId,
			budgetItemIds,
			tx,
		);
		if (resolved.missing.length > 0) {
			throw new ConstructionError(
				"BUDGET_ITEM_WRONG_WORK",
				"Item de orçamento não pertence à obra informada",
				422,
			);
		}
		if (resolved.found.length === 0) {
			throw new ConstructionError(
				"BUDGET_VERSION_NOT_AVAILABLE",
				"Nenhuma versão de orçamento ativa com itens para a obra",
				422,
			);
		}
		for (const ref of resolved.found) {
			if (ref.unitCost == null) {
				throw new ConstructionError(
					"BUDGET_VERSION_NOT_AVAILABLE",
					"Item sem custo unitário na versão vigente do orçamento",
					422,
				);
			}
		}
		return resolved;
	}

	private async getBalances(
		ownerId: string,
		workId: string,
		refs: { found: BudgetItemReferenceRow[] },
		tx?: Prisma.TransactionClient,
	): Promise<Record<string, InternalBalance>> {
		const rows = await getBalanceRows(ownerId, workId, refs.found, tx);
		const refByBudgetItemId = new Map(
			refs.found.map((ref) => [ref.budgetItemId, ref]),
		);
		const balances: Record<string, InternalBalance> = {};
		for (const row of rows) {
			const ref = refByBudgetItemId.get(row.budgetItemId);
			if (!ref) continue;
			const commitmentNet = row.commitmentNet;
			const uncoveredContractConsumed = row.contractConsumed
				.minus(commitmentNet)
				.isNegative()
				? new Decimal(0)
				: row.contractConsumed.minus(commitmentNet);
			balances[row.budgetItemId] = {
				budgetItemId: row.budgetItemId,
				limit: this.analyticLimit(ref),
				approvedCommitted: commitmentNet,
				independentConsumed: row.independentConsumed,
				uncoveredContractConsumed,
				pendingImpact: row.pendingImpact,
			};
		}
		return balances;
	}

	private analyticLimit(ref: BudgetItemReferenceRow): Decimal {
		if (ref.quantity == null || ref.unitCost == null) {
			throw new ConstructionError(
				"BUDGET_VERSION_NOT_AVAILABLE",
				"Item sem quantidade e custo unitário na versão vigente do orçamento",
				422,
			);
		}
		return ref.quantity.mul(ref.unitCost).toDecimalPlaces(2);
	}

	private allocationAmount(
		allocation: ApplyBudgetImpactInput["allocations"][number],
		_ref: BudgetItemReferenceRow,
		input: { amount?: number },
	): Decimal {
		if (allocation.value !== undefined) {
			return new Decimal(allocation.value);
		}
		if (allocation.quantity !== undefined) {
			if (_ref.unitCost == null) {
				throw new ConstructionError(
					"BUDGET_VERSION_NOT_AVAILABLE",
					"Item sem custo unitário na versão vigente do orçamento",
					422,
				);
			}
			return new Decimal(allocation.quantity)
				.mul(_ref.unitCost)
				.toDecimalPlaces(2);
		}
		if (allocation.percentage !== undefined) {
			if (input.amount === undefined) {
				throw new ConstructionError(
					"BUDGET_ALLOCATION_MISMATCH",
					"Valor total da operação obrigatório para alocação percentual",
					422,
				);
			}
			return new Decimal(input.amount)
				.mul(allocation.percentage)
				.div(100)
				.toDecimalPlaces(2);
		}
		if (allocation.amount !== undefined) {
			return new Decimal(allocation.amount);
		}
		throw new ConstructionError(
			"BUDGET_ALLOCATION_MISMATCH",
			"Informe apenas uma base de alocação por item",
			422,
		);
	}

	private async appendImpactLedger(
		tx: Prisma.TransactionClient,
		base: {
			scope: ScopeContext;
			workId: string;
			budgetItemIdentityId: string;
			budgetVersionItemId: string;
			sourceType: string;
			sourceId: string;
			componentId: string;
			amount: Decimal;
			competence: string;
			occurredAt: Date;
			budgetImpactId: string;
		},
		eventType: string,
	) {
		await appendLedgerEvent(
			{
				...base,
				amount: base.amount.abs(),
				eventType: eventType as LedgerEventType,
			},
			tx,
		);
	}

	private scopeOf(ownerId: string): ScopeContext {
		return {
			actorId: "system",
			resourceType: "WORK",
			resourceOwnerId: ownerId,
			path: { organizationId: "", costCenterId: null, workId: null },
			role: "ADMIN",
			canRead: true,
			canWrite: true,
			canApprove: true,
			canAdmin: true,
		};
	}

	private async resultFromImpact(
		impact: BudgetImpactRow,
		updated: BudgetImpactRow | null,
	): Promise<BudgetMutationResult> {
		const effective = updated ?? impact;
		return {
			status:
				effective.status === STATUS_APPROVED ? "APPROVED" : "PENDING_APPROVAL",
			requiresApproval: effective.status === STATUS_PENDING,
			availableBalance: 0,
			projectedBalance: 0,
			allocations: [
				{
					budgetItemId: impact.budgetItemIdentityId,
					impactId: impact.id,
					impactType: impact.impactType as "COMMITMENT" | "CONSUMPTION",
					status:
						effective.status === STATUS_APPROVED
							? "APPROVED"
							: effective.status === STATUS_REJECTED
								? "REJECTED"
								: "PENDING_APPROVAL",
					amount: roundNumber(impact.amount),
					availableBalance: 0,
					projectedBalance: 0,
				},
			],
		};
	}
}

export const budgetControlService = new BudgetControlService();
