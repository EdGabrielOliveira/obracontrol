import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { ConstructionError } from "../../../lib/errors";
import { deriveMacroValues, type MacroQualityIssue } from "./macro-metrics";
import type { Indicator } from "./metrics-core";
import {
	type MonthlyFactRecord,
	type MonthlyFactRepository,
	prismaMonthlyFactRepository,
} from "./monthly-fact.repository";

const COMPETENCIA_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export type MonthlyFactView = {
	id: string;
	ownerId: string;
	workId: string;
	competencia: string;
	origem: string;
	version: number;
	status: string;
	valores: unknown;
	fingerprint: string;
	reason: string | null;
	createdBy: string;
	createdAt: string;
	updatedAt: string;
	derived: Record<string, Indicator<number>>;
	qualityIssues: MacroQualityIssue[];
};

export type MonthlyFactValues = Record<string, number | string | null>;

function toJson(value: MonthlyFactValues | null): Prisma.InputJsonValue {
	return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

function fingerprint(value: Prisma.InputJsonValue): string {
	return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function toValues(value: unknown): Record<string, number | null> | null {
	if (typeof value !== "object" || value === null) return null;
	const record = value as Record<string, unknown>;
	const numeric: Record<string, number | null> = {};
	for (const [key, entry] of Object.entries(record)) {
		if (typeof entry === "number") numeric[key] = entry;
		else if (entry === null) numeric[key] = null;
	}
	return numeric;
}

function toView(record: MonthlyFactRecord): MonthlyFactView {
	const { derived, issues } = deriveMacroValues(toValues(record.valores));
	return {
		id: record.id,
		ownerId: record.ownerId,
		workId: record.workId,
		competencia: record.competencia,
		origem: record.origem,
		version: record.version,
		status: record.status,
		valores: record.valores,
		fingerprint: record.fingerprint,
		reason: record.reason,
		createdBy: record.createdBy,
		createdAt: record.createdAt.toISOString(),
		updatedAt: record.updatedAt.toISOString(),
		derived,
		qualityIssues: issues,
	};
}

export class MonthlyFactService {
	constructor(
		private readonly repository: MonthlyFactRepository = prismaMonthlyFactRepository,
	) {}

	async listByCompetencia(input: {
		ownerId: string;
		workId: string;
		competencia?: string;
		origem?: string;
	}): Promise<{ items: MonthlyFactView[] }> {
		const records = await this.repository.listByCompetencia(input);
		return { items: records.map(toView) };
	}

	async persist(input: {
		ownerId: string;
		userId: string;
		workId: string;
		competencia: string;
		origem: string;
		valores: MonthlyFactValues | null;
		reason?: string;
	}): Promise<MonthlyFactView> {
		const work = await this.repository.workExists({
			ownerId: input.ownerId,
			workId: input.workId,
		});
		if (!work) {
			throw new ConstructionError("NOT_FOUND", "Obra nao encontrada", 404);
		}

		if (!COMPETENCIA_PATTERN.test(input.competencia)) {
			throw new ConstructionError(
				"INVALID_COMPETENCIA",
				"Competencia invalida, use YYYY-MM",
				422,
			);
		}
		const origem = input.origem.trim();
		if (!origem) {
			throw new ConstructionError("INVALID_ORIGEM", "Origem obrigatoria", 422);
		}

		const latest = await this.repository.findLatestVersion({
			ownerId: input.ownerId,
			workId: input.workId,
			competencia: input.competencia,
			origem,
		});
		if (latest && !input.reason?.trim()) {
			throw new ConstructionError(
				"GOVERNANCE_REASON_REQUIRED",
				"Motivo obrigatorio para reprocessar um fato mensal",
				422,
			);
		}

		const valores = toJson(input.valores);
		const record = await this.repository.createVersioned({
			ownerId: input.ownerId,
			workId: input.workId,
			competencia: input.competencia,
			origem,
			status: "RASCUNHO",
			valores,
			fingerprint: fingerprint(valores),
			reason: input.reason?.trim() || null,
			createdBy: input.userId,
		});

		return toView(record);
	}
}

export const monthlyFactService = new MonthlyFactService();
