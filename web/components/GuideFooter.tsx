import { AnalyticsPreferences } from "@/components/WebsiteAnalytics";

export function GuideFooter() {
  return <footer className="site-legal-footer wrap">
    <a className="brand" href="/"><img src="/pocket-icon.webp" alt="" width={28} height={28} />Pocket</a>
    <a href="/guides/">All guides</a>
    <a href="https://www.orlandoascanio.com">Made by Orlando Ascanio</a>
    <nav className="foot-legal" aria-label="Website preferences">
      <a href="/privacy/">Website privacy</a>
      <AnalyticsPreferences />
    </nav>
  </footer>;
}
