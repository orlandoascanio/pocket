import { REPO_URL, SITE_URL } from "@/lib/site";

// Named entities reused across JSON-LD so search and answer engines can tie pages to one maker.
export const AUTHOR = {
  "@type": "Person",
  "@id": "https://www.orlandoascanio.com/#person",
  name: "Orlando Ascanio",
  url: "https://www.orlandoascanio.com",
  sameAs: ["https://github.com/orlandoascanio"],
};

// Other pages that describe this same app. Add Product Hunt, AlternativeTo, MacUpdate or a
// portfolio product page here once they exist: matching profiles are how AI engines learn they're one app.
export const PROFILES = [REPO_URL];

// "Pocket" is a crowded name, so say which Pocket this is.
export const ALTERNATE_NAMES = ["Pocket", "Pocket Left", "pocketleft"];
export const DISAMBIGUATION =
  "A free macOS menu bar app that shows how much money you have left, made by Orlando Ascanio at pocketleft.app. Not related to Mozilla Pocket, PocketGuard or Pocket Clear.";

export const PUBLISHER = {
  "@type": "Organization",
  "@id": `${SITE_URL}/#publisher`,
  name: "Pocket",
  url: `${SITE_URL}/`,
  logo: `${SITE_URL}/apple-touch-icon.png`,
  founder: { "@id": AUTHOR["@id"] },
  sameAs: PROFILES,
};
