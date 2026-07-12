const express = require("express");
const axios = require("axios");
const requireAdmin = require("../middleware/requireAdmin");

const router = express.Router();

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const AI_MODEL = process.env.AI_MODEL || "claude-sonnet-5";

// Pull the plain-text parts out of an Anthropic API response (it also returns
// tool_use / server_tool_use / web_search_tool_result blocks when web search runs)
function extractText(content) {
  return (content || [])
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

// The model is asked to answer with JSON only, but strip stray code fences just in case
function parseJsonResponse(text) {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  return JSON.parse(cleaned);
}

async function callClaude({ system, prompt, useWebSearch = true, maxTokens = 1500 }) {
  if (!process.env.ANTHROPIC_API_KEY) {
    const err = new Error(
      "AI features aren't configured yet. Add ANTHROPIC_API_KEY to your .env file (get one at https://console.anthropic.com)."
    );
    err.code = "NO_API_KEY";
    throw err;
  }

  const body = {
    model: AI_MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: prompt }],
  };
  if (useWebSearch) {
    body.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 4 }];
  }

  const res = await axios.post(ANTHROPIC_API_URL, body, {
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    timeout: 45000,
  });

  return { text: extractText(res.data.content), content: res.data.content || [] };
}

// Pull the real URLs/titles the model actually looked at out of the web_search_tool_result
// blocks (NOT model-written text), so the "related news" links we show are genuine, not guessed.
function extractNewsLinks(content, limit = 6) {
  const seen = new Set();
  const links = [];
  for (const block of content || []) {
    if (block.type !== "web_search_tool_result") continue;
    const results = Array.isArray(block.content) ? block.content : [];
    for (const item of results) {
      if (item.type !== "web_search_result" || !item.url) continue;
      if (seen.has(item.url)) continue;
      seen.add(item.url);
      let source = "";
      try { source = new URL(item.url).hostname.replace(/^www\./, ""); } catch {}
      links.push({ title: item.title || item.url, url: item.url, source });
      if (links.length >= limit) return links;
    }
  }
  return links;
}

// ---------- 1. Suggest a title/description/bullets/front-image for ONE product ----------
// Body: { query (required — product name/niche or the current draft title),
//         category, existing_images: [url, ...] }
router.post("/admin/ai/suggest-product", requireAdmin, async (req, res) => {
  const { query, category, existing_images } = req.body;
  if (!query || !query.trim()) {
    return res.status(400).json({ error: "Give the AI a product name or topic to work from." });
  }

  const images = Array.isArray(existing_images) ? existing_images.filter(Boolean).slice(0, 5) : [];

  const system = `You are an e-commerce copywriter and merchandiser for an affiliate marketing site called WolfHustler that sells men's lifestyle products (watches, fashion, fragrances, travel gear) via Amazon affiliate links. You research current shopping trends using web search, then write Amazon-style listing copy: a punchy title, a short one-line description, and short feature bullets. You always answer with ONLY a raw JSON object — no markdown, no code fences, no commentary before or after.`;

  const prompt = `Product / niche to research: "${query.trim()}"
Category: ${category || "uncategorized"}
${images.length ? `The admin already has ${images.length} candidate image URL(s) for this listing, in this order:\n${images.map((u, i) => `${i}: ${u}`).join("\n")}` : "No candidate images have been uploaded yet."}

Use web search to check what's currently trending / selling well for this kind of product right now (style, colors, keywords shoppers search for) before you answer.

Respond with ONLY this JSON shape:
{
  "title": "a scroll-stopping product title, under 70 characters",
  "description": "one short punchy marketing line, under 120 characters",
  "bullets": ["4 to 5 short Amazon-style feature/benefit bullets, each under 90 characters"],
  "suggested_category": "one of: watches, mens-fashion, fragrances, travel-essentials, uncategorized",
  "trend_notes": "2-3 sentences on why this is/isn't trending right now and what shoppers are searching for",
  "recommended_front_image_index": ${images.length ? "the index (0-based, from the list above) of the image you'd lead with, as a number, or null if you can't tell" : "null"}
}`;

  try {
    const { text } = await callClaude({ system, prompt });
    const data = parseJsonResponse(text);
    res.json(data);
  } catch (err) {
    if (err.code === "NO_API_KEY") return res.status(400).json({ error: err.message });
    console.error("[ai/suggest-product]", err.response?.data || err.message);
    res.status(502).json({ error: "The AI request failed. Check your ANTHROPIC_API_KEY and try again." });
  }
});

// ---------- 2. Trend research for the dashboard — "what should I sell right now?" ----------
// Body: { niche } — a category name or free-text ("minimalist watches", "travel-essentials")
router.post("/admin/ai/trends", requireAdmin, async (req, res) => {
  const niche = (req.body.niche || "").trim() ||
    "men's watches, men's fashion accessories, fragrances, and travel essentials — general shopping trends right now";

  const system = `You are a trend-research analyst for an affiliate marketing site (men's watches, fashion, fragrances, travel gear), sold via Amazon affiliate links. You use web search to find what's genuinely trending right now, then propose concrete product ideas the site could add. You always answer with ONLY a raw JSON object — no markdown, no code fences, no commentary before or after.`;

  const prompt = `Research current trends for: "${niche.trim()}"

Use web search to find what's actually popular / rising right now (recent articles, best-seller patterns, style trends, search interest) — don't just rely on general knowledge.

Respond with ONLY this JSON shape:
{
  "ideas": [
    {
      "title": "a suggested product title, under 70 characters",
      "why_trending": "1-2 sentences on why this is trending right now",
      "description": "one short punchy marketing line, under 120 characters",
      "bullets": ["3 to 4 short Amazon-style feature bullets"],
      "suggested_category": "one of: watches, mens-fashion, fragrances, travel-essentials, uncategorized"
    }
  ]
}
Give exactly 4 ideas, each genuinely different from the others.`;

  try {
    const { text, content } = await callClaude({ system, prompt, maxTokens: 2000 });
    const data = parseJsonResponse(text);
    const news = extractNewsLinks(content);
    res.json({ ...data, news });
  } catch (err) {
    if (err.code === "NO_API_KEY") return res.status(400).json({ error: err.message });
    console.error("[ai/trends]", err.response?.data || err.message);
    res.status(502).json({ error: "The AI request failed. Check your ANTHROPIC_API_KEY and try again." });
  }
});

module.exports = router;
