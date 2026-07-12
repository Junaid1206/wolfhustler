const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db/db");
const requireAdmin = require("../middleware/requireAdmin");

const router = express.Router();

// ---------- AUTH ----------
router.post("/admin/login", (req, res) => {
  const { username, password } = req.body;
  const admin = db.prepare("SELECT * FROM admins WHERE username = ?").get(username);
  if (!admin || !bcrypt.compareSync(password || "", admin.password_hash)) {
    return res.status(401).json({ error: "Invalid username or password" });
  }
  req.session.adminId = admin.id;
  req.session.username = admin.username;
  res.json({ ok: true, username: admin.username });
});

router.post("/admin/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get("/admin/me", (req, res) => {
  if (req.session && req.session.adminId) {
    return res.json({ loggedIn: true, username: req.session.username });
  }
  res.json({ loggedIn: false });
});

router.post("/admin/change-password", requireAdmin, (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  }
  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare("UPDATE admins SET password_hash = ? WHERE id = ?").run(hash, req.session.adminId);
  res.json({ ok: true });
});

// ---------- PRODUCTS (drafts / published) ----------

// Safely parse a JSON array column, falling back to [] on bad/empty data
function parseJsonArray(str) {
  try {
    const val = JSON.parse(str || "[]");
    return Array.isArray(val) ? val : [];
  } catch {
    return [];
  }
}

function withParsedArrays(row) {
  if (!row) return row;
  return { ...row, images: parseJsonArray(row.images), bullets: parseJsonArray(row.bullets) };
}

// List products, optionally filtered by status (?status=draft / published)
router.get("/admin/products", requireAdmin, (req, res) => {
  const { status } = req.query;
  let rows;
  if (status) {
    rows = db.prepare("SELECT * FROM products WHERE status = ? ORDER BY created_at DESC").all(status);
  } else {
    rows = db.prepare("SELECT * FROM products ORDER BY created_at DESC").all();
  }
  res.json(rows.map(withParsedArrays));
});

router.get("/admin/products/:id", requireAdmin, (req, res) => {
  const row = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(withParsedArrays(row));
});

// Clean up an incoming images array: strings only, trimmed, non-empty, max 5, front image first
function sanitizeImages(images, fallbackImageUrl) {
  let arr = Array.isArray(images) ? images : [];
  arr = arr.map((s) => (typeof s === "string" ? s.trim() : "")).filter(Boolean).slice(0, 5);
  if (arr.length === 0 && fallbackImageUrl) arr = [fallbackImageUrl.trim()].filter(Boolean);
  return arr;
}

function sanitizeBullets(bullets) {
  let arr = Array.isArray(bullets) ? bullets : [];
  arr = arr.map((s) => (typeof s === "string" ? s.trim() : "")).filter(Boolean).slice(0, 5);
  return arr;
}

// Create a product manually (the "Upload" page)
router.post("/admin/products", requireAdmin, (req, res) => {
  const { title, description, image_url, images, bullets, affiliate_link, category, price, status } = req.body;
  if (!title) return res.status(400).json({ error: "Title is required" });

  const imgArray = sanitizeImages(images, image_url);
  const bulletArray = sanitizeBullets(bullets);

  const info = db
    .prepare(
      `INSERT INTO products (title, description, image_url, images, bullets, affiliate_link, category, price, status, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual')`
    )
    .run(
      title,
      description || "",
      imgArray[0] || image_url || "",
      JSON.stringify(imgArray),
      JSON.stringify(bulletArray),
      affiliate_link || "",
      category || "uncategorized",
      price || "",
      status === "published" ? "published" : "draft"
    );

  res.json({ ok: true, id: info.lastInsertRowid });
});

