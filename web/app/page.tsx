import type { ReactNode } from "react";
import { Bento } from "@/components/Bento";
import { ButtonFx } from "@/components/ButtonFx";
import { DownloadDialog } from "@/components/DownloadDialog";
import { Faq } from "@/components/Faq";
import { PocketCharacter } from "@/components/PocketCharacter";
import { DownloadIcon, SiteNav } from "@/components/SiteNav";
import { Tour } from "@/components/Tour";
import { HeroScene } from "@/components/HeroScene";
import { AnalyticsPreferences } from "@/components/WebsiteAnalytics";
import "./home.css";
import {
  DESCRIPTION,
  DOWNLOAD_URL,
  ISSUES_URL,
  RELEASES_URL,
  REPO_URL,
  SELF_HOSTING_URL,
  SITE_URL,
  VERSION,
  WEB_APP_URL,
} from "@/lib/site";

const FAQ: { q: string; a: string; link?: { href: string; label: string } }[] = [
  { q: "Is Pocket free?", a: "Yes. Every feature, with no account and no trial. The source code is on GitHub." },
  {
    q: "Does Pocket connect to my bank?",
    a: "No. You add what comes in and what goes out, and Pocket keeps the balance you've recorded. Repeating payments log themselves on their day, and quick-add buttons (⌘1 to ⌘9) add the things you buy often in one keystroke.",
  },
  {
    q: "Where is my money data stored?",
    a: "In one file on your Mac (~/Library/Application Support/Pocket/ledger.json), with seven daily backups. From Settings you can export it as JSON, import it again, or erase it.",
  },
  {
    q: "Can I see my balance on my phone?",
    a: "Yes, if you want to. Connect Pocket to a server you run (a free Supabase project), then pair your phone from Settings → Sync. Your phone uses the Pocket web app, and your Mac keeps a full copy that works offline.",
    link: { href: SELF_HOSTING_URL, label: "Read the self-hosting guide" },
  },
  {
    q: "Which currencies does it support?",
    a: "Any standard currency. Each ledger uses one. Changing it relabels your amounts; it doesn't convert them.",
  },
  {
    q: "Which Macs does it run on?",
    a: "macOS 14 Sonoma or later, on Apple Silicon and Intel. The app is signed and notarized by Apple.",
  },
  {
    q: "How do I move Pocket to a new Mac?",
    a: "Export your data from Settings on the old Mac, then import that file on the new one.",
  },
  {
    q: "Is there a Windows or iPhone app?",
    a: "Not a native one. With sync set up, the Pocket web app works in any browser, and you can add it to your home screen.",
  },
];

const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": `${SITE_URL}/#software`,
    name: "Pocket for Mac",
    description: DESCRIPTION,
    url: `${SITE_URL}/`,
    downloadUrl: DOWNLOAD_URL,
    softwareVersion: VERSION,
    image: `${SITE_URL}/screenshot-overview.png`,
    operatingSystem: "macOS 14 or later",
    applicationCategory: "FinanceApplication",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    isAccessibleForFree: true,
    screenshot: [`${SITE_URL}/screenshot-overview.png`, `${SITE_URL}/screenshot-plan.png`],
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  },
];

function DownloadButton({ label = "Download for Mac", wide }: { label?: string; wide?: boolean }) {
  return (
    <a className={wide ? "pill pill-dark pill-wide" : "pill pill-dark"} href={DOWNLOAD_URL} data-download>
      <DownloadIcon />
      {label}
    </a>
  );
}

function Check({ children }: { children: ReactNode }) {
  return (
    <li>
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="m3 8.5 3.2 3L13 4.5" />
      </svg>
      {children}
    </li>
  );
}

