import { beforeEach, describe, expect, it, mock } from "bun:test";
import { ConstructionError } from "../../../src/lib/errors";

type Session = { user: { id: string; email: string } | null } | null;
const getSession = mock(
	async (): Promise<Session> => ({
		user: { id: "user-1", email: "user@example.com" },
	}),
);

mock.module("../../../src/lib/auth", () => ({
	auth: { api: { getSession } },
}));

const { getSessionUser } = await import("../../../src/lib/auth-middleware");

describe("getSessionUser", () => {
	beforeEach(() => {
		getSession.mockResolvedValue({
			user: { id: "user-1", email: "user@example.com" },
		});
	});

	it("passes request headers to the auth provider", async () => {
		const request = new Request("http://localhost/app", {
			headers: { cookie: "session=test" },
		});

		await expect(getSessionUser(request)).resolves.toMatchObject({
			id: "user-1",
			email: "user@example.com",
		});
		expect(getSession).toHaveBeenCalledWith({ headers: request.headers });
	});

	it("rejects requests without an authenticated user", async () => {
		getSession.mockResolvedValueOnce({ user: null });

		await expect(
			getSessionUser(new Request("http://localhost/app")),
		).rejects.toEqual(
			new ConstructionError("UNAUTHORIZED", "Login obrigatorio", 401),
		);
	});
});
