"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ANALYTICS_CONFIGURED, ANALYTICS_PREFERENCE, MEASUREMENT_ID, pageLocation, removeAnalyticsCookies, trackWebsiteEvent } from "@/lib/analytics";
import { DOWNLOAD_URL, REPO_URL, SELF_HOSTING_URL } from "@/lib/site";
import "./website-analytics.css";

export function WebsiteAnalytics() {
  const route = usePathname();
  const pathname = route === "/" ? "/" : `${route.replace(/\/$/, "")}/`;
  const [preference, setPreference] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState(false);
  const initialized = useRef(false);
  const lastPage = useRef("");
  const marketing = pathname === "/" || pathname === "/changelog/" || pathname === "/privacy/";

  useEffect(() => {
    try { setPreference(localStorage.getItem(ANALYTICS_PREFERENCE)); } catch { /* Default to no analytics. */ }
    setReady(true);
    function onStorage(event: StorageEvent) {
      if (event.key !== ANALYTICS_PREFERENCE) return;
      if (initialized.current && event.newValue !== "accepted") window.location.reload();
      else setPreference(event.newValue);
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!ANALYTICS_CONFIGURED || !marketing || preference !== "accepted") return;
    if (!initialized.current) {
      initialized.current = true;
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer?.push(arguments); };
      window.gtag("consent", "default", {
        analytics_storage: "granted", ad_storage: "denied",
        ad_user_data: "denied", ad_personalization: "denied",
      });
      window.gtag("js", new Date());
      let referrer = "";
      try { referrer = new URL(document.referrer).origin; } catch { /* Direct visit. */ }
      window.gtag("config", MEASUREMENT_ID, {
        send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false,
        page_location: pageLocation(pathname), page_referrer: referrer,
      });
      const script = document.createElement("script");
      script.id = "pocket-ga";
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
      document.head.appendChild(script);
    }
    if (lastPage.current !== pathname) {
      lastPage.current = pathname;
      window.gtag?.("set", { page_location: pageLocation(pathname), page_title: document.title });
      trackWebsiteEvent("page_view", { page_title: document.title });
    }

    function onClick(event: MouseEvent) {
      const link = event.target instanceof Element ? event.target.closest("a") : null;
      if (!link) return;
      const location = link.closest(".dl") ? "install_dialog" : link.closest(".nav-shell") ? "navigation" : link.closest(".hero") ? "hero" : link.closest("footer") ? "footer" : "content";
      if (link.href === DOWNLOAD_URL) trackWebsiteEvent("download_clicked", { location, download_target: "latest" });
      else if (link.href === SELF_HOSTING_URL) trackWebsiteEvent("self_hosting_opened", { location });
      else if (link.pathname === "/app/") trackWebsiteEvent("web_app_opened", { location });
      else if (link.href === REPO_URL) trackWebsiteEvent("source_opened", { location });
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [pathname, preference, marketing]);

  function choose(value: "accepted" | "rejected") {
    try { localStorage.setItem(ANALYTICS_PREFERENCE, value); } catch { /* The choice still dismisses the prompt; tracking stays disabled. */ }
    setPreference(value);
    setEditing(false);
    if (value === "rejected") {
      window.gtag?.("consent", "update", { analytics_storage: "denied" });
      removeAnalyticsCookies();
      // Unload an already accepted tag so no further automatic events can run.
      if (initialized.current) window.location.reload();
    }
  }

  if (!ANALYTICS_CONFIGURED || !ready || !marketing) return null;
  const prompt = (preference !== "accepted" && preference !== "rejected") || editing;

  return <>
    <div className="website-preferences">
      <a href="/privacy/">Website privacy</a>
      <button type="button" onClick={() => setEditing(true)}>Analytics preferences</button>
    </div>
    {prompt && <aside className="website-consent" aria-label="Website analytics preferences">
      <p>Allow website analytics?</p>
      <span>Help us understand visits and download clicks. Your Pocket balances and entries aren’t collected. <a href="/privacy/">Details</a></span>
      <div>
        <button className="pill pill-line" type="button" onClick={() => choose("rejected")}>No thanks</button>
        <button className="pill pill-line" type="button" onClick={() => choose("accepted")}>Allow analytics</button>
        {editing && <button className="website-consent-cancel" type="button" onClick={() => setEditing(false)}>Cancel</button>}
      </div>
    </aside>}
  </>;
}
