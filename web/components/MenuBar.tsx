import type { ReactNode } from "react";

// A slice of the macOS menu bar with Pocket's balance item highlighted.
export function MenuBarStrip({ amount, children }: { amount?: string; children?: ReactNode }) {
  return (
    <div className="mb">
      <span className="mb-item mb-pocket">{children ?? amount}</span>
      <svg className="mb-glyph" viewBox="0 0 20 14" aria-hidden="true">
        <path d="M10 12.5 1.6 5.2a12 12 0 0 1 16.8 0Z" />
      </svg>
      <svg className="mb-glyph mb-battery" viewBox="0 0 26 12" aria-hidden="true">
        <rect x=".75" y=".75" width="21.5" height="10.5" rx="3" fill="none" strokeWidth="1.2" />
        <rect x="2.5" y="2.5" width="15" height="7" rx="1.6" />
        <rect x="23.4" y="4" width="1.8" height="4" rx=".9" />
      </svg>
      <span className="mb-item mb-clock">Mon 9:41</span>
    </div>
  );
}

// The panel that drops from the menu bar, rebuilt in HTML from the app's layout (MenuPanel.swift).
export function MenuPanel() {
  return (
    <div className="mp">
      <div className="mp-label">Money left</div>
      <div className="mp-amount">$337.03</div>
      <div className="mp-lasts">
        <svg viewBox="0 0 20 16" aria-hidden="true">
          <path d="M2 14h16M3 11l4-4 3 3 7-7" />
        </svg>
        Lasts past <b>Jan 10</b>
        <span className="mp-chev" aria-hidden="true">›</span>
      </div>
      <div className="mp-chips">
        <span className="chip">Coffee <span className="muted">−$6.50</span></span>
        <span className="chip">Gift</span>
      </div>
      <div className="mp-composer">
        <div className="mp-amount-row">
          <span className="mp-sign" aria-hidden="true">−</span>
          <span className="mp-zero">$ 0.00</span>
        </div>
        <div className="mp-what-row">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M2.5 8.6V3.2a.7.7 0 0 1 .7-.7h5.4l5 5a.9.9 0 0 1 0 1.3l-4.1 4.1a.9.9 0 0 1-1.3 0Z" />
            <circle cx="5.6" cy="5.6" r=".9" />
          </svg>
          What was it for?
        </div>
        <div className="mp-more">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <rect x="2.5" y="3.5" width="11" height="10" rx="2" />
            <path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" />
          </svg>
          Date &amp; repeat
        </div>
      </div>
      <div className="mp-notice">
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="6.5" />
          <path d="M8 4.5V8l2.2 1.6" />
        </svg>
        1 payment is waiting for you
        <span className="mp-chev" aria-hidden="true">›</span>
      </div>
      <div className="mp-head">
        <span>Recent</span>
        <span className="mp-all">See All</span>
      </div>
      <div className="mp-row">
        <span className="mp-ic">☕</span>
        <span className="mp-what">
          Coffee<small>Food · Today</small>
        </span>
        <span className="mp-val">−$6.50</span>
      </div>
      <div className="mp-row">
        <span className="mp-ic mp-ic-in">↓</span>
        <span className="mp-what">
          Paycheck<small>Pay · Oct 9</small>
        </span>
        <span className="mp-val mp-in">+$1,200.00</span>
      </div>
      <div className="mp-foot">
        <span>$127.98 spent this month</span>
        <span className="mp-foot-icons" aria-hidden="true">
          <svg viewBox="0 0 16 16"><path d="M9.5 2.5h4v4M13.5 2.5 9 7M6.5 13.5h-4v-4M2.5 13.5 7 9" /></svg>
          <svg viewBox="0 0 16 16"><circle cx="3.5" cy="8" r="1.1" /><circle cx="8" cy="8" r="1.1" /><circle cx="12.5" cy="8" r="1.1" /></svg>
        </span>
      </div>
    </div>
  );
}
