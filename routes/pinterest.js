const express = require("express");
const axios = require("axios");
const db = require("../db/db");
const requireAdmin = require("../middleware/requireAdmin");
const { requireAdminPage } = requireAdmin;

const router = express.Router();

const PINTEREST_AUTH_URL = "https://www.pinterest.com/oauth/";
const PINTEREST_TOKEN_URL = "https://api.pinterest.com/v5/oauth/token";
const PINTEREST_API_BASE = "https://api.pinterest.com/v5";

// Step 1: admin clicks "Connect Pinterest" -> redirect to Pinterest's consent screen
router.get("/admin/pinterest/connect", requireAdminPage, (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.PINTEREST_APP_ID,
    redirect_uri: process.env.PINTEREST_REDIRECT_URI,
    response_type: "code",
    scope: "boards:read,pins:read",
  });
  res.redirect(`${PINTEREST_AUTH_URL}?${params.toString()}`);
});

// Step 2: Pinterest redirects back here with a ?code=... to exchange for a token
router.get("/auth/pinterest/callback", requireAdminPage, async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send("Missing ?code from Pinterest.");

  try {
    const basicAuth = Buffer.from(
      `${process.env.PINTEREST_APP_ID}:${process.env.PINTEREST_APP_SECRET}`
    ).toString("base64");

    const tokenRes = await axios.post(
      PINTEREST_TOKEN_URL,
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.PINTEREST_REDIRECT_URI,
      }),
      {
        headers: {
          Authorization: `Basic ${basicAuth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const { access_token, refresh_token } = tokenRes.data;

    db.prepare(
      `INSERT INTO pinterest_account (id, access_token, refresh_token, connected_at)
       VALUES (1, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(id) DO UPDATE SET access_token=excluded.access_token,
         refresh_token=excluded.refresh_token, connected_at=CURRENT_TIMESTAMP`
    ).run(access_token, refresh_token || null);

    res.redirect("/admin/settings.html?pinterest=connected");
  } catch (err) {
    console.error("Pinterest OAuth error:", err.response?.data || err.message);
    res.redirect("/admin/settings.html?pinterest=error");
  }
});

// List the boards on the connected Pinterest account, so the admin can pick one to sync
router.get("/admin/pinterest/boards", requireAdmin, async (req, res) => {
  const account = db.prepare("SELECT * FROM pinterest_account WHERE id = 1").get();
  if (!account || !account.access_token) {
    return res.status(400).json({ error: "Pinterest is not connected yet." });
  }
  try {
    const boardsRes = await axios.get(`${PINTEREST_API_BASE}/boards`, {
      headers: { Authorization: `Bearer ${account.access_token}` },
    });
    res.json(boardsRes.data.items || []);
  } catch (err) {
    console.error("Pinterest boards fetch error:", err.response?.data || err.message);
    res.status(500).json({ error: "Could not fetch boards from Pinterest." });
  }
});

// Save which board should be synced
router.post("/admin/pinterest/board", requireAdmin, (req, res) => {
  const { board_id, board_name } = req.body;
  db.prepare("UPDATE pinterest_account SET board_id = ?, board_name = ? WHERE id = 1").run(
    board_id,
    board_name
  );
  res.json({ ok: true });
});

// Pull the latest pins from the connected board and add any new ones as drafts
async function syncPinsFromBoard() {
  const account = db.prepare("SELECT * FROM pinterest_account WHERE id = 1").get();
  if (!account || !account.access_token || !account.board_id) {
    return { added: 0, skipped: 0, reason: "Pinterest not connected or no board selected" };
  }

  const pinsRes = await axios.get(
    `${PINTEREST_API_BASE}/boards/${account.board_id}/pins`,
    { headers: { Authorization: `Bearer ${account.access_token}` }, params: { page_size: 25 } }
  );

  const pins = pinsRes.data.items || [];
  let added = 0;
  let skipped = 0;

  const insert = db.prepare(`
    INSERT INTO products (title, description, image_url, images, affiliate_link, category, status, source, pinterest_pin_id, pinterest_pin_url)
    VALUES (?, ?, ?, ?, '', 'uncategorized', 'draft', 'pinterest', ?, ?)
  `);
  const exists = db.prepare("SELECT id FROM products WHERE pinterest_pin_id = ?");

  for (const pin of pins) {
    if (exists.get(pin.id)) {
      skipped++;
      continue;
    }
    const imageUrl =
      pin.media?.images?.["600x"]?.url ||
      pin.media?.images?.original?.url ||
      "";
    const pinUrl = `https://www.pinterest.com/pin/${pin.id}/`;
    insert.run(pin.title || "Untitled pin", pin.description || "", imageUrl, JSON.stringify(imageUrl ? [imageUrl] : []), pin.id, pinUrl);
    added++;
  }

  return { added, skipped, reason: null };
}

// Manual "Sync Now" button in the admin panel
router.post("/admin/pinterest/sync", requireAdmin, async (req, res) => {
  try {
    const result = await syncPinsFromBoard();
    res.json(result);
  } catch (err) {
    console.error("Pinterest sync error:", err.response?.data || err.message);
    res.status(500).json({ error: "Sync failed. Check server logs." });
  }
});

router.get("/admin/pinterest/status", requireAdmin, (req, res) => {
  const account = db.prepare("SELECT board_id, board_name, connected_at FROM pinterest_account WHERE id = 1").get();
  res.json({ connected: !!(account && account.connected_at), account: account || null });
});

module.exports = { router, syncPinsFromBoard };
