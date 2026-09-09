import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
	schema: "prisma",
	migrations: {
		path: "prisma/migrations-postgresql",
	},
	datasource: {
		url:
			process.env.DATABASE_URL ??
			"postgresql://obracontrol:obracontrol_dev@localhost:5432/obracontrol?schema=public",
	},
});
