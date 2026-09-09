import { env } from "../env";
import { redact } from "./redact";
import { requestContext } from "./request-context";

type SentryModule = typeof import("@sentry/node");

let sentryPromise: Promise<SentryModule> | null = null;

function loadSentry(): Promise<SentryModule> {
	if (!sentryPromise) {
		sentryPromise = import("@sentry/node").then((sentry) => {
			sentry.init({
				dsn: env.SENTRY_DSN,
				tracesSampleRate: 0.1,
				beforeSend(event) {
					if (event.request?.headers) {
						delete event.request.headers.cookie;
						delete event.request.headers.authorization;
						delete event.request.headers["x-api-key"];
					}
					if (event.request?.data)
						event.request.data = redact(event.request.data);
					return event;
				},
			});
			return sentry;
		});
	}
	return sentryPromise;
}

export function reportException(error: unknown): void {
	if (!env.SENTRY_DSN) return;
	const requestId = requestContext.getRequestId();
	const userId = requestContext.getUserId();
	void loadSentry()
		.then((sentry) => {
			sentry.withScope((scope) => {
				if (requestId) scope.setTag("request_id", requestId);
				if (userId) scope.setUser({ id: userId });
				sentry.captureException(error);
			});
		})
		.catch(() => undefined);
}
