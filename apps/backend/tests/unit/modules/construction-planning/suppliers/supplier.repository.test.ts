import { beforeEach, describe, expect, it, mock } from "bun:test";

const supplierFindFirst = mock(
	async (): Promise<{ id: string } | null> => null,
);
const contractFindMany = mock(async () => []);
const actualCostFindMany = mock(async () => []);
const workSupplierFindMany = mock(async () => []);

mock.module("../../../../../src/lib/prisma", () => ({
	prisma: {
		constructionSupplier: { findFirst: supplierFindFirst },
		contract: { findMany: contractFindMany },
		constructionActualCost: { findMany: actualCostFindMany },
		constructionWorkSupplier: { findMany: workSupplierFindMany },
	},
}));

const repository = await import(
	"../../../../../src/modules/construction-planning/suppliers/supplier.repository"
);

beforeEach(() => {
	mock.clearAllMocks();
	supplierFindFirst.mockResolvedValue({ id: "supplier-1" });
	contractFindMany.mockResolvedValue([]);
	actualCostFindMany.mockResolvedValue([]);
	workSupplierFindMany.mockResolvedValue([]);
});

describe("supplier repository detail", () => {
	it("aplica o workspace de custos e vínculos pela obra-pai", async () => {
		await repository.getSupplierDetail("admin-1", "supplier-1", "workspace-1");

		expect(actualCostFindMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					supplierId: "supplier-1",
					work: { workspaceId: "workspace-1" },
				},
			}),
		);
		expect(workSupplierFindMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					supplierId: "supplier-1",
					work: { workspaceId: "workspace-1" },
				},
			}),
		);
	});
});
