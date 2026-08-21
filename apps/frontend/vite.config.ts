import { devtools as tanstackDevtools } from "@tanstack/devtools-vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const backendPort = process.env.VITE_BACKEND_PORT ?? "7001";
const backendTarget =
	process.env.VITE_BACKEND_TARGET ||
	process.env.VITE_SERVER_URL ||
	`http://127.0.0.1:${backendPort}`;
const isE2E = process.env.E2E === "1";
const apiProxy = {
	"/api": {
		target: backendTarget,
		changeOrigin: true,
	},
	"/construction": {
		target: backendTarget,
		changeOrigin: true,
	},
	"/organizations": {
		target: backendTarget,
		changeOrigin: true,
	},
	"/api-keys": {
		target: backendTarget,
		changeOrigin: true,
	},
	"/governance": {
		target: backendTarget,
		changeOrigin: true,
	},
	"/audit-logs": {
		target: backendTarget,
		changeOrigin: true,
	},
	"/health": {
		target: backendTarget,
		changeOrigin: true,
	},
	"/openapi": {
		target: backendTarget,
		changeOrigin: true,
	},
	"/admin": {
		target: backendTarget,
		changeOrigin: true,
	},
	"/users": {
		target: backendTarget,
		changeOrigin: true,
	},
	"/internal": {
		target: backendTarget,
		changeOrigin: true,
	},
};

export default defineConfig({
	optimizeDeps: {
		exclude: ["@sentry/react"],
	},
	server: {
		host: true,
		port: 7000,
		strictPort: true,
		allowedHosts: [".ngrok-free.app"],
		proxy: apiProxy,
	},
	preview: {
		host: true,
		allowedHosts: [".ngrok-free.app"],
		proxy: apiProxy,
		strictPort: true,
	},
	plugins: [
		tanstackRouter({ target: "react", autoCodeSplitting: true }),
		tsconfigPaths(),
		tailwindcss(),
		viteReact(),
		...(!isE2E
			? [
					tanstackDevtools({
						eventBusConfig: {
							port: 42070,
						},
					}),
				]
			: []),
	],
	build: {
		rollupOptions: {
			output: {
				manualChunks(id) {
					if (
						id.includes("node_modules/react") ||
						id.includes("node_modules/react-dom")
					) {
						return "react";
					}
					if (
						id.includes("node_modules/@tanstack/react-table") ||
						id.includes("node_modules/@tanstack/table-core")
					) {
						return "table";
					}
					if (id.includes("node_modules/@tanstack/")) {
						return "tanstack";
					}
					if (
						id.includes("node_modules/@radix-ui/") ||
						id.includes("node_modules/radix-ui/")
					) {
						return "radix";
					}
					if (id.includes("node_modules/lucide-react")) {
						return "icons";
					}
					if (id.includes("node_modules/recharts") || id.includes("node_modules/d3-")) {
						return "recharts";
					}
				},
			},
		},
	},
});
