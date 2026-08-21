import { beforeEach, describe, expect, it, mock } from "bun:test";
import { ConstructionError } from "../../../../../src/lib/errors";

type StoredWorkFixture = {
	id: string;
	ownerId: string;
	code: string;
	name: string;
	clientName: string | null;
	plannedStart: Date | null;
	plannedEnd: Date | null;
	baseDate: Date | null;
	createdAt: Date;
	imports: Array<{ createdAt: Date }>;
	baselineSchedules: Array<{
		id?: string;
		budgetItemId?: string;
		index?: string;
		plannedStart?: Date | null;
		plannedEnd?: Date | null;
	}>;
	scheduleRevisions: Array<{
		id?: string;
		budgetItemId?: string;
		index?: string;
		version?: string | null;
		revisionDate?: Date | null;
		replannedStart?: Date | null;
		replannedEnd?: Date | null;
		reason?: string | null;
	}>;
	items: Array<{ id: string; index: string }>;
};

const getWorkWithItems = mock<() => Promise<StoredWorkFixture>>(async () => ({
	id: "work-1",
	ownerId: "owner-1",
	code: "OBRA-001",
	name: "Edificio Horizonte",
	clientName: null,
	plannedStart: null,
	plannedEnd: null,
	baseDate: null,
	createdAt: new Date(),
	imports: [],
	baselineSchedules: [],
	scheduleRevisions: [],
	items: [{ id: "item-1", index: "1.1" }],
}));
const findActiveImport = mock(
	async (): Promise<{ activeImportId: string } | null> => ({
		activeImportId: "import-1",
	}),
);
const assertGovernanceWritable = mock(async () => undefined);
const baselineDeleteMany = mock(async () => ({ count: 0 }));
const baselineCreateMany = mock(async () => ({ count: 1 }));
const baselineFindFirst = mock(
	async () => null as Record<string, unknown> | null,
);
const baselineCreate = mock(async () => ({
	id: "baseline-1",
	plannedStart: new Date("2026-01-01"),
	plannedEnd: new Date("2026-01-31"),
}));
const baselineUpdate = mock(async () => ({
	id: "baseline-1",
	plannedStart: new Date("2026-02-01"),
	plannedEnd: new Date("2026-02-28"),
}));
const scheduleVersionFindFirst = mock(
	async () => null as { id: string } | null,
);
const scheduleVersionItemFindFirst = mock(
	async () => null as Record<string, unknown> | null,
);
const scheduleVersionItemCreate = mock(async () => undefined);
const scheduleVersionItemUpdate = mock(async () => undefined);
const revisionDeleteMany = mock(async () => ({ count: 0 }));
const revisionCreateMany = mock(async () => ({ count: 1 }));
const revisionCreate = mock<
	(args: { data: Record<string, unknown> }) => Promise<Record<string, unknown>>
>(async () => ({
	id: "rev-1",
	ownerId: "owner-1",
	workId: "work-1",
	importId: "import-1",
	budgetItemId: "item-1",
	index: "1.1",
	version: "R1",
	replannedStart: new Date("2026-01-05"),
	replannedEnd: new Date("2026-02-05"),
	revisionDate: new Date("2026-01-10"),
	reason: "Chuva",
}));
const transaction = mock(
	async (callback: (tx: never) => Promise<unknown>): Promise<unknown> =>
		callback(tx),
);

const tx = {
	constructionWork: { findFirst: findActiveImport },
	constructionBaselineSchedule: {
		deleteMany: baselineDeleteMany,
		createMany: baselineCreateMany,
		findFirst: baselineFindFirst,
		create: baselineCreate,
		update: baselineUpdate,
	},
	scheduleVersion: {
		findFirst: scheduleVersionFindFirst,
	},
	scheduleVersionItem: {
		findFirst: scheduleVersionItemFindFirst,
		create: scheduleVersionItemCreate,
		update: scheduleVersionItemUpdate,
	},
	constructionScheduleRevision: {
		deleteMany: revisionDeleteMany,
		createMany: revisionCreateMany,
		create: revisionCreate,
	},
} as never;

