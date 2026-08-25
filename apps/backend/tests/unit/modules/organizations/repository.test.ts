import { beforeEach, describe, expect, it, mock } from "bun:test";

const getAccessibleOrgIds = mock(async () => ["org-1"]);
const getAccessibleCostCenterIds = mock(async () => ["cc-1", "cc-2"]);
const getCostCenterReport = mock(async (ownerId: string, id: string) => ({
	ownerId,
	costCenter: { id, name: `Centro ${id}` },
	summary: {
		totalWorks: id === "cc-1" ? 2 : 1,
		totalBudgeted: 100,
		totalSpent: 40,
	},
}));

type Row = Record<string, unknown>;
const organizationFindMany = mock(async (): Promise<Row[]> => []);
const organizationFindFirst = mock(async (): Promise<Row | null> => null);
const organizationCreate = mock(
	async (args: { data: Row }): Promise<Row> => ({ id: "org-1", ...args.data }),
);
const organizationUpdate = mock(
	async (args: { data: Row }): Promise<Row> => args.data,
);
const organizationDelete = mock(async (): Promise<Row> => ({ id: "org-1" }));
const organization = {
	findMany: organizationFindMany,
	findFirst: organizationFindFirst,
	create: organizationCreate,
	update: organizationUpdate,
	delete: organizationDelete,
	count: mock(async (): Promise<number> => 0),
};
const costCenterFindMany = mock(async (): Promise<Row[]> => []);
const costCenterFindFirst = mock(async (): Promise<Row | null> => null);
const costCenterCreate = mock(
	async (args: { data: Row }): Promise<Row> => ({ id: "cc-1", ...args.data }),
);
const costCenterUpdate = mock(
	async (args: { data: Row }): Promise<Row> => args.data,
);
const costCenterDelete = mock(async (): Promise<Row> => ({ id: "cc-1" }));
const costCenter = {
	findMany: costCenterFindMany,
	findFirst: costCenterFindFirst,
	create: costCenterCreate,
	update: costCenterUpdate,
	delete: costCenterDelete,
	count: mock(async (): Promise<number> => 0),
};
const address = {
	create: mock(async (): Promise<Row> => ({ id: "address-1" })),
};

mock.module("../../../../src/lib/prisma", () => ({
	prisma: {
		organization,
		costCenter,
		address,
		$transaction: async (callback: (tx: unknown) => unknown) =>
			callback({ address, organization, costCenter }),
	},
}));
mock.module("../../../../src/lib/scope-access", () => ({
	getAccessibleOrgIds,
	getAccessibleCostCenterIds,
}));
mock.module(
	"../../../../src/modules/construction-planning/management.repository",
	() => ({
		getCostCenterReport,
	}),
);

const repository = await import(
	"../../../../src/modules/organizations/repository"
);

const structuredAddress = {
	zipCode: "59000-000",
	street: " Rua Principal ",
	district: " Centro ",
	number: " 10 ",
	city: " Natal ",
	state: "rn",
	complement: " Sala 2 ",
	latitude: -5.79,
	longitude: -35.2,
};

beforeEach(() => {
	mock.clearAllMocks();
	getAccessibleOrgIds.mockResolvedValue(["org-1"]);
	getAccessibleCostCenterIds.mockResolvedValue(["cc-1", "cc-2"]);
	organizationFindFirst.mockResolvedValue(null);
	organizationFindMany.mockResolvedValue([]);
	organization.count.mockResolvedValue(0);
	costCenterFindFirst.mockResolvedValue(null);
	costCenterFindMany.mockResolvedValue([]);
	costCenter.count.mockResolvedValue(0);
});

