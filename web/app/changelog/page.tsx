import type { Metadata } from "next";
import { ButtonFx } from "@/components/ButtonFx";
import { Changelog } from "@/components/Changelog";
import { DownloadDialog } from "@/components/DownloadDialog";
import { PocketCharacter } from "@/components/PocketCharacter";
import { SiteNav } from "@/components/SiteNav";
import { ISSUES_URL, REPO_URL } from "@/lib/site";
import "./changelog.css";

export const metadata: Metadata = {
  title: "Changelog · Pocket for Mac",
  description: "What’s new in Pocket for Mac. Read the latest releases, improvements and changes.",
  alternates: { canonical: "/changelog/" },
  openGraph: {
    title: "What’s new in Pocket",
    description: "The latest releases and improvements to Pocket for Mac.",
    url: "/changelog/",
  },
};

export default function ChangelogPage() {
  return (
    <>
      <a className="changes-skip" href="#releases">Skip to release notes</a>
      <SiteNav />
      <main className="changes wrap">
        <header className="changes-intro">
          <div>
            <h1>What’s new<br />in Pocket<span>.</span></h1>
            <p>The releases, refinements, and little details<br className="changes-desktop-break" /> that make Pocket better to use.</p>
          </div>
          <div className="changes-character" aria-hidden="true">
            <PocketCharacter id="changelog" mood="happy" bubble="New in my pocket!" style={{ width: "180px" }} />
          </div>
        </header>
        <Changelog />
        <div className="changes-close">
          <div><h2>Something we can improve?</h2><p>Tell us what happened, or what would help.</p></div>
          <a className="pill pill-line" href={ISSUES_URL}>Share feedback <span aria-hidden="true">↗</span></a>
        </div>
      </main>
      <footer className="changes-footer wrap">
        <a className="brand" href="/"><img src="/apple-touch-icon.png" alt="" width={28} height={28} />Pocket</a>
        <span>Your balance, a little closer.</span>
        <a href={REPO_URL}>View the source <span aria-hidden="true">↗</span></a>
      </footer>
      <DownloadDialog />
      <ButtonFx />
    </>
  );
}