mock.module("../../../../../src/lib/prisma", () => ({
	prisma: {
		$transaction: transaction,
		constructionWork: { findFirst: findActiveImport },
		constructionBaselineSchedule: {
			deleteMany: baselineDeleteMany,
			createMany: baselineCreateMany,
			findFirst: baselineFindFirst,
			create: baselineCreate,
			update: baselineUpdate,
		},
		scheduleVersion: {
			findFirst: scheduleVersionFindFirst,
		},
		scheduleVersionItem: {
			findFirst: scheduleVersionItemFindFirst,
			create: scheduleVersionItemCreate,
			update: scheduleVersionItemUpdate,
		},
		constructionScheduleRevision: {
			deleteMany: revisionDeleteMany,
			createMany: revisionCreateMany,
			create: revisionCreate,
		},
	},
}));

describe("ConstructionScheduleService.importSchedule", () => {
	let service: InstanceType<
		typeof import("../../../../../src/modules/construction-planning/schedule/schedule-service").ConstructionScheduleService
	>;
	let scheduleModule: typeof import("../../../../../src/modules/construction-planning/schedule/schedule-service");

	beforeEach(async () => {
		getWorkWithItems.mockClear();
		findActiveImport.mockClear();
		baselineDeleteMany.mockClear();
		baselineCreateMany.mockClear();
		baselineFindFirst.mockClear();
		baselineCreate.mockClear();
		baselineUpdate.mockClear();
		scheduleVersionFindFirst.mockClear();
		scheduleVersionItemFindFirst.mockClear();
		scheduleVersionItemCreate.mockClear();
		scheduleVersionItemUpdate.mockClear();
		revisionDeleteMany.mockClear();
		revisionCreateMany.mockClear();
		revisionCreate.mockClear();
		transaction.mockClear();
		assertGovernanceWritable.mockClear();
		getWorkWithItems.mockImplementation(async () => ({
			id: "work-1",
			ownerId: "owner-1",
			code: "OBRA-001",
			name: "Edificio Horizonte",
			clientName: null,
			plannedStart: null,
			plannedEnd: null,
			baseDate: null,
			createdAt: new Date(),
			imports: [],
			baselineSchedules: [],
			scheduleRevisions: [],
			items: [{ id: "item-1", index: "1.1" }],
		}));
		findActiveImport.mockImplementation(async () => ({
			activeImportId: "import-1",
		}));
		scheduleModule = await import(
			"../../../../../src/modules/construction-planning/schedule/schedule-service"
		);
		service = new scheduleModule.ConstructionScheduleService(
			{ getWorkWithItems } as never,
			{ assertWritable: assertGovernanceWritable } as never,
		);
	});

	it("applies baseline and replanning rows inside a single transaction", async () => {
		const result = await service.importSchedule(
			"owner-1",
			"work-1",
			[
				{
					index: "1.1",
					plannedStart: "2026-01-01",
					plannedEnd: "2026-01-31",
					plannedWeight: 0,
				},
			],
			[
				{
					rowNumber: 2,
					index: "1.1",
					version: "R1",
					replannedStart: new Date("2026-01-05"),
					replannedEnd: new Date("2026-02-05"),
					revisionDate: new Date("2026-01-10"),
					reason: "Chuva",
				},
			],
			"user-1",
		);

		expect(transaction).toHaveBeenCalledTimes(1);
		expect(baselineDeleteMany).toHaveBeenCalledWith({
			where: { ownerId: "owner-1", workId: "work-1", importId: "import-1" },
		});
		expect(baselineCreateMany).toHaveBeenCalledWith({
			data: expect.arrayContaining([
				expect.objectContaining({
					ownerId: "owner-1",
					workId: "work-1",
					importId: "import-1",
					budgetItemId: "item-1",
					index: "1.1",
				}),
			]),
		});
		expect(revisionDeleteMany).toHaveBeenCalledWith({
			where: { ownerId: "owner-1", workId: "work-1", importId: "import-1" },
		});
		expect(revisionCreateMany).toHaveBeenCalledWith({
			data: expect.arrayContaining([
				expect.objectContaining({
					index: "1.1",
					version: "R1",
					budgetItemId: "item-1",
				}),
			]),
		});
		expect(result).toEqual({
			work: { id: "work-1" },
			replanningImported: 1,
		});
	});

	it("skips baseline writes when only replanning rows are provided", async () => {
		const result = await service.importSchedule(
			"owner-1",
			"work-1",
			[],
			[
				{
					rowNumber: 2,
					index: "1.1",
					version: "R1",
					replannedStart: new Date("2026-01-05"),
					replannedEnd: new Date("2026-02-05"),
					revisionDate: new Date("2026-01-10"),
					reason: null,
				},
			],
			"user-1",
		);

		expect(transaction).toHaveBeenCalledTimes(1);
		expect(baselineDeleteMany).not.toHaveBeenCalled();
		expect(baselineCreateMany).not.toHaveBeenCalled();
		expect(revisionCreateMany).toHaveBeenCalledTimes(1);
		expect(result.replanningImported).toBe(1);
	});

	it("aborts before any write when a baseline index has no budget item", async () => {
		await expect(
			service.importSchedule(
				"owner-1",
				"work-1",
				[
					{
						index: "9.9",
						plannedStart: "2026-01-01",
						plannedEnd: "2026-01-31",
						plannedWeight: 0,
					},
				],
				[],
				"user-1",
			),
		).rejects.toThrow(
			new ConstructionError(
				"INVALID_INPUT",
				"Item de orcamento com indice 9.9 nao encontrado",
				422,
			),
		);

		expect(transaction).not.toHaveBeenCalled();
		expect(baselineDeleteMany).not.toHaveBeenCalled();
	});

	it("binds a baseline row to the closest ancestor budget item when the exact index is absent", async () => {
		const result = await service.importSchedule(
			"owner-1",
			"work-1",
			[
				{
					index: "1.1.1",
					plannedStart: "2026-01-01",
					plannedEnd: "2026-01-31",
					plannedWeight: 0,
				},
			],
			[],
			"user-1",
		);

		expect(baselineCreateMany).toHaveBeenCalledWith(
			expect.objectContaining({
				data: [
					expect.objectContaining({
						index: "1.1.1",
						budgetItemId: "item-1",
					}),
				],
			}),
		);
		expect(result).toEqual({
			work: { id: "work-1" },
			replanningImported: 0,
		});
	});

	it("binds replanning rows to the closest ancestor budget item when the exact index is absent", async () => {
		const result = await service.importSchedule(
			"owner-1",
			"work-1",
			[],
			[
				{
					rowNumber: 2,
					index: "1.1.1",
					version: "R1",
					replannedStart: new Date("2026-01-05"),
					replannedEnd: new Date("2026-02-05"),
					revisionDate: new Date("2026-01-10"),
					reason: null,
				},
			],
			"user-1",
		);

		expect(revisionCreateMany).toHaveBeenCalledWith(
			expect.objectContaining({
				data: [
					expect.objectContaining({
						index: "1.1.1",
						budgetItemId: "item-1",
					}),
				],
			}),
		);
		expect(result.replanningImported).toBe(1);
	});

	it("rejects when the work has no active import", async () => {
		findActiveImport.mockImplementation(async () => null);

		await expect(
			service.importSchedule("owner-1", "work-1", [], [], "user-1"),
		).rejects.toThrow("A obra precisa de uma importacao ativa");
		expect(transaction).not.toHaveBeenCalled();
	});

	it("rejects when the work is not found or belongs to another owner", async () => {
		getWorkWithItems.mockImplementation(async () => null as never);

		await expect(
			service.importSchedule("owner-1", "work-1", [], [], "user-1"),
		).rejects.toThrow("Obra nao encontrada");
		expect(transaction).not.toHaveBeenCalled();
	});

	it("calls the governance guard with SCHEDULE scope before importing", async () => {
		await service.importSchedule("owner-1", "work-1", [], [], "user-1");

		expect(assertGovernanceWritable).toHaveBeenCalledWith(
			"owner-1",
			"SCHEDULE",
			"work-1",
		);
	});

	it("blocks the import when the schedule is accepted or locked", async () => {
		const blocked = new ConstructionError(
			"GOVERNANCE_MUTATION_BLOCKED",
			"A entidade aceita ou travada deve ser reaberta antes de ser alterada",
			423,
		);
		assertGovernanceWritable.mockImplementationOnce(async () => {
			throw blocked;
		});

		await expect(
			service.importSchedule("owner-1", "work-1", [], [], "user-1"),
		).rejects.toThrow(blocked);
		expect(transaction).not.toHaveBeenCalled();
		expect(baselineCreateMany).not.toHaveBeenCalled();
		expect(revisionCreateMany).not.toHaveBeenCalled();
	});
});

