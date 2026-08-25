import { prisma } from "./prisma";

type WorkspaceUserDelegate = {
	findUnique?: (args: {
		where: { id: string };
		select: Record<string, boolean>;
	}) => Promise<{ workspaceId?: string | null; name?: string } | null>;
};

/**
 * Resolve the account boundary for a session.  The field is nullable while
 * legacy databases are being backfilled, so the first access also performs a
 * safe, idempotent assignment to the default workspace.
 */
export async function ensureWorkspaceForUser(
	userId: string,
): Promise<string | null> {
	const userDelegate = (prisma as unknown as { user?: WorkspaceUserDelegate })
		.user;
	if (!userDelegate?.findUnique) return null;
	const user = await userDelegate.findUnique({
		where: { id: userId },
		select: { workspaceId: true, name: true },
	});
	if (!user) throw new Error("User not found");
	if (user.workspaceId) return user.workspaceId;
	const workspaceDelegate = (prisma as unknown as { workspace?: unknown })
		.workspace;
	if (!workspaceDelegate) return null;

	let workspace = await prisma.workspace.findFirst({
		orderBy: { createdAt: "asc" },
		select: { id: true },
	});
	if (!workspace) {
		workspace = await prisma.workspace.create({
			data: { name: `Conta ${user.name || "ObraControl"}` },
			select: { id: true },
		});
	}

	await prisma.user.update({
		where: { id: userId },
		data: { workspaceId: workspace.id },
	});
	return workspace.id;
}

export async function getWorkspaceIdForUser(
	userId: string,
): Promise<string | null> {
	const userDelegate = (prisma as unknown as { user?: WorkspaceUserDelegate })
		.user;
	if (!userDelegate?.findUnique) return null;
	const user = await userDelegate.findUnique({
		where: { id: userId },
		select: { workspaceId: true },
	});
	return user?.workspaceId ?? null;
}

export async function createWorkspace(name: string): Promise<string | null> {
	const workspaceDelegate = (prisma as unknown as { workspace?: unknown })
		.workspace;
	if (!workspaceDelegate) return null;
	const workspace = await prisma.workspace.create({
		data: { name: name.trim() || "Conta ObraControl" },
		select: { id: true },
	});
	return workspace.id;
}
