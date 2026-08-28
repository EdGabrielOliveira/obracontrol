import { beforeEach, describe, expect, it, mock } from "bun:test";
import { prisma } from "../../../../src/lib/prisma";

const userFindMany = mock(async () => [] as Array<{ id: string }>);

mock.module("../../../../src/lib/prisma", () => {
	const auditLog = {
		create: mock(),
		findMany: mock(),
		count: mock(),
	};
	return {
		prisma: {
			auditLog,
			user: { findMany: userFindMany },
		},
	};
});

const { auditService } = await import(
	"../../../../src/modules/audit/audit.service"
);

describe("audit service", () => {
	beforeEach(() => {
		mock.restore();
		userFindMany.mockClear();
		userFindMany.mockResolvedValue([]);
	});

	it("filters by entityDescriptionPrefix using startsWith", async () => {
		(prisma.auditLog.findMany as ReturnType<typeof mock>).mockResolvedValue([
			{ id: "a-1", user: null },
		]);
		(prisma.auditLog.count as ReturnType<typeof mock>).mockResolvedValue(1);

		const result = await auditService.list({
			ownerId: "owner-1",
			entityDescriptionPrefix: "work-1:",
		});

		expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					ownerId: "owner-1",
					entityDescription: { startsWith: "work-1:" },
				},
			}),
		);
		expect(prisma.auditLog.count).toHaveBeenCalledWith({
			where: {
				ownerId: "owner-1",
				entityDescription: { startsWith: "work-1:" },
			},
		});
		expect(result).toMatchObject({ total: 1 });
	});

	it("omits the description filter when the prefix is absent", async () => {
		(prisma.auditLog.findMany as ReturnType<typeof mock>).mockResolvedValue([]);
		(prisma.auditLog.count as ReturnType<typeof mock>).mockResolvedValue(0);

		await auditService.list({ ownerId: "owner-1", entityType: "WORK" });

		expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { ownerId: "owner-1", entityType: "WORK" },
			}),
		);
	});

	it("redacts sensitive fields in previousState, newState and metadata", async () => {
		const create = prisma.auditLog.create as ReturnType<typeof mock>;
		create.mockResolvedValue({ id: "audit-1" });

		await auditService.log({
			userId: "u1",
			ownerId: "o1",
			action: "UPDATE",
			entityType: "WORK",
			entityId: "w1",
			previousState: { password: "old", name: "A" },
			newState: { token: "tok", apiKey: "k", name: "B" },
			metadata: { document: "123", cpf: "456", count: 3 },
		});

		expect(create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					previousState: { password: "[redacted]", name: "A" },
					newState: {
						token: "[redacted]",
						apiKey: "[redacted]",
						name: "B",
					},
					metadata: {
						document: "[redacted]",
						cpf: "[redacted]",
						count: 3,
					},
				}),
			}),
		);
	});

	it("paginates by owner applying skip and take", async () => {
		(prisma.auditLog.findMany as ReturnType<typeof mock>).mockResolvedValue([]);
		(prisma.auditLog.count as ReturnType<typeof mock>).mockResolvedValue(120);

		const result = await auditService.list({
			ownerId: "owner-1",
			page: 3,
			limit: 40,
		});

		expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { ownerId: "owner-1" },
				skip: 80,
				take: 40,
			}),
		);
		expect(result).toMatchObject({ page: 3, limit: 40, total: 120 });
	});

	it("clamps limit at 100 and never pages without the owner filter", async () => {
		const findMany = prisma.auditLog.findMany as ReturnType<typeof mock>;
		findMany.mockClear();
		findMany.mockResolvedValue([]);
		(prisma.auditLog.count as ReturnType<typeof mock>).mockResolvedValue(0);

		await auditService.list({ ownerId: "owner-1", limit: 500 });

		expect(findMany).toHaveBeenCalledWith(
			expect.objectContaining({ skip: 0, take: 100 }),
		);
		expect(findMany.mock.calls[0][0].where).toEqual({ ownerId: "owner-1" });
	});

	it("lists audit events from every owner in the authenticated workspace", async () => {
		(prisma.auditLog.findMany as ReturnType<typeof mock>).mockResolvedValue([]);
		(prisma.auditLog.count as ReturnType<typeof mock>).mockResolvedValue(0);
		userFindMany.mockResolvedValue([{ id: "owner-1" }, { id: "owner-2" }]);

		await auditService.list({
			ownerId: "admin-1",
			workspaceId: "workspace-1",
		});

		expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { ownerId: { in: ["admin-1", "owner-1", "owner-2"] } },
			}),
		);
		expect(userFindMany).toHaveBeenCalledWith({
			where: { workspaceId: "workspace-1" },
			select: { id: true },
		});
	});
});
