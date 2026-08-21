import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { PrismaClient } from "../../generated/prisma/client";

export function createLocalPrisma(): PrismaClient {
	const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
	const adapter = new PrismaLibSQL({ url });
	return new PrismaClient({
		adapter,
		transactionOptions: {
			maxWait: 30_000,
			timeout: 30_000,
		},
	});
}
