import { z } from "zod";

export const membershipRoles = [
	"ADMIN",
	"GERENTE",
	"GESTOR",
	"SUPERVISOR",
] as const;

export const membershipRoleSchema = z.enum(membershipRoles);

const organizationIdsSchema = z.array(z.string().min(1)).default([]);
const costCenterIdsSchema = z.array(z.string().min(1)).default([]);
const workIdsSchema = z.array(z.string().min(1)).default([]);

export const userScopeInputSchema = z.object({
	organizationIds: organizationIdsSchema,
	costCenterIds: costCenterIdsSchema,
	workIds: workIdsSchema,
});

export const createUserInputSchema = z.object({
	name: z.string().min(1),
	email: z.string().email(),
	password: z.string().min(8),
	role: membershipRoleSchema,
	scope: userScopeInputSchema.optional(),
});

export const updateUserInputSchema = z.object({
	name: z.string().min(1).optional(),
	role: membershipRoleSchema.optional(),
	scope: userScopeInputSchema.optional(),
});

export const replaceScopeInputSchema = userScopeInputSchema;

export const createInvitationInputSchema = z.object({
	email: z.string().email(),
	role: membershipRoleSchema,
	scope: userScopeInputSchema,
});

export const acceptInvitationInputSchema = z.object({
	token: z.string().min(1),
});

export const invitationFilterSchema = z.object({
	page: z.coerce.number().int().min(1).optional().default(1),
	limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type UserScopeInput = z.infer<typeof userScopeInputSchema>;
export type CreateUserInput = z.infer<typeof createUserInputSchema>;
export type UpdateUserInput = z.infer<typeof updateUserInputSchema>;
export type ReplaceScopeInput = z.infer<typeof replaceScopeInputSchema>;
export type CreateInvitationInput = z.infer<typeof createInvitationInputSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationInputSchema>;
