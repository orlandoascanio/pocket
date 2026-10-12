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

// The panel that drops from the menu bar, rebuilt in HTML from the app's layout.
export function MenuPanel() {
  return (
    <div className="mp">
      <div className="mp-top">
        <div>
          <div className="mp-label">Money left</div>
          <div className="mp-amount">$337.03</div>
          <div className="mp-sub">This month: $127.98 spent</div>
          <div className="mp-lasts">
            <svg viewBox="0 0 20 16" aria-hidden="true">
              <path d="M2 14h16M3 11l4-4 3 3 7-7" />
            </svg>
            Lasts past <b>Jan 10</b>
          </div>
        </div>
      </div>
      <div className="mp-chips">
        <span className="chip">Coffee <span className="muted">−$6.50</span></span>
        <span className="chip">Gift</span>
      </div>
      <div className="mp-seg">
        <span className="on">Spent</span>
        <span>Got money</span>
      </div>
      <div className="mp-entry">
        <span className="mp-field mp-amt">0.00</span>
        <span className="mp-field">What was it?</span>
        <span className="mp-add">Add</span>
      </div>
      <div className="mp-notice">
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="6.5" />
          <path d="M8 4.5V8l2.2 1.6" />
        </svg>
        1 payment waiting for you
      </div>
      <div className="mp-head">Recent</div>
      <div className="mp-row">
        <span className="mp-ic">☕</span>
        <span className="mp-what">
          Coffee<small>Today</small>
        </span>
        <span className="mp-val">−$6.50</span>
      </div>
      <div className="mp-row">
        <span className="mp-ic mp-ic-in">↓</span>
        <span className="mp-what">
          Paycheck<small>Fri, Oct 9</small>
        </span>
        <span className="mp-val mp-in">+$1,200.00</span>
      </div>
      <div className="mp-foot">
        <span>Open Pocket</span>
        <span>Settings</span>
        <span className="mp-quit">Quit</span>
      </div>
    </div>
  );
}
