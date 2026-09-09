import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";

export function createLocalPrisma(): PrismaClient {
	const url =
		process.env.DATABASE_URL ??
		"postgresql://obracontrol:obracontrol_dev@localhost:5432/obracontrol?schema=public";
	const adapter = new PrismaPg({ connectionString: url });
	return new PrismaClient({
		adapter,
		transactionOptions: {
			maxWait: 30_000,
			timeout: 30_000,
		},
	});
}
