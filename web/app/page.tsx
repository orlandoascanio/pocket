import type { ReactNode } from "react";
import { Bento } from "@/components/Bento";
import { ButtonFx } from "@/components/ButtonFx";
import { DownloadDialog } from "@/components/DownloadDialog";
import { Faq } from "@/components/Faq";
import { GuideCards } from "@/components/GuideCards";
import { PocketCharacter } from "@/components/PocketCharacter";
import { DownloadIcon, SiteNav } from "@/components/SiteNav";
import { Tour } from "@/components/Tour";
import { HeroScene } from "@/components/HeroScene";
import { SiteFooter } from "@/components/SiteFooter";
import { FAQ } from "@/lib/faq";
import { AUTHOR, PUBLISHER } from "@/lib/schema";
import "./home.css";
import "./guides/guides.css";
import { RELEASES } from "@/lib/releases";
import {
  DESCRIPTION,
  DOWNLOAD_URL,
  REPO_URL,
  SELF_HOSTING_GUIDE_URL,
  SITE_URL,
  VERSION,
} from "@/lib/site";

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
    datePublished: RELEASES[RELEASES.length - 1].date,
    dateModified: RELEASES[0].date,
    releaseNotes: `${SITE_URL}/changelog/`,
    author: AUTHOR,
    publisher: PUBLISHER,
    sameAs: [REPO_URL],
    featureList: [
      "Recorded balance in the Mac menu bar",
      "Manual spending and income entries with categories",
      "Quick-add buttons with Command-1 through Command-9",
      "Weekly, every-two-weeks, monthly and yearly repeating payments",
      "Expected payments that wait for confirmation",
      "Balance forecast for the next 1, 3, 6 or 12 months",
      "Local data file with seven daily backups and JSON export/import",
      "Optional self-hosted sync with a Pocket web app for phones",
    ],
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

