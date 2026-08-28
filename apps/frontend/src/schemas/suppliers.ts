import { z } from "zod";
import type { AddressValue } from "@/types/address";

const optionalText = z
	.string()
	.trim()
	.transform((value) => (value.length > 0 ? value : null))
	.nullable()
	.optional();

const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
	z
		.union([z.literal(""), z.enum(values)])
		.transform((value) => (value === "" ? null : value))
		.nullable()
		.optional();

export const supplierFormSchema = z.object({
	name: z.string().trim().min(1, "Nome obrigatório"),
	document: optionalText,
	responsibleName: optionalText,
	responsibleDocument: optionalText,
	contact: optionalText,
	pixKey: optionalText,
	pixKeyType: optionalEnum(["CPF", "CNPJ", "EMAIL", "PHONE", "RANDOM"]),
	bankCode: optionalText,
	bankName: optionalText,
	bankBranch: optionalText,
	bankAccount: optionalText,
	bankAccountType: optionalEnum(["CHECKING", "SAVINGS"]),
	addressZipCode: optionalText,
	addressStreet: optionalText,
	addressNumber: optionalText,
	addressComplement: optionalText,
	addressDistrict: optionalText,
	addressCity: optionalText,
	addressState: z
		.string()
		.trim()
		.transform((value) => {
			const state = value.toUpperCase().slice(0, 2);
			return state.length > 0 ? state : null;
		})
		.nullable()
		.optional(),
	structuredAddress: z.custom<AddressValue>().nullable().optional(),
	notes: optionalText,
});

export type SupplierFormValues = z.infer<typeof supplierFormSchema>;
