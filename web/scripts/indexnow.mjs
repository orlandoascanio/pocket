// Tells IndexNow search engines (Bing, Yandex, Seznam, Naver) about every public page.
// Run after a production deploy: `npm run indexnow`. It reads the live sitemap, so it only
// submits pages that are actually deployed. Pass URLs as arguments to submit just those.
const SITE = "https://pocketleft.app";
// Public by design: engines fetch public/<key>.txt to confirm we own the host.
const KEY = "a449ec0ecfcef5fef41e8dab92e59ddd";

async function sitemapUrls() {
  const res = await fetch(`${SITE}/sitemap.xml`);
  if (!res.ok) throw new Error(`sitemap.xml returned ${res.status}`);
  return [...(await res.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
}

const keyFile = await fetch(`${SITE}/${KEY}.txt`);
if (!keyFile.ok || (await keyFile.text()).trim() !== KEY) {
  throw new Error(`${SITE}/${KEY}.txt is not live yet. Deploy first, then run this again.`);
}

const urlList = process.argv.length > 2 ? process.argv.slice(2) : await sitemapUrls();
const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: new URL(SITE).host, key: KEY, keyLocation: `${SITE}/${KEY}.txt`, urlList }),
});
// 200 and 202 both mean accepted; 202 means the key is still being validated.
if (res.status !== 200 && res.status !== 202) throw new Error(`IndexNow returned ${res.status}: ${await res.text()}`);
console.log(`IndexNow accepted ${urlList.length} URLs (HTTP ${res.status}).`);
