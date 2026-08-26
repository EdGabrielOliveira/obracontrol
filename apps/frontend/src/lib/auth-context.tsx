import { useQuery } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext } from "react";
import type { BetterAuthSession } from "@/lib/auth-client";
import { authorizationSessionQueryOptions } from "@/lib/authorization-session-query";
import { sessionQueryOptions } from "@/lib/session-query";
import type {
	AuthorizationCapabilities,
	AuthorizationSession,
	Role,
} from "@/types/authorization";

interface AuthContextValue {
	session: BetterAuthSession["session"] | null;
	user: BetterAuthSession["user"] | null;
	authorization: AuthorizationSession | null;
	capabilities: AuthorizationCapabilities | null;
	role: Role | null;
	loading: boolean;
}

const EMPTY_CAPABILITIES: AuthorizationCapabilities = {
	canManageUsers: false,
	canAdministerCompanies: false,
	canManageScopedCompanies: false,
	canManageStructure: false,
	canManageApiKeys: false,
	canDecideSupervisorRequests: false,
	canReviewExecutedSupervisorRequests: false,
	canRequestSupervisorDecisionReversal: false,
	canDecideGestorRequests: false,
	canFinalizeContracts: false,
};

const AuthContext = createContext<AuthContextValue>({
	session: null,
	user: null,
	authorization: null,
	capabilities: EMPTY_CAPABILITIES,
	role: null,
	loading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
	// Use the same cache as route guards and the login flow. Better Auth's
	// useSession has a separate nanostore and can briefly remain anonymous while
	// the initial get-session request settles.
	const sessionQuery = useQuery(sessionQueryOptions());
	const session = sessionQuery.data?.data?.session ?? null;
	const user = sessionQuery.data?.data?.user ?? null;
	const authorizationQuery = useQuery({
		...authorizationSessionQueryOptions(),
		enabled: Boolean(session && user),
	});
	const authorization = authorizationQuery.data ?? null;
	const authorizationReady = Boolean(
		session && user && authorization?.user.role,
	);
	const value: AuthContextValue = {
		session,
		user,
		authorization,
		capabilities: authorization?.capabilities ?? EMPTY_CAPABILITIES,
		role: authorization?.user.role ?? null,
		loading:
			sessionQuery.isPending ||
			(Boolean(session && user) && !authorizationReady),
	};

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
	return useContext(AuthContext);
}