describe("ConstructionScheduleService.addScheduleRevision", () => {
	let service: InstanceType<
		typeof import("../../../../../src/modules/construction-planning/schedule/schedule-service").ConstructionScheduleService
	>;

	beforeEach(async () => {
		getWorkWithItems.mockClear();
		findActiveImport.mockClear();
		revisionCreate.mockClear();
		assertGovernanceWritable.mockClear();
		getWorkWithItems.mockImplementation(async () => ({
			id: "work-1",
			ownerId: "owner-1",
			code: "OBRA-001",
			name: "Edificio Horizonte",
			clientName: null,
			plannedStart: null,
			plannedEnd: null,
			baseDate: null,
			createdAt: new Date(),
			imports: [],
			baselineSchedules: [],
			scheduleRevisions: [],
			items: [{ id: "item-1", index: "1.1" }],
		}));
		findActiveImport.mockImplementation(async () => ({
			activeImportId: "import-1",
		}));
		const scheduleModule = await import(
			"../../../../../src/modules/construction-planning/schedule/schedule-service"
		);
		service = new scheduleModule.ConstructionScheduleService(
			{ getWorkWithItems } as never,
			{ assertWritable: assertGovernanceWritable } as never,
		);
	});

	it("creates a single revision without deleting existing ones", async () => {
		const result = await service.addScheduleRevision(
			"owner-1",
			"work-1",
			{
				index: "1.1",
				version: "R2",
				replannedStart: "2026-03-01",
				replannedEnd: "2026-03-31",
				revisionDate: "2026-02-15",
				reason: "Atraso de fornecedor",
			},
			"user-1",
		);

		expect(revisionDeleteMany).not.toHaveBeenCalled();
		expect(revisionCreate).toHaveBeenCalledTimes(1);
		expect(revisionCreate).toHaveBeenCalledWith({
			data: {
				ownerId: "owner-1",
				workId: "work-1",
				importId: "import-1",
				budgetItemId: "item-1",
				rowNumber: null,
				index: "1.1",
				version: "R1",
				replannedStart: new Date("2026-03-01"),
				replannedEnd: new Date("2026-03-31"),
				revisionDate: new Date("2026-02-15"),
				reason: "Atraso de fornecedor",
				createdBy: "user-1",
			},
		});
		expect(result.id).toBe("rev-1");
	});

	it("defaults revisionDate to today and reason to null when absent", async () => {
		await service.addScheduleRevision(
			"owner-1",
			"work-1",
			{
				index: "1.1",
				replannedStart: "2026-03-01",
				replannedEnd: "2026-03-31",
			},
			"user-1",
		);

		const calledData = revisionCreate.mock.calls[0][0].data as {
			revisionDate: Date;
			version: string | null;
			reason: string | null;
		};
		expect(calledData.revisionDate).toBeInstanceOf(Date);
		expect(calledData.revisionDate.toISOString().slice(0, 10)).toBe(
			new Date().toISOString().slice(0, 10),
		);
		expect(calledData.version).toBe("R1");
		expect(calledData.reason).toBeNull();
	});

	it("auto-increments the version from the latest existing revision and ignores the payload version", async () => {
		getWorkWithItems.mockImplementation(async () => ({
			id: "work-1",
			ownerId: "owner-1",
			code: "OBRA-001",
			name: "Edificio Horizonte",
			clientName: null,
			plannedStart: null,
			plannedEnd: null,
			baseDate: null,
			createdAt: new Date(),
			imports: [],
			baselineSchedules: [],
			scheduleRevisions: [{ version: "R1", revisionDate: null }],
			items: [{ id: "item-1", index: "1.1" }],
		}));

		await service.addScheduleRevision(
			"owner-1",
			"work-1",
			{
				index: "1.1",
				version: "R9",
				replannedStart: "2026-03-01",
				replannedEnd: "2026-03-31",
				revisionDate: "2026-02-15",
			},
			"user-1",
		);

		const calledData = revisionCreate.mock.calls[0][0].data as {
			version: string | null;
		};
		expect(calledData.version).toBe("R2");
	});

	it("calls the governance guard with SCHEDULE scope before creating a revision", async () => {
		await service.addScheduleRevision(
			"owner-1",
			"work-1",
			{
				index: "1.1",
				replannedStart: "2026-03-01",
				replannedEnd: "2026-03-31",
			},
			"user-1",
		);

		expect(assertGovernanceWritable).toHaveBeenCalledWith(
			"owner-1",
			"SCHEDULE",
			"work-1",
		);
	});

	it("blocks the revision when the schedule is accepted or locked", async () => {
		const blocked = new ConstructionError(
			"GOVERNANCE_MUTATION_BLOCKED",
			"A entidade aceita ou travada deve ser reaberta antes de ser alterada",
			423,
		);
		assertGovernanceWritable.mockImplementationOnce(async () => {
			throw blocked;
		});

		await expect(
			service.addScheduleRevision(
				"owner-1",
				"work-1",
				{
					index: "1.1",
					replannedStart: "2026-03-01",
					replannedEnd: "2026-03-31",
				},
				"user-1",
			),
		).rejects.toThrow(blocked);
		expect(revisionCreate).not.toHaveBeenCalled();
	});

	it("rejects a revision date earlier than the item baseline", async () => {
		getWorkWithItems.mockImplementation(async () => ({
			id: "work-1",
			ownerId: "owner-1",
			code: "OBRA-001",
			name: "Edificio Horizonte",
			clientName: null,
			plannedStart: null,
			plannedEnd: null,
			baseDate: null,
			createdAt: new Date(),
			imports: [],
			baselineSchedules: [
				{
					id: "baseline-1",
					budgetItemId: "item-1",
					index: "1.1",
					plannedStart: new Date("2026-01-01"),
					plannedEnd: new Date("2026-01-31"),
				},
			],
			scheduleRevisions: [],
			items: [{ id: "item-1", index: "1.1" }],
		}));

		await expect(
			service.addScheduleRevision(
				"owner-1",
				"work-1",
				{
					index: "1.1",
					replannedStart: "2026-03-01",
					replannedEnd: "2026-03-31",
					revisionDate: "2025-12-01",
				},
				"user-1",
			),
		).rejects.toThrow(
			new ConstructionError(
				"REVISION_DATE_OUT_OF_SEQUENCE",
				"Data da revisao anterior a baseline ou a revisao vigente",
				422,
			),
		);
		expect(revisionCreate).not.toHaveBeenCalled();
	});

	it("rejects a revision date earlier than the latest existing revision", async () => {
		getWorkWithItems.mockImplementation(async () => ({
			id: "work-1",
			ownerId: "owner-1",
			code: "OBRA-001",
			name: "Edificio Horizonte",
			clientName: null,
			plannedStart: null,
			plannedEnd: null,
			baseDate: null,
			createdAt: new Date(),
			imports: [],
			baselineSchedules: [
				{
					id: "baseline-1",
					budgetItemId: "item-1",
					index: "1.1",
					plannedStart: new Date("2026-01-01"),
					plannedEnd: new Date("2026-01-31"),
				},
			],
			scheduleRevisions: [
				{ version: "R1", revisionDate: new Date("2026-02-15") },
			],
			items: [{ id: "item-1", index: "1.1" }],
		}));

		await expect(
			service.addScheduleRevision(
				"owner-1",
				"work-1",
				{
					index: "1.1",
					replannedStart: "2026-03-01",
					replannedEnd: "2026-03-31",
					revisionDate: "2026-01-10",
				},
				"user-1",
			),
		).rejects.toThrow(
			new ConstructionError(
				"REVISION_DATE_OUT_OF_SEQUENCE",
				"Data da revisao anterior a baseline ou a revisao vigente",
				422,
			),
		);
		expect(revisionCreate).not.toHaveBeenCalled();
	});

	it("rejects when the index has no budget item", async () => {
		await expect(
			service.addScheduleRevision(
				"owner-1",
				"work-1",
				{
					index: "9.9",
					replannedStart: "2026-03-01",
					replannedEnd: "2026-03-31",
				},
				"user-1",
			),
		).rejects.toThrow(
			new ConstructionError(
				"INVALID_INPUT",
				"Item de orcamento com indice 9.9 nao encontrado",
				422,
			),
		);
		expect(revisionCreate).not.toHaveBeenCalled();
	});

	it("rejects when the work has no active import", async () => {
		findActiveImport.mockImplementation(async () => null);

		await expect(
			service.addScheduleRevision(
				"owner-1",
				"work-1",
				{
					index: "1.1",
					replannedStart: "2026-03-01",
					replannedEnd: "2026-03-31",
				},
				"user-1",
			),
		).rejects.toThrow("A obra precisa de uma importacao ativa");
		expect(revisionCreate).not.toHaveBeenCalled();
	});

	it("rejects when the work is not found or belongs to another owner", async () => {
		getWorkWithItems.mockImplementation(async () => null as never);

		await expect(
			service.addScheduleRevision(
				"owner-1",
				"work-1",
				{
					index: "1.1",
					replannedStart: "2026-03-01",
					replannedEnd: "2026-03-31",
				},
				"user-1",
			),
		).rejects.toThrow("Obra nao encontrada");
		expect(revisionCreate).not.toHaveBeenCalled();
	});
});

