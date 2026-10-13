"use client";

import { useEffect, useRef } from "react";
import { DMG_SIZE, DOWNLOAD_URL, ISSUES_URL } from "@/lib/site";
import { MenuBarStrip } from "@/components/MenuBar";

// Any link marked `data-download` still downloads as usual; this also opens the install steps.
export function DownloadDialog() {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const link = (e.target as Element).closest?.("a[data-download]");
      if (!link || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      // Let the download start first, then show the steps.
      setTimeout(() => ref.current?.showModal(), 150);
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return (
    <dialog
      ref={ref}
      className="dl"
      aria-labelledby="dl-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) ref.current?.close();
      }}
    >
      <div className="dl-inner">
        <div className="dl-head">
          <div>
            <h2 id="dl-title">Almost there.</h2>
            <p>
              Pocket.dmg ({DMG_SIZE}) should be downloading. If it isn&apos;t,{" "}
              <a href={DOWNLOAD_URL}>download it here</a>.
            </p>
          </div>
          <div className="dl-actions">
            <a className="pill pill-soft" href={ISSUES_URL}>
              Report a problem
            </a>
            <button className="dl-close" type="button" aria-label="Close" onClick={() => ref.current?.close()}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
        </div>
        <ol className="dl-steps">
          <li>
            <div className="dl-art" aria-hidden="true">
              <div className="dl-file">
                <img src="/pocket-icon.webp" alt="" width={72} height={72} />
                <span className="dl-filename">Pocket.dmg</span>
                <span className="dl-size">{DMG_SIZE}</span>
              </div>
            </div>
            <span className="dl-step">Step 1</span>
            <h3>Open</h3>
            <p>Open Pocket.dmg from your Downloads folder.</p>
          </li>
          <li>
            <div className="dl-art" aria-hidden="true">
              <img className="dl-app" src="/pocket-icon.webp" alt="" width={84} height={84} />
              <svg className="dl-arrow" viewBox="0 0 48 24">
                <path d="M2 12h40M34 4l8 8-8 8" />
              </svg>
              <svg className="dl-folder" viewBox="0 0 96 76">
                <path d="M4 14a8 8 0 0 1 8-8h22l8 8h42a8 8 0 0 1 8 8v42a8 8 0 0 1-8 8H12a8 8 0 0 1-8-8Z" />
                <path className="dl-folder-a" d="M48 26 34 58M48 26l14 32M39 48h18" />
              </svg>
            </div>
            <span className="dl-step">Step 2</span>
            <h3>Install</h3>
            <p>Drag Pocket into your Applications folder.</p>
          </li>
          <li>
            <div className="dl-art" aria-hidden="true">
              <MenuBarStrip amount="$337.03" />
            </div>
            <span className="dl-step">Step 3</span>
            <h3>Launch</h3>
            <p>Open Pocket and type what you have now. From then on, it&apos;s in your menu bar.</p>
          </li>
        </ol>
      </div>
    </dialog>
  );
}
