import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Load the actual TypeScript helpers, with browser APIs and env values controlled.
function load(file, globals = {}, dependencies = {}) {
  const output = ts.transpileModule(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  runInNewContext(output, {
    module, exports: module.exports, URL, process: { env: {} },
    require: (name) => dependencies[name] || createRequire(import.meta.url)(name), ...globals,
  });
  return module.exports;
}

const { sanitizeError, sentryOptions } = load("lib/sentry.ts");
for (const runtime of ["server", "edge"]) {
  const initializations = [];
  load(`sentry.${runtime}.config.ts`, {}, {
    "@sentry/nextjs": { init: (options) => initializations.push(options) },
    "./lib/sentry": { sentryOptions },
  });
  assert.equal(initializations.length, 1);
  assert.equal(initializations[0], sentryOptions, `${runtime} must retain the shared privacy controls`);
}
assert.equal(sentryOptions.enabled, false);
assert.equal(sentryOptions.tracesSampleRate, 0);
assert.equal(sentryOptions.maxBreadcrumbs, 0);
for (const key of ["userInfo", "cookies", "httpHeaders", "urlQueryParams", "stackFrameVariables"]) {
  assert.equal(sentryOptions.dataCollection[key], false);
}
assert.equal(sentryOptions.dataCollection.httpBodies.length, 0);
for (const path of ["/app", "/app/", "/app/index.html"]) {
  assert.equal(sanitizeError({ request: { url: `https://pocketleft.app${path}?code=private#key` } }), null);
}
const clean = sanitizeError({ request: { url: "https://pocketleft.app/?code=private#key", headers: { authorization: "private" }, cookies: "private", data: "private" }, user: { email: "private" }, breadcrumbs: [{ message: "private" }], extra: { private: true } });
assert.equal(clean.request.url, "https://pocketleft.app/");
assert.equal(JSON.stringify(clean).includes("private"), false);
assert.equal(sanitizeError({ request: { url: "invalid" } }).request, undefined);

let preference = null;
const events = [];
const siteDependency = { "./site": { SITE_URL: "https://pocketleft.app" } };
const defaultAnalytics = load("lib/analytics.ts", {}, siteDependency);
assert.equal(defaultAnalytics.MEASUREMENT_ID, "G-6LLJJ52MDL");
assert.equal(defaultAnalytics.analyticsEnabledForHost("pocketleft.app"), true);
assert.equal(defaultAnalytics.analyticsEnabledForHost("localhost"), false);
assert.equal(defaultAnalytics.analyticsEnabledForHost("pocket-preview.vercel.app"), false);
const disabledAnalytics = load("lib/analytics.ts", {
  process: { env: { NEXT_PUBLIC_GA_MEASUREMENT_ID: "" } },
}, siteDependency);
assert.equal(disabledAnalytics.analyticsEnabledForHost("pocketleft.app"), false);
const globals = {
  process: { env: { NEXT_PUBLIC_GA_MEASUREMENT_ID: "G-TEST123" } },
  localStorage: {
    getItem: () => preference,
    setItem: (_, value) => { preference = value; },
    removeItem: () => { preference = null; },
  },
  window: { location: { pathname: "/", hostname: "pocketleft.app" }, gtag: (...args) => events.push(args) },
};
const analytics = load("lib/analytics.ts", globals, { "./site": { SITE_URL: "https://pocketleft.app" } });
assert.equal(analytics.analyticsEnabledForHost("localhost"), true);
const lifetime = 180 * 24 * 60 * 60 * 1000;
for (const choice of ["accepted", "rejected"]) {
  const saved = analytics.saveAnalyticsConsent(choice, 1000);
  assert.equal(saved.expiresAt, 1000 + lifetime);
  assert.equal(analytics.readAnalyticsConsent(1001).choice, choice);
  const returningVisit = load("lib/analytics.ts", globals, siteDependency);
  assert.equal(returningVisit.readAnalyticsConsent(1002).choice, choice);
  assert.equal(returningVisit.readAnalyticsConsent(1002).expiresAt, saved.expiresAt);
  assert.equal(analytics.readAnalyticsConsent(saved.expiresAt), null);
}
preference = "accepted";
assert.equal(analytics.readAnalyticsConsent(1000).expiresAt, 1000 + lifetime);
assert.equal(analytics.readAnalyticsConsent(2000).expiresAt, 1000 + lifetime);
preference = "malformed";
assert.equal(analytics.readAnalyticsConsent(3000), null);
preference = JSON.stringify({ choice: "accepted", expiresAt: "forever" });
assert.equal(analytics.readAnalyticsConsent(3000), null);
preference = null;
analytics.trackWebsiteEvent("download_clicked", { location: "hero" });
assert.equal(events.length, 0);
preference = "rejected";
analytics.trackWebsiteEvent("download_clicked", { location: "hero" });
assert.equal(events.length, 0);
preference = "accepted";
analytics.trackWebsiteEvent("download_clicked", { location: "hero" });
assert.equal(events.length, 1);
assert.equal(events[0][2].page_location, "https://pocketleft.app/");
globals.window.gtag = () => { throw new Error("Tag blocked"); };
assert.doesNotThrow(() => analytics.trackWebsiteEvent("download_clicked", { location: "hero" }));
globals.localStorage.getItem = () => { throw new Error("Storage blocked"); };
assert.doesNotThrow(() => analytics.trackWebsiteEvent("download_clicked", { location: "hero" }));
console.log("Passed: Sentry privacy and app exclusion; consent persistence, migration, expiry, and failure tolerance.");
