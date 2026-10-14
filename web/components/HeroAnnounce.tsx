"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

// /share/ is the homepage reached from someone's "Share Pocket…" link. It greets the visitor
// in place of the release announcement; everything else on the page stays the same.
export function HeroAnnounce({ children }: { children: ReactNode }) {
  if (usePathname() !== "/share/") return children;
  return (
    <p className="announce">
      <span className="announce-tag">Shared</span>
      <span className="announce-text">A friend thought you’d like Pocket.</span>
    </p>
  );
}
