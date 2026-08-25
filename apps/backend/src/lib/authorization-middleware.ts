import { Elysia } from "elysia";
import { assertRoleCan, type RoleAction } from "./authorization";
import { ConstructionError } from "./errors";
import {
	resolveResourceScope,
	type ScopeContext,
	type ScopeResource,
} from "./resource-scope";

const emptyScope: ScopeContext = {
	actorId: "",
	resourceType: "ORGANIZATION",
	resourceOwnerId: "",
	workspaceId: "",
	path: { organizationId: "", costCenterId: null, workId: null },
	role: null,
	canRead: false,
	canWrite: false,
	canApprove: false,
	canAdmin: false,
	canAudit: false,
};

export function requireRole(action: RoleAction) {
	return new Elysia({ name: `require-role-${action}` }).onBeforeHandle(
		{ as: "scoped" },
		(context) => {
			const user = (context as Record<string, unknown>).user as
				| { id: string; role?: string | null }
				| undefined;
			assertRoleCan(user?.role, action);
		},
	);
}

export function requireScopedAccess(
	action: "read" | "write",
	resolveResource: (
		params: Record<string, string | undefined>,
	) => ScopeResource | Promise<ScopeResource | null> | null,
	notFoundMessage = "Obra nao encontrada",
	pluginName = `require-scoped-access-${action}`,
) {
	return new Elysia({ name: pluginName }).resolve(
		{ as: "scoped" },
		async (context) => {
			const typed = context as unknown as {
				request?: Request;
				user?: { id?: string };
				params?: Record<string, string | undefined>;
			};
			const method = typed.request?.method ?? "GET";
			const isReadMethod = method === "GET" || method === "HEAD";
			// Para mutacoes o requireRole(action) ja bloqueia papéis sem
			// permissao (403) e o requireScopedAccess("write") valida o escopo
			// depois; o middleware de leitura nao pode antecipar um 404. O
			// escopo vazio e sobrescrito pelo resolve de escrita registrado
			// depois (Elysia aplica o ultimo resolve sobre a mesma chave).
			if (action === "read" && !isReadMethod) {
				return { scope: emptyScope };
			}
			const actorId = typed.user?.id;
			const resource = await resolveResource(typed.params ?? {});
			if (
				!actorId ||
				!resource ||
				(!resource.workId && !resource.costCenterId && !resource.organizationId)
			) {
				throw new ConstructionError("NOT_FOUND", notFoundMessage, 404);
			}
			const scope = await resolveResourceScope(actorId, resource);
			const allowed = action === "write" ? scope.canWrite : scope.canRead;
			if (!allowed) {
				throw new ConstructionError("NOT_FOUND", notFoundMessage, 404);
			}
			return { scope };
		},
	);
}

export function requireWorkAccess(action: "read" | "write") {
	return requireScopedAccess(action, (params) => ({
		workId: params?.workId,
	}));
}
