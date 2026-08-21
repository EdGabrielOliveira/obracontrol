import {
	type ConstructionMonthlyFact,
	Prisma,
} from "../../../../generated/prisma/client";
import { prisma } from "../../../lib/prisma";

export type MonthlyFactRecord = ConstructionMonthlyFact;

export type MonthlyFactRepository = {
	workExists: (input: {
		ownerId: string;
		workId: string;
	}) => Promise<{ id: string } | null>;
	findLatestVersion: (input: {
		ownerId: string;
		workId: string;
		competencia: string;
		origem: string;
	}) => Promise<{ version: number } | null>;
	listByCompetencia: (input: {
		ownerId: string;
		workId: string;
		competencia?: string;
		origem?: string;
	}) => Promise<MonthlyFactRecord[]>;
	createVersioned: (input: {
		ownerId: string;
		workId: string;
		competencia: string;
		origem: string;
		status: string;
		valores: Prisma.InputJsonValue | null;
		fingerprint: string;
		reason: string | null;
		createdBy: string;
	}) => Promise<MonthlyFactRecord>;
};

export const prismaMonthlyFactRepository: MonthlyFactRepository = {
	workExists: (input) =>
		prisma.constructionWork.findFirst({
			where: { id: input.workId, ownerId: input.ownerId },
			select: { id: true },
		}),
	findLatestVersion: (input) =>
		prisma.constructionMonthlyFact.findFirst({
			where: {
				ownerId: input.ownerId,
				workId: input.workId,
				competencia: input.competencia,
				origem: input.origem,
			},
			orderBy: { version: "desc" },
			select: { version: true },
		}),
	listByCompetencia: (input) =>
		prisma.constructionMonthlyFact.findMany({
			where: {
				ownerId: input.ownerId,
				workId: input.workId,
				...(input.competencia ? { competencia: input.competencia } : {}),
				...(input.origem ? { origem: input.origem } : {}),
			},
			orderBy: [
				{ version: "desc" },
				{ competencia: "desc" },
				{ origem: "desc" },
			],
		}),
	createVersioned: (input) =>
		prisma.$transaction(async (tx) => {
			const latest = await tx.constructionMonthlyFact.findFirst({
				where: {
					ownerId: input.ownerId,
					workId: input.workId,
					competencia: input.competencia,
					origem: input.origem,
				},
				orderBy: { version: "desc" },
				select: { version: true },
			});
			return tx.constructionMonthlyFact.create({
				data: {
					...input,
					valores: input.valores ?? Prisma.DbNull,
					version: (latest?.version ?? 0) + 1,
				},
			});
		}),
};
