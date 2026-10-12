"use client";

import type { MouseEvent } from "react";

type Item = { q: string; a: string; link?: { href: string; label: string } };

const running = new WeakMap<HTMLElement, Animation[]>();

// <details> can't animate its own open and close, so the summary click is taken over: the body's
// height tweens from wherever it is right now (clicking again mid-animation reverses from there),
// and `open` only drops once the close has finished. Without JS, or with reduced motion, it's a
// plain <details>, and find-in-page still opens it.
function toggle(e: MouseEvent<HTMLElement>) {
  const details = e.currentTarget.parentElement as HTMLDetailsElement;
  const body = details.querySelector<HTMLElement>(".faq-body");
  const text = body?.firstElementChild as HTMLElement | null;
  if (!body || !text || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  e.preventDefault();

  const closing = details.open && !details.hasAttribute("data-closing");
  // A closed <details> can still report its body's last laid-out size, so closed means 0.
  const height = details.open ? body.getBoundingClientRect().height : 0;
  const { opacity, transform, filter } = getComputedStyle(text);
  running.get(body)?.forEach((a) => a.cancel());

  if (closing) {
    details.setAttribute("data-closing", "");
    const ease = { duration: 340, easing: "cubic-bezier(.4, 0, .2, 1)", fill: "forwards" } as const;
    const anims = [
      body.animate({ height: [`${height}px`, "0px"] }, ease),
      text.animate({ opacity: [opacity, "0"], transform: [transform, "translateY(-4px)"], filter: [filter, "blur(2px)"] }, { ...ease, duration: 220 }),
    ];
    running.set(body, anims);
    anims[0].onfinish = () => {
      details.open = false;
      details.removeAttribute("data-closing");
      anims.forEach((a) => a.cancel());
      running.delete(body);
    };
  } else {
    details.removeAttribute("data-closing");
    details.open = true;
    const fresh = height === 0;
    const ease = { duration: 560, easing: "cubic-bezier(.16, 1, .3, 1)" };
    const anims = [
      body.animate({ height: [`${height}px`, `${body.scrollHeight}px`] }, ease),
      text.animate(
        fresh
          ? { opacity: [0, 1], transform: ["translateY(10px)", "none"], filter: ["blur(4px)", "blur(0)"] }
          : { opacity: [opacity, "1"], transform: [transform, "none"], filter: [filter, "blur(0)"] },
        { ...ease, delay: fresh ? 70 : 0, fill: "backwards" },
      ),
    ];
    running.set(body, anims);
    anims[0].onfinish = () => running.delete(body);
  }
}

export function Faq({ items }: { items: Item[] }) {
  return (
    <div className="faq">
      {items.map(({ q, a, link }) => (
        <details key={q}>
          <summary onClick={toggle}>
            {q}
            <span className="faq-icon" aria-hidden="true" />
          </summary>
          <div className="faq-body">
            <p>
              {a}
              {link && (
                <>
                  {" "}
                  <a href={link.href}>{link.label}</a>.
                </>
              )}
            </p>
          </div>
        </details>
      ))}
    </div>
  );
}
