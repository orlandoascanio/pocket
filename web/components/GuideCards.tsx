import { GUIDES, guideUrl } from "@/lib/guides";

export function GuideCards({ slugs }: { slugs?: string[] }) {
  const guides = slugs ? slugs.map((slug) => GUIDES.find((guide) => guide.slug === slug)!) : GUIDES;
  return <div className="guide-list">
    {guides.map((guide, index) => <a className="guide-card" href={guideUrl(guide.slug)} key={guide.slug}>
      <span className="guide-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
      <div>
        <span className="guide-eyebrow">{guide.category} · {guide.minutes} min read</span>
        <h3>{guide.title}</h3>
        <p>{guide.description}</p>
      </div>
      <span className="guide-arrow" aria-hidden="true">↗</span>
    </a>)}
  </div>;
}
