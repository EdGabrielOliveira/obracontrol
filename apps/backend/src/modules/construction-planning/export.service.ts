import * as XLSX from "xlsx";
import { ConstructionError } from "../../lib/errors";
import { prisma } from "../../lib/prisma";
import { auditService } from "../audit/audit.service";
import { orgBIService } from "../organizations/bi";
import type { ExportSourceResolution } from "./export.repository";
import * as exportRepo from "./export.repository";
import { getWorkStatistics } from "./statistics/statistics.service";
import {
	buildGuiaSheet,
	buildWorkbookTemplate,
} from "./templates/template-generator";

export type ExportActor = { id: string; name?: string | null };
export type ExportMode = "raw" | "report";
export type ExportOptions = {
	asOfDate?: Date;
	actor?: ExportActor;
	mode?: ExportMode;
};
export type ExportAudit = Pick<typeof auditService, "log">;

function toBuffer(workbook: XLSX.WorkBook): Buffer {
	for (const sheet of workbook.SheetNames.map(
		(name) => workbook.Sheets[name],
	)) {
		if (!sheet || !sheet["!ref"]) continue;
		const range = XLSX.utils.decode_range(sheet["!ref"]);
		const widths: number[] = [];
		for (let c = range.s.c; c <= range.e.c; c += 1) {
			const header = String(
				sheet[XLSX.utils.encode_cell({ r: range.s.r, c })]?.v ?? "",
			);
			const normalized = header.toLowerCase();
			let max = header.length;
			for (let r = range.s.r + 1; r <= range.e.r; r += 1) {
				const cell = sheet[XLSX.utils.encode_cell({ r, c })];
				max = Math.max(max, String(cell?.v ?? "").length);
				if (cell && typeof cell.v === "number") {
					cell.s = {
						...(cell.s ?? {}),
						numFmt:
							/valor|custo|preço|preco|total|saldo|gasto|orçado|orcado|impacto|amount/i.test(
								normalized,
							)
								? "[$R$-pt-BR] #,##0.00"
								: /data|início|inicio|fim|vencimento|pagamento/i.test(
											normalized,
										)
									? "[$-pt-BR]dd/mm/yyyy"
									: undefined,
					};
				}
			}
			widths.push(Math.min(60, Math.max(12, max + 2)));
		}
		sheet["!cols"] = widths.map((wch) => ({ wch }));
		sheet["!freeze"] = { xSplit: 0, ySplit: 1 };
		sheet["!autofilter"] = { ref: XLSX.utils.encode_range(range) };
	}
	return Buffer.from(
		XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }),
	);
}

export function xlsxResponse(buffer: Buffer, filename: string): Response {
	return new Response(buffer as unknown as Blob, {
		headers: {
			"content-type":
				"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			"content-disposition": `attachment; filename="${filename}"`,
		},
	});
}

function buildSimpleWorkbook(
	sheets: Record<string, unknown[]>,
	filename: string,
) {
	const workbook = XLSX.utils.book_new();
	for (const [name, rows] of Object.entries(sheets)) {
		XLSX.utils.book_append_sheet(
			workbook,
			XLSX.utils.json_to_sheet(
				rows.length ? rows : [{ Informação: "Sem dados" }],
			),
			name.slice(0, 31),
		);
	}
	return xlsxResponse(toBuffer(workbook), filename);
}

