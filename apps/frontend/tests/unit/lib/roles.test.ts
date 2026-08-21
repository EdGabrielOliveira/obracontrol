import { describe, expect, it } from "bun:test";
import { isRole } from "@/types/authorization";
import {
	canAdministerCompanies,
	canDecideGestorRequests,
	canDecideSupervisorRequests,
	canManageUsers,
} from "@/lib/role-permissions";
import {
	canAccessAdministration,
	canAccessApiKeys,
	canAccessAudit,
	isAdmin,
	isGestorOrSupervisor,
	roleRequiresCostCenter,
	toRole,
} from "@/lib/roles";

const ALL_CAPABILITIES = {
	canManageUsers: true,
	canAdministerCompanies: true,
	canManageApiKeys: true,
	canDecideSupervisorRequests: true,
	canReviewExecutedSupervisorRequests: true,
	canRequestSupervisorDecisionReversal: true,
	canDecideGestorRequests: true,
	canFinalizeContracts: true,
};

describe("roles (USR-003, DEC-004/DEC-005)", () => {
	it("ADMIN acessa tudo", () => {
		expect(isAdmin("ADMIN")).toBe(true);
		expect(canAccessAdministration("ADMIN")).toBe(true);
		expect(canAccessApiKeys("ADMIN")).toBe(true);
		expect(canAccessAudit("ADMIN")).toBe(true);
	});

	it("GERENTE acessa administração mas não API Keys nem auditoria", () => {
		expect(canAccessAdministration("GERENTE")).toBe(true);
		expect(canAccessApiKeys("GERENTE")).toBe(false);
		expect(canAccessAudit("GERENTE")).toBe(false);
	});

	it("GESTOR e limitado ao centro de custo", () => {
		expect(canAccessAdministration("GESTOR")).toBe(false);
		expect(isGestorOrSupervisor("GESTOR")).toBe(true);
		expect(roleRequiresCostCenter("GESTOR")).toBe(true);
	});

	it("SUPERVISOR acessa obras do CC e exige vinculo", () => {
		expect(canAccessAdministration("SUPERVISOR")).toBe(false);
		expect(isGestorOrSupervisor("SUPERVISOR")).toBe(true);
		expect(roleRequiresCostCenter("SUPERVISOR")).toBe(true);
	});

	it("roles legados nao sao aceitos", () => {
		expect(toRole("OPERADOR")).toBeNull();
		expect(toRole("APROVADOR")).toBeNull();
		expect(toRole("VISUALIZADOR")).toBeNull();
		expect(isRole("OPERADOR")).toBe(false);
		expect(canAccessAdministration("OPERADOR")).toBe(false);
		expect(roleRequiresCostCenter("VISUALIZADOR")).toBe(false);
	});

	it("role ausente nao acessa nada restrito", () => {
		expect(canAccessAdministration(null)).toBe(false);
		expect(canAccessApiKeys(undefined)).toBe(false);
		expect(roleRequiresCostCenter(null)).toBe(false);
		expect(toRole(null)).toBeNull();
	});

	it("capabilities do backend controlam aprovação, empresas e usuários", () => {
		expect(canDecideSupervisorRequests(ALL_CAPABILITIES)).toBe(true);
		expect(canDecideGestorRequests(ALL_CAPABILITIES)).toBe(true);
		expect(canAdministerCompanies(ALL_CAPABILITIES)).toBe(true);
		expect(canManageUsers(ALL_CAPABILITIES)).toBe(true);
		expect(canManageUsers({ ...ALL_CAPABILITIES, canManageUsers: false })).toBe(
			false,
		);
		expect(canDecideSupervisorRequests(null)).toBe(false);
	});
});
