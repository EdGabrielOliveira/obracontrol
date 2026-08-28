import { beforeEach, describe, expect, it, mock } from "bun:test";
import { zipSync } from "fflate";
import { ConstructionError } from "../../../../src/lib/errors";

const companyFindMany = mock(
	async (): Promise<Array<Record<string, unknown>>> => [],
);
const companyFindFirst = mock(
	async (): Promise<Record<string, unknown> | null> => null,
);
const companyCreate = mock(async (args: { data: Record<string, unknown> }) => ({
	id: "company-1",
	...args.data,
	createdAt: new Date(),
	_count: { organizations: 0 },
}));
const companyUpdate = mock(
	async (args: { where: { id: string }; data: Record<string, unknown> }) => ({
		id: args.where.id,
		...args.data,
		createdAt: new Date(),
		_count: { organizations: 0 },
	}),
);
const companyDelete = mock(async () => ({ id: "company-1" }));
const organizationUpdateMany = mock(async () => ({ count: 1 }));

mock.module("../../../../src/lib/prisma", () => ({
	prisma: {
		company: {
			findMany: companyFindMany,
			findFirst: companyFindFirst,
			create: companyCreate,
			update: companyUpdate,
			delete: companyDelete,
		},
		organization: { updateMany: organizationUpdateMany },
		$transaction: async (callback: (tx: unknown) => unknown) =>
			callback({ company: { create: companyCreate } }),
	},
}));

const { companyService } = await import(
	"../../../../src/modules/organizations/company.service"
);

function makeCompany(overrides: Record<string, unknown> = {}) {
	return {
		id: "company-1",
		ownerId: "owner-1",
		name: "Construtora Alfa",
		document: null,
		tradeName: null,
		addressCity: null,
		addressState: null,
		contactEmail: null,
		contactPhone: null,
		contractTemplate: null,
		contractTemplateType: null,
		createdAt: new Date(),
		_count: { organizations: 0 },
		...overrides,
	};
}

