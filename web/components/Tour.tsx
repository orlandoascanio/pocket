"use client";

import Image from "next/image";
import { useState } from "react";
import { MenuBarStrip, MenuPanel } from "@/components/MenuBar";
import overview from "@/public/screenshot-overview.png";
import plan from "@/public/screenshot-plan.png";

const VIEWS = [
  { id: "menu", label: "Menu bar", caption: "One click from anywhere, all day." },
  { id: "overview", label: "Overview", caption: "What came in, what went out." },
  { id: "plan", label: "Plan", caption: "Where your balance is heading." },
] as const;

export function Tour() {
  const [view, setView] = useState<(typeof VIEWS)[number]["id"]>("menu");
  const current = VIEWS.find((v) => v.id === view)!;

  return (
    <div className="tour">
      <div className="tour-stage" id="tour-panel" role="tabpanel" aria-label={current.label}>
        {view === "menu" && (
          <div className="tour-menu">
            <Image className="tour-behind" src={overview} sizes="(max-width: 720px) 0px, 620px" alt="" />
            <MenuBarStrip amount="$337.03" />
            <MenuPanel />
          </div>
        )}
        {view === "overview" && (
          <Image
            className="tour-shot"
            src={overview}
            sizes="(max-width: 1080px) 100vw, 1000px"
            alt="Pocket's main window: the balance, quick-add buttons, a form to add an entry, a payment waiting to be confirmed, and history."
          />
        )}
        {view === "plan" && (
          <Image
            className="tour-shot"
            src={plan}
            sizes="(max-width: 1080px) 100vw, 1000px"
            alt="The Plan view: a step chart of the projected balance and the list of payments coming up."
          />
        )}
      </div>
      <div className="tour-bar">
        <p className="tour-caption">
          <b>{current.label}</b> <i>{current.caption}</i>
        </p>
        <div className="tour-tabs" role="tablist" aria-label="Views">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={v.id === view}
              aria-controls="tour-panel"
              onClick={() => setView(v.id)}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