// Edit a product (the "Edit" page) — used both for finishing Pinterest drafts and manual products
router.put("/admin/products/:id", requireAdmin, (req, res) => {
  const { title, description, image_url, images, bullets, affiliate_link, category, price, status } = req.body;
  const existing = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Not found" });

  const imgArray = images !== undefined ? sanitizeImages(images, image_url) : parseJsonArray(existing.images);
  const bulletArray = bullets !== undefined ? sanitizeBullets(bullets) : parseJsonArray(existing.bullets);

  db.prepare(
    `UPDATE products SET title = ?, description = ?, image_url = ?, images = ?, bullets = ?, affiliate_link = ?,
       category = ?, price = ?, status = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(
    title ?? existing.title,
    description ?? existing.description,
    imgArray[0] || image_url || existing.image_url,
    JSON.stringify(imgArray),
    JSON.stringify(bulletArray),
    affiliate_link ?? existing.affiliate_link,
    category ?? existing.category,
    price ?? existing.price,
    status ?? existing.status,
    req.params.id
  );

  res.json({ ok: true });
});

router.delete("/admin/products/:id", requireAdmin, (req, res) => {
  db.prepare("DELETE FROM products WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// ---------- DASHBOARD ANALYTICS ----------
router.get("/admin/dashboard", requireAdmin, (req, res) => {
  const totalVisitors = db
    .prepare("SELECT COUNT(DISTINCT session_id) AS c FROM visits")
    .get().c;

  const visitorsToday = db
    .prepare(
      "SELECT COUNT(DISTINCT session_id) AS c FROM visits WHERE date(created_at) = date('now')"
    )
    .get().c;

  const totalPageViews = db
    .prepare("SELECT COUNT(*) AS c FROM visits WHERE event_type = 'page_view'")
    .get().c;

  const totalAffiliateClicks = db
    .prepare("SELECT COUNT(*) AS c FROM visits WHERE event_type = 'affiliate_click'")
    .get().c;

  const draftCount = db.prepare("SELECT COUNT(*) AS c FROM products WHERE status = 'draft'").get().c;
  const publishedCount = db
    .prepare("SELECT COUNT(*) AS c FROM products WHERE status = 'published'")
    .get().c;
  const unreadMessages = db.prepare("SELECT COUNT(*) AS c FROM contact_messages WHERE is_read = 0").get().c;

  const topProducts = db
    .prepare(
      `SELECT p.id, p.title, p.image_url, p.status,
              COUNT(CASE WHEN v.event_type='product_view' THEN 1 END) AS views,
              COUNT(CASE WHEN v.event_type='affiliate_click' THEN 1 END) AS clicks
       FROM products p
       LEFT JOIN visits v ON v.product_id = p.id
       GROUP BY p.id
       ORDER BY views DESC
       LIMIT 10`
    )
    .all();

  const recentActivity = db
    .prepare(
      `SELECT v.session_id, v.event_type, v.page, v.created_at, p.title AS product_title
       FROM visits v
       LEFT JOIN products p ON p.id = v.product_id
       ORDER BY v.created_at DESC
       LIMIT 50`
    )
    .all();

  const dailyVisits = db
    .prepare(
      `SELECT date(created_at) AS day, COUNT(DISTINCT session_id) AS visitors
       FROM visits
       WHERE created_at >= datetime('now', '-14 days')
       GROUP BY day
       ORDER BY day ASC`
    )
    .all();

  res.json({
    totalVisitors,
    visitorsToday,
    totalPageViews,
    totalAffiliateClicks,
    draftCount,
    publishedCount,
    unreadMessages,
    topProducts,
    recentActivity,
    dailyVisits,
  });
});

// ---------- CONTACT MESSAGES ----------
router.get("/admin/messages", requireAdmin, (req, res) => {
  const rows = db.prepare("SELECT * FROM contact_messages ORDER BY created_at DESC").all();
  res.json(rows);
});

router.post("/admin/messages/:id/read", requireAdmin, (req, res) => {
  db.prepare("UPDATE contact_messages SET is_read = 1 WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

router.delete("/admin/messages/:id", requireAdmin, (req, res) => {
  db.prepare("DELETE FROM contact_messages WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
