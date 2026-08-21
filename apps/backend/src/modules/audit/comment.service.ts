import { ConstructionError } from "../../lib/errors";
import { prisma } from "../../lib/prisma";

type CommentClient = {
	auditComment: {
		findMany(args: unknown): Promise<unknown[]>;
		create(args: unknown): Promise<unknown>;
		update(args: unknown): Promise<unknown>;
		delete(args: unknown): Promise<unknown>;
		findFirst(args: unknown): Promise<unknown | null>;
	};
};

const db = prisma as unknown as CommentClient;
const normalizeBody = (body: string) => {
	const value = body.trim();
	if (!value)
		throw new ConstructionError("INVALID_INPUT", "Comentario obrigatorio", 400);
	if (value.length > 2000)
		throw new ConstructionError(
			"INVALID_INPUT",
			"Comentario excede 2000 caracteres",
			400,
		);
	return value;
};

export const auditCommentService = {
	async list(ownerId: string, workId: string, auditLogId?: string) {
		return db.auditComment.findMany({
			where: { ownerId, workId, ...(auditLogId ? { auditLogId } : {}) },
			orderBy: { createdAt: "asc" },
			include: { author: { select: { id: true, name: true, email: true } } },
		});
	},
	async create(
		ownerId: string,
		workId: string,
		authorId: string,
		body: string,
		auditLogId?: string,
	) {
		return db.auditComment.create({
			data: {
				ownerId,
				workId,
				authorId,
				body: normalizeBody(body),
				...(auditLogId ? { auditLogId } : {}),
			},
			include: { author: { select: { id: true, name: true, email: true } } },
		});
	},
	async update(
		ownerId: string,
		workId: string,
		id: string,
		authorId: string,
		body: string,
	) {
		const existing = (await db.auditComment.findFirst({
			where: { id, ownerId, workId },
		})) as { authorId?: string } | null;
		if (!existing)
			throw new ConstructionError(
				"NOT_FOUND",
				"Comentario nao encontrado",
				404,
			);
		if (existing.authorId !== authorId)
			throw new ConstructionError(
				"FORBIDDEN",
				"Somente o autor pode editar o comentario",
				403,
			);
		return db.auditComment.update({
			where: { id },
			data: { body: normalizeBody(body) },
			include: { author: { select: { id: true, name: true, email: true } } },
		});
	},
	async remove(ownerId: string, workId: string, id: string, authorId: string) {
		const existing = (await db.auditComment.findFirst({
			where: { id, ownerId, workId },
		})) as { authorId?: string } | null;
		if (!existing)
			throw new ConstructionError(
				"NOT_FOUND",
				"Comentario nao encontrado",
				404,
			);
		if (existing.authorId !== authorId)
			throw new ConstructionError(
				"FORBIDDEN",
				"Somente o autor pode excluir o comentario",
				403,
			);
		await db.auditComment.delete({ where: { id } });
		return { deleted: true };
	},
};