describe("ConstructionScheduleService.createScheduleRevisions", () => {
	let service: InstanceType<
		typeof import("../../../../../src/modules/construction-planning/schedule/schedule-service").ConstructionScheduleService
	>;

	beforeEach(async () => {
		getWorkWithItems.mockClear();
		findActiveImport.mockClear();
		revisionDeleteMany.mockClear();
		revisionCreateMany.mockClear();
		assertGovernanceWritable.mockClear();
		getWorkWithItems.mockImplementation(async () => ({
			id: "work-1",
			ownerId: "owner-1",
			code: "OBRA-001",
			name: "Edificio Horizonte",
			clientName: null,
			plannedStart: null,
			plannedEnd: null,
			baseDate: null,
			createdAt: new Date(),
			imports: [],
			baselineSchedules: [],
			scheduleRevisions: [],
			items: [{ id: "item-1", index: "1.1" }],
		}));
		findActiveImport.mockImplementation(async () => ({
			activeImportId: "import-1",
		}));
		const scheduleModule = await import(
			"../../../../../src/modules/construction-planning/schedule/schedule-service"
		);
		service = new scheduleModule.ConstructionScheduleService(
			{ getWorkWithItems } as never,
			{ assertWritable: assertGovernanceWritable } as never,
		);
	});

	it("rejects a row date earlier than the baseline before any write", async () => {
		getWorkWithItems.mockImplementation(async () => ({
			id: "work-1",
			ownerId: "owner-1",
			code: "OBRA-001",
			name: "Edificio Horizonte",
			clientName: null,
			plannedStart: null,
			plannedEnd: null,
			baseDate: null,
			createdAt: new Date(),
			imports: [],
			baselineSchedules: [
				{
					id: "baseline-1",
					budgetItemId: "item-1",
					index: "1.1",
					plannedStart: new Date("2026-01-01"),
					plannedEnd: new Date("2026-01-31"),
				},
			],
			scheduleRevisions: [],
			items: [{ id: "item-1", index: "1.1" }],
		}));

		await expect(
			service.createScheduleRevisions(
				"owner-1",
				"work-1",
				[
					{
						rowNumber: 1,
						index: "1.1",
						version: "R1",
						replannedStart: new Date("2026-01-05"),
						replannedEnd: new Date("2026-02-05"),
						revisionDate: new Date("2025-12-01"),
						reason: null,
					},
				],
				"user-1",
			),
		).rejects.toThrow(
			new ConstructionError(
				"REVISION_DATE_OUT_OF_SEQUENCE",
				"Data da revisao anterior a baseline ou a revisao vigente",
				422,
			),
		);
		expect(transaction).not.toHaveBeenCalled();
	});

	it("persists the acting user as createdBy and keeps the payload version", async () => {
		const count = await service.createScheduleRevisions(
			"owner-1",
			"work-1",
			[
				{
					rowNumber: 1,
					index: "1.1",
					version: "R3",
					replannedStart: new Date("2026-01-05"),
					replannedEnd: new Date("2026-02-05"),
					revisionDate: new Date("2026-01-10"),
					reason: null,
				},
			],
			"user-1",
		);

		expect(revisionCreateMany).toHaveBeenCalledWith(
			expect.objectContaining({
				data: [
					expect.objectContaining({
						index: "1.1",
						version: "R3",
						createdBy: "user-1",
					}),
				],
			}),
		);
		expect(count).toBe(1);
	});
});

