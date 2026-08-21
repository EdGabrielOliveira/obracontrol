import { describe, expect, it } from "bun:test";
import type {
	MonthlyFactRecord,
	MonthlyFactRepository,
} from "../../../../../src/modules/construction-planning/bi/monthly-fact.repository";
import { MonthlyFactService } from "../../../../../src/modules/construction-planning/bi/monthly-fact.service";

const DATE = new Date("2026-08-01T15:00:00.000Z");

function matches(
	record: MonthlyFactRecord,
	input: Parameters<MonthlyFactRepository["findLatestVersion"]>[0],
) {
	return (
		record.ownerId === input.ownerId &&
		record.workId === input.workId &&
		record.competencia === input.competencia &&
		record.origem === input.origem
	);
}

function makeRepository(overrides: Partial<MonthlyFactRepository> = {}) {
	const records: MonthlyFactRecord[] = [];
	const repository: MonthlyFactRepository = {
		workExists: async () => ({ id: "work-1" }),
		findLatestVersion: async (input) => {
			const latest = records
				.filter((record) => matches(record, input))
				.sort((a, b) => b.version - a.version)[0];
			return latest ? { version: latest.version } : null;
		},
		listByCompetencia: async (input) =>
			records
				.filter(
					(record) =>
						record.ownerId === input.ownerId &&
						record.workId === input.workId &&
						(!input.competencia || record.competencia === input.competencia) &&
						(!input.origem || record.origem === input.origem),
				)
				.sort(
					(a, b) =>
						b.version - a.version ||
						b.competencia.localeCompare(a.competencia) ||
						b.origem.localeCompare(a.origem),
				),
		createVersioned: async (input) => {
			const latest = records
				.filter((record) => matches(record, input))
				.sort((a, b) => b.version - a.version)[0];
			const record: MonthlyFactRecord = {
				...input,
				valores: input.valores as MonthlyFactRecord["valores"],
				version: (latest?.version ?? 0) + 1,
				id: `fact-${records.length + 1}`,
				createdAt: DATE,
				updatedAt: DATE,
			};
			records.push(record);
			return record;
		},
		...overrides,
	};
	return { repository, records };
}

function makeService() {
	return new MonthlyFactService(makeRepository().repository);
}

