import { beforeEach, describe, expect, it, mock } from "bun:test";

const listSuppliers = mock(
	async (): Promise<{
		data: unknown[];
		total: number;
		page: number;
		limit: number;
	}> => ({
		data: [],
		total: 0,
		page: 1,
		limit: 10,
	}),
);
const getSupplierById = mock(async (): Promise<unknown | null> => null);
const getSupplierDetail = mock(async (): Promise<unknown | null> => null);
const createSupplier = mock(async (): Promise<unknown | null> => null);
const updateSupplier = mock(async (): Promise<unknown | null> => null);
const deleteSupplier = mock(async (): Promise<unknown | null> => null);
const findSupplierByDocument = mock(async (): Promise<unknown | null> => null);
const countSupplierDependencies = mock(async (): Promise<number> => 0);
const getWorkById = mock(
	async (): Promise<unknown | null> => ({
		id: "work-1",
		ownerId: "owner-1",
	}),
);
const createWorkSupplier = mock(
	async (): Promise<unknown> => ({
		id: "work-supplier-1",
	}),
);
const listWorkSuppliers = mock(async (): Promise<unknown[]> => []);
const deleteWorkSupplier = mock(async (): Promise<unknown | null> => null);
const findWorkSupplier = mock(async (): Promise<unknown | null> => null);
const writeAudit = mock(async () => ({ id: "audit-1" }));

mock.module(
	"../../../../../src/modules/construction-planning/suppliers/supplier.repository",
	() => ({
		listSuppliers,
		getSupplierById,
		getSupplierDetail,
		createSupplier,
		updateSupplier,
		deleteSupplier,
		findSupplierByDocument,
		countSupplierDependencies,
		getWorkById,
		createWorkSupplier,
		listWorkSuppliers,
		deleteWorkSupplier,
		findWorkSupplier,
	}),
);

mock.module("../../../../../src/lib/audit-writer", () => ({ writeAudit }));

const { supplierService } = await import(
	"../../../../../src/modules/construction-planning/suppliers/supplier.service"
);

beforeEach(() => {
	listSuppliers.mockClear();
	getSupplierById.mockClear();
	getSupplierDetail.mockClear();
	createSupplier.mockClear();
	updateSupplier.mockClear();
	deleteSupplier.mockClear();
	findSupplierByDocument.mockClear();
	countSupplierDependencies.mockClear();
	getWorkById.mockClear();
	createWorkSupplier.mockClear();
	listWorkSuppliers.mockClear();
	deleteWorkSupplier.mockClear();
	findWorkSupplier.mockClear();
	writeAudit.mockClear();
	getWorkById.mockImplementation(async () => ({
		id: "work-1",
		ownerId: "owner-1",
	}));
	getSupplierById.mockImplementation(async () => null);
	findSupplierByDocument.mockImplementation(async () => null);
	countSupplierDependencies.mockImplementation(async () => 0);
});

describe("SupplierService.list", () => {
	it("lista fornecedores repassando filtros e paginacao", async () => {
		listSuppliers.mockResolvedValue({
			data: [{ id: "supplier-1", name: "Fornecedor A" }],
			total: 1,
			page: 2,
			limit: 5,
		});

		const result = await supplierService.list({
			ownerId: "owner-1",
			q: "ferr",
			page: 2,
			pageSize: 5,
		});

		expect(listSuppliers).toHaveBeenCalledWith("owner-1", {
			q: "ferr",
			page: 2,
			pageSize: 5,
		});
		expect(result).toMatchObject({ total: 1, page: 2, limit: 5 });
	});

	it("lista sem filtros com defaults de paginacao", async () => {
		await supplierService.list({ ownerId: "owner-1" });

		expect(listSuppliers).toHaveBeenCalledWith("owner-1", {
			page: 1,
			pageSize: 10,
		});
	});
});

describe("SupplierService.get", () => {
	it("retorna fornecedor existente", async () => {
		getSupplierById.mockResolvedValue({
			id: "supplier-1",
			ownerId: "owner-1",
			name: "Fornecedor A",
		});

		const result = await supplierService.get("owner-1", "supplier-1");

		expect(getSupplierById).toHaveBeenCalledWith("owner-1", "supplier-1");
		expect(result).toMatchObject({ id: "supplier-1", name: "Fornecedor A" });
	});

	it("lanca 404 quando fornecedor nao existe", async () => {
		getSupplierById.mockResolvedValue(null);

		await expect(supplierService.get("owner-1", "missing")).rejects.toThrow(
			expect.objectContaining({
				code: "NOT_FOUND",
				status: 404,
			}),
		);
	});
});

