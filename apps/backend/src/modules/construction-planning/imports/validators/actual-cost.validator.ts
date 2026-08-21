import type { ImportValidationError, ParsedWorkbook } from "../../types";
import { normalizeHierarchyIndex } from "../index-helpers";
import type { NormalizedActualCost } from "../normalized-types";
import {
	hasValue,
	invalidField,
	missingField,
	normalizeCategory,
	normalizeCostType,
	normalizeDate,
	normalizeNumberField,
	normalizePaymentStatusWithValidation,
	normalizeRequiredDateField,
} from "../normalizers";

export function normalizeActualCosts(
	workbook: ParsedWorkbook,
	errors: ImportValidationError[],
	budgetIndexes: Set<string>,
): NormalizedActualCost[] {
	return (workbook.actualCostRows ?? []).flatMap((row) => {
		const budgetIndex = row.budgetIndex?.trim()
			? normalizeHierarchyIndex(row.budgetIndex)
			: null;
		if (budgetIndex && !budgetIndexes.has(budgetIndex)) {
			invalidField(
				errors,
				"Custos Realizados",
				row.rowNumber,
				"Indice",
				"UNKNOWN_BUDGET_INDEX",
				"Indice nao encontrado no orcamento",
			);
			return [];
		}

		const costDate = normalizeRequiredDateField(
			errors,
			"Custos Realizados",
			row.rowNumber,
			"Data do lancamento",
			row.costDate,
			"Data do lancamento obrigatoria",
		);
		const amount = normalizeNumberField(
			errors,
			"Custos Realizados",
			row.rowNumber,
			"Valor realizado",
			row.amount,
		);
		if (!hasValue(row.amount)) {
			missingField(
				errors,
				"Custos Realizados",
				row.rowNumber,
				"Valor realizado",
				"Valor realizado obrigatorio",
			);
		}

		const category = normalizeCategory(row.category);
		if (!category) {
			if (hasValue(row.category)) {
				invalidField(
					errors,
					"Custos Realizados",
					row.rowNumber,
					"Categoria",
					"INVALID_CATEGORY",
					"Categoria invalida",
				);
			} else {
				missingField(
					errors,
					"Custos Realizados",
					row.rowNumber,
					"Categoria",
					"Categoria obrigatoria",
				);
			}
		}

		if (!hasValue(row.description)) {
			missingField(
				errors,
				"Custos Realizados",
				row.rowNumber,
				"Descricao",
				"Descricao obrigatoria",
			);
		}

		const costType = normalizeCostType(row.costType);
		if (!costType) {
			if (hasValue(row.costType)) {
				invalidField(
					errors,
					"Custos Realizados",
					row.rowNumber,
					"Tipo",
					"INVALID_COST_TYPE",
					"Tipo invalido",
				);
			} else {
				missingField(
					errors,
					"Custos Realizados",
					row.rowNumber,
					"Tipo",
					"Tipo obrigatorio",
				);
			}
		}

		if (
			costDate === null ||
			amount === null ||
			!category ||
			!hasValue(row.description) ||
			!costType
		) {
			return [];
		}

		const paymentStatus = normalizePaymentStatusWithValidation(
			errors,
			"Custos Realizados",
			row.rowNumber,
			"Situacao do pagamento",
			row.paymentStatus,
		);

		if (paymentStatus === "OPEN" && row.paymentDate) {
			invalidField(
				errors,
				"Custos Realizados",
				row.rowNumber,
				"Data de pagamento",
				"INVALID_PAYMENT_DATE",
				"Data de pagamento nao pode existir quando situacao e aberto",
			);
		}

		return [
			{
				rowNumber: row.rowNumber,
				costDate,
				budgetIndex,
				category,
				description: row.description,
				amount,
				costType,
				sourceDocument: row.sourceDocument,
				appropriationStatus: budgetIndex ? "APPROPRIATED" : "UNAPPROPRIATED",
				supplierName: row.supplierName ?? null,
				costGroup: row.costGroup ?? null,
				paymentStatus,
				competenceDate: normalizeDate(row.competenceDate),
				dueDate: normalizeDate(row.dueDate),
				paymentDate:
					paymentStatus === "PAID" ? normalizeDate(row.paymentDate) : null,
				documentNumber: row.documentNumber ?? null,
			},
		];
	});
}
