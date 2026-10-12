"use client";

import { useEffect, useState } from "react";

// Types each word, holds it, then erases it. Every word sits invisibly in the same grid cell,
// so the slot is always as wide as the longest one and the headline never shifts.
export function TypedWord({ words }: { words: string[] }) {
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState(words[0].length);
  const [erasing, setErasing] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const word = words[index];
    let delay = erasing ? 45 : 85;
    if (!erasing && shown === word.length) delay = 2200;
    const t = setTimeout(() => {
      if (!erasing && shown === word.length) setErasing(true);
      else if (erasing && shown === 0) {
        setErasing(false);
        setIndex((index + 1) % words.length);
      } else setShown(shown + (erasing ? -1 : 1));
    }, delay);
    return () => clearTimeout(t);
  }, [words, index, shown, erasing]);

  return (
    <span className="typed" aria-hidden="true">
      {words.map((w) => (
        <span key={w} className="typed-size">
          {w}
        </span>
      ))}
      <span className="typed-word">
        {words[index].slice(0, shown)}
        <span className="typed-caret" />
      </span>
    </span>
  );
}
