import type { Role } from "@/types/authorization";

export const ADMIN_ROLES = [
	"ADMIN",
	"GERENTE",
	"GESTOR",
	"SUPERVISOR",
] as const;

export type MembershipRole = Role;

export type AdminUser = {
	id: string;
	name: string;
	email: string;
	role: string;
	emailVerified: boolean;
	createdAt: string;
	organizationMemberships: Array<{
		id: string;
		organizationId: string;
		role: string;
		revokedAt: string | null;
		organization: { name: string } | null;
	}>;
	costCenterMemberships: Array<{
		id: string;
		costCenterId: string;
		role: string;
		revokedAt: string | null;
		costCenter: { name: string } | null;
	}>;
	workMemberships: Array<{
		id: string;
		workId: string;
		role: string;
		revokedAt: string | null;
		work: { name: string } | null;
	}>;
};

export type UserScopeInput = {
	organizationIds: string[];
	costCenterIds: string[];
	workIds: string[];
};

export type CreateUserInput = {
	name: string;
	email: string;
	password: string;
	role: Role;
	scope?: UserScopeInput;
};

export type UpdateUserInput = {
	name?: string;
	role?: Role;
	scope?: UserScopeInput;
};

export type Invitation = {
	id: string;
	email: string;
	role: string;
	scope: UserScopeInput | null;
	status: string;
	expiresAt: string | null;
	createdAt: string;
};

export type CreateInvitationInput = {
	email: string;
	role: Role;
	scope: UserScopeInput;
};
