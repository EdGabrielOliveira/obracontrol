import { beforeEach, describe, expect, it, mock } from "bun:test";

const notificationFindUnique = mock(
	async (): Promise<Record<string, unknown> | null> => null,
);
const notificationCreate = mock(
	async (args: { data: Record<string, unknown> }) => ({
		id: "notif-1",
		...args.data,
		createdAt: new Date(),
	}),
);
const notificationFindMany = mock(
	async (): Promise<Record<string, unknown>[]> => [],
);
const notificationCount = mock(async () => 0);
const notificationFindFirst = mock(
	async (): Promise<Record<string, unknown> | null> => null,
);
const notificationUpdate = mock(
	async (args: { data: Record<string, unknown> }) => ({
		id: "notif-1",
		...args.data,
		createdAt: new Date(),
	}),
);

mock.module("../../../../src/lib/prisma", () => ({
	prisma: {
		notification: {
			findUnique: notificationFindUnique,
			create: notificationCreate,
			findMany: notificationFindMany,
			count: notificationCount,
			findFirst: notificationFindFirst,
			update: notificationUpdate,
		},
	},
}));

async function importService() {
	return import("../../../../src/modules/governance/notification.service");
}

function makeRow(overrides: Record<string, unknown> = {}) {
	return {
		id: "notif-1",
		recipientId: "user-1",
		eventType: "APPROVAL_REQUESTED",
		referenceId: "req-1",
		version: 1,
		title: "Aprovacao pendente",
		body: null,
		status: "PENDING",
		createdAt: new Date(),
		readAt: null,
		dismissedAt: null,
		...overrides,
	};
}

describe("notification service", () => {
	beforeEach(() => {
		mock.clearAllMocks();
		notificationFindUnique.mockResolvedValue(null);
		notificationCreate.mockImplementation(
			async (args: { data: Record<string, unknown> }) => ({
				id: "notif-1",
				...args.data,
				createdAt: new Date(),
			}),
		);
		notificationFindFirst.mockResolvedValue(makeRow());
		notificationUpdate.mockImplementation(
			async (args: { data: Record<string, unknown> }) => ({
				id: "notif-1",
				...args.data,
				createdAt: new Date(),
			}),
		);
	});

	it("cria notificacao pendente com chave idempotente", async () => {
		const { notificationService } = await importService();
		const result = await notificationService.create({
			recipientId: "user-1",
			eventType: "APPROVAL_REQUESTED",
			referenceId: "req-1",
			title: "Aprovacao pendente",
		});

		expect(result.status).toBe("PENDING");
		expect(notificationCreate).toHaveBeenCalledWith({
			data: {
				recipientId: "user-1",
				eventType: "APPROVAL_REQUESTED",
				referenceId: "req-1",
				version: 1,
				title: "Aprovacao pendente",
				body: null,
				status: "PENDING",
			},
		});
	});

	it("nao duplica ao criar repetidamente a mesma chave", async () => {
		notificationFindUnique.mockResolvedValue(makeRow());
		const { notificationService } = await importService();
		const result = await notificationService.create({
			recipientId: "user-1",
			eventType: "APPROVAL_REQUESTED",
			referenceId: "req-1",
			title: "Aprovacao pendente",
		});

		expect(result.id).toBe("notif-1");
		expect(notificationCreate).not.toHaveBeenCalled();
	});

	it("marca como lida e descarta isoladamente por usuario", async () => {
		const { notificationService } = await importService();

		const read = await notificationService.markRead("user-1", "notif-1");
		expect(read?.status).toBe("READ");

		const dismissed = await notificationService.markDismissed(
			"user-1",
			"notif-1",
		);
		expect(dismissed?.status).toBe("DISMISSED");
	});

	it("nao marca notificacao de outro usuario", async () => {
		notificationFindFirst.mockResolvedValue(null);
		const { notificationService } = await importService();

		const read = await notificationService.markRead("user-2", "notif-1");
		expect(read).toBeNull();
		expect(notificationUpdate).not.toHaveBeenCalled();
	});

	it("conta pendentes por usuario", async () => {
		notificationCount.mockResolvedValue(3);
		const { notificationService } = await importService();
		const count = await notificationService.pendingCount("user-1");
		expect(count).toBe(3);
	});

	it("list filtra pelo recipient e nao vaza entre dois owners", async () => {
		notificationFindMany.mockResolvedValue([
			makeRow({ id: "notif-a", recipientId: "user-1" }),
			makeRow({ id: "notif-b", recipientId: "user-2" }),
		]);
		notificationCount.mockResolvedValue(1);
		const { notificationService } = await importService();

		const result = await notificationService.list("user-1");

		expect(notificationFindMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { recipientId: "user-1" },
				skip: 0,
				take: 20,
			}),
		);
		expect(notificationCount).toHaveBeenCalledWith({
			where: { recipientId: "user-1" },
		});
		expect(result.total).toBe(1);
	});

	it("create e idempotente por recipient: a mesma chave para outro owner gera notificacao separada", async () => {
		notificationFindUnique.mockResolvedValue(null);
		notificationCreate.mockImplementation(
			async (args: { data: Record<string, unknown> }) => ({
				id: "notif-2",
				...args.data,
				createdAt: new Date(),
			}),
		);
		const { notificationService } = await importService();

		await notificationService.create({
			recipientId: "user-1",
			eventType: "APPROVAL_REQUESTED",
			referenceId: "req-1",
			title: "Aprovacao pendente",
		});
		await notificationService.create({
			recipientId: "user-2",
			eventType: "APPROVAL_REQUESTED",
			referenceId: "req-1",
			title: "Aprovacao pendente",
		});

		expect(notificationCreate).toHaveBeenCalledTimes(2);
		expect(notificationFindUnique).toHaveBeenCalledWith({
			where: {
				recipientId_eventType_referenceId_version: {
					recipientId: "user-1",
					eventType: "APPROVAL_REQUESTED",
					referenceId: "req-1",
					version: 1,
				},
			},
		});
		expect(notificationFindUnique).toHaveBeenCalledWith({
			where: {
				recipientId_eventType_referenceId_version: {
					recipientId: "user-2",
					eventType: "APPROVAL_REQUESTED",
					referenceId: "req-1",
					version: 1,
				},
			},
		});
	});

	it("nao descarta notificacao de outro usuario", async () => {
		notificationFindFirst.mockResolvedValue(null);
		const { notificationService } = await importService();

		const dismissed = await notificationService.markDismissed(
			"user-2",
			"notif-1",
		);
		expect(dismissed).toBeNull();
		expect(notificationUpdate).not.toHaveBeenCalled();
	});

	it("pendingCount filtra pelo recipient no where", async () => {
		notificationCount.mockResolvedValue(2);
		const { notificationService } = await importService();

		const count = await notificationService.pendingCount("user-2");

		expect(count).toBe(2);
		expect(notificationCount).toHaveBeenCalledWith({
			where: { recipientId: "user-2", status: "PENDING" },
		});
	});
});