describe("MonthlyFactService", () => {
	it("persists a first version without a reason", async () => {
		const service = makeService();
		const result = await service.persist({
			ownerId: "owner-1",
			userId: "user-1",
			workId: "work-1",
			competencia: "2026-07",
			origem: "BASE_UNICA_BD",
			valores: { produzido: 100, gastos: 80 },
		});

		expect(result).toMatchObject({
			ownerId: "owner-1",
			workId: "work-1",
			competencia: "2026-07",
			origem: "BASE_UNICA_BD",
			version: 1,
			status: "RASCUNHO",
			valores: { produzido: 100, gastos: 80 },
			reason: null,
			createdBy: "user-1",
		});
		expect(result.fingerprint).toMatch(/^[0-9a-f]{64}$/);
	});

	it("persists a second version only with a reason and keeps the first version", async () => {
		const service = makeService();
		const v1 = await service.persist({
			ownerId: "owner-1",
			userId: "user-1",
			workId: "work-1",
			competencia: "2026-07",
			origem: "BASE_UNICA_BD",
			valores: { produzido: 100, gastos: 80 },
		});
		const v2 = await service.persist({
			ownerId: "owner-1",
			userId: "user-1",
			workId: "work-1",
			competencia: "2026-07",
			origem: "BASE_UNICA_BD",
			valores: { produzido: 120, gastos: 80 },
			reason: "Correcao de producao apos medicao aceita",
		});

		expect(v2).toMatchObject({
			version: 2,
			reason: "Correcao de producao apos medicao aceita",
		});
		const list = await service.listByCompetencia({
			ownerId: "owner-1",
			workId: "work-1",
		});
		expect(list.items).toHaveLength(2);
		expect(list.items[0].version).toBe(2);
		expect(list.items[1]).toMatchObject({ id: v1.id, version: 1 });
	});

	it("rejects a second version without a reason with GOVERNANCE_REASON_REQUIRED", async () => {
		const service = makeService();
		await service.persist({
			ownerId: "owner-1",
			userId: "user-1",
			workId: "work-1",
			competencia: "2026-07",
			origem: "BASE_UNICA_BD",
			valores: { produzido: 100 },
		});

		await expect(
			service.persist({
				ownerId: "owner-1",
				userId: "user-1",
				workId: "work-1",
				competencia: "2026-07",
				origem: "BASE_UNICA_BD",
				valores: { produzido: 120 },
			}),
		).rejects.toMatchObject({
			code: "GOVERNANCE_REASON_REQUIRED",
			status: 422,
			message: "Motivo obrigatorio para reprocessar um fato mensal",
		});
	});

	it("preserves null values as unavailability", async () => {
		const service = makeService();
		const result = await service.persist({
			ownerId: "owner-1",
			userId: "user-1",
			workId: "work-1",
			competencia: "2026-07",
			origem: "RESUMO_VALIDACAO",
			valores: { produzido: 100, previsaoFechamento: null, faturado: null },
		});

		expect(result.valores).toEqual({
			produzido: 100,
			previsaoFechamento: null,
			faturado: null,
		});
	});

	it("computes a different fingerprint when values differ between versions", async () => {
		const service = makeService();
		const v1 = await service.persist({
			ownerId: "owner-1",
			userId: "user-1",
			workId: "work-1",
			competencia: "2026-07",
			origem: "BASE_UNICA_BD",
			valores: { produzido: 100 },
		});
		const v2 = await service.persist({
			ownerId: "owner-1",
			userId: "user-1",
			workId: "work-1",
			competencia: "2026-07",
			origem: "BASE_UNICA_BD",
			valores: { produzido: 101 },
			reason: "Ajuste",
		});

		expect(v1.fingerprint).not.toBe(v2.fingerprint);
	});

	it("increments the version per competencia and origem (unique per version)", async () => {
		const service = makeService();
		const v1 = await service.persist({
			ownerId: "owner-1",
			userId: "user-1",
			workId: "work-1",
			competencia: "2026-07",
			origem: "BASE_UNICA_BD",
			valores: { produzido: 100 },
		});
		const v2 = await service.persist({
			ownerId: "owner-1",
			userId: "user-1",
			workId: "work-1",
			competencia: "2026-07",
			origem: "BASE_UNICA_BD",
			valores: { produzido: 101 },
			reason: "Ajuste",
		});
		const v3 = await service.persist({
			ownerId: "owner-1",
			userId: "user-1",
			workId: "work-1",
			competencia: "2026-07",
			origem: "BASE_UNICA_BD",
			valores: { produzido: 102 },
			reason: "Novo ajuste",
		});
		const other = await service.persist({
			ownerId: "owner-1",
			userId: "user-1",
			workId: "work-1",
			competencia: "2026-08",
			origem: "BASE_UNICA_BD",
			valores: { produzido: 1 },
		});

		expect([v1.version, v2.version, v3.version]).toEqual([1, 2, 3]);
		expect(other.version).toBe(1);
	});

	it("lists versions in descending order filtered by competencia and origem", async () => {
		const service = makeService();
		await service.persist({
			ownerId: "owner-1",
			userId: "user-1",
			workId: "work-1",
			competencia: "2026-07",
			origem: "BASE_UNICA_BD",
			valores: { produzido: 100 },
		});
		await service.persist({
			ownerId: "owner-1",
			userId: "user-1",
			workId: "work-1",
			competencia: "2026-07",
			origem: "BASE_UNICA_BD",
			valores: { produzido: 101 },
			reason: "Ajuste",
		});
		await service.persist({
			ownerId: "owner-1",
			userId: "user-1",
			workId: "work-1",
			competencia: "2026-07",
			origem: "RESUMO_VALIDACAO",
			valores: { produzido: 90 },
		});
		await service.persist({
			ownerId: "owner-1",
			userId: "user-1",
			workId: "work-1",
			competencia: "2026-08",
			origem: "BASE_UNICA_BD",
			valores: { produzido: 1 },
		});

		const all = await service.listByCompetencia({
			ownerId: "owner-1",
			workId: "work-1",
		});
		expect(
			all.items.map(
				(item) => `${item.competencia}:${item.origem}:${item.version}`,
			),
		).toEqual([
			"2026-07:BASE_UNICA_BD:2",
			"2026-08:BASE_UNICA_BD:1",
			"2026-07:RESUMO_VALIDACAO:1",
			"2026-07:BASE_UNICA_BD:1",
		]);

		const filtered = await service.listByCompetencia({
			ownerId: "owner-1",
			workId: "work-1",
			competencia: "2026-07",
			origem: "BASE_UNICA_BD",
		});
		expect(filtered.items.map((item) => item.version)).toEqual([2, 1]);
	});

	it("scopes all reads and writes by ownerId", async () => {
		const service = makeService();
		await service.persist({
			ownerId: "owner-1",
			userId: "user-1",
			workId: "work-1",
			competencia: "2026-07",
			origem: "BASE_UNICA_BD",
			valores: { produzido: 100 },
		});

		const otherOwnerList = await service.listByCompetencia({
			ownerId: "owner-2",
			workId: "work-1",
		});
		expect(otherOwnerList.items).toHaveLength(0);

		const v1 = await service.persist({
			ownerId: "owner-2",
			userId: "user-2",
			workId: "work-1",
			competencia: "2026-07",
			origem: "BASE_UNICA_BD",
			valores: { produzido: 200 },
		});
		expect(v1.version).toBe(1);
		expect(v1.createdBy).toBe("user-2");
	});

	it("rejects an invalid competencia format", async () => {
		const service = makeService();
		await expect(
			service.persist({
				ownerId: "owner-1",
				userId: "user-1",
				workId: "work-1",
				competencia: "07/2026",
				origem: "BASE_UNICA_BD",
				valores: { produzido: 100 },
			}),
		).rejects.toMatchObject({
			code: "INVALID_COMPETENCIA",
			status: 422,
		});
	});

	it("rejects persist when the work belongs to another owner with NOT_FOUND", async () => {
		const { repository, records } = makeRepository({
			workExists: async ({ ownerId, workId }) =>
				ownerId === "owner-1" && workId === "work-1" ? { id: workId } : null,
		});
		const service = new MonthlyFactService(repository);

		await expect(
			service.persist({
				ownerId: "owner-2",
				userId: "user-2",
				workId: "work-1",
				competencia: "2026-07",
				origem: "BASE_UNICA_BD",
				valores: { produzido: 100 },
			}),
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			status: 404,
			message: "Obra nao encontrada",
		});
		expect(records).toHaveLength(0);
	});

	it("rejects persist when the work does not exist with NOT_FOUND", async () => {
		const { repository, records } = makeRepository({
			workExists: async () => null,
		});
		const service = new MonthlyFactService(repository);

		await expect(
			service.persist({
				ownerId: "owner-1",
				userId: "user-1",
				workId: "work-unknown",
				competencia: "2026-07",
				origem: "BASE_UNICA_BD",
				valores: { produzido: 100 },
			}),
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			status: 404,
			message: "Obra nao encontrada",
		});
		expect(records).toHaveLength(0);
	});

	it("returns derived macro metrics on read without mutating stored values", async () => {
		const { repository, records } = makeRepository();
		const service = new MonthlyFactService(repository);
		await service.persist({
			ownerId: "owner-1",
			userId: "user-1",
			workId: "work-1",
			competencia: "2026-07",
			origem: "BASE_UNICA_BD",
			valores: {
				produzido: 100,
				faturado: 60,
				gastos: 70,
				metaMensal: 500,
			},
		});

		const stored = records[0].valores as Record<string, number | null>;
		expect(stored).toEqual({
			produzido: 100,
			faturado: 60,
			gastos: 70,
			metaMensal: 500,
		});

		const list = await service.listByCompetencia({
			ownerId: "owner-1",
			workId: "work-1",
		});
		const view = list.items[0];
		expect(view.derived.lucro).toMatchObject({
			status: "AVAILABLE",
			value: 30,
		});
		expect(view.derived.produzidoNaoFaturado).toMatchObject({
			status: "AVAILABLE",
			value: 40,
		});
		expect(view.derived.margem.status).toBe("UNAVAILABLE");
		expect(view.qualityIssues).toHaveLength(0);
	});

	it("reports negative gastos as a quality issue without deriving lucro", async () => {
		const { repository } = makeRepository();
		const service = new MonthlyFactService(repository);
		await service.persist({
			ownerId: "owner-1",
			userId: "user-1",
			workId: "work-1",
			competencia: "2026-07",
			origem: "BASE_UNICA_BD",
			valores: { produzido: 100, gastos: -50 },
		});

		const list = await service.listByCompetencia({
			ownerId: "owner-1",
			workId: "work-1",
		});
		expect(list.items[0].derived.lucro).toMatchObject({
			status: "UNAVAILABLE",
			value: null,
			unavailableReason: "NEGATIVE_AMOUNT_REVIEW",
		});
		expect(list.items[0].qualityIssues).toEqual([
			{
				code: "NEGATIVE_AMOUNT_REVIEW",
				severity: "MEDIUM",
				message: "Indicador lucro indisponivel: NEGATIVE_AMOUNT_REVIEW",
				metric: "lucro",
			},
		]);
	});

	it("keeps owner scope when returning derived metrics", async () => {
		const { repository } = makeRepository();
		const service = new MonthlyFactService(repository);
		await service.persist({
			ownerId: "owner-1",
			userId: "user-1",
			workId: "work-1",
			competencia: "2026-07",
			origem: "BASE_UNICA_BD",
			valores: { produzido: 100, gastos: 70 },
		});

		const otherOwner = await service.listByCompetencia({
			ownerId: "owner-2",
			workId: "work-1",
		});
		expect(otherOwner.items).toHaveLength(0);
	});

	it("BI-001: campos textuais sao preservados e nao quebram derivados numericos", async () => {
		const { repository } = makeRepository();
		const service = new MonthlyFactService(repository);

		const created = await service.persist({
			ownerId: "owner-1",
			userId: "user-1",
			workId: "work-1",
			competencia: "2026-07",
			origem: "BASE_UNICA_BD",
			valores: {
				produzido: 100,
				gastos: 70,
				nota: "Producao parcial por chuvas",
				origemExtra: "SAP",
			},
		});

		expect(created.valores).toMatchObject({
			produzido: 100,
			gastos: 70,
			nota: "Producao parcial por chuvas",
			origemExtra: "SAP",
		});

		const list = await service.listByCompetencia({
			ownerId: "owner-1",
			workId: "work-1",
		});
		const view = list.items[0];
		expect(view.valores).toMatchObject({ nota: "Producao parcial por chuvas" });
		// Derivados numericos seguem calculados a partir dos campos numericos.
		expect(view.derived).toBeTruthy();
	});
});
