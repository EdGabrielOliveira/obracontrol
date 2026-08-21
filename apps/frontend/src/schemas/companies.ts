import { z } from "zod";

const optionalText = z.string().trim().optional();

export const companyFormSchema = z.object({
	name: z.string().trim().min(2, "Razão social obrigatória"),
	document: optionalText.refine(
		(value) => !value || value.replace(/\D/g, "").length === 14,
		"CNPJ deve conter 14 dígitos",
	),
	tradeName: optionalText,
	contactEmail: optionalText.refine(
		(value) => !value || z.email().safeParse(value).success,
		"E-mail inválido",
	),
	contactPhone: optionalText.refine(
		(value) => !value || value.replace(/\D/g, "").length >= 10,
		"Telefone inválido",
	),
	managerName: optionalText,
});

export type CompanyFormValues = z.infer<typeof companyFormSchema>;