describe("organizations repository", () => {
	it("creates an organization with a normalized structured address", async () => {
		await repository.createOrganization("owner-1", {
			name: "Org",
			structuredAddress,
		});

		expect(address.create).toHaveBeenCalledWith({
			data: {
				zipCode: "59000000",
				street: "Rua Principal",
				district: "Centro",
				number: "10",
				city: "Natal",
				state: "RN",
				complement: "Sala 2",
				latitude: -5.79,
				longitude: -35.2,
			},
		});
		expect(organization.create).toHaveBeenCalledWith({
			data: expect.objectContaining({
				ownerId: "owner-1",
				structuredAddressId: "address-1",
			}),
			include: { structuredAddress: true },
		});
	});

	it("lists organizations using accessible ids, search and pagination", async () => {
		organizationFindMany.mockResolvedValue([{ id: "org-1" }]);
		organization.count.mockResolvedValue(1);

		const result = await repository.listOrganizations("owner-1", {
			q: "obra",
			page: 2,
			limit: 5,
		});

		expect(organizationFindMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					id: { in: ["org-1"] },
					OR: [{ name: { contains: "obra" } }],
				},
				skip: 5,
				take: 5,
			}),
		);
		expect(result).toMatchObject({ total: 1, page: 2, limit: 5 });
	});

	it("keeps organization reads and deletes inside the owner scope", async () => {
		expect(await repository.getOrganizationById("owner-1", "other")).toBeNull();
		getAccessibleOrgIds.mockResolvedValue(["org-1"]);
		organizationFindFirst.mockResolvedValue({ id: "org-1" });
		expect(
			await repository.getOrganizationById("owner-1", "org-1"),
		).toMatchObject({
			id: "org-1",
		});
		expect(organizationFindFirst).toHaveBeenCalledWith({
			where: { id: "org-1" },
			include: { costCenters: true, structuredAddress: true },
		});

		organizationFindFirst.mockResolvedValue(null);
		expect(await repository.deleteOrganization("owner-1", "org-1")).toBeNull();
		organizationFindFirst.mockResolvedValue({ id: "org-1" });
		expect(
			await repository.deleteOrganization("owner-1", "org-1"),
		).toMatchObject({
			id: "org-1",
		});
		expect(organization.delete).toHaveBeenCalledWith({
			where: { id: "org-1" },
		});
	});

	it("updates organization fields and validates a new company relationship", async () => {
		organizationFindFirst.mockResolvedValue({ id: "org-1" });
		address.create.mockResolvedValue({ id: "address-2" });

		await repository.updateOrganization("owner-1", "org-1", {
			name: " Atualizada ",
			managerName: " Gerente ",
			structuredAddress,
		});

		expect(organization.update).toHaveBeenCalledWith({
			where: { id: "org-1" },
			data: expect.objectContaining({
				name: " Atualizada ",
				managerName: " Gerente ",
				structuredAddressId: "address-2",
			}),
			include: { structuredAddress: true },
		});
	});
});

describe("cost center repository", () => {
	it("creates and lists cost centers with owner scope and filters", async () => {
		await repository.createCostCenter("owner-1", "org-1", {
			name: "Centro",
			managerName: " Gerente ",
			structuredAddress,
		});
		expect(costCenter.create).toHaveBeenCalledWith({
			data: expect.objectContaining({
				ownerId: "owner-1",
				organizationId: "org-1",
				managerName: "Gerente",
				structuredAddressId: "address-2",
			}),
			include: { structuredAddress: true },
		});

		await repository.listCostCenters("owner-1", "org-1", {
			q: "centro",
			page: 2,
			limit: 3,
		});
		expect(costCenterFindMany).toHaveBeenCalledWith(
			expect.objectContaining({ skip: 3, take: 3 }),
		);
	});

	it("rejects inaccessible cost centers before querying details", async () => {
		getAccessibleCostCenterIds.mockResolvedValue(["cc-1"]);
		expect(
			await repository.getCostCenterByIdOnly("owner-1", "cc-9"),
		).toBeNull();
		expect(costCenterFindFirst).not.toHaveBeenCalled();
	});

	it("updates and deletes cost centers only after ownership checks", async () => {
		costCenterFindFirst.mockResolvedValue({ id: "cc-1" });
		await repository.updateCostCenterByIdOnly("owner-1", "cc-1", {
			name: "Atualizado",
		});
		expect(costCenter.update).toHaveBeenCalledWith({
			where: { id: "cc-1" },
			data: { name: "Atualizado" },
			include: { structuredAddress: true },
		});

		await repository.deleteCostCenterByIdOnly("owner-1", "cc-1");
		expect(costCenter.delete).toHaveBeenCalledWith({
			where: { id: "cc-1" },
		});
	});

	it("aggregates organization reports from accessible cost centers", async () => {
		organizationFindFirst.mockResolvedValue({ id: "org-1", name: "Org" });
		costCenterFindMany.mockResolvedValue([
			{ id: "cc-1", name: "Centro 1" },
			{ id: "cc-2", name: "Centro 2" },
		]);

		const report = await repository.getOrganizationReport("owner-1", "org-1");

		expect(report).toEqual({
			organization: { id: "org-1", name: "Org" },
			costCenters: [
				{ id: "cc-1", name: "Centro cc-1", works: 2, budgeted: 100, spent: 40 },
				{ id: "cc-2", name: "Centro cc-2", works: 1, budgeted: 100, spent: 40 },
			],
			summary: {
				totalCostCenters: 2,
				totalWorks: 3,
				totalBudgeted: 200,
				totalSpent: 80,
				balance: 120,
			},
		});
	});
});
