import { describe, expect, it } from "bun:test";
import {
	AUTH_ROLES,
	assertRoleCan,
	canPerformRoleAction,
	isAuthorizationRole,
	normalizeRole,
	roleToScopeAccess,
} from "../../../src/lib/authorization";
import { ConstructionError } from "../../../src/lib/errors";

describe("authorization", () => {
	const cases = [
		["ADMIN", "read", true],
		["ADMIN", "write", true],
		["ADMIN", "approve", true],
		["ADMIN", "admin", true],
		["GERENTE", "read", true],
		["GERENTE", "write", true],
		["GERENTE", "approve", true],
		["GERENTE", "admin", false],
		// DEC-004: GESTOR aprova (limitado ao centro de custo); SUPERVISOR
		// acessa as obras do CC e faz solicitacoes de cadastro.
		["GESTOR", "read", true],
		["GESTOR", "write", true],
		["GESTOR", "approve", true],
		["GESTOR", "admin", false],
		["SUPERVISOR", "read", true],
		["SUPERVISOR", "write", true],
		["SUPERVISOR", "approve", false],
		["SUPERVISOR", "admin", false],
		// OPERADOR legado preserva somente a autoridade de SUPERVISOR.
		["OPERADOR", "read", true],
		["OPERADOR", "write", true],
		["APROVADOR", "read", false],
		["APROVADOR", "approve", false],
		["VISUALIZADOR", "read", false],
		["VISUALIZADOR", "write", false],
		[null, "read", false],
		[undefined, "read", false],
		["UNKNOWN", "read", false],
	] as const;

	for (const [role, action, expected] of cases) {
		it(`${String(role)} ${action} => ${expected}`, () => {
			expect(canPerformRoleAction(role, action)).toBe(expected);
		});
	}

	it("exposes only the four final roles", () => {
		expect(AUTH_ROLES).toEqual(["ADMIN", "GERENTE", "GESTOR", "SUPERVISOR"]);
	});

	it("recognizes only final roles as authorization roles", () => {
		expect(isAuthorizationRole("ADMIN")).toBe(true);
		expect(isAuthorizationRole("GERENTE")).toBe(true);
		expect(isAuthorizationRole("GESTOR")).toBe(true);
		expect(isAuthorizationRole("SUPERVISOR")).toBe(true);
		expect(isAuthorizationRole("OPERADOR")).toBe(true);
		expect(isAuthorizationRole("APROVADOR")).toBe(false);
		expect(isAuthorizationRole("VISUALIZADOR")).toBe(false);
		expect(isAuthorizationRole("")).toBe(false);
		expect(isAuthorizationRole(null)).toBe(false);
	});

	it("maps scope access flags from final roles and the safe legacy alias", () => {
		expect(roleToScopeAccess("GESTOR")).toMatchObject({
			canRead: true,
			canWrite: true,
			canApprove: true,
			canAdmin: false,
			canAudit: false,
		});
		expect(roleToScopeAccess("SUPERVISOR")).toMatchObject({
			canRead: true,
			canWrite: true,
			canApprove: false,
			canAdmin: false,
			canAudit: false,
		});
		expect(roleToScopeAccess("OPERADOR")).toMatchObject({
			canRead: true,
			canWrite: true,
			canApprove: false,
			canAdmin: false,
			canAudit: false,
		});
	});

	it("normalizes legacy OPERADOR without changing unmapped roles", () => {
		expect(normalizeRole(" operador ")).toBe("SUPERVISOR");
		expect(normalizeRole("APROVADOR")).toBe("APROVADOR");
	});

	it("throws ConstructionError when role cannot perform action", () => {
		expect(() => assertRoleCan("SUPERVISOR", "approve")).toThrow(
			ConstructionError,
		);
	});

	it("diferencia GERENTE de GESTOR pela acao organizacional", () => {
		expect(canPerformRoleAction("GERENTE", "manage")).toBe(true);
		expect(canPerformRoleAction("GESTOR", "manage")).toBe(false);
		expect(roleToScopeAccess("GERENTE").canAudit).toBe(true);
	});
});
