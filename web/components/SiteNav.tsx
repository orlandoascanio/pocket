"use client";

import { useEffect, useState } from "react";
import { DOWNLOAD_URL, REPO_URL } from "@/lib/site";

// A floating pill. The Download button joins it once the hero's own button has scrolled away.
export function SiteNav() {
  const [past, setPast] = useState(false);

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

  return (
    <header className="nav-shell">
      <nav className="nav" aria-label="Main">
        <a className="brand" href="/">
          <img src="/apple-touch-icon.png" alt="" width={28} height={28} />
          Pocket <span className="brand-sub">Mac</span>
        </a>
        <div className="nav-links">
          <a href="#tour">Features</a>
          <a href="#plan">Plan ahead</a>
          <a href="#private">Privacy</a>
          <a href="#faq">FAQ</a>
          <a href={REPO_URL}>Source</a>
        </div>
        <a className="nav-cta" data-download data-shown={past || undefined} href={DOWNLOAD_URL}>
          Download
        </a>
      </nav>
    </header>
  );
}
