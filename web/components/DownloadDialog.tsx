"use client";

import { useEffect, useRef } from "react";
import { DMG_SIZE, DOWNLOAD_URL, ISSUES_URL } from "@/lib/site";
import { MenuBarStrip } from "@/components/MenuBar";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// Any link marked `data-download` still downloads as usual; this also opens the install steps.
// The dialog grows out of the button that was pressed and shrinks back into it when it closes,
// along the same path. Closing mid-open (or opening mid-close) turns around from wherever it is.
export function DownloadDialog() {
  const ref = useRef<HTMLDialogElement>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const anim = useRef<Animation | null>(null);

  // The transform that puts the dialog small and centred on the button it came from.
  function collapsed(d: HTMLDialogElement) {
    const o = origin.current;
    const r = d.getBoundingClientRect();
    if (!o || !r.width) return "translate(0, 16px) scale(.97)";
    const dx = o.x - (r.left + r.width / 2);
    const dy = o.y - (r.top + r.height / 2);
    return `translate(${dx}px, ${dy}px) scale(.2)`;
  }

  // The dimmed page behind fades with the dialog. `from` null means "from where it is now".
  const backdrop = useRef<Animation | null>(null);
  function fadeBackdrop(d: HTMLDialogElement, from: number | null, to: number, duration: number) {
    try {
      const now = from ?? +getComputedStyle(d, "::backdrop").opacity;
      backdrop.current?.cancel();
      backdrop.current = d.animate({ opacity: [now, to] }, { duration, easing: "ease-out", fill: "forwards", pseudoElement: "::backdrop" });
      if (to === 1) backdrop.current.onfinish = () => backdrop.current?.cancel();
    } catch {
      // Browsers that can't animate ::backdrop just show and hide it.
    }
  }

  function open(from: Element) {
    const d = ref.current;
    if (!d) return;
    const b = from.getBoundingClientRect();
    origin.current = { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    const running = anim.current;
    if (!d.open) d.showModal();
    else if (!running) return;
    // Start from what's on screen now, so a reopen during the close turns around in place.
    const { transform, opacity } = getComputedStyle(d);
    running?.cancel();
    if (reduced()) {
      anim.current = d.animate({ opacity: [running ? opacity : "0", "1"] }, { duration: 180, easing: "ease-out" });
    } else {
      anim.current = d.animate(
        { transform: [running ? transform : collapsed(d), "none"], opacity: [running ? opacity : "0", "1"] },
        { duration: 520, easing: "cubic-bezier(.16, 1, .3, 1)" },
      );
    }
    fadeBackdrop(d, running ? null : 0, 1, reduced() ? 180 : 400);
    anim.current.onfinish = () => (anim.current = null);
  }

  function close() {
    const d = ref.current;
    if (!d?.open) return;
    const { transform, opacity } = getComputedStyle(d);
    anim.current?.cancel();
    const a = reduced()
      ? d.animate({ opacity: [opacity, "0"] }, { duration: 150, easing: "ease-in", fill: "forwards" })
      : d.animate(
          { transform: [transform, collapsed(d)], opacity: [opacity, "0"] },
          // Same path as the way in, but moving from the first frame: a strong ease-in would sit
          // still for the first 100ms and read as lag.
          { duration: 320, easing: "cubic-bezier(.4, 0, .2, 1)", fill: "forwards" },
        );
    anim.current = a;
    fadeBackdrop(d, null, 0, reduced() ? 150 : 320);
    a.onfinish = () => {
      d.close();
      a.cancel();
      backdrop.current?.cancel();
      anim.current = null;
    };
  }

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const link = (e.target as Element).closest?.("a[data-download]");
      if (!link || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      // The link's own navigation still starts the download; the steps open on the next frame.
      requestAnimationFrame(() => open(link));
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return (
    <dialog
      ref={ref}
      className="dl"
      aria-labelledby="dl-title"
      onCancel={(e) => {
        // Escape: animate out instead of vanishing.
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
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
            <button className="dl-close" type="button" aria-label="Close" onClick={close}>
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