describe("SupplierService.getDetail", () => {
	it("repassa o ownerId ao detalhe do fornecedor", async () => {
		getSupplierDetail.mockResolvedValue({
			supplier: { id: "supplier-1", ownerId: "owner-1" },
			contracts: [],
			actualCosts: [],
			workLinks: [],
		});

		const result = await supplierService.getDetail("owner-1", "supplier-1");

		expect(getSupplierDetail).toHaveBeenCalledWith("owner-1", "supplier-1");
		expect(result).toMatchObject({
			supplier: { id: "supplier-1", ownerId: "owner-1" },
		});
	});

	it("nega detalhe quando o fornecedor pertence a outro owner", async () => {
		getSupplierDetail.mockResolvedValue(null);

		await expect(
			supplierService.getDetail("owner-1", "supplier-from-owner-2"),
		).rejects.toThrow(
			expect.objectContaining({
				code: "NOT_FOUND",
				status: 404,
			}),
		);
		expect(getSupplierDetail).toHaveBeenCalledWith(
			"owner-1",
			"supplier-from-owner-2",
		);
	});
});

describe("SupplierService.create", () => {
	it("cria fornecedor com nome trimado e documento normalizado", async () => {
		createSupplier.mockResolvedValue({
			id: "supplier-1",
			ownerId: "owner-1",
			name: "Fornecedor A",
			document: "12345678000190",
		});

		const result = await supplierService.create(
			{
				ownerId: "owner-1",
				name: "  Fornecedor A  ",
				document: "12.345.678/0001-90",
				contact: "contato@fornecedor.com",
				notes: "observacao",
			},
			{ userId: "user-1" },
		);

		expect(createSupplier).toHaveBeenCalledWith("owner-1", {
			name: "Fornecedor A",
			document: "12345678000190",
			contact: "contato@fornecedor.com",
			notes: "observacao",
		});
		expect(result).toMatchObject({ name: "Fornecedor A" });
		expect(writeAudit).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				userId: "user-1",
				ownerId: "owner-1",
				action: "CREATE",
				entityType: "SUPPLIER",
				entityId: "supplier-1",
			}),
		);
	});

	it("rejeita nome em branco", async () => {
		await expect(
			supplierService.create(
				{ ownerId: "owner-1", name: "   " },
				{ userId: "user-1" },
			),
		).rejects.toThrow(
			expect.objectContaining({
				code: "INVALID_INPUT",
				status: 400,
				message: "Nome do fornecedor e obrigatorio",
			}),
		);
		expect(createSupplier).not.toHaveBeenCalled();
	});

	it("normaliza documento em branco para null", async () => {
		await supplierService.create(
			{
				ownerId: "owner-1",
				name: "Fornecedor B",
				document: "   ",
			},
			{ userId: "user-1" },
		);

		expect(createSupplier).toHaveBeenCalledWith("owner-1", {
			name: "Fornecedor B",
			document: null,
			contact: null,
			notes: null,
		});
		expect(findSupplierByDocument).not.toHaveBeenCalled();
	});

	it("rejeita CNPJ informado sem 14 digitos", async () => {
		await expect(
			supplierService.create(
				{
					ownerId: "owner-1",
					name: "Fornecedor Invalido",
					document: "123",
				},
				{ userId: "user-1" },
			),
		).rejects.toThrow(
			expect.objectContaining({ code: "INVALID_CNPJ", status: 400 }),
		);
		expect(createSupplier).not.toHaveBeenCalled();
	});

	it("nao checa duplicidade quando documento e null", async () => {
		await supplierService.create(
			{ ownerId: "owner-1", name: "Fornecedor B" },
			{ userId: "user-1" },
		);

		expect(findSupplierByDocument).not.toHaveBeenCalled();
	});

	it("lanca 422 DUPLICATE_SUPPLIER_DOCUMENT quando documento ja existe", async () => {
		findSupplierByDocument.mockResolvedValue({
			id: "supplier-9",
			ownerId: "owner-1",
			document: "12345678000190",
		});

		await expect(
			supplierService.create(
				{
					ownerId: "owner-1",
					name: "Fornecedor C",
					document: "12345678000190",
				},
				{ userId: "user-1" },
			),
		).rejects.toThrow(
			expect.objectContaining({
				code: "DUPLICATE_SUPPLIER_DOCUMENT",
				status: 422,
				message: "Ja existe um fornecedor com este documento",
			}),
		);
		expect(createSupplier).not.toHaveBeenCalled();
	});
});

