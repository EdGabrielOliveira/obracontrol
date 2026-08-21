import { Elysia } from "elysia";
import { env } from "../env";

const isProd = env.NODE_ENV === "production";

export function buildSecurityHeaders(options?: {
	isProduction?: boolean;
	isSecure?: boolean;
}): Record<string, string> {
	const production = options?.isProduction ?? isProd;
	const secure = options?.isSecure ?? true;
	const headers: Record<string, string> = {
		"x-content-type-options": "nosniff",
		"x-frame-options": "DENY",
		"referrer-policy": "strict-origin-when-cross-origin",
		"x-permitted-cross-domain-policies": "none",
		"x-download-options": "noopen",
		"x-dns-prefetch-control": "off",
		"permissions-policy": [
			"camera=()",
			"microphone=()",
			"geolocation=()",
			"interest-cohort=()",
		].join(", "),
		"content-security-policy": [
			"default-src 'self'",
			"script-src 'self'",
			"style-src 'self' 'unsafe-inline'",
			"img-src 'self' data: blob: https:",
			"font-src 'self'",
			"connect-src 'self'",
			"frame-ancestors 'none'",
			"form-action 'self'",
			"base-uri 'self'",
			"object-src 'none'",
		].join("; "),
	};

	if (production && secure) {
		headers["strict-transport-security"] =
			"max-age=63072000; includeSubDomains; preload";
	}

	return headers;
}

export const securityHeaders = new Elysia({
	name: "security-headers",
}).onAfterHandle({ as: "scoped" }, ({ request, response, set }) => {
	const forwardedProto = request.headers
		.get("x-forwarded-proto")
		?.split(",", 1)[0]
		?.trim()
		.toLowerCase();
	const isHttps =
		forwardedProto === "https" || new URL(request.url).protocol === "https:";
	const headers = buildSecurityHeaders({ isSecure: isHttps });

	if (response instanceof Response) {
		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers: {
				...Object.fromEntries(response.headers.entries()),
				...headers,
			},
		});
	}

	Object.assign(set.headers, headers);
});
