import type {
	AdminUser,
	CreateInvitationInput,
	CreateUserInput,
	Invitation,
	UpdateUserInput,
	UserScopeInput,
} from "@/types/admin-users";
import type { PaginatedResponse } from "@/types/shared";
import { sanitizeQueryParams } from "@/utils/sanitizeQueryParams";
import { api, normalizePagination } from "./api";

export type AdminUserFilter = {
	page?: number;
	limit?: number;
};

export async function listAdminUsers(filters: AdminUserFilter = {}) {
	const cleaned = sanitizeQueryParams(filters as Record<string, unknown>);
	const limit = filters.limit ?? 10;
	const { data: raw } = await api.get<{
		data: AdminUser[];
		total: number;
		page: number;
		limit: number;
		totalPages: number;
		hasNextPage: boolean;
		hasPreviousPage: boolean;
	}>("/admin/users", {
		params: { ...cleaned, limit, page: filters.page ?? 1 },
		headers: { "Cache-Control": "no-store" },
	});
	return normalizePagination(raw, limit) as PaginatedResponse<AdminUser> & {
		totalPages: number;
	};
}

export async function getAdminUser(id: string) {
	const { data } = await api.get<AdminUser>(`/admin/users/${id}`);
	return data;
}

export async function createAdminUser(input: CreateUserInput) {
	const { data } = await api.post<AdminUser>("/admin/users", input);
	return data;
}

export async function updateAdminUser(id: string, input: UpdateUserInput) {
	const { data } = await api.patch<AdminUser>(`/admin/users/${id}`, input);
	return data;
}

export async function deleteAdminUser(id: string) {
	await api.delete(`/admin/users/${id}`);
}

export async function replaceAdminUserScope(id: string, scope: UserScopeInput) {
	const { data } = await api.put<AdminUser>(`/admin/users/${id}/scope`, scope);
	return data;
}

export type InvitationFilter = {
	page?: number;
	limit?: number;
};

export async function listAdminInvitations(filters: InvitationFilter = {}) {
	const { data } = await api.get<{
		data: Invitation[];
		total: number;
		page: number;
		limit: number;
		totalPages: number;
		hasNextPage: boolean;
		hasPreviousPage: boolean;
	}>("/admin/users/invitations", { params: filters });
	return data;
}

export async function createAdminInvitation(input: CreateInvitationInput) {
	const { data } = await api.post<Invitation>(
		"/admin/users/invitations",
		input,
	);
	return data;
}

export async function resendAdminInvitation(invitationId: string) {
	const { data } = await api.post<Invitation>(
		`/admin/users/invitations/${invitationId}/resend`,
	);
	return data;
}

export async function revokeAdminInvitation(invitationId: string) {
	const { data } = await api.post<Invitation>(
		`/admin/users/invitations/${invitationId}/revoke`,
	);
	return data;
}