describe("SupplierService.update", () => {
	it("atualiza fornecedor com documento normalizado", async () => {
		getSupplierById.mockResolvedValue({
			id: "supplier-1",
			ownerId: "owner-1",
			document: "12345678000190",
		});
		updateSupplier.mockResolvedValue({
			id: "supplier-1",
			name: "Fornecedor A Atualizado",
			document: "99888777666555",
		});

		const result = await supplierService.update(
			"owner-1",
			"supplier-1",
			{
				name: "  Fornecedor A Atualizado  ",
				document: "99.888.777/6665-55",
				contact: "novo-contato",
			},
			{ userId: "user-1" },
		);

		expect(updateSupplier).toHaveBeenCalledWith("owner-1", "supplier-1", {
			name: "Fornecedor A Atualizado",
			document: "99888777666555",
			contact: "novo-contato",
		});
		expect(result).toMatchObject({ name: "Fornecedor A Atualizado" });
		expect(writeAudit).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				userId: "user-1",
				ownerId: "owner-1",
				action: "UPDATE",
				entityType: "SUPPLIER",
				entityId: "supplier-1",
			}),
		);
	});

	it("lanca 422 quando documento pertence a outro fornecedor", async () => {
		getSupplierById.mockResolvedValue({
			id: "supplier-1",
			ownerId: "owner-1",
			document: "12345678000190",
		});
		findSupplierByDocument.mockResolvedValue({
			id: "supplier-2",
			ownerId: "owner-1",
			document: "99888777666555",
		});

		await expect(
			supplierService.update(
				"owner-1",
				"supplier-1",
				{
					document: "99888777666555",
				},
				{ userId: "user-1" },
			),
		).rejects.toThrow(
			expect.objectContaining({
				code: "DUPLICATE_SUPPLIER_DOCUMENT",
				status: 422,
			}),
		);
		expect(updateSupplier).not.toHaveBeenCalled();
	});

	it("permite manter o proprio documento", async () => {
		getSupplierById.mockResolvedValue({
			id: "supplier-1",
			ownerId: "owner-1",
			document: "12345678000190",
		});
		findSupplierByDocument.mockResolvedValue({
			id: "supplier-1",
			ownerId: "owner-1",
			document: "12345678000190",
		});
		updateSupplier.mockResolvedValue({ id: "supplier-1" });

		await supplierService.update(
			"owner-1",
			"supplier-1",
			{
				document: "12345678000190",
			},
			{ userId: "user-1" },
		);

		expect(updateSupplier).toHaveBeenCalledWith(
			"owner-1",
			"supplier-1",
			expect.objectContaining({ document: "12345678000190" }),
		);
	});

	it("normaliza documento em branco para null no update", async () => {
		getSupplierById.mockResolvedValue({
			id: "supplier-1",
			ownerId: "owner-1",
			document: "12345678000190",
		});
		updateSupplier.mockResolvedValue({ id: "supplier-1", document: null });

		await supplierService.update(
			"owner-1",
			"supplier-1",
			{ document: "" },
			{ userId: "user-1" },
		);

		expect(updateSupplier).toHaveBeenCalledWith(
			"owner-1",
			"supplier-1",
			expect.objectContaining({ document: null }),
		);
	});

	it("lanca 404 quando fornecedor nao existe", async () => {
		getSupplierById.mockResolvedValue(null);

		await expect(
			supplierService.update(
				"owner-1",
				"missing",
				{ name: "X" },
				{ userId: "user-1" },
			),
		).rejects.toThrow(
			expect.objectContaining({ code: "NOT_FOUND", status: 404 }),
		);
	});
});

