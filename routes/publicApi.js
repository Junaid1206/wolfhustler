const express = require("express");
const crypto = require("crypto");
const db = require("../db/db");

const router = express.Router();

// Give every visitor a stable anonymous session id via a cookie, so the
// dashboard can tell "one person viewed 3 products" apart from 3 people.
router.use((req, res, next) => {
  let sid = req.cookies?.wh_sid;
  if (!sid) {
    sid = crypto.randomBytes(16).toString("hex");
    res.cookie("wh_sid", sid, {
      maxAge: 1000 * 60 * 60 * 24 * 365,
      httpOnly: true,
      sameSite: "lax",
    });
  }
  req.sessionIdForTracking = sid;
  next();
});

function parseJsonArray(str) {
  try {
    const val = JSON.parse(str || "[]");
    return Array.isArray(val) ? val : [];
  } catch {
    return [];
  }
}

// Only published products are ever shown on the public site
router.get("/products", (req, res) => {
  const { category } = req.query;
  let rows;
  if (category) {
    rows = db
      .prepare("SELECT * FROM products WHERE status = 'published' AND category = ? ORDER BY created_at DESC")
      .all(category);
  } else {
    rows = db
      .prepare("SELECT * FROM products WHERE status = 'published' ORDER BY created_at DESC")
      .all();
  }
  const products = rows.map((r) => {
    const images = parseJsonArray(r.images);
    return {
      ...r,
      images: images.length ? images : (r.image_url ? [r.image_url] : []),
      bullets: parseJsonArray(r.bullets),
    };
  });
  res.json(products);
});

// Record a page view, a product card being seen/clicked, or an affiliate link click
router.post("/track", express.json(), (req, res) => {
  const { event_type, page, product_id } = req.body;
  const allowed = ["page_view", "product_view", "affiliate_click"];
  if (!allowed.includes(event_type)) {
    return res.status(400).json({ error: "Invalid event_type" });
  }

  db.prepare(
    `INSERT INTO visits (session_id, event_type, page, product_id, user_agent, referrer)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    req.sessionIdForTracking,
    event_type,
    page || null,
    product_id || null,
    req.headers["user-agent"] || null,
    req.headers["referer"] || null
  );

  res.json({ ok: true });
});

// Contact form submission — stored in the DB, visible to the admin via /api/admin/messages
router.post("/contact", express.json(), (req, res) => {
  const { name, email, subject, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ error: "Name, email, and message are required." });
  }
  db.prepare(
    `INSERT INTO contact_messages (name, email, subject, message) VALUES (?, ?, ?, ?)`
  ).run(name.trim(), email.trim(), (subject || "").trim(), message.trim());
  res.json({ ok: true });
});

module.exports = router;
