"use client";

import { gsap } from "gsap";
import { useEffect } from "react";

const SEL = ".pill, .nav-cta";

// Pills lean a few pixels toward the pointer, with a soft light under it, and spring back when it
// leaves. Delegated from the document, so pills in the download dialog count too. Mouse and
// trackpad only, and nothing at all with reduced motion.
export function ButtonFx() {
  useEffect(() => {
    if (!matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)").matches) return;

    let el: HTMLElement | null = null;
    let rect: DOMRect;
    let toX: gsap.QuickToFunc, toY: gsap.QuickToFunc;
    // GSAP tweens a plain object and the pill reads it as --tx/--ty. Tweening the element itself
    // would have GSAP reset its `scale` and `translate`, which the CSS press and reveal rely on.
    const pulls = new WeakMap<HTMLElement, { x: number; y: number }>();

    function pull(target: HTMLElement) {
      let p = pulls.get(target);
      if (!p) pulls.set(target, (p = { x: 0, y: 0 }));
      const apply = () => {
        target.style.setProperty("--tx", `${p.x}px`);
        target.style.setProperty("--ty", `${p.y}px`);
      };
      return { p, apply };
    }

    function grab(next: HTMLElement) {
      el = next;
      const { p, apply } = pull(el);
      gsap.killTweensOf(p);
      // Measured without the pull, so the pull doesn't feed back into itself.
      rect = el.getBoundingClientRect();
      rect = new DOMRect(rect.x - p.x, rect.y - p.y, rect.width, rect.height);
      toX = gsap.quickTo(p, "x", { duration: 0.5, ease: "power3.out", onUpdate: apply });
      toY = gsap.quickTo(p, "y", { duration: 0.5, ease: "power3.out", onUpdate: apply });
    }

    function release() {
      if (!el) return;
      const { p, apply } = pull(el);
      gsap.killTweensOf(p);
      // Settles without overshoot: the pointer just left, nothing was thrown, so there's no
      // momentum for a wobble to express.
      gsap.to(p, { x: 0, y: 0, duration: 0.5, ease: "power3.out", onUpdate: apply });
      el = null;
    }

    function onMove(e: PointerEvent) {
      const hit = (e.target as Element).closest?.<HTMLElement>(SEL) ?? null;
      if (hit !== el) {
        release();
        if (hit) grab(hit);
      }
      if (!el) return;
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      toX(((px - rect.width / 2) / (rect.width / 2)) * 6);
      toY(((py - rect.height / 2) / (rect.height / 2)) * 4);
      el.style.setProperty("--mx", `${px}px`);
      el.style.setProperty("--my", `${py}px`);
    }

    document.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", release);
    window.addEventListener("scroll", release, { passive: true });
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", release);
      window.removeEventListener("scroll", release);
    };
  }, []);

  return null;
}
