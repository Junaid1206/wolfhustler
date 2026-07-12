const path = require("path");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");

const db = new Database(path.join(__dirname, "wolfhustler.db"));
db.pragma("journal_mode = WAL");

// --- Schema ---
db.exec(`
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  images TEXT DEFAULT '[]',   -- JSON array of up to 5 image URLs, images[0] is the "front" image
  bullets TEXT DEFAULT '[]',  -- JSON array of short Amazon-style feature bullets
  affiliate_link TEXT DEFAULT '',
  category TEXT DEFAULT 'uncategorized',
  price TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft', -- draft | published
  source TEXT NOT NULL DEFAULT 'manual', -- manual | pinterest
  pinterest_pin_id TEXT,
  pinterest_pin_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pinterest_account (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  access_token TEXT,
  refresh_token TEXT,
  board_id TEXT,
  board_name TEXT,
  connected_at DATETIME
);

CREATE TABLE IF NOT EXISTS visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL, -- page_view | product_view | affiliate_click
  page TEXT,
  product_id INTEGER,
  user_agent TEXT,
  referrer TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT DEFAULT '',
  message TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_visits_created ON visits(created_at);
CREATE INDEX IF NOT EXISTS idx_visits_product ON visits(product_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
`);

// --- Migrate older databases that predate the images/bullets columns ---
function ensureProductColumns() {
  const cols = db.prepare("PRAGMA table_info(products)").all().map((c) => c.name);
  if (!cols.includes("images")) {
    db.exec("ALTER TABLE products ADD COLUMN images TEXT DEFAULT '[]'");
    // Backfill: wrap any existing single image_url into the new images array
    const rows = db.prepare("SELECT id, image_url FROM products WHERE image_url IS NOT NULL AND image_url != ''").all();
    const update = db.prepare("UPDATE products SET images = ? WHERE id = ?");
    rows.forEach((r) => update.run(JSON.stringify([r.image_url]), r.id));
  }
  if (!cols.includes("bullets")) {
    db.exec("ALTER TABLE products ADD COLUMN bullets TEXT DEFAULT '[]'");
  }
}
ensureProductColumns();

// --- Seed first admin account from .env, only if no admin exists yet ---
function ensureDefaultAdmin() {
  const row = db.prepare("SELECT COUNT(*) AS c FROM admins").get();
  if (row.c === 0) {
    const username = process.env.ADMIN_USERNAME || "admin";
    const password = process.env.ADMIN_PASSWORD || "changeme";
    const hash = bcrypt.hashSync(password, 10);
    db.prepare("INSERT INTO admins (username, password_hash) VALUES (?, ?)").run(username, hash);
    console.log(`[setup] Created default admin account "${username}". Change the password after first login!`);
  }
}
ensureDefaultAdmin();

module.exports = db;
