import { z } from "zod";

const supplierProfileFields = {
	name: z.string().trim().min(1, "Nome do fornecedor e obrigatorio."),
	document: z.string().optional().nullable(),
	responsibleName: z.string().trim().optional().nullable(),
	responsibleDocument: z.string().trim().optional().nullable(),
	contact: z.string().optional().nullable(),
	pixKey: z.string().trim().optional().nullable(),
	pixKeyType: z
		.enum(["CPF", "CNPJ", "EMAIL", "PHONE", "RANDOM"])
		.optional()
		.nullable(),
	bankCode: z.string().trim().optional().nullable(),
	bankName: z.string().trim().optional().nullable(),
	bankBranch: z.string().trim().optional().nullable(),
	bankAccount: z.string().trim().optional().nullable(),
	bankAccountType: z.enum(["CHECKING", "SAVINGS"]).optional().nullable(),
	addressZipCode: z.string().trim().optional().nullable(),
	addressStreet: z.string().trim().optional().nullable(),
	addressNumber: z.string().trim().optional().nullable(),
	addressComplement: z.string().trim().optional().nullable(),
	addressDistrict: z.string().trim().optional().nullable(),
	addressCity: z.string().trim().optional().nullable(),
	addressState: z.string().trim().length(2).optional().nullable(),
	notes: z.string().optional().nullable(),
};

export const createSupplierSchema = z.object(supplierProfileFields);

export const updateSupplierSchema = z.object({
	...supplierProfileFields,
	name: supplierProfileFields.name.optional(),
});

export const supplierFilterSchema = z.object({
	q: z.string().max(100).optional(),
	page: z.coerce.number().int().min(1).optional().default(1),
	pageSize: z.coerce.number().int().min(1).max(100).optional().default(10),
});

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
export type SupplierFilter = z.infer<typeof supplierFilterSchema>;
