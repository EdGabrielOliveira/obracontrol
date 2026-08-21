import { z } from "zod";

export const userScopeSchema = z.object({
	organizationIds: z.array(z.string().min(1)),
	costCenterIds: z.array(z.string().min(1)),
	workIds: z.array(z.string().min(1)),
});

export const adminUserFormSchema = z.object({
	name: z.string().trim().min(2, "Nome obrigatório"),
	email: z.email("E-mail inválido"),
	password: z.string().min(8, "Senha deve ter pelo menos 8 caracteres"),
	role: z.enum(["ADMIN", "GERENTE", "GESTOR", "SUPERVISOR"]),
	...userScopeSchema.shape,
});

export type AdminUserFormValues = z.infer<typeof adminUserFormSchema>;
