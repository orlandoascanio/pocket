import type { CSSProperties } from "react";

// The same pocket-and-coin character as the app icon. Each instance names its own gradients,
// so `id` must be unique on the page.
export function PocketCharacter({
  id,
  mood,
  bubble,
  style,
  bubbleStyle,
}: {
  id: string;
  mood: "happy" | "excited";
  bubble: string;
  style?: CSSProperties;
  bubbleStyle?: CSSProperties;
}) {
  const coin = `${id}-coin`;
  const body = `${id}-body`;
  return (
    <div className="stage" aria-hidden="true" style={style}>
      <svg className="pocket" viewBox="0 0 1024 1024">
        <defs>
          <linearGradient id={coin} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FFE07A" />
            <stop offset="1" stopColor="#EBA83A" />
          </linearGradient>
          <linearGradient id={body} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FFFDF8" />
            <stop offset="1" stopColor="#ECE2CC" />
          </linearGradient>
        </defs>
        <g className="coin">
          <circle cx="596" cy="352" r="152" fill={`url(#${coin})`} />
          <circle cx="596" cy="352" r="120" fill="none" stroke="#C4851F" strokeWidth="14" opacity=".5" />
          <text x="596" y="404" textAnchor="middle" fontFamily="-apple-system, Helvetica, Arial, sans-serif" fontWeight="800" fontSize="156" fill="#B0701A">
            $
          </text>
        </g>
        <path d="M232 420H792V676Q792 712 760 728L540 836Q512 850 484 836L264 728Q232 712 232 676Z" fill={`url(#${body})`} />
        {mood === "happy" && <rect x="232" y="420" width="560" height="12" fill="#000" opacity=".07" />}
        <path d="M274 468H750V662Q750 688 727 700L526 798Q512 805 498 798L297 700Q274 688 274 662Z" fill="none" stroke="#C7B086" strokeWidth="10" strokeDasharray="26 18" strokeLinecap="round" />
        <ellipse cx="392" cy="650" rx="30" ry="15" fill="#F4A6A0" opacity=".55" />
        <ellipse cx="632" cy="650" rx="30" ry="15" fill="#F4A6A0" opacity=".55" />
        {mood === "happy" ? (
          <>
            <circle cx="442" cy="588" r="24" fill="#3B2A1A" />
            <circle cx="582" cy="588" r="24" fill="#3B2A1A" />
            <circle cx="450" cy="580" r="8" fill="#fff" />
            <circle cx="590" cy="580" r="8" fill="#fff" />
          </>
        ) : (
          <>
            <path d="M442 560Q448 584 472 588Q448 592 442 616Q436 592 412 588Q436 584 442 560Z" fill="#3B2A1A" />
            <path d="M582 560Q588 584 612 588Q588 592 582 616Q576 592 552 588Q576 584 582 560Z" fill="#3B2A1A" />
          </>
        )}
        <path d="M480 650Q512 680 544 650" fill="none" stroke="#3B2A1A" strokeWidth="12" strokeLinecap="round" />
      </svg>
      <span className="bubble" style={bubbleStyle}>
        {bubble}
      </span>
    </div>
  );
}