function DownloadButton() {
  return (
    <a className="pill pill-dark" href={DOWNLOAD_URL} data-download>
      <DownloadIcon />
      Download for Mac
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
              <span className="announce-text">Free money tracker for your Mac.</span>
              <span className="announce-arrow" aria-hidden="true">
                ↗
              </span>
            </a>
            <h1>Your money left,<br /><span>in your Mac menu bar.</span></h1>
            <p className="lead">Enter your starting balance, record spending and income, and see what&apos;s left in your menu bar.</p>
            <div className="cta" id="hero-cta">
              <DownloadButton />
              <a className="pill pill-soft" href="#tour">
                See Pocket in action
              </a>
            </div>
            <ul className="meta">
              <li>Free</li>
              <li>No account</li>
              <li>macOS 14+</li>
              <li>Apple Silicon &amp; Intel</li>
              <li>Developer signed · Apple notarized</li>
              <li>
                <a href="/changelog/">
                  v{VERSION}
                </a>
              </li>
            </ul>
          </div>
          <HeroScene />
        </section>

        <section className="section wrap" id="tour">
          <h2>Inside Pocket.</h2>
          <p className="section-lead">
            Your balance, entries and upcoming payments in one window.
          </p>
          <Tour initialView="overview" />
          <div className="tour-download">
            <DownloadButton />
            <p>Free. No account. Your money data stays on your Mac by default.</p>
          </div>
        </section>

        <div className="wrap wrap-wide home-demos">
          <Bento />
        </div>

        <section className="section wrap" id="plan">
          <div className="feature">
            <div className="copy">
              <h2>Plan for upcoming bills.</h2>
              <p>
                See where your balance is heading based on the payments you enter. Add your bills, subscriptions
                and expected income to plan a month or a year ahead.
              </p>
              <ul className="dots">
                <li>A projected runway based on your recorded balance and planned payments</li>
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
                <li>Waiting payments sit in Overview with Got it and Skip buttons</li>
                <li>Your balance only changes once you confirm</li>
                <li>A reminder on the day it&apos;s due</li>
              </ul>
              <a className="feature-guide" href="/guides/expected-income/">
                Guide: track expected income before it arrives <span aria-hidden="true">→</span>
              </a>
            </div>
            <PocketCharacter id="waiting" mood="excited" bubble="Can't wait!" style={{ width: "min(280px, 64vw)" }} />
          </div>

          <div className="feature quick-add-feature" id="quick-add">
            <div className="copy">
              <h2>Quick-add for everyday spending.</h2>
              <p>
                Add a coffee once, then choose Save as Button. From then on it&apos;s one click, or ⌘1 to ⌘9 from the
                menu bar panel or anywhere in the Pocket window, and your balance updates right away.
              </p>
              <a className="feature-guide" href="/guides/quick-add-spending/">
                Guide: set up quick-add buttons <span aria-hidden="true">→</span>
              </a>
            </div>
            <figure className="quick-add-recording">
              <video
                controls
                muted
                playsInline
                preload="none"
                width={1660}
                height={1080}
                poster="/media/quick-add-2026-10-12.webp"
                aria-label="Pocket quick-add keyboard shortcuts demonstration"
              >
                <source src="/media/quick-add-2026-10-12.mp4" type="video/mp4" />
                <a href="/media/quick-add-2026-10-12.mp4">Watch the quick-add demonstration</a>
              </video>
            </figure>
          </div>

          <div className="feature categories-feature" id="categories">
            <div className="copy">
              <h2>Categories, month by month.</h2>
              <p>
                See how much went to food, bills and other categories, and where your money came from. Switch
                between Month and All time, or click a category to see its entries.
              </p>
            </div>
            <figure className="categories-recording">
              <video
                controls
                muted
                playsInline
                preload="none"
                width={1540}
                height={1200}
                poster="/media/categories-2026-10-12.webp"
                aria-label="Pocket Categories: monthly spending, all-time totals, and purchases by category"
              >
                <source src="/media/categories-2026-10-12.mp4" type="video/mp4" />
                <a href="/media/categories-2026-10-12.mp4">Watch the Categories demonstration</a>
              </video>
            </figure>
          </div>
        </section>

        <section className="section wrap" id="private">
          <h2 className="two-tone">
            Free. <span>Every feature in it.</span>
            <br />
            <span>No account, and Pocket is</span> yours.
          </h2>
          <div className="local-default plan">
            <div className="local-copy">
              <h3>On your Mac</h3>
              <p>Download Pocket, enter your starting balance, and start recording. No account or server to set up.</p>
              <DownloadButton />
              <a className="feature-guide plan-guide" href="/guides/back-up-your-data/">
                Back up or move to a new Mac <span aria-hidden="true">→</span>
              </a>
            </div>
            <ul className="checks">
              <Check>Your money data stays in one file on your Mac</Check>
              <Check>Works offline</Check>
              <Check>Seven daily backups you can restore</Check>
              <Check>Export, import or erase any time</Check>
            </ul>
          </div>
          <details className="sync-details">
            <summary>
              <span>Optional: see your balance on your phone</span>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
            </summary>
            <div className="sync-content">
              <p>Sync requires a server you run, using a free Supabase project. Set it up when you want access from your phone or another computer.</p>
              <ul className="checks">
                <Check>The Pocket web app on your phone or any computer</Check>
                <Check>Pair a device with a 6-digit code</Check>
                <Check>Your Mac keeps a full copy and works offline</Check>
              </ul>
              <a className="pill pill-line" href={SELF_HOSTING_GUIDE_URL}>
                Read the self-hosting guide
              </a>
            </div>
          </details>
        </section>

        <section className="home-guides wrap" id="guides">
          <h2>A few useful things to start with.</h2>
          <p className="section-lead">Set up your balance, make everyday spending easier to record, and keep expected money in its place.</p>
          <GuideCards slugs={["getting-started", "quick-add-spending", "expected-income"]} />
          <a href="/guides/">All Pocket guides <span aria-hidden="true">↗</span></a>
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

      <SiteFooter />

      <DownloadDialog />
      <ButtonFx />
    </>
  );
}
