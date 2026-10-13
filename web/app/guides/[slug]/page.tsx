import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { GuideCards } from "@/components/GuideCards";
import { GuideFooter } from "@/components/GuideFooter";
import { DownloadDialog } from "@/components/DownloadDialog";
import { DownloadIcon, SiteNav } from "@/components/SiteNav";
import { GUIDES, guideUrl } from "@/lib/guides";
import { DOWNLOAD_URL, SELF_HOSTING_URL, SITE_URL } from "@/lib/site";
import "../guides.css";

export const dynamicParams = false;
export function generateStaticParams() { return GUIDES.map(({ slug }) => ({ slug })); }

function findGuide(slug: string) { return GUIDES.find((guide) => guide.slug === slug) ?? notFound(); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const guide = findGuide((await params).slug);
  const title = `${guide.title} · Pocket`;
  return {
    title, description: guide.description,
    alternates: { canonical: guideUrl(guide.slug) },
    openGraph: { type: "article", title, description: guide.description, url: guideUrl(guide.slug), modifiedTime: guide.updated, images: [{ url: guide.image, alt: guide.imageAlt }] },
    twitter: { card: "summary_large_image", title, description: guide.description, images: [guide.image] },
  };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const guide = findGuide((await params).slug);
  const schema = [
    { "@context": "https://schema.org", "@type": "Article", headline: guide.title, description: guide.description, dateModified: guide.updated, image: `${SITE_URL}${guide.image}`, mainEntityOfPage: `${SITE_URL}${guideUrl(guide.slug)}` },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Pocket", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Guides", item: `${SITE_URL}/guides/` },
      { "@type": "ListItem", position: 3, name: guide.title, item: `${SITE_URL}${guideUrl(guide.slug)}` },
    ] },
  ];
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
    <SiteNav />
    <main className="wrap guide-page">
      <nav className="guide-breadcrumb" aria-label="Breadcrumb"><a href="/">Pocket</a><span aria-hidden="true">/</span><a href="/guides/">Guides</a><span aria-hidden="true">/</span><span aria-current="page">{guide.category}</span></nav>
      <article>
        <header className="guide-header">
          <p className="guide-eyebrow">{guide.category} · {guide.minutes} min read</p>
          <h1>{guide.title}</h1>
          <p className="guide-lead">{guide.description}</p>
          <p className="guide-date">Updated <time dateTime={guide.updated}>October 13, 2026</time></p>
        </header>
        <div className="guide-reading-layout">
          <nav className="guide-toc" aria-label="On this page"><p>On this page</p>{guide.sections.map((section) => <a href={`#${section.id}`} key={section.id}>{section.title}</a>)}</nav>
          <div className="guide-body">
            <figure className="guide-media">
              {guide.video ? <video controls muted playsInline preload="none" poster={guide.poster ?? guide.image} aria-label={guide.imageAlt}>
                <source src={guide.video} type="video/mp4" /><a href={guide.video}>Watch the quick-add demonstration</a>
              </video> : <Image src={guide.image} alt={guide.imageAlt} width={1600} height={1283} sizes="(max-width: 760px) calc(100vw - 48px), (max-width: 1100px) 65vw, 720px" />}
              <figcaption>{guide.video ? "Recorded in Pocket for Mac." : "Pocket for Mac with example data."}</figcaption>
            </figure>
            {guide.sections.map((section) => <section id={section.id} key={section.id}>
              <h2>{section.title}</h2>
              {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              {section.steps && <ol>{section.steps.map((step) => <li key={step}>{step}</li>)}</ol>}
              {section.table && <div className="guide-table-wrap" tabIndex={0} role="region" aria-label={section.table.caption}>
                <table><caption>{section.table.caption}</caption><thead><tr>{section.table.headings.map((heading) => <th scope="col" key={heading}>{heading}</th>)}</tr></thead><tbody>{section.table.rows.map((row) => <tr key={row[0]}>{row.map((cell, index) => index === 0 ? <th scope="row" key={index}>{cell}</th> : <td key={index}>{cell}</td>)}</tr>)}</tbody></table>
              </div>}
              {section.note && <aside className="guide-note">{section.note}</aside>}
            </section>)}
            {guide.slug === "back-up-your-data" && <p><a href={SELF_HOSTING_URL}>Read the self-hosting and device-pairing instructions</a></p>}
          </div>
        </div>
      </article>
      <section className="guide-related"><h2>Keep going</h2><GuideCards slugs={guide.related} /></section>
      <section className="guide-download">
        <div><h2>Try it with your own entries.</h2><p>Free for macOS 14 or later. Your money stays on your Mac by default.</p></div>
        <a className="pill pill-dark" href={DOWNLOAD_URL} data-download><DownloadIcon />Download for Mac</a>
      </section>
    </main>
    <GuideFooter />
    <DownloadDialog />
  </>;
}