describe("ConstructionScheduleService.upsertManualScheduleItem", () => {
	let service: InstanceType<
		typeof import("../../../../../src/modules/construction-planning/schedule/schedule-service").ConstructionScheduleService
	>;

	beforeEach(async () => {
		baselineCreate.mockClear();
		baselineUpdate.mockClear();
		scheduleVersionItemUpdate.mockClear();
		getWorkWithItems.mockImplementation(async () => ({
			id: "work-1",
			ownerId: "owner-1",
			code: "OBRA-001",
			name: "Edificio Horizonte",
			clientName: null,
			plannedStart: null,
			plannedEnd: null,
			baseDate: null,
			createdAt: new Date(),
			imports: [],
			baselineSchedules: [],
			scheduleRevisions: [],
			items: [{ id: "item-1", index: "1.1" }],
		}));
		findActiveImport.mockImplementation(async () => ({
			activeImportId: "import-1",
		}));
		baselineFindFirst.mockImplementation(async () => null);
		scheduleVersionFindFirst.mockImplementation(async () => null);
		scheduleVersionItemFindFirst.mockImplementation(async () => null);
		const scheduleModule = await import(
			"../../../../../src/modules/construction-planning/schedule/schedule-service"
		);
		service = new scheduleModule.ConstructionScheduleService(
			{ getWorkWithItems } as never,
			{ assertWritable: assertGovernanceWritable } as never,
		);
	});

	it("creates a baseline row for a budget item without schedule", async () => {
		const result = await service.upsertManualScheduleItem("owner-1", "work-1", {
			budgetItemId: "item-1",
			plannedStart: "2026-01-01",
			plannedEnd: "2026-01-31",
		});

		expect(baselineCreate).toHaveBeenCalledWith({
			data: {
				ownerId: "owner-1",
				workId: "work-1",
				importId: "import-1",
				budgetItemId: "item-1",
				rowNumber: null,
				index: "1.1",
				plannedStart: new Date("2026-01-01"),
				plannedEnd: new Date("2026-01-31"),
				plannedWeight: null,
			},
		});
		expect(result).toMatchObject({
			id: "baseline-1",
			budgetItemId: "item-1",
			index: "1.1",
			created: true,
		});
	});

	it("updates an existing baseline and its materialized Baseline version item", async () => {
		baselineFindFirst.mockImplementationOnce(async () => ({
			id: "baseline-1",
			createdAt: new Date("2026-01-01"),
		}));
		baselineUpdate.mockImplementationOnce(async () => ({
			id: "baseline-1",
			plannedStart: new Date("2026-02-01"),
			plannedEnd: new Date("2026-02-28"),
		}));
		scheduleVersionFindFirst.mockImplementationOnce(async () => ({
			id: "version-1",
		}));
		scheduleVersionItemFindFirst.mockImplementationOnce(async () => ({
			id: "version-item-1",
		}));

		const result = await service.upsertManualScheduleItem("owner-1", "work-1", {
			budgetItemId: "item-1",
			plannedStart: "2026-02-01",
			plannedEnd: "2026-02-28",
		});

		expect(baselineUpdate).toHaveBeenCalledWith({
			where: { id: "baseline-1" },
			data: {
				index: "1.1",
				plannedStart: new Date("2026-02-01"),
				plannedEnd: new Date("2026-02-28"),
			},
		});
		expect(scheduleVersionItemUpdate).toHaveBeenCalledWith({
			where: { id: "version-item-1" },
			data: {
				budgetItemId: "item-1",
				index: "1.1",
				baselineStart: new Date("2026-02-01"),
				baselineEnd: new Date("2026-02-28"),
			},
		});
		expect(result.created).toBe(false);
	});

	it("rejects an end date before the start date before writing", async () => {
		await expect(
			service.upsertManualScheduleItem("owner-1", "work-1", {
				budgetItemId: "item-1",
				plannedStart: "2026-03-01",
				plannedEnd: "2026-02-28",
			}),
		).rejects.toThrow("A data de fim deve ser maior ou igual");
		expect(baselineCreate).not.toHaveBeenCalled();
		expect(baselineUpdate).not.toHaveBeenCalled();
	});
});
