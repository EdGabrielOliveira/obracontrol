import { env } from "./env";
import { startCleanupJob } from "./lib/cleanup-job";
import {
	configureImportStorage,
	createImportStorage,
} from "./lib/import-storage";
import { logger } from "./lib/logger";
import { configureObjectStorage } from "./lib/object-storage";
import { createLocalObjectStorage } from "./lib/object-storage-local";
import { configureLocalPrisma, getDatabaseMode } from "./lib/prisma";
import { createLocalPrisma } from "./lib/prisma-local";

if (getDatabaseMode() === "unconfigured") {
	configureLocalPrisma(createLocalPrisma());
	configureObjectStorage(createLocalObjectStorage(env.OBJECT_STORAGE_DIR));
	configureImportStorage(createImportStorage());
}
const { createApp } = await import("./app");
const app = createApp().listen({ hostname: env.HOST, port: env.PORT });

const url = new URL(`http://${app.server?.hostname}:${app.server?.port}`);

startCleanupJob();

logger.info("server.started", {
	url: url.href,
	port: env.PORT,
	nodeEnv: env.NODE_ENV,
});
logger.info("openapi.available", { url: `${url.href}openapi` });