describe("companyService (EMP-003, DEC-013)", () => {
	beforeEach(() => {
		companyFindMany.mockClear();
		companyFindFirst.mockClear();
		companyCreate.mockClear();
		companyUpdate.mockClear();
		companyDelete.mockClear();
		organizationUpdateMany.mockClear();
		companyFindMany.mockResolvedValue([]);
		companyFindFirst.mockResolvedValue(null);
		companyCreate.mockImplementation(
			async (args: { data: Record<string, unknown> }) => ({
				id: "company-1",
				...args.data,
				createdAt: new Date(),
				_count: { organizations: 0 },
			}),
		);
		organizationUpdateMany.mockResolvedValue({ count: 1 });
	});

	it("cria empresa como entidade cliente acima de Organization", async () => {
		// Sem CNPJ: sem consulta externa.
		const lookup = mock(async () => {
			throw new Error("nao deve chamar");
		});
		companyService.lookupCnpj = lookup as never;

		const result = await companyService.create("owner-1", {
			name: "Construtora Alfa",
		});

		expect(lookup).not.toHaveBeenCalled();
		expect(companyCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					ownerId: "owner-1",
					name: "Construtora Alfa",
					document: null,
				}),
			}),
		);
		expect(result.name).toBe("Construtora Alfa");
	});

	it("CNPJ integrado: valida e enriquece dados da empresa via BrasilAPI", async () => {
		const lookup = mock(async () => ({
			razaoSocial: "CONSTRUTORA ALFA LTDA",
			nomeFantasia: "Alfa Construtora",
			situacao: "ATIVA",
			atividade: "Construcao",
			uf: "SP",
		}));
		companyService.lookupCnpj = lookup as never;

		await companyService.create("owner-1", {
			name: "Construtora Alfa",
			document: "12.345.678/0001-95",
		});

		expect(lookup).toHaveBeenCalledWith("12345678000195");
		expect(companyCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					document: "12345678000195",
					tradeName: "Alfa Construtora",
					addressState: "SP",
				}),
			}),
		);
	});

	it("CNPJ inexistente bloqueia o cadastro (CNPJ_NOT_FOUND)", async () => {
		const lookup = mock(async () => {
			throw new ConstructionError("CNPJ_NOT_FOUND", "CNPJ nao encontrado", 404);
		});
		companyService.lookupCnpj = lookup as never;

		await expect(
			companyService.create("owner-1", {
				name: "Alfa",
				document: "12.345.678/0001-95",
			}),
		).rejects.toMatchObject({ code: "CNPJ_NOT_FOUND", status: 404 });
		expect(companyCreate).not.toHaveBeenCalled();
	});

	it("formato invalido de CNPJ bloqueia o cadastro (INVALID_CNPJ)", async () => {
		const lookup = mock(async () => {
			throw new ConstructionError(
				"INVALID_CNPJ",
				"CNPJ deve conter 14 digitos",
				400,
			);
		});
		companyService.lookupCnpj = lookup as never;

		await expect(
			companyService.create("owner-1", {
				name: "Alfa",
				document: "123",
			}),
		).rejects.toMatchObject({ code: "INVALID_CNPJ", status: 400 });
		expect(companyCreate).not.toHaveBeenCalled();
	});

	it("indisponibilidade do servico de CNPJ nao bloqueia o cadastro (best-effort)", async () => {
		const lookup = mock(async () => {
			throw new ConstructionError("CNPJ_TIMEOUT", "Tempo esgotado", 504);
		});
		companyService.lookupCnpj = lookup as never;

		const result = await companyService.create("owner-1", {
			name: "Alfa",
			document: "12.345.678/0001-95",
			tradeName: "Alfa Construtora",
		});

		expect(result.name).toBe("Alfa");
		expect(companyCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					tradeName: "Alfa Construtora",
				}),
			}),
		);
	});

	it("lista empresas apenas do owner", async () => {
		companyFindMany.mockResolvedValue([
			makeCompany(),
			makeCompany({ id: "company-2", name: "Beta" }),
		]);

		const result = await companyService.list("owner-1");

		expect(companyFindMany).toHaveBeenCalledWith({
			where: { ownerId: "owner-1" },
			orderBy: { name: "asc" },
			include: {
				_count: { select: { organizations: true } },
				structuredAddress: true,
			},
		});
		expect(result).toHaveLength(2);
	});

	it("permite que ADMIN acesse empresas e organizacoes criadas por outro admin", async () => {
		companyFindMany.mockResolvedValue([makeCompany({ ownerId: "admin-1" })]);
		companyFindFirst.mockResolvedValue(makeCompany({ ownerId: "admin-1" }));

		const access = { canAccessAllCompanies: true };
		await companyService.list("admin-2", access);
		await companyService.get("admin-2", "company-1", access);
		await companyService.linkOrganization(
			"admin-2",
			"company-1",
			"org-1",
			access,
		);

		expect(companyFindMany).toHaveBeenCalledWith(
			expect.objectContaining({ where: {} }),
		);
		expect(companyFindFirst).toHaveBeenCalledWith(
			expect.objectContaining({ where: { id: "company-1" } }),
		);
		expect(organizationUpdateMany).toHaveBeenCalledWith({
			where: { id: "org-1" },
			data: { companyId: "company-1" },
		});
	});

	it("empresa de outro owner nao e acessivel (404)", async () => {
		companyFindFirst.mockResolvedValue(null);

		await expect(
			companyService.get("owner-2", "company-1"),
		).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
	});

	it("atualiza dados informativos da empresa", async () => {
		companyFindFirst.mockResolvedValue(makeCompany());
		companyUpdate.mockResolvedValue(
			makeCompany({ tradeName: "Alfa Construtora" }),
		);

		const result = await companyService.update("owner-1", "company-1", {
			tradeName: "Alfa Construtora",
		});

		expect(companyUpdate).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: "company-1" },
				data: expect.objectContaining({ tradeName: "Alfa Construtora" }),
			}),
		);
		expect(result.tradeName).toBe("Alfa Construtora");
	});

	it("atualiza o endereco estruturado sem criar outra entidade", async () => {
		companyFindFirst.mockResolvedValue(makeCompany());
		const address = {
			zipCode: "01001-000",
			street: "Praca da Se",
			district: "Se",
			number: "100",
			city: "Sao Paulo",
			state: "sp",
			latitude: -23.55,
			longitude: -46.63,
		};

		await companyService.update("owner-1", "company-1", {
			structuredAddress: address,
		});

		expect(companyUpdate).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					structuredAddress: {
						upsert: {
							create: expect.objectContaining({
								zipCode: "01001000",
								state: "SP",
							}),
							update: expect.objectContaining({
								zipCode: "01001000",
								state: "SP",
							}),
						},
					},
				}),
			}),
		);
	});

	it("atrela empresa a uma organizacao do owner", async () => {
		companyFindFirst.mockResolvedValue(makeCompany());

		await companyService.linkOrganization("owner-1", "company-1", "org-1");

		expect(organizationUpdateMany).toHaveBeenCalledWith({
			where: { id: "org-1", ownerId: "owner-1" },
			data: { companyId: "company-1" },
		});
	});

	it("exclui empresa do owner", async () => {
		companyFindFirst.mockResolvedValue(makeCompany());

		await companyService.delete("owner-1", "company-1");

		expect(companyDelete).toHaveBeenCalledWith({ where: { id: "company-1" } });
	});

	describe("EMP-004 (DEC-012) modelo contratual", () => {
		function makeFile(name: string, type: string, size: number): File {
			return {
				name,
				type,
				size,
				arrayBuffer: async () =>
					name.endsWith(".docx")
						? zipSync({
								"word/document.xml": new TextEncoder().encode(
									"<w:document><w:body><w:p><w:r><w:t>Modelo</w:t></w:r></w:p></w:body></w:document>",
								),
							}).buffer
						: new Uint8Array([37, 80, 68, 70]).buffer,
			} as File;
		}

		it("aceita PDF e registra o template na empresa", async () => {
			companyFindFirst.mockResolvedValue(makeCompany());
			companyUpdate.mockResolvedValue(
				makeCompany({
					contractTemplate: "modelo-contrato.pdf",
					contractTemplateType: "PDF",
				}),
			);

			const result = await companyService.uploadContractTemplate(
				"owner-1",
				"company-1",
				makeFile("modelo-contrato.pdf", "application/pdf", 1000),
			);

			expect(
				(companyUpdate as ReturnType<typeof mock>).mock.calls[0][0].data,
			).toMatchObject({
				contractTemplate: "modelo-contrato.pdf",
				contractTemplateType: "PDF",
			});
			expect(result.contractTemplate).toBe("modelo-contrato.pdf");
		});

		it("aceita DOCX como modelo contratual", async () => {
			companyFindFirst.mockResolvedValue(makeCompany());
			companyUpdate.mockResolvedValue(
				makeCompany({
					contractTemplate: "modelo-contrato.docx",
					contractTemplateType: "DOCX",
				}),
			);

			await companyService.uploadContractTemplate(
				"owner-1",
				"company-1",
				makeFile(
					"modelo-contrato.docx",
					"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
					1000,
				),
			);

			expect(
				(companyUpdate as ReturnType<typeof mock>).mock.calls[0][0].data,
			).toMatchObject({ contractTemplateType: "DOCX" });
		});

		it("cria empresa e DOCX atomicamente no endpoint de onboarding", async () => {
			companyCreate.mockResolvedValue(
				makeCompany({
					contractTemplate: "modelo.docx",
					contractTemplateType: "DOCX",
				}),
			);
			const result = await companyService.createWithTemplate(
				"owner-1",
				{ name: "Empresa com modelo" },
				makeFile(
					"modelo.docx",
					"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
					100,
				),
			);
			expect(result.contractTemplate).toBe("modelo.docx");
			expect(companyCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						contractTemplateType: "DOCX",
						contractTemplateVersion: 1,
					}),
				}),
			);
		});

		it("rejeita extensao diferente de PDF/DOCX", async () => {
			companyFindFirst.mockResolvedValue(makeCompany());

			await expect(
				companyService.uploadContractTemplate(
					"owner-1",
					"company-1",
					makeFile("modelo.txt", "text/plain", 100),
				),
			).rejects.toMatchObject({
				code: "INVALID_FILE_TYPE",
				status: 400,
			});
			expect(companyUpdate).not.toHaveBeenCalled();
		});

		it("rejeita arquivo acima de 10MB", async () => {
			companyFindFirst.mockResolvedValue(makeCompany());

			await expect(
				companyService.uploadContractTemplate(
					"owner-1",
					"company-1",
					makeFile("modelo.pdf", "application/pdf", 11 * 1024 * 1024),
				),
			).rejects.toMatchObject({
				code: "FILE_TOO_LARGE",
				status: 413,
			});
		});

		it("empresa de outro owner nao recebe template (404)", async () => {
			companyFindFirst.mockResolvedValue(null);

			await expect(
				companyService.uploadContractTemplate(
					"owner-2",
					"company-1",
					makeFile("modelo.pdf", "application/pdf", 100),
				),
			).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
		});

		it("armazena o conteudo do arquivo no object storage e apenas a chave no banco", async () => {
			companyFindFirst.mockResolvedValue(makeCompany());
			companyUpdate.mockResolvedValue(makeCompany());

			await companyService.uploadContractTemplate(
				"owner-1",
				"company-1",
				makeFile("modelo-contrato.pdf", "application/pdf", 4),
			);

			expect(
				(companyUpdate as ReturnType<typeof mock>).mock.calls[0][0].data,
			).toMatchObject({
				contractTemplate: "modelo-contrato.pdf",
				contractTemplateType: "PDF",
			});
			// O payload binario fica fora do D1; a linha guarda apenas a chave.
			const data = (companyUpdate as ReturnType<typeof mock>).mock.calls[0][0]
				.data as Record<string, unknown>;
			expect(data.contractTemplateBlob).toBeNull();
			expect(data.contractTemplateStorageKey).toEqual(
				expect.stringContaining("companies/owner-1/company-1/template-v1.pdf"),
			);
		});

		it("baixa o template com content-type e nome do arquivo", async () => {
			companyFindFirst.mockResolvedValue({
				id: "company-1",
				ownerId: "owner-1",
				contractTemplate: "modelo-contrato.docx",
				contractTemplateType: "DOCX",
				contractTemplateBlob: new Uint8Array([1, 2, 3]),
			});

			const result = await companyService.downloadContractTemplate(
				"owner-1",
				"company-1",
			);

			expect(result.filename).toBe("modelo-contrato.docx");
			expect(result.contentType).toBe(
				"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			);
			expect(Array.from(result.bytes)).toEqual([1, 2, 3]);
		});

		it("baixa template PDF com content-type correto", async () => {
			companyFindFirst.mockResolvedValue({
				id: "company-1",
				ownerId: "owner-1",
				contractTemplate: "modelo-contrato.pdf",
				contractTemplateType: "PDF",
				contractTemplateBlob: new Uint8Array([37, 80, 68, 70]),
			});

			const result = await companyService.downloadContractTemplate(
				"owner-1",
				"company-1",
			);

			expect(result.contentType).toBe("application/pdf");
		});

		it("baixa template de empresa sem modelo (404)", async () => {
			companyFindFirst.mockResolvedValue({
				id: "company-1",
				ownerId: "owner-1",
				contractTemplate: null,
				contractTemplateType: null,
				contractTemplateBlob: null,
			});

			await expect(
				companyService.downloadContractTemplate("owner-1", "company-1"),
			).rejects.toMatchObject({
				code: "TEMPLATE_NOT_FOUND",
				status: 404,
			});
		});
	});
});
