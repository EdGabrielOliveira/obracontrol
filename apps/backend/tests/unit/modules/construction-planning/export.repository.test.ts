import { describe, expect, it, mock } from "bun:test";

const scopeGet = mock(
	async (): Promise<Record<string, unknown>> => ({
		mode: "LIVE",
		snapshotId: null,
	}),
);
const snapshotFindById = mock(
	async (): Promise<Record<string, unknown> | null> => null,
);

mock.module("./bi/bi-snapshot-scope.service", () => ({
	biSnapshotScopeService: { get: scopeGet },
}));

mock.module("./bi/work-metrics-snapshot.service", () => ({
	workMetricsSnapshotService: { findById: snapshotFindById },
}));

mock.module("../../../../src/lib/prisma", () => ({ prisma: {} }));

describe("export repository", () => {
	it("resolveExportSource retorna LIVE quando nao ha modo persistido", async () => {
		const { resolveExportSource } = await import(
			"../../../../src/modules/construction-planning/export.repository"
		);

		await expect(resolveExportSource("owner-1", "work-1")).resolves.toEqual({
			mode: "LIVE",
			persisted: null,
		});
	});

	it("resolveExportSource retorna LIVE quando scope persistido nao aponta snapshot", async () => {
		scopeGet.mockImplementation(async () => ({
			mode: "PERSISTED",
			snapshotId: null,
		}));
		const { resolveExportSource } = await import(
			"../../../../src/modules/construction-planning/export.repository"
		);

		await expect(resolveExportSource("owner-1", "work-1")).resolves.toEqual({
			mode: "LIVE",
			persisted: null,
		});
	});

	it("resolveExportSource retorna LIVE quando snapshot nao esta aceito", async () => {
		scopeGet.mockImplementation(async () => ({
			mode: "PERSISTED",
			snapshotId: "snap-1",
		}));
		snapshotFindById.mockImplementation(async () => ({
			id: "snap-1",
			status: "RASCUNHO",
			version: 2,
			snapshotKind: "CURRENT",
			data: { input: { items: [] } },
		}));
		const { resolveExportSource } = await import(
			"../../../../src/modules/construction-planning/export.repository"
		);

		await expect(resolveExportSource("owner-1", "work-1")).resolves.toEqual({
			mode: "LIVE",
			persisted: null,
		});
	});

	it("resolveExportSource retorna LIVE quando snapshot nao tem data.input", async () => {
		scopeGet.mockImplementation(async () => ({
			mode: "PERSISTED",
			snapshotId: "snap-1",
		}));
		snapshotFindById.mockImplementation(async () => ({
			id: "snap-1",
			status: "ACEITO",
			version: 1,
			data: {},
		}));
		const { resolveExportSource } = await import(
			"../../../../src/modules/construction-planning/export.repository"
		);

		await expect(resolveExportSource("owner-1", "work-1")).resolves.toEqual({
			mode: "LIVE",
			persisted: null,
		});
	});

	it("resolveExportSource retorna LIVE quando snapshot aceito tem data.input sem items", async () => {
		scopeGet.mockImplementation(async () => ({
			mode: "PERSISTED",
			snapshotId: "snap-1",
		}));
		snapshotFindById.mockImplementation(async () => ({
			id: "snap-1",
			status: "ACEITO",
			version: 3,
			snapshotKind: "CURRENT",
			data: { input: { baseDate: "2026-03-01T00:00:00.000Z" } },
		}));
		const { resolveExportSource } = await import(
			"../../../../src/modules/construction-planning/export.repository"
		);

		await expect(resolveExportSource("owner-1", "work-1")).resolves.toEqual({
			mode: "LIVE",
			persisted: null,
		});
	});

	it("resolveExportSource retorna LIVE quando items nao e array", async () => {
		scopeGet.mockImplementation(async () => ({
			mode: "PERSISTED",
			snapshotId: "snap-1",
		}));
		snapshotFindById.mockImplementation(async () => ({
			id: "snap-1",
			status: "ACEITO",
			version: 2,
			snapshotKind: "CURRENT",
			data: { input: { items: { index: "1.1" } } },
		}));
		const { resolveExportSource } = await import(
			"../../../../src/modules/construction-planning/export.repository"
		);

		await expect(resolveExportSource("owner-1", "work-1")).resolves.toEqual({
			mode: "LIVE",
			persisted: null,
		});
	});

	it("resolveExportSource retorna sempre LIVE (fonte unica de exportacao)", async () => {
		const { resolveExportSource } = await import(
			"../../../../src/modules/construction-planning/export.repository"
		);

		const result = await resolveExportSource("owner-1", "work-1");
		expect(result).toEqual({ mode: "LIVE", persisted: null });
	});
});
