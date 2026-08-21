import "dotenv/config";
import { createLocalPrisma } from "../src/lib/prisma-local";

const prisma = createLocalPrisma();

try {
	await prisma.$queryRaw`SELECT 1`;
	console.log("✅ Connected");
} finally {
	await prisma.$disconnect();
}
