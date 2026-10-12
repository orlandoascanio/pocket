"use client";

import { gsap } from "gsap";
import { useEffect, useRef, useState } from "react";
import { DOWNLOAD_URL, REPO_URL } from "@/lib/site";

const LINKS = [
  { href: "#tour", label: "Features" },
  { href: "#plan", label: "Plan ahead" },
  { href: "#private", label: "Privacy" },
  { href: "#faq", label: "FAQ" },
  { href: REPO_URL, label: "Source" },
];

// A floating pill. The Download button joins it once the hero's own button has scrolled away.
// One highlight slides between the links: it follows the pointer, and otherwise rests on the
// section you're reading.
export function SiteNav() {
  const [past, setPast] = useState(false);
  const [section, setSection] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const links = useRef<HTMLDivElement>(null);
  const hl = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const target = document.getElementById("hero-cta");
    if (!target) return;
    // The top margin is the nav's height, so the button counts as gone once it slides under the nav.
    const io = new IntersectionObserver(([e]) => setPast(!e.isIntersecting && e.boundingClientRect.top < 80), {
      rootMargin: "-80px 0px 0px 0px",
    });
    io.observe(target);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    // A section is current while it crosses a thin band just above the middle of the screen.
    const sections = LINKS.flatMap((l) => (l.href.startsWith("#") ? [document.querySelector(l.href)] : []));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setSection(`#${e.target.id}`);
          else if (e.boundingClientRect.top > 0) setSection((s) => (s === `#${e.target.id}` ? null : s));
        }
      },
      { rootMargin: "-40% 0px -55% 0px" },
    );
    sections.forEach((s) => s && io.observe(s));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const box = links.current;
    const pill = hl.current;
    if (!box || !pill) return;
    const on = hover ?? section;
    const link = on ? box.querySelector<HTMLElement>(`a[href="${on}"]`) : null;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!link) {
      gsap.to(pill, { opacity: 0, scale: 0.9, duration: reduce ? 0 : 0.25, ease: "power2.out" });
      return;
    }
    const to = { x: link.offsetLeft, width: link.offsetWidth };
    // Coming from hidden it appears in place; from another link it slides over.
    if (+gsap.getProperty(pill, "opacity") < 0.05) gsap.set(pill, to);
    gsap.to(pill, { ...to, opacity: 1, scale: 1, duration: reduce ? 0 : 0.5, ease: "expo.out", overwrite: true });
  }, [hover, section]);

  return (
    <header className="nav-shell">
      <nav className="nav" aria-label="Main">
        <a className="brand" href="/">
          <img src="/apple-touch-icon.png" alt="" width={28} height={28} />
          Pocket <span className="brand-sub">Mac</span>
        </a>
        <div className="nav-links" ref={links} onPointerLeave={() => setHover(null)}>
          <span className="nav-hl" ref={hl} aria-hidden="true" />
          {LINKS.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              aria-current={href === section ? "location" : undefined}
              onPointerEnter={() => setHover(href)}
              onFocus={() => setHover(href)}
              onBlur={() => setHover(null)}
            >
              {label}
            </a>
          ))}
        </div>
        <a className="nav-cta" data-download data-shown={past || undefined} href={DOWNLOAD_URL}>
          <DownloadIcon />
          Download
        </a>
      </nav>
    </header>
  );
}

export function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path className="i-arrow" d="M12 4v11M7 10l5 5 5-5" />
      <path d="M5 20h14" />
    </svg>
  );
}
