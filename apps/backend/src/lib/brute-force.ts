import { logger } from "./logger";
import {
	checkLoginBruteForce,
	hashLoginEmail,
	recordLoginFailure,
} from "./password-policy";

function isAuthAction(url: URL): boolean {
	return (
		url.pathname.includes("/sign-in/email") ||
		url.pathname.includes("/sign-up/email")
	);
}

export async function bruteForceGuard(
	request: Request,
): Promise<Response | null> {
	const url = new URL(request.url, "http://internal.invalid");

	if (request.method !== "POST" || !isAuthAction(url)) return null;

	let body: Record<string, unknown> = {};
	try {
		body = await request.clone().json();
	} catch {
		return null;
	}

	const email = (body?.email as string) ?? "";
	if (!email) return null;

	if (!(await checkLoginBruteForce(email))) {
		const emailHash = hashLoginEmail(email);
		logger.warn("auth.bruteforce.blocked", {
			emailHash,
			path: url.pathname,
		});
		return new Response(
			JSON.stringify({
				message: "Muitas tentativas. Tente novamente mais tarde.",
			}),
			{
				status: 429,
				headers: { "Content-Type": "application/json", "Retry-After": "900" },
			},
		);
	}

	return null;
}

export async function bruteForceAfter(request: Request, response: Response) {
	const url = new URL(request.url, "http://internal.invalid");

	if (request.method !== "POST" || !isAuthAction(url)) return;

	const status = response.status;

	try {
		const body = (await request.clone().json()) as Record<string, unknown>;
		const email = (body?.email as string) ?? "";
		if (!email) return;

		if (status === 401 || status === 400) {
			await recordLoginFailure(email);
		}
	} catch {
		// body already consumed — ignore
	}
}
