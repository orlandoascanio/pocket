import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// AI crawlers are named so the policy is a decision, not a default. Search and user-triggered
// fetchers make Pocket citable in AI answers; the training crawlers (GPTBot, ClaudeBot,
// Google-Extended, Applebot-Extended) are allowed too. Move any of them to `disallow` to opt out
// of model training without affecting citations.
const AI_AGENTS = [
  "OAI-SearchBot", "ChatGPT-User", "Claude-SearchBot", "Claude-User", "PerplexityBot", "Perplexity-User",
  "GPTBot", "ClaudeBot", "Google-Extended", "Applebot-Extended",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/" }, { userAgent: AI_AGENTS, allow: "/" }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
