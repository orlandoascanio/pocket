import Image from "next/image";
import { PocketCharacter } from "@/components/PocketCharacter";
import { DESCRIPTION, DOWNLOAD_URL, REPO_URL, SITE_URL } from "@/lib/site";
import overview from "@/public/screenshot-overview.png";
import plan from "@/public/screenshot-plan.png";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Pocket for Mac",
  description: DESCRIPTION,
  url: `${SITE_URL}/`,
  downloadUrl: DOWNLOAD_URL,
  image: `${SITE_URL}/screenshot-overview.png`,
  operatingSystem: "macOS 14 or later",
  applicationCategory: "FinanceApplication",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

function DownloadButton() {
  return (
    <a className="btn" href={DOWNLOAD_URL}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 4v11" />
        <path d="m7 10 5 5 5-5" />
        <path d="M5 20h14" />
      </svg>
      Download for Mac
    </a>
  );
}

export default function Home() {
  return (
    <div className="wrap">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <header className="top">
        <a className="brand" href="/">
          <img src="/apple-touch-icon.png" alt="" width={30} height={30} />
          Pocket
        </a>
        <nav aria-label="Page">
          <a href="#plan">Plan ahead</a>
          <a href="#private">Privacy</a>
          <a href={REPO_URL}>Source</a>
        </nav>
      </header>

      <main>
        <div className="hero">
          <div>
            <h1>
              Your money, <em>always in sight.</em>
            </h1>
            <p className="lead">{DESCRIPTION}</p>
            <div className="cta">
              <DownloadButton />
              <span className="fine">Free · macOS 14 or later · Apple Silicon and Intel</span>
            </div>
          </div>
          <PocketCharacter id="hero" mood="happy" bubble="Cha-ching!" />
        </div>

        <figure className="shot">
          <Image
            src={overview}
            sizes="(max-width: 1080px) 100vw, 1032px"
            loading="eager"
            alt="Pocket's main window: the balance, quick-add buttons, a form to add an entry, a payment waiting to be confirmed, and history."
          />
        </figure>

        <section className="feature" id="plan">
          <div className="copy">
            <h2>Know when it runs out.</h2>
            <p>
              Add your bills, subscriptions and paychecks once. Pocket logs them on their day and draws where your
              balance is heading, a month or a year out.
            </p>
            <ul>
              <li>“Lasts past Jan 10”, or “Runs out on Dec 4”, at a glance</li>
              <li>Every payment coming up, with the balance after it</li>
              <li>Pause, skip or stop anything that repeats</li>
            </ul>
          </div>
          <div className="shot-sm">
            <Image
              src={plan}
              sizes="(max-width: 820px) 100vw, 560px"
              alt="The Plan view: a step chart of the projected balance and the list of payments coming up."
            />
          </div>
        </section>

        <section className="feature flip">
          <div className="copy">
            <h2>Made for money that doesn&apos;t arrive on schedule.</h2>
            <p>
              Freelance pay, refunds, the friend who owes you: mark it as something you&apos;re waiting for. When it
              lands, click “Got it” and type what actually arrived, even if it came late or smaller.
            </p>
            <ul>
              <li>A reminder on the day it&apos;s due</li>
              <li>Quick-add buttons for the things you buy often, ⌘1 to ⌘9</li>
              <li>Categories and a monthly breakdown of where it went</li>
            </ul>
          </div>
          <PocketCharacter
            id="waiting"
            mood="excited"
            bubble="Can't wait!"
            style={{ width: "min(260px, 60vw)" }}
            bubbleStyle={{ animationDelay: "0ms" }}
          />
        </section>

        <section className="promise" id="private">
          <h2>By default, your money never leaves your Mac.</h2>
          <p>
            You don&apos;t need an account. Everything lives in one file on your Mac, with a daily backup, and you can
            export it, move it, or erase it any time. Want Pocket on your phone too? Sync is optional, and you can{" "}
            <a href={`${REPO_URL}/blob/main/SELF-HOSTING.md`}>run the server yourself</a>.
          </p>
          <div className="cta" style={{ justifyContent: "center" }}>
            <DownloadButton />
          </div>
        </section>
      </main>

      <footer>
        <span>Pocket for Mac. Signed and notarized by Apple.</span>
        <span>
          <a href={`${REPO_URL}/releases`}>Release notes</a> · <a href={REPO_URL}>Source code</a>
        </span>
      </footer>
    </div>
  );
}
