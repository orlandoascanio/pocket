import { SITE_URL } from "./site";

export const ANALYTICS_PREFERENCE = "pocket-website-analytics";
// The Measurement ID is public. An explicit env value overrides it; blank disables tracking.
export const MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "G-6LLJJ52MDL";
export const ANALYTICS_CONFIGURED = /^G-[A-Z0-9]+$/.test(MEASUREMENT_ID);
type Gtag = (...args: unknown[]) => void;

export function analyticsEnabledForHost(hostname: string) {
  // Keep preview and localhost visits out of the live stream unless explicitly configured.
  return ANALYTICS_CONFIGURED && (
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID !== undefined || hostname === new URL(SITE_URL).hostname
  );
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
  }
}

// Keep arbitrary query strings, hashes, and pairing parameters out of analytics.
export function pageLocation(pathname: string) {
  return `${SITE_URL}${pathname}`;
}

export function trackWebsiteEvent(name: string, properties: Record<string, string>) {
  try {
    if (!analyticsEnabledForHost(window.location.hostname) || localStorage.getItem(ANALYTICS_PREFERENCE) !== "accepted") return;
    window.gtag?.("event", name, {
      ...properties,
      page_location: pageLocation(window.location.pathname),
      ...(process.env.NEXT_PUBLIC_GA_DEBUG === "true" ? { debug_mode: true } : {}),
    });
  } catch { /* Download and navigation always work, even with blocked storage or tags. */ }
}

export function removeAnalyticsCookies() {
  const hostname = window.location.hostname;
  const domains = ["", hostname, ...hostname.split(".").map((_, i, parts) => `.${parts.slice(i).join(".")}`)];
  for (const cookie of document.cookie.split(";")) {
    const name = cookie.split("=")[0].trim();
    if (!/^_ga(?:_|$)/.test(name)) continue;
    for (const domain of domains) {
      document.cookie = `${name}=; Max-Age=0; path=/;${domain ? ` domain=${domain};` : ""} SameSite=Lax`;
    }
  }
}
