import "dotenv/config";

import { createLocalPrisma } from "../../src/lib/prisma-local";

const prisma = createLocalPrisma();

/**
 * Keeps the local db setup aligned with the production SQLite migration.
 * The update is intentionally idempotent and only touches the legacy
 * imported-measurement status; work operational statuses are not involved.
 */
export async function normalizeImportedMeasurementStatuses() {
	return prisma.constructionMeasurement.updateMany({
		where: { status: "APROVADA" },
		data: { status: "ACEITO" },
	});
}

if (import.meta.main) {
	normalizeImportedMeasurementStatuses()
		.then((result) => {
			console.log("imported_measurement_statuses_normalized", {
				count: result.count,
			});
		})
		.catch((error) => {
			console.error("Falha ao normalizar status de medições importadas", error);
			process.exitCode = 1;
		})
		.finally(() => prisma.$disconnect());
}