describe("SupplierService.remove", () => {
	it("remove fornecedor sem dependencias", async () => {
		getSupplierById.mockResolvedValue({
			id: "supplier-1",
			ownerId: "owner-1",
			name: "Fornecedor A",
		});
		countSupplierDependencies.mockResolvedValue(0);
		deleteSupplier.mockResolvedValue({ id: "supplier-1" });

		const result = await supplierService.remove("owner-1", "supplier-1", {
			userId: "user-1",
		});

		expect(countSupplierDependencies).toHaveBeenCalledWith(
			"owner-1",
			"supplier-1",
		);
		expect(deleteSupplier).toHaveBeenCalledWith("owner-1", "supplier-1");
		expect(result).toMatchObject({ id: "supplier-1" });
		expect(writeAudit).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				userId: "user-1",
				ownerId: "owner-1",
				action: "DELETE",
				entityType: "SUPPLIER",
				entityId: "supplier-1",
			}),
		);
	});

	it("lanca 409 HAS_DEPENDENCIES quando vinculado a contratos ou custos", async () => {
		getSupplierById.mockResolvedValue({
			id: "supplier-1",
			ownerId: "owner-1",
			name: "Fornecedor A",
		});
		countSupplierDependencies.mockResolvedValue(2);

		await expect(
			supplierService.remove("owner-1", "supplier-1", { userId: "user-1" }),
		).rejects.toThrow(
			expect.objectContaining({
				code: "HAS_DEPENDENCIES",
				status: 409,
				message: "Fornecedor vinculado a contratos ou custos",
			}),
		);
		expect(deleteSupplier).not.toHaveBeenCalled();
	});

	it("lanca 404 quando fornecedor nao existe", async () => {
		getSupplierById.mockResolvedValue(null);

		await expect(
			supplierService.remove("owner-1", "missing", { userId: "user-1" }),
		).rejects.toThrow(
			expect.objectContaining({ code: "NOT_FOUND", status: 404 }),
		);
	});
});

describe("SupplierService work scope", () => {
	it("associa um fornecedor existente a uma obra", async () => {
		getSupplierById.mockResolvedValue({
			id: "supplier-1",
			ownerId: "owner-1",
			name: "Fornecedor A",
		});
		findWorkSupplier.mockResolvedValue(null);

		const result = await supplierService.linkToWork(
			"owner-1",
			"work-1",
			"supplier-1",
		);

		expect(createWorkSupplier).toHaveBeenCalledWith(
			"owner-1",
			"work-1",
			"supplier-1",
		);
		expect(result).toMatchObject({ id: "work-supplier-1" });
	});

	it("rejeita associacao duplicada na mesma obra", async () => {
		getSupplierById.mockResolvedValue({
			id: "supplier-1",
			ownerId: "owner-1",
			name: "Fornecedor A",
		});
		findWorkSupplier.mockResolvedValue({ id: "work-supplier-1" });

		await expect(
			supplierService.linkToWork("owner-1", "work-1", "supplier-1"),
		).rejects.toThrow(
			expect.objectContaining({
				code: "SUPPLIER_ALREADY_LINKED",
				status: 409,
			}),
		);
		expect(createWorkSupplier).not.toHaveBeenCalled();
	});

	it("rejeita associacao de fornecedor bloqueado", async () => {
		getSupplierById.mockResolvedValue({
			id: "supplier-1",
			ownerId: "owner-1",
			name: "Fornecedor A",
			status: "BLOCKED",
		});
		findWorkSupplier.mockResolvedValue(null);

		await expect(
			supplierService.linkToWork("owner-1", "work-1", "supplier-1"),
		).rejects.toThrow(
			expect.objectContaining({
				code: "SUPPLIER_BLOCKED",
				status: 422,
			}),
		);
		expect(createWorkSupplier).not.toHaveBeenCalled();
	});

	it("permite associacao de fornecedor aprovado ou aguardando aprovacao", async () => {
		for (const status of ["APPROVED", "PENDING_APPROVAL"]) {
			getSupplierById.mockResolvedValue({
				id: "supplier-1",
				ownerId: "owner-1",
				name: "Fornecedor A",
				status,
			});
			findWorkSupplier.mockResolvedValue(null);
			createWorkSupplier.mockClear();

			await supplierService.linkToWork("owner-1", "work-1", "supplier-1");

			expect(createWorkSupplier).toHaveBeenCalledWith(
				"owner-1",
				"work-1",
				"supplier-1",
			);
		}
	});

	it("lista fornecedores vinculados a uma obra", async () => {
		listWorkSuppliers.mockResolvedValue([
			{
				id: "work-supplier-1",
				supplier: { id: "supplier-1" },
			} as never,
		]);

		const result = await supplierService.listForWork("owner-1", "work-1");

		expect(listWorkSuppliers).toHaveBeenCalledWith("owner-1", "work-1");
		expect(result).toEqual([
			{
				id: "work-supplier-1",
				supplier: { id: "supplier-1" },
			} as never,
		]);
	});

	it("valida fornecedor vinculado antes de usa-lo na obra", async () => {
		findWorkSupplier.mockResolvedValue(null);

		await expect(
			supplierService.assertLinkedToWork("owner-1", "work-1", "supplier-1"),
		).rejects.toThrow(
			expect.objectContaining({
				code: "SUPPLIER_OUTSIDE_WORK",
				status: 422,
			}),
		);
	});
});
