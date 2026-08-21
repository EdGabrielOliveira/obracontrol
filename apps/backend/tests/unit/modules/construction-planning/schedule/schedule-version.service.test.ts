import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { ConstructionError } from "../../../../../src/lib/errors";

const scheduleVersionFindFirst = mock(
	async (): Promise<Record<string, unknown> | null> => null,
);
const scheduleVersionFindMany = mock(
	async (): Promise<Array<Record<string, unknown>>> => [],
);
const scheduleVersionCreate = mock(
	async (args: { data: Record<string, unknown> }) => ({
		id: "version-1",
		...args.data,
	}),
);
const scheduleVersionUpdate = mock(async () => ({
	id: "version-1",
	status: "VIGENTE",
}));
const scheduleVersionItemFindFirst = mock(
	async (): Promise<Record<string, unknown> | null> => null,
);
const scheduleVersionItemFindMany = mock(
	async (): Promise<Array<Record<string, unknown>>> => [],
);
const scheduleVersionItemCreateMany = mock(async () => ({ count: 0 }));
const scheduleVersionItemUpdate = mock(async () => ({}));
const constructionBaselineScheduleFindMany = mock(
	async (): Promise<Array<Record<string, unknown>>> => [],
);
const constructionWorkFindFirst = mock(async () => ({
	id: "work-1",
	ownerId: "owner-1",
}));

const transactionMock = mock(
	async (callback: (tx: Record<string, unknown>) => Promise<unknown>) =>
		callback({
			scheduleVersion: {
				findFirst: scheduleVersionFindFirst,
				create: scheduleVersionCreate,
			},
			constructionBaselineSchedule: {
				findMany: constructionBaselineScheduleFindMany,
			},
			scheduleVersionItem: { createMany: scheduleVersionItemCreateMany },
		}),
);

mock.module("../../../../../src/lib/prisma", () => ({
	prisma: {
		scheduleVersion: {
			findFirst: scheduleVersionFindFirst,
			findMany: scheduleVersionFindMany,
			update: scheduleVersionUpdate,
		},
		scheduleVersionItem: {
			findFirst: scheduleVersionItemFindFirst,
			findMany: scheduleVersionItemFindMany,
			update: scheduleVersionItemUpdate,
		},
		constructionWork: { findFirst: constructionWorkFindFirst },
		$transaction: transactionMock,
	},
}));

mock.module("../../../../../src/lib/resource-scope", () => ({
	resolveResourceScope: mock(async () => ({
		actorId: "user-1",
		resourceType: "WORK",
		resourceOwnerId: "owner-1",
		path: { organizationId: "org-1", costCenterId: "cc-1", workId: "work-1" },
		role: "GERENTE",
		canRead: true,
		canWrite: true,
		canAdmin: false,
	})),
}));

async function importService() {
	return import(
		"../../../../../src/modules/construction-planning/schedule/schedule-version.service"
	);
}

function makeBaselineItem(overrides: Record<string, unknown> = {}) {
	return {
		id: "svi-1",
		versionId: "version-1",
		budgetItemId: "item-1",
		index: "1.1",
		baselineStart: new Date("2026-01-01"),
		baselineEnd: new Date("2026-03-31"),
		baselineWeight: 1,
		replannedStart: null,
		replannedEnd: null,
		deltaDays: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides,
	};
}

function makeVersion(overrides: Record<string, unknown> = {}) {
	return {
		id: "version-1",
		ownerId: "owner-1",
		workId: "work-1",
		versionNumber: 1,
		label: "Baseline",
		status: "VIGENTE",
		isActive: true,
		revisionDate: null,
		reason: null,
		createdBy: null,
		createdAt: new Date(),
		items: [makeBaselineItem()],
		...overrides,
	};
}

describe("schedule version service", () => {
	beforeEach(() => {
		mock.clearAllMocks();
		scheduleVersionFindFirst.mockResolvedValue(null);
		scheduleVersionCreate.mockImplementation(
			async (args: { data: Record<string, unknown> }) => ({
				id: "version-1",
				...args.data,
			}),
		);
		constructionBaselineScheduleFindMany.mockResolvedValue([
			{
				budgetItemId: "item-1",
				index: "1.1",
				plannedStart: new Date("2026-01-01"),
				plannedEnd: new Date("2026-03-31"),
				plannedWeight: 1,
			},
		]);
		scheduleVersionItemCreateMany.mockImplementation(async () => ({
			count: 1,
		}));
	});

	it("cria a baseline de cronograma independente do orcamento", async () => {
		const { scheduleVersionService } = await importService();
		const versions = await scheduleVersionService.getScheduleVersions(
			"user-1",
			"work-1",
		);

		expect(scheduleVersionCreate).toHaveBeenCalledWith({
			data: {
				ownerId: "owner-1",
				workId: "work-1",
				versionNumber: 1,
				label: "Baseline",
				status: "VIGENTE",
				isActive: true,
			},
		});
		expect(scheduleVersionItemCreateMany).toHaveBeenCalledWith({
			data: expect.arrayContaining([
				expect.objectContaining({ index: "1.1", versionId: "version-1" }),
			]),
		});
		expect(Array.isArray(versions)).toBe(true);
	});

	it("replanejamento cria somente versao de cronograma (nao mexe no orcamento)", async () => {
		scheduleVersionFindFirst.mockResolvedValue(
			makeVersion({
				revisionDate: new Date("2026-03-01"),
				reason: "Deslocamento de cronograma",
				createdBy: "user-1",
				items: [
					makeBaselineItem({
						replannedStart: new Date("2026-04-01"),
						replannedEnd: new Date("2026-06-30"),
						deltaDays: 90,
					}),
				],
			}),
		);
		scheduleVersionItemFindFirst.mockResolvedValue(makeBaselineItem());
		const { scheduleVersionService } = await importService();

		const view = await scheduleVersionService.createScheduleRevisionVersion(
			"user-1",
			"work-1",
			{
				index: "1.1",
				replannedStart: "2026-04-01",
				replannedEnd: "2026-06-30",
				revisionDate: "2026-03-01",
				reason: "Deslocamento de cronograma",
			},
		);

		expect(scheduleVersionItemUpdate).toHaveBeenCalledWith({
			where: { id: "svi-1" },
			data: {
				replannedStart: expect.any(Date),
				replannedEnd: expect.any(Date),
				deltaDays: 90,
			},
		});
		expect(scheduleVersionUpdate).toHaveBeenCalledWith({
			where: { id: "version-1" },
			data: {
				revisionDate: expect.any(Date),
				reason: "Deslocamento de cronograma",
				createdBy: "user-1",
				status: "VIGENTE",
			},
		});
		expect(view.items[0]?.deltaDays).toBe(90);
	});

	it("rejeita revisao com data anterior a baseline", async () => {
		scheduleVersionFindFirst.mockResolvedValue(makeVersion());
		scheduleVersionItemFindFirst.mockResolvedValue(makeBaselineItem());
		const { scheduleVersionService } = await importService();

		let error: ConstructionError | undefined;
		try {
			await scheduleVersionService.createScheduleRevisionVersion(
				"user-1",
				"work-1",
				{
					index: "1.1",
					replannedStart: "2026-04-01",
					replannedEnd: "2026-06-30",
					revisionDate: "2025-12-01",
				},
			);
		} catch (e: unknown) {
			error = e as ConstructionError;
		}

		expect(error?.code).toBe("REVISION_DATE_OUT_OF_SEQUENCE");
		expect(error?.status).toBe(422);
	});
});
