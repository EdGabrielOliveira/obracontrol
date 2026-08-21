import { auth } from "./auth";
import { ConstructionError } from "./errors";

export async function getSessionUser(request: Request) {
	const session = await auth.api.getSession({
		headers: request.headers,
	});

	if (!session?.user) {
		throw new ConstructionError("UNAUTHORIZED", "Login obrigatorio", 401);
	}

	return session.user;
}
