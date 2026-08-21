import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./index.css";

if (import.meta.env.VITE_SENTRY_DSN) {
	import("@sentry/react").then((Sentry) => {
		Sentry.init({
			dsn: import.meta.env.VITE_SENTRY_DSN as string,
			integrations: [Sentry.browserTracingIntegration()],
			tracesSampleRate: 0.1,
			beforeSend(event) {
				if (event.request?.headers) {
					delete event.request.headers.cookie;
					delete event.request.headers.authorization;
				}
				if (event.request?.data) {
					const sensitive = [
						"password",
						"token",
						"secret",
						"apikey",
						"api_key",
					];
					event.request.data = sanitizeDeep(event.request.data, sensitive);
				}
				return event;
			},
		});
	});
}

function sanitizeDeep(obj: unknown, keys: string[]): unknown {
	if (Array.isArray(obj)) return obj.map((v) => sanitizeDeep(v, keys));
	if (obj && typeof obj === "object") {
		const result: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
			result[k] = keys.includes(k.toLowerCase())
				? "[redacted]"
				: sanitizeDeep(v, keys);
		}
		return result;
	}
	return obj;
}

const root = document.getElementById("root");

if (!root) {
	throw new Error("Root element not found");
}

ReactDOM.createRoot(root).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>,
);
