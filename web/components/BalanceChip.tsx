"use client";

import { gsap } from "gsap";
import { useEffect, useRef, useState } from "react";

const START = 337.03;
// A small made-up month. Each round nets to zero, so the loop never drifts, and every balance
// on the way stays in three digits so the chip keeps its width.
const FEED: [string, number][] = [
  ["Coffee", -6.5],
  ["Lunch", -13.5],
  ["Client A", 250],
  ["AI subscription", -20],
  ["Groceries", -46.8],
  ["Phone", -45],
  ["Dinner", -38.2],
  ["Books", -80],
];

const money = (n: number) => `$${Math.abs(n).toFixed(2)}`;

// The nav's right side before Download joins it: Pocket's menu bar item, living a little.
// Every few seconds a payment drops out of it and the balance rolls to match.
export function BalanceChip({ off }: { off: boolean }) {
  const amount = useRef<HTMLSpanElement>(null);
  const chip = useRef<HTMLSpanElement>(null);
  const balance = useRef({ v: 0, i: 0 });
  const [tx, setTx] = useState<{ what: string; delta: number; n: number } | null>(null);

  useEffect(() => {
    const el = amount.current;
    const box = chip.current;
    if (!el || !box) return;
    const b = balance.current;
    const render = () => (el.textContent = money(b.v));
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      b.v = START;
      render();
      return;
    }
    if (off) return;

    let next: gsap.core.Tween;
    function step() {
      const [what, delta] = FEED[b.i % FEED.length];
      b.i++;
      setTx({ what, delta, n: b.i });
      box!.dataset.dir = delta > 0 ? "in" : "out";
      gsap.to(b, {
        v: Math.round((b.v + delta) * 100) / 100,
        duration: 1.1,
        delay: 0.3,
        ease: "power3.inOut",
        onUpdate: render,
        onComplete: () => void delete box!.dataset.dir,
      });
      next = gsap.delayedCall(4.2, step);
    }
    // The first time in, the balance counts up from zero (or from wherever an interrupted count
    // stopped); after that it picks up where it was.
    if (b.i === 0) {
      gsap.to(b, { v: START, duration: 1.6, delay: 0.6, ease: "power3.out", onUpdate: render });
      next = gsap.delayedCall(4, step);
    } else next = gsap.delayedCall(1.5, step);
    return () => {
      next.kill();
      gsap.killTweensOf(b);
      delete box.dataset.dir;
      b.v = Math.round(b.v * 100) / 100;
    };
  }, [off]);

  return (
    <span className="nav-chip" ref={chip} data-off={off || undefined} aria-hidden="true">
      <span className="nav-chip-dot" />
      <span className="nav-chip-amount" ref={amount}>
        {money(0)}
      </span>
      {tx && (
        <span className="nav-chip-tx" key={tx.n} data-in={tx.delta > 0 || undefined}>
          {tx.what} <b>{(tx.delta > 0 ? "+" : "−") + money(tx.delta)}</b>
        </span>
      )}
    </span>
  );
}
