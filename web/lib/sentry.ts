import type { ErrorEvent } from "@sentry/nextjs";

// Website errors only: never report the paired app or its link parameters.
export function sanitizeError(event: ErrorEvent): ErrorEvent | null {
  if (event.request?.url) {
    try {
      const url = new URL(event.request.url);
      if (url.pathname === "/app" || url.pathname.startsWith("/app/")) return null;
      event.request = { url: `${url.origin}${url.pathname}`, method: event.request.method };
    } catch {
      delete event.request;
    }
  }
  delete event.user;
  delete event.breadcrumbs;
  delete event.extra;
  return event;
}

export const sentryOptions = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,
  tracesSampleRate: 0,
  enableLogs: false,
  maxBreadcrumbs: 0,
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    httpBodies: [],
    urlQueryParams: false,
    stackFrameVariables: false,
    databaseQueryData: false,
    queues: false,
    graphQL: { document: false, variables: false },
    genAI: { inputs: false, outputs: false },
  },
  beforeSend: sanitizeError,
};