function toDateString(value: unknown): string {
	if (value == null) return "";
	const date = value instanceof Date ? value : new Date(String(value));
	if (Number.isNaN(date.getTime())) return "";
	return date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

type CanonicalRow = Record<string, unknown>;

function budgetItemRow(
	item: { index: string; type: string; description: string },
	row: {
		unit: string | null;
		quantity: number | null;
		labor?: number | null;
		material?: number | null;
		equipment?: number | null;
		other?: number | null;
		unitCost?: number | null;
		totalCost?: number | null;
		plannedStart?: unknown;
		plannedEnd?: unknown;
		actualStart?: unknown;
		actualEnd?: unknown;
		completionPercentage?: number | null;
		situacao: string;
	},
): CanonicalRow {
	return {
		Índice: item.index,
		Tipo: item.type,
		Descrição: item.description,
		Unidade: row.unit ?? "",
		Quantidade: row.quantity ?? "",
		"Mão de obra unitária": row.labor ?? "",
		"Material unitário": row.material ?? "",
		"Equipamento unitário": row.equipment ?? "",
		"Outros unitário": row.other ?? "",
		"Custo unitário": row.unitCost ?? "",
		"Valor total": row.totalCost ?? "",
		"Início previsto": toDateString(row.plannedStart),
		"Fim previsto": toDateString(row.plannedEnd),
		"Início real": toDateString(row.actualStart),
		"Fim real": toDateString(row.actualEnd),
		"% concluído": row.completionPercentage ?? "",
		Situação: row.situacao,
	};
}

function budgetItemRawRow(item: {
	index: string;
	type: string;
	description: string;
	unit?: string | null;
	quantity?: number | null;
	labor?: number | null;
	material?: number | null;
	equipment?: number | null;
	other?: number | null;
	unitCost?: number | null;
	totalCost?: number | null;
	plannedStart?: unknown;
	plannedEnd?: unknown;
	actualStart?: unknown;
	actualEnd?: unknown;
	completionPercentage?: number | null;
	status?: string | null;
}): CanonicalRow {
	return {
		index: item.index,
		type: item.type,
		description: item.description,
		unit: item.unit ?? null,
		quantity: item.quantity ?? null,
		labor_unit_cost: item.labor ?? null,
		material_unit_cost: item.material ?? null,
		equipment_unit_cost: item.equipment ?? null,
		other_unit_cost: item.other ?? null,
		unit_cost: item.unitCost ?? null,
		total_cost: item.totalCost ?? null,
		planned_start: item.plannedStart ? toDateString(item.plannedStart) : null,
		planned_end: item.plannedEnd ? toDateString(item.plannedEnd) : null,
		actual_start: item.actualStart ? toDateString(item.actualStart) : null,
		actual_end: item.actualEnd ? toDateString(item.actualEnd) : null,
		completion_percentage: item.completionPercentage ?? null,
		status: item.status ?? null,
	};
}

async function buildOrcamentoRows(
	ownerId: string,
	workId: string,
): Promise<CanonicalRow[]> {
	return buildOrcamentoRowsFromItems(
		await exportRepo.getBudgetItemsForExport(ownerId, workId),
	);
}

async function buildOrcamentoRowsFromImport(
	ownerId: string,
	workId: string,
	importId: string,
): Promise<CanonicalRow[]> {
	return buildOrcamentoRowsFromItems(
		await exportRepo.getBudgetItemsForImportExport(ownerId, workId, importId),
	);
}

function buildOrcamentoRowsFromItems(
	items: Awaited<ReturnType<typeof exportRepo.getBudgetItemsForExport>>,
): CanonicalRow[] {
	return items.map((item) =>
		budgetItemRow(item, {
			unit: item.unit,
			quantity: item.quantity != null ? Number(item.quantity) : null,
			labor: item.laborUnitCost != null ? Number(item.laborUnitCost) : null,
			material:
				item.materialUnitCost != null ? Number(item.materialUnitCost) : null,
			equipment:
				item.equipmentUnitCost != null ? Number(item.equipmentUnitCost) : null,
			other: item.otherUnitCost != null ? Number(item.otherUnitCost) : null,
			unitCost: item.unitCost != null ? Number(item.unitCost) : null,
			totalCost: item.totalCost != null ? Number(item.totalCost) : null,
			plannedStart: item.plannedStart,
			plannedEnd: item.plannedEnd,
			actualStart: item.actualStart,
			actualEnd: item.actualEnd,
			completionPercentage:
				item.completionPercentage != null
					? Number(item.completionPercentage)
					: null,
			situacao: item.providedStatus ?? item.computedStatus,
		}),
	);
}

async function buildOrcamentoRowsRaw(
	ownerId: string,
	workId: string,
): Promise<CanonicalRow[]> {
	return (await exportRepo.getBudgetItemsForExport(ownerId, workId)).map(
		(item) =>
			budgetItemRawRow({
				index: item.index,
				type: item.type,
				description: item.description,
				unit: item.unit,
				quantity: item.quantity != null ? Number(item.quantity) : null,
				labor: item.laborUnitCost != null ? Number(item.laborUnitCost) : null,
				material:
					item.materialUnitCost != null ? Number(item.materialUnitCost) : null,
				equipment:
					item.equipmentUnitCost != null
						? Number(item.equipmentUnitCost)
						: null,
				other: item.otherUnitCost != null ? Number(item.otherUnitCost) : null,
				unitCost: item.unitCost != null ? Number(item.unitCost) : null,
				totalCost: item.totalCost != null ? Number(item.totalCost) : null,
				plannedStart: item.plannedStart,
				plannedEnd: item.plannedEnd,
				actualStart: item.actualStart,
				actualEnd: item.actualEnd,
				completionPercentage:
					item.completionPercentage != null
						? Number(item.completionPercentage)
						: null,
				status: item.providedStatus ?? item.computedStatus,
			}),
	);
}

async function buildBudgetVersionRows(
	ownerId: string,
	workId: string,
	raw: boolean,
): Promise<CanonicalRow[]> {
	const versions = await exportRepo.getBudgetVersionsForExport(ownerId, workId);
	return versions.flatMap((version) =>
		version.items.map((item) =>
			raw
				? {
						version: version.versionNumber,
						label: version.label,
						status: version.status,
						active: version.isActive,
						reason: version.reason,
						kind: version.kind,
						gross_addition:
							version.acrescimoBruto == null
								? null
								: Number(version.acrescimoBruto),
						suppression:
							version.supressao == null ? null : Number(version.supressao),
						net_impact:
							version.impactoLiquido == null
								? null
								: Number(version.impactoLiquido),
						impact_percentage:
							version.percentualImpacto == null
								? null
								: Number(version.percentualImpacto),
						index: item.index,
						type: item.type,
						description: item.description,
						unit: item.unit,
						quantity: item.quantity == null ? null : Number(item.quantity),
						unit_cost: item.unitCost == null ? null : Number(item.unitCost),
						total_cost: Number(item.totalCost),
						planned_start: toDateString(item.plannedStart),
						planned_end: toDateString(item.plannedEnd),
					}
				: {
						Versao: version.versionNumber,
						Aditivo: version.label,
						Status: version.status,
						Ativa: version.isActive ? "Sim" : "Nao",
						Tipo: version.kind ?? "",
						Motivo: version.reason ?? "",
						"Acrescimo bruto":
							version.acrescimoBruto == null
								? ""
								: Number(version.acrescimoBruto),
						Supressao:
							version.supressao == null ? "" : Number(version.supressao),
						"Impacto liquido":
							version.impactoLiquido == null
								? ""
								: Number(version.impactoLiquido),
						"Percentual de impacto":
							version.percentualImpacto == null
								? ""
								: Number(version.percentualImpacto),
						Indice: item.index,
						TipoItem: item.type,
						Descricao: item.description,
						Unidade: item.unit ?? "",
						Quantidade: item.quantity == null ? "" : Number(item.quantity),
						"Custo unitario":
							item.unitCost == null ? "" : Number(item.unitCost),
						"Valor total": Number(item.totalCost),
						"Inicio previsto": toDateString(item.plannedStart),
						"Fim previsto": toDateString(item.plannedEnd),
					},
		),
	);
}

async function buildCronogramaRows(
	ownerId: string,
	workId: string,
): Promise<CanonicalRow[]> {
	return (await exportRepo.getBaselineSchedulesForExport(ownerId, workId)).map(
		(s) => {
			const item = s.budgetItem;
			const revision = s.budgetItem?.scheduleRevisions?.[0];
			return {
				Índice: s.index,
				Tipo: item?.type ?? "",
				Descrição: item?.description ?? "",
				"Nome do item": item?.description ?? "",
				Unidade: item?.unit ?? "",
				Quantidade: item?.quantity != null ? Number(item.quantity) : "",
				"Custo unitário": item?.unitCost != null ? Number(item.unitCost) : "",
				"Valor total": item?.totalCost != null ? Number(item.totalCost) : "",
				"Início previsto": toDateString(s.plannedStart),
				"Fim previsto": toDateString(s.plannedEnd),
				"Peso planejado opcional": Number(s.plannedWeight ?? 0),
				"Início real": toDateString(item?.actualStart),
				"Fim real": toDateString(item?.actualEnd),
				"% concluído": item?.completionPercentage ?? "",
				Situação: item?.computedStatus ?? "",
				"Versão replanejamento": revision?.version ?? "",
				"Início replanejado": toDateString(revision?.replannedStart),
				"Fim replanejado": toDateString(revision?.replannedEnd),
				"Data da revisão": toDateString(revision?.revisionDate),
				"Motivo da revisão": revision?.reason ?? "",
			};
		},
	);
}

function cronogramaRawRow(s: {
	index: string;
	plannedStart?: unknown;
	plannedEnd?: unknown;
	plannedWeight?: number | null;
	budgetItem?: {
		type?: string;
		description?: string;
		unit?: string | null;
		quantity?: number | null;
		unitCost?: number | null;
		totalCost?: number | null;
		actualStart?: unknown;
		actualEnd?: unknown;
		completionPercentage?: number | null;
		computedStatus?: string;
		scheduleRevisions?: Array<{
			version?: string | null;
			replannedStart?: unknown;
			replannedEnd?: unknown;
			revisionDate?: unknown;
			reason?: string | null;
		}>;
	};
}): CanonicalRow {
	return {
		index: s.index,
		type: s.budgetItem?.type ?? null,
		description: s.budgetItem?.description ?? null,
		budget_item_name: s.budgetItem?.description ?? null,
		unit: s.budgetItem?.unit ?? null,
		quantity: s.budgetItem?.quantity ?? null,
		unit_cost: s.budgetItem?.unitCost ?? null,
		total_cost: s.budgetItem?.totalCost ?? null,
		planned_start: s.plannedStart ? toDateString(s.plannedStart) : null,
		planned_end: s.plannedEnd ? toDateString(s.plannedEnd) : null,
		planned_weight: s.plannedWeight ?? null,
		actual_start: s.budgetItem?.actualStart
			? toDateString(s.budgetItem.actualStart)
			: null,
		actual_end: s.budgetItem?.actualEnd
			? toDateString(s.budgetItem.actualEnd)
			: null,
		completion_percentage: s.budgetItem?.completionPercentage ?? null,
		status: s.budgetItem?.computedStatus ?? null,
		replanning_version: s.budgetItem?.scheduleRevisions?.[0]?.version ?? null,
		replanned_start: s.budgetItem?.scheduleRevisions?.[0]?.replannedStart
			? toDateString(s.budgetItem.scheduleRevisions[0].replannedStart)
			: null,
		replanned_end: s.budgetItem?.scheduleRevisions?.[0]?.replannedEnd
			? toDateString(s.budgetItem.scheduleRevisions[0].replannedEnd)
			: null,
		revision_date: s.budgetItem?.scheduleRevisions?.[0]?.revisionDate
			? toDateString(s.budgetItem.scheduleRevisions[0].revisionDate)
			: null,
		revision_reason: s.budgetItem?.scheduleRevisions?.[0]?.reason ?? null,
	};
}

async function buildCronogramaRowsRaw(
	ownerId: string,
	workId: string,
): Promise<CanonicalRow[]> {
	return (await exportRepo.getBaselineSchedulesForExport(ownerId, workId)).map(
		(s) =>
			cronogramaRawRow({
				index: s.index,
				plannedStart: s.plannedStart,
				plannedEnd: s.plannedEnd,
				plannedWeight: s.plannedWeight != null ? Number(s.plannedWeight) : null,
				budgetItem: s.budgetItem
					? {
							type: s.budgetItem.type,
							description: s.budgetItem.description,
							unit: s.budgetItem.unit,
							quantity:
								s.budgetItem.quantity != null
									? Number(s.budgetItem.quantity)
									: null,
							unitCost:
								s.budgetItem.unitCost != null
									? Number(s.budgetItem.unitCost)
									: null,
							totalCost:
								s.budgetItem.totalCost != null
									? Number(s.budgetItem.totalCost)
									: null,
							actualStart: s.budgetItem.actualStart,
							actualEnd: s.budgetItem.actualEnd,
							completionPercentage:
								s.budgetItem.completionPercentage != null
									? Number(s.budgetItem.completionPercentage)
									: null,
							computedStatus: s.budgetItem.computedStatus,
							scheduleRevisions: s.budgetItem.scheduleRevisions,
						}
					: undefined,
			}),
	);
}

function measurementRow(m: {
	index?: string | null;
	budgetItem?: { index: string; description: string } | null;
	measurementDate?: unknown;
	measuredPercentageAccumulated?: unknown;
	measuredQuantityAccumulated?: unknown;
	notes?: string | null;
}): CanonicalRow {
	return {
		Índice: m.budgetItem?.index ?? m.index,
		"Nome do item": m.budgetItem?.description ?? "",
		"Data da medição": toDateString(m.measurementDate),
		"Percentual medido acumulado": Number(m.measuredPercentageAccumulated ?? 0),
		"Quantidade medida acumulada": Number(m.measuredQuantityAccumulated ?? 0),
		Observação: m.notes ?? "",
	};
}

function measurementRawRow(m: {
	index?: string | null;
	budgetItem?: { index: string; description: string } | null;
	measurementDate?: unknown;
	measuredPercentageAccumulated?: unknown;
	measuredQuantityAccumulated?: unknown;
	notes?: string | null;
}): CanonicalRow {
	return {
		index: m.budgetItem?.index ?? m.index ?? null,
		budget_item_name: m.budgetItem?.description ?? null,
		measurement_date: m.measurementDate
			? toDateString(m.measurementDate)
			: null,
		measured_percentage_accumulated:
			m.measuredPercentageAccumulated != null
				? Number(m.measuredPercentageAccumulated)
				: null,
		measured_quantity_accumulated:
			m.measuredQuantityAccumulated != null
				? Number(m.measuredQuantityAccumulated)
				: null,
		notes: m.notes ?? null,
	};
}

async function buildMedicoesRows(
	ownerId: string,
	workId: string,
	asOfDate?: Date,
): Promise<CanonicalRow[]> {
	return (
		await exportRepo.getMeasurementsWithBudgetItemForExport(
			ownerId,
			workId,
			asOfDate,
		)
	).map((m) => measurementRow(m));
}

async function buildMedicoesRowsRaw(
	ownerId: string,
	workId: string,
	asOfDate?: Date,
): Promise<CanonicalRow[]> {
	return (
		await exportRepo.getMeasurementsWithBudgetItemForExport(
			ownerId,
			workId,
			asOfDate,
		)
	).map((m) => measurementRawRow(m));
}

function actualCostRow(c: {
	costDate: unknown;
	budgetIndex?: string | null;
	category?: string | null;
	description?: string | null;
	amount: unknown;
	costType?: string | null;
	sourceDocument?: string | null;
	supplierName?: string | null;
	costGroup?: string | null;
	paymentStatus?: string | null;
	competenceDate?: unknown;
	dueDate?: unknown;
	paymentDate?: unknown;
	documentNumber?: string | null;
	budgetItem?: { index: string; description: string } | null;
	budgetVersionItem?: { index: string; description: string } | null;
}): CanonicalRow {
	const budgetItem = c.budgetItem ?? c.budgetVersionItem;
	return {
		"Data do lançamento": toDateString(c.costDate),
		"Índice apropriado": budgetItem?.index ?? c.budgetIndex ?? "",
		"Nome do item do orçamento": budgetItem?.description ?? "",
		Categoria: c.category ?? "",
		Descrição: c.description ?? "",
		"Valor realizado": Number(c.amount),
		Tipo: c.costType ?? "",
		"Documento origem": c.sourceDocument ?? "",
		"Fornecedor/Favorecido": c.supplierName ?? "",
		"Grupo de custo": c.costGroup ?? "",
		"Situação do pagamento": c.paymentStatus ?? "",
		"Data de competência": toDateString(c.competenceDate),
		"Data de vencimento": toDateString(c.dueDate),
		"Data de pagamento": toDateString(c.paymentDate),
		"Número do documento": c.documentNumber ?? "",
	};
}

function actualCostRawRow(c: {
	costDate?: unknown;
	budgetIndex?: string | null;
	category?: string | null;
	description?: string | null;
	amount?: unknown;
	costType?: string | null;
	sourceDocument?: string | null;
	supplierName?: string | null;
	costGroup?: string | null;
	paymentStatus?: string | null;
	competenceDate?: unknown;
	dueDate?: unknown;
	paymentDate?: unknown;
	documentNumber?: string | null;
	budgetItem?: { index: string; description: string } | null;
	budgetVersionItem?: { index: string; description: string } | null;
}): CanonicalRow {
	const budgetItem = c.budgetItem ?? c.budgetVersionItem;
	return {
		cost_date: c.costDate ? toDateString(c.costDate) : null,
		budget_index: budgetItem?.index ?? c.budgetIndex ?? null,
		budget_item_name: budgetItem?.description ?? null,
		category: c.category ?? null,
		description: c.description ?? null,
		amount: c.amount != null ? Number(c.amount) : null,
		cost_type: c.costType ?? null,
		source_document: c.sourceDocument ?? null,
		supplier_name: c.supplierName ?? null,
		cost_group: c.costGroup ?? null,
		payment_status: c.paymentStatus ?? null,
		competence_date: c.competenceDate ? toDateString(c.competenceDate) : null,
		due_date: c.dueDate ? toDateString(c.dueDate) : null,
		payment_date: c.paymentDate ? toDateString(c.paymentDate) : null,
		document_number: c.documentNumber ?? null,
	};
}

async function buildCustosRows(
	ownerId: string,
	workId: string,
	asOfDate?: Date,
): Promise<CanonicalRow[]> {
	return (
		await exportRepo.getActualCostsForExport(ownerId, workId, asOfDate)
	).map((c) => actualCostRow(c));
}

async function buildCustosRowsRaw(
	ownerId: string,
	workId: string,
	asOfDate?: Date,
): Promise<CanonicalRow[]> {
	return (
		await exportRepo.getActualCostsForExport(ownerId, workId, asOfDate)
	).map((c) => actualCostRawRow(c));
}

function contractRow(c: {
	code: string;
	supplierName: string;
	contractValue: unknown;
	serviceType?: string | null;
	title?: string | null;
	startDate?: unknown;
	endDate?: unknown;
	status: string;
	notes?: string | null;
}): CanonicalRow {
	return {
		Código: c.code,
		Fornecedor: c.supplierName,
		"Valor do Contrato": Number(c.contractValue),
		"Tipo de Serviço": c.serviceType ?? "",
		Título: c.title ?? "",
		Início: toDateString(c.startDate),
		Fim: toDateString(c.endDate),
		Situação: c.status,
		Observações: c.notes ?? "",
	};
}

function contractRawRow(c: {
	code: string;
	supplierName: string;
	contractValue?: unknown;
	serviceType?: string | null;
	title?: string | null;
	startDate?: unknown;
	endDate?: unknown;
	status?: string | null;
	notes?: string | null;
}): CanonicalRow {
	return {
		code: c.code,
		supplier_name: c.supplierName,
		contract_value: c.contractValue != null ? Number(c.contractValue) : null,
		service_type: c.serviceType ?? null,
		title: c.title ?? null,
		start_date: c.startDate ? toDateString(c.startDate) : null,
		end_date: c.endDate ? toDateString(c.endDate) : null,
		status: c.status ?? null,
		notes: c.notes ?? null,
	};
}

async function buildContratosRows(
	ownerId: string,
	workId: string,
	asOfDate?: Date,
): Promise<CanonicalRow[]> {
	const contracts = await exportRepo.getContractsSimpleForExport(
		ownerId,
		workId,
		asOfDate,
	);
	return contracts.map((c) => contractRow(c));
}

async function buildContratosRowsRaw(
	ownerId: string,
	workId: string,
	asOfDate?: Date,
): Promise<CanonicalRow[]> {
	const contracts = await exportRepo.getContractsSimpleForExport(
		ownerId,
		workId,
		asOfDate,
	);
	return contracts.map((c) => contractRawRow(c));
}

type ContractWithDetails = Awaited<
	ReturnType<typeof exportRepo.getContractsWithDetailsForExport>
>[number];

async function appendContractDetailSheets(
	wb: XLSX.WorkBook,
	contracts: ContractWithDetails[],
): Promise<void> {
	const serviceRows: Array<Record<string, string | number>> = [];
	const measurementRows: Array<Record<string, string | number>> = [];
	const paymentRows: Array<Record<string, string | number>> = [];

	for (const contract of contracts) {
		for (const service of contract.services ?? []) {
			serviceRows.push({
				Contrato: contract.code,
				Descricao: service.description,
				"Valor Total": Number(service.totalCost ?? 0),
			});
		}
		for (const measurement of contract.measurements ?? []) {
			measurementRows.push({
				Contrato: contract.code,
				Medicao: measurement.number ?? "",
				Data: measurement.date ? toDateString(measurement.date) : "",
				"Valor Medido": (measurement.items ?? []).reduce(
					(sum, item) => sum + Number(item.measuredValue ?? 0),
					0,
				),
			});
		}
		for (const payment of contract.payments ?? []) {
			paymentRows.push({
				Contrato: contract.code,
				"Valor Pago": Number(payment.paidValue ?? 0),
			});
		}
	}

	if (serviceRows.length > 0) {
		XLSX.utils.book_append_sheet(
			wb,
			XLSX.utils.json_to_sheet(serviceRows),
			"Servicos",
		);
	}
	if (measurementRows.length > 0) {
		XLSX.utils.book_append_sheet(
			wb,
			XLSX.utils.json_to_sheet(measurementRows),
			"Medicoes",
		);
	}
	if (paymentRows.length > 0) {
		XLSX.utils.book_append_sheet(
			wb,
			XLSX.utils.json_to_sheet(paymentRows),
			"Pagamentos",
		);
	}
}

function appendMetadados(
	wb: XLSX.WorkBook,
	meta: {
		work: { code: string; name: string } | null;
		asOfDate?: Date;
		source: ExportSourceResolution;
		actor: ExportActor;
		mode: ExportMode;
	},
) {
	const effectiveCutoff = meta.asOfDate ? toDateString(meta.asOfDate) : "Atual";

	const rows: Array<[string, string | number]> = [
		["Obra", meta.work?.name ?? ""],
		["Codigo da Obra", meta.work?.code ?? ""],
		[
			"Filtro asOfDate",
			meta.asOfDate ? toDateString(meta.asOfDate) : "Sem corte",
		],
		["Data de Corte", effectiveCutoff],
		["Fonte", meta.source.mode],
		["Modo", meta.mode],
		["Versao do Snapshot", ""],
		["Tipo do Snapshot", ""],
		["Usuario ID", meta.actor.id],
		["Usuario Nome", meta.actor.name ?? ""],
		["Data de Geracao", new Date().toISOString()],
	];
	const ws = XLSX.utils.aoa_to_sheet([["Campo", "Valor"], ...rows]);
	XLSX.utils.book_append_sheet(wb, ws, "Metadados");
}

export class ExportService {
	constructor(private readonly audit: ExportAudit = auditService) {}

	private async runExport(input: {
		ownerId: string;
		workId: string;
		kind: string;
		fileName:
			| string
			| ((work: { code: string; name: string } | null) => string);
		opts?: ExportOptions;
		buildSheets: (
			wb: XLSX.WorkBook,
			work: { code: string; name: string } | null,
		) => Promise<void>;
	}): Promise<Response> {
		const opts = input.opts ?? {};
		const actor = opts.actor ?? { id: input.ownerId };
		const [source, work] = await Promise.all([
			exportRepo.resolveExportSource(input.ownerId, input.workId),
			exportRepo.getWorkInfoForExport(input.ownerId, input.workId),
		]);
		const fileName =
			typeof input.fileName === "function"
				? input.fileName(work)
				: input.fileName;

		const wb = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(wb, buildGuiaSheet(undefined), "Guia");
		appendMetadados(wb, {
			work,
			asOfDate: opts?.asOfDate,
			source,
			actor,
			mode: opts?.mode ?? "report",
		});
		await input.buildSheets(wb, work);

		await this.audit.log({
			userId: actor.id,
			ownerId: input.ownerId,
			action: "EXPORT",
			entityType: "EXPORT",
			entityId: input.workId,
			entityDescription: `${input.workId}:${input.kind}`,
			previousState: null,
			newState: {
				kind: input.kind,
				asOfDate: opts?.asOfDate ? opts?.asOfDate.toISOString() : null,
				sourceMode: source.mode,
				fileName,
			},
		});

		return xlsxResponse(toBuffer(wb), fileName);
	}

	async exportOrcamento(ownerId: string, workId: string, opts?: ExportOptions) {
		const raw = (opts?.mode ?? "report") === "raw";
		return this.runExport({
			ownerId,
			workId,
			kind: "orcamento",
			fileName: raw ? "orcamento-raw.xlsx" : "orcamento.xlsx",
			opts,
			buildSheets: async (wb) => {
				const versionRows = await buildBudgetVersionRows(ownerId, workId, raw);
				XLSX.utils.book_append_sheet(
					wb,
					XLSX.utils.json_to_sheet(
						raw
							? await buildOrcamentoRowsRaw(ownerId, workId)
							: await buildOrcamentoRows(ownerId, workId),
					),
					"Orcamento",
				);
				XLSX.utils.book_append_sheet(
					wb,
					XLSX.utils.json_to_sheet(
						raw
							? await buildCronogramaRowsRaw(ownerId, workId)
							: await buildCronogramaRows(ownerId, workId),
					),
					"Cronograma Original",
				);
				XLSX.utils.book_append_sheet(
					wb,
					XLSX.utils.json_to_sheet(versionRows),
					"Versoes Orcamento",
				);
				XLSX.utils.book_append_sheet(
					wb,
					XLSX.utils.json_to_sheet(versionRows),
					"Cronograma Versoes",
				);
			},
		});
	}

	async exportOrcamentoAditivoTemplate(
		ownerId: string,
		workId: string,
	): Promise<Response> {
		const originalImportId =
			await exportRepo.getOriginalBudgetImportIdForExport(ownerId, workId);
		const [budgetRows, scheduleRows] = await Promise.all([
			originalImportId
				? buildOrcamentoRowsFromImport(ownerId, workId, originalImportId)
				: buildOrcamentoRows(ownerId, workId),
			buildCronogramaRows(ownerId, workId),
		]);

		return xlsxResponse(
			Buffer.from(
				buildWorkbookTemplate("orcamento-aditivo", {
					Orcamento: budgetRows,
					"Cronograma Original": scheduleRows,
				}),
			),
			"modelo-orcamento-aditivo.xlsx",
		);
	}

	async exportCronogramaTemplate(
		ownerId: string,
		workId: string,
	): Promise<Response> {
		const budgetItems = await exportRepo.getBudgetItemsForExport(
			ownerId,
			workId,
		);
		const rows = budgetItems.map((item) => ({
			Índice: item.index,
			"Nome do item": item.description,
			"Início previsto": "",
			"Fim previsto": "",
			"Peso planejado opcional": "",
		}));

		return xlsxResponse(
			Buffer.from(
				buildWorkbookTemplate(
					"cronograma",
					{
						"Cronograma Original": rows,
						Replanejamento: [],
					},
					budgetItems.map((item) => ({
						index: item.index,
						description: item.description,
					})),
				),
			),
			"modelo-cronograma.xlsx",
		);
	}

	async exportMedicaoObraTemplate(
		ownerId: string,
		workId: string,
	): Promise<Response> {
		const budgetItems = await exportRepo.getBudgetItemsForExport(
			ownerId,
			workId,
		);
		const rows = budgetItems.map((item) => ({
			Índice: item.index,
			"Nome do item": item.description,
			"Data da medição": "",
			"Percentual medido acumulado": "",
			"Quantidade medida acumulada": "",
			Observação: "",
		}));

		return xlsxResponse(
			Buffer.from(
				buildWorkbookTemplate(
					"medicao-obra",
					{ "Medicoes Obra": rows },
					budgetItems.map((item) => ({
						index: item.index,
						description: item.description,
					})),
				),
			),
			"modelo-medicao-obra.xlsx",
		);
	}

	async exportCronograma(
		ownerId: string,
		workId: string,
		opts?: ExportOptions,
	) {
		const raw = (opts?.mode ?? "report") === "raw";
		return this.runExport({
			ownerId,
			workId,
			kind: "cronograma",
			fileName: raw ? "cronograma-raw.xlsx" : "cronograma.xlsx",
			opts,
			buildSheets: async (wb) => {
				XLSX.utils.book_append_sheet(
					wb,
					XLSX.utils.json_to_sheet(
						raw
							? await buildCronogramaRowsRaw(ownerId, workId)
							: await buildCronogramaRows(ownerId, workId),
					),
					"Cronograma Original",
				);
				XLSX.utils.book_append_sheet(
					wb,
					XLSX.utils.json_to_sheet(
						await buildBudgetVersionRows(ownerId, workId, raw),
					),
					"Cronograma Versoes",
				);
			},
		});
	}

	async exportMedicoes(ownerId: string, workId: string, opts?: ExportOptions) {
		const raw = (opts?.mode ?? "report") === "raw";
		return this.runExport({
			ownerId,
			workId,
			kind: "medicoes",
			fileName: raw ? "medicoes-raw.xlsx" : "medicoes.xlsx",
			opts,
			buildSheets: async (wb) => {
				XLSX.utils.book_append_sheet(
					wb,
					XLSX.utils.json_to_sheet(
						raw
							? await buildMedicoesRowsRaw(ownerId, workId, opts?.asOfDate)
							: await buildMedicoesRows(ownerId, workId, opts?.asOfDate),
					),
					"Medicoes Obra",
				);
			},
		});
	}

	async exportCustos(ownerId: string, workId: string, opts?: ExportOptions) {
		const raw = (opts?.mode ?? "report") === "raw";
		return this.runExport({
			ownerId,
			workId,
			kind: "custos",
			fileName: raw ? "custos-raw.xlsx" : "custos.xlsx",
			opts,
			buildSheets: async (wb) => {
				XLSX.utils.book_append_sheet(
					wb,
					XLSX.utils.json_to_sheet(
						raw
							? await buildCustosRowsRaw(ownerId, workId, opts?.asOfDate)
							: await buildCustosRows(ownerId, workId, opts?.asOfDate),
					),
					"Custos Realizados",
				);
			},
		});
	}

	async exportContratos(ownerId: string, workId: string, opts?: ExportOptions) {
		const raw = (opts?.mode ?? "report") === "raw";
		return this.runExport({
			ownerId,
			workId,
			kind: "contratos",
			fileName: raw ? "contratos-raw.xlsx" : "contratos.xlsx",
			opts,
			buildSheets: async (wb) => {
				XLSX.utils.book_append_sheet(
					wb,
					XLSX.utils.json_to_sheet(
						raw
							? await buildContratosRowsRaw(ownerId, workId, opts?.asOfDate)
							: await buildContratosRows(ownerId, workId, opts?.asOfDate),
					),
					"Contrato",
				);
				await appendContractDetailSheets(
					wb,
					await exportRepo.getContractsWithDetailsForExport(
						ownerId,
						workId,
						opts?.asOfDate,
					),
				);
			},
		});
	}

	async exportWorkStatistics(
		ownerId: string,
		workId: string,
		period = "monthly",
	) {
		const statistics = await getWorkStatistics(
			ownerId,
			workId,
			period as "daily" | "weekly" | "monthly",
		);
		return buildSimpleWorkbook(
			{
				"Série temporal": statistics.series,
				Fornecedores: statistics.suppliers,
			},
			"estatisticas-obra.xlsx",
		);
	}

	async exportSuppliers(ownerId: string) {
		const suppliers = await prisma.constructionSupplier.findMany({
			where: { ownerId },
			orderBy: { name: "asc" },
		});
		return buildSimpleWorkbook(
			{ Fornecedores: suppliers },
			"fornecedores.xlsx",
		);
	}

	async exportSystemStatistics(ownerId: string) {
		const [works, organizations, costCenters, suppliers, contracts, costs] =
			await Promise.all([
				prisma.constructionWork.count({ where: { ownerId } }),
				prisma.organization.count({ where: { ownerId } }),
				prisma.costCenter.count({ where: { ownerId } }),
				prisma.constructionSupplier.count({ where: { ownerId } }),
				prisma.contract.count({ where: { ownerId } }),
				prisma.constructionActualCost.count({ where: { ownerId } }),
			]);
		return buildSimpleWorkbook(
			{
				Resumo: [
					{ works, organizations, costCenters, suppliers, contracts, costs },
				],
			},
			"estatisticas-sistema.xlsx",
		);
	}

	async exportOrganizationStatistics(ownerId: string, organizationId: string) {
		const report = await orgBIService.getOrganizationBI(
			ownerId,
			organizationId,
		);
		return buildSimpleWorkbook(
			{
				Resumo: [report.cards],
				"Por obra": report.works,
				"Por fornecedor": report.financial.bySupplier,
			},
			"estatisticas-organizacao.xlsx",
		);
	}

	async exportCostCenterStatistics(
		ownerId: string,
		organizationId: string,
		costCenterId: string,
	) {
		const report = await orgBIService.getCostCenterBI(
			ownerId,
			organizationId,
			costCenterId,
		);
		return buildSimpleWorkbook(
			{
				Resumo: [report.cards],
				"Por obra": report.works,
				"Por fornecedor": report.financial.bySupplier,
			},
			"estatisticas-centro-custo.xlsx",
		);
	}

	async exportCompleto(ownerId: string, workId: string, opts?: ExportOptions) {
		const raw = (opts?.mode ?? "report") === "raw";
		return this.runExport({
			ownerId,
			workId,
			kind: "completo",
			fileName: (work) =>
				work
					? `${work.code}-${raw ? "completo-raw" : "completo"}.xlsx`
					: "completo.xlsx",
			opts,
			buildSheets: async (wb, work) => {
				if (!work) {
					throw new ConstructionError("NOT_FOUND", "Obra nao encontrada", 404);
				}

				XLSX.utils.book_append_sheet(
					wb,
					XLSX.utils.json_to_sheet([
						{ Campo: "Nome da obra", Valor: work.name },
						{ Campo: "Código da obra", Valor: work.code },
					]),
					"Obra",
				);

				const [
					items,
					schedules,
					versionRows,
					measurements,
					costs,
					contractRows,
				] = await Promise.all([
					raw
						? buildOrcamentoRowsRaw(ownerId, workId)
						: buildOrcamentoRows(ownerId, workId),
					raw
						? buildCronogramaRowsRaw(ownerId, workId)
						: buildCronogramaRows(ownerId, workId),
					buildBudgetVersionRows(ownerId, workId, raw),
					raw
						? buildMedicoesRowsRaw(ownerId, workId, opts?.asOfDate)
						: buildMedicoesRows(ownerId, workId, opts?.asOfDate),
					raw
						? buildCustosRowsRaw(ownerId, workId, opts?.asOfDate)
						: buildCustosRows(ownerId, workId, opts?.asOfDate),
					raw
						? buildContratosRowsRaw(ownerId, workId, opts?.asOfDate)
						: buildContratosRows(ownerId, workId, opts?.asOfDate),
				]);

				XLSX.utils.book_append_sheet(
					wb,
					XLSX.utils.json_to_sheet(items),
					"Orcamento",
				);
				XLSX.utils.book_append_sheet(
					wb,
					XLSX.utils.json_to_sheet(schedules),
					"Cronograma Original",
				);
				XLSX.utils.book_append_sheet(
					wb,
					XLSX.utils.json_to_sheet(versionRows),
					"Versoes Orcamento",
				);
				XLSX.utils.book_append_sheet(
					wb,
					XLSX.utils.json_to_sheet(measurements),
					"Medicoes Obra",
				);
				XLSX.utils.book_append_sheet(
					wb,
					XLSX.utils.json_to_sheet(costs),
					"Custos Realizados",
				);
				XLSX.utils.book_append_sheet(
					wb,
					XLSX.utils.json_to_sheet(contractRows),
					"Contrato",
				);
			},
		});
	}
}

export const exportService = new ExportService();
