import { REPO_URL, SITE_URL } from "@/lib/site";

// Named entities reused across JSON-LD so search and answer engines can tie pages to one maker.
export const AUTHOR = {
  "@type": "Person",
  "@id": "https://www.orlandoascanio.com/#person",
  name: "Orlando Ascanio",
  url: "https://www.orlandoascanio.com",
};

export const PUBLISHER = {
  "@type": "Organization",
  "@id": `${SITE_URL}/#publisher`,
  name: "Pocket",
  url: `${SITE_URL}/`,
  logo: `${SITE_URL}/apple-touch-icon.png`,
  founder: { "@id": AUTHOR["@id"] },
  sameAs: [REPO_URL],
};