const COMING_UP = [
  { what: "Client A", when: "Mon, Nov 9", amount: "+$750.00", after: "$1,837.03", income: true },
  { what: "AI subscription", when: "Wed, Nov 11", amount: "−$20.00", after: "$1,817.03" },
  { what: "Client A", when: "Wed, Dec 9", amount: "+$750.00", after: "$2,567.03", income: true },
  { what: "AI subscription", when: "Fri, Dec 11", amount: "−$20.00", after: "$2,547.03" },
];

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteNav />

      <main>
        <section className="hero hero-dimensional wrap">
          <div className="hero-copy">
            <a className="announce" href="/changelog/">
              <span className="announce-tag">New</span>
              <b>Pocket {VERSION.replace(/\.0$/, "")}</b>
              <span className="announce-text">Your balance on your phone too</span>
              <span className="announce-arrow" aria-hidden="true">
                ↗
              </span>
            </a>
            <h1>Know what&apos;s<br />left. <span>Before<br />you spend it.</span></h1>
            <p className="lead">{DESCRIPTION}</p>
            <div className="cta" id="hero-cta">
              <DownloadButton />
              <a className="pill pill-soft" href="#tour">
                See how it works
              </a>
            </div>
            <ul className="meta">
              <li>Free</li>
              <li>No account</li>
              <li>macOS 14+</li>
              <li>Apple Silicon &amp; Intel</li>
              <li>Signed by Apple</li>
              <li>
                <a href="/changelog/">
                  v{VERSION} <span className="live-dot" aria-hidden="true" />
                </a>
              </li>
            </ul>
          </div>
          <HeroScene />
        </section>

        <div className="home-proof wrap" aria-label="Pocket at a glance">
          <span>Small app. A clearer picture.</span>
          <p>In your menu bar. On your Mac. Always within reach.</p>
          <a href="#tour">Take a closer look <span aria-hidden="true">↓</span></a>
        </div>

        <div className="wrap wrap-wide home-demos">
          <Bento />
        </div>

        <section className="section wrap" id="tour">
          <h2>One balance, everywhere you look.</h2>
          <p className="section-lead">
            A number in your menu bar, a window for the details, and a plan for the months ahead.
          </p>
          <Tour />
        </section>

        <section className="section wrap" id="plan">
          <div className="feature">
            <div className="copy">
              <h2>Know when it runs out.</h2>
              <p>
                Add your bills, subscriptions and paychecks once. Pocket logs them on their day and draws where your
                balance is heading, a month or a year out.
              </p>
              <ul className="dots">
                <li>“Lasts past Jan 10”, or “Runs out on Dec 4”, at a glance</li>
                <li>Every payment coming up, with the balance after it</li>
                <li>Pause, skip or stop anything that repeats</li>
              </ul>
            </div>
            <div className="upcoming" aria-label="Example of payments coming up">
              <div className="upcoming-head">
                <span>Coming up</span>
                <span>next 3 months</span>
              </div>
              {COMING_UP.map((p) => (
                <div className="upcoming-row" key={p.what + p.when}>
                  <span className={p.income ? "upcoming-ic in" : "upcoming-ic"} aria-hidden="true">
                    {p.income ? "↓" : "↻"}
                  </span>
                  <span className="upcoming-what">
                    {p.what}
                    <small>{p.when}</small>
                  </span>
                  <span className="upcoming-amt">
                    <b className={p.income ? "in" : undefined}>{p.amount}</b>
                    <small>then {p.after}</small>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="feature flip" id="waiting">
            <div className="copy">
              <h2>Made for money that doesn&apos;t arrive on schedule.</h2>
              <p>
                Freelance pay, refunds, the friend who owes you: mark it as something you&apos;re waiting for. When it
                lands, click “Got it” and type what actually arrived, even if it came late or smaller.
              </p>
              <ul className="dots">
                <li>A reminder on the day it&apos;s due</li>
                <li>Quick-add buttons for the things you buy often, ⌘1 to ⌘9</li>
                <li>Categories and a monthly breakdown of where it went</li>
              </ul>
            </div>
            <PocketCharacter id="waiting" mood="excited" bubble="Can't wait!" style={{ width: "min(280px, 64vw)" }} />
          </div>
        </section>

        <section className="section wrap" id="private">
          <h2 className="two-tone">
            Free. <span>Every feature in it.</span>
            <br />
            <span>No account, and Pocket is</span> yours.
          </h2>
          <div className="plans">
            <div className="plan">
              <h3>On your Mac</h3>
              <p>How Pocket works out of the box. Nothing to sign up for.</p>
              <ul className="checks">
                <Check>Everything in one file on your Mac</Check>
                <Check>Nothing is sent anywhere</Check>
                <Check>Seven daily backups</Check>
                <Check>Export, import or erase any time</Check>
              </ul>
              <DownloadButton wide />
            </div>
            <div className="plan">
              <h3>With sync</h3>
              <p>Optional. Your balance on your phone too, from a server you run.</p>
              <ul className="checks">
                <Check>The Pocket web app on your phone or any computer</Check>
                <Check>Pair a device with a 6-digit code</Check>
                <Check>Your Mac keeps a full copy and works offline</Check>
                <Check>A free Supabase project that only you can read</Check>
              </ul>
              <a className="pill pill-line pill-wide" href={SELF_HOSTING_URL}>
                Self-hosting guide
              </a>
            </div>
          </div>
        </section>

        <section className="section wrap" id="faq">
          <h2>Straight answers.</h2>
          <Faq items={FAQ} />
        </section>

        <section className="closing wrap home-closing">
          <img className="closing-sculpture" src="/pocket-sculpture.webp" alt="" width={200} height={200} loading="lazy" />
          <h2>Ready to know what&apos;s left?</h2>
          <p>Free for macOS 14 or later, on Apple Silicon and Intel.</p>
          <div className="cta">
            <DownloadButton />
            <a className="pill pill-soft" href={REPO_URL}>
              View the source
            </a>
          </div>
        </section>
      </main>

      <footer className="foot">
        <div className="wrap foot-grid">
          <div className="foot-brand">
            <a className="brand" href="/">
              <img src="/apple-touch-icon.png" alt="" width={28} height={28} />
              Pocket
            </a>
            <p>Your balance in the menu bar, and how long it will last.</p>
            <a className="foot-ver" href="/changelog/">
              v{VERSION} · Release notes <span className="live-dot" aria-hidden="true" />
            </a>
            <span className="foot-badge">
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="m3 8.5 3.2 3L13 4.5" />
              </svg>
              Signed and notarized by Apple
            </span>
          </div>
          <nav className="foot-col" aria-label="Product">
            <h3>Product</h3>
            <a href={DOWNLOAD_URL} data-download>
              Download
            </a>
            <a href="#tour">Features</a>
            <a href="#plan">Plan ahead</a>
            <a href={WEB_APP_URL}>Web app</a>
          </nav>
          <nav className="foot-col" aria-label="Help">
            <h3>Help</h3>
            <a href="#faq">Questions</a>
            <a href={SELF_HOSTING_URL}>Self-hosting</a>
            <a href={ISSUES_URL}>Report a bug</a>
          </nav>
          <nav className="foot-col" aria-label="Project">
            <h3>Project</h3>
            <a href={REPO_URL}>Source code</a>
            <a href="/changelog/">Changelog</a>
            <a href={RELEASES_URL}>All releases</a>
          </nav>
        </div>
        <div className="wrap foot-base">
          <span>
            Download Pocket only from <b>pocketleft.app</b> or its GitHub page.
          </span>
          <nav className="foot-legal" aria-label="Website preferences">
            <a href="/privacy/">Website privacy</a>
            <AnalyticsPreferences />
          </nav>
        </div>
        <div className="foot-word" aria-hidden="true">
          Pocket
        </div>
      </footer>

      <DownloadDialog />
      <ButtonFx />
    </>
  );
}
