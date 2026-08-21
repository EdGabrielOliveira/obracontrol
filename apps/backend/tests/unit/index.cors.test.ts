import { describe, expect, it } from "bun:test";
import { resolve } from "node:path";

describe("application CORS", () => {
	it("allows PUT preflight requests from the configured frontend origin", async () => {
		const origin = "http://localhost:7001";
		const additionalOrigin = "https://admin.example.com";
		const child = Bun.spawn(["bun", "src/index.ts"], {
			cwd: resolve(import.meta.dir, "../.."),
			env: {
				...process.env,
				NODE_ENV: "test",
				PORT: "0",
				FRONTEND_ORIGIN: origin,
				AUTH_TRUSTED_ORIGINS: additionalOrigin,
			},
			stdout: "pipe",
			stderr: "ignore",
		});

		try {
			const startup = new Promise<string>((resolveStartup, rejectStartup) => {
				const reader = child.stdout.getReader();
				const decoder = new TextDecoder();
				let output = "";

				void (async () => {
					while (true) {
						const { done, value } = await reader.read();
						if (done) break;
						output += decoder.decode(value, { stream: true });
						const match = output.match(/url=(http:\/\/[^ ]+)/);
						if (match) {
							resolveStartup(match[1]);
							return;
						}
					}

					rejectStartup(
						new Error(`Server exited before startup: ${output.trim()}`),
					);
				})().catch(rejectStartup);

				void child.exited.then((exitCode) => {
					rejectStartup(`Server exited with code ${exitCode}`);
				});
			});
			const baseUrl = await startup;
			const endpoint = `${baseUrl}construction/works/work-1/budget/import`;

			let response: Response | undefined;
			for (let attempt = 0; attempt < 50; attempt += 1) {
				try {
					response = await fetch(endpoint, {
						method: "OPTIONS",
						headers: {
							Origin: origin,
							"Access-Control-Request-Method": "PUT",
							"Access-Control-Request-Headers": "content-type, authorization",
						},
					});
					break;
				} catch {
					await Bun.sleep(100);
				}
			}

			expect(response).toBeDefined();
			expect(response?.status).toBe(204);
			expect(response?.headers.get("access-control-allow-origin")).toBe(origin);
			expect(response?.headers.get("access-control-allow-credentials")).toBe(
				"true",
			);
			expect(response?.headers.get("access-control-allow-methods")).toBe(
				"GET, POST, PUT, PATCH, DELETE, OPTIONS",
			);
			expect(response?.headers.get("access-control-allow-headers")).toBe(
				"Content-Type, Authorization, Cache-Control, Idempotency-Key",
			);

			const additionalOriginResponse = await fetch(endpoint, {
				method: "OPTIONS",
				headers: {
					Origin: additionalOrigin,
					"Access-Control-Request-Method": "PUT",
				},
			});
			expect(
				additionalOriginResponse.headers.get("access-control-allow-origin"),
			).toBe(additionalOrigin);

			const disallowedResponse = await fetch(endpoint, {
				method: "OPTIONS",
				headers: {
					Origin: "http://evil.example",
					"Access-Control-Request-Method": "PUT",
					"Access-Control-Request-Headers": "content-type",
				},
			});
			expect(
				disallowedResponse.headers.get("access-control-allow-origin"),
			).toBeNull();
		} finally {
			child.kill();
			await child.exited;
		}
	});
});
