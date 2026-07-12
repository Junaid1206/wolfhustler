require("dotenv").config();
const express = require("express");
const path = require("path");
const session = require("express-session");
const cron = require("node-cron");

const adminApi = require("./routes/adminApi");
const publicApi = require("./routes/publicApi");
const aiApi = require("./routes/aiApi");
const { router: pinterestRoutes, syncPinsFromBoard } = require("./routes/pinterest");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Tiny cookie parser (avoids adding the cookie-parser dependency)
app.use((req, res, next) => {
  req.cookies = {};
  const header = req.headers.cookie;
  if (header) {
    header.split(";").forEach((pair) => {
      const [k, ...v] = pair.trim().split("=");
      req.cookies[k] = decodeURIComponent(v.join("="));
    });
  }
  res.cookie = (name, value, opts = {}) => {
    let str = `${name}=${encodeURIComponent(value)}; Path=/`;
    if (opts.maxAge) str += `; Max-Age=${Math.floor(opts.maxAge / 1000)}`;
    if (opts.httpOnly) str += "; HttpOnly";
    if (opts.sameSite) str += `; SameSite=${opts.sameSite}`;
    res.append("Set-Cookie", str);
  };
  next();
});

app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev_secret_change_me",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 8 }, // 8 hour login session
  })
);

// --- API routes ---
app.use("/api", publicApi);
app.use("/api", adminApi);
app.use("/api", aiApi);
app.use("/", pinterestRoutes); // has both /admin/pinterest/* (API) and /auth/pinterest/callback

// --- Static files ---
// Admin panel (login, dashboard, drafts, edit, upload, settings)
app.use("/admin", express.static(path.join(__dirname, "admin")));
// Public website (index.html, style.css, script.js, logo.png)
app.use("/", express.static(path.join(__dirname, "public")));

// Optional: auto-sync Pinterest pins every 30 minutes so drafts show up
// without anyone needing to press the button.
cron.schedule("*/30 * * * *", async () => {
  try {
    const result = await syncPinsFromBoard();
    if (result.added) {
      console.log(`[pinterest-sync] Added ${result.added} new draft(s).`);
    }
  } catch (err) {
    // Silently skip if Pinterest isn't connected yet
  }
});

app.listen(PORT, () => {
  console.log(`WolfHustler server running at http://localhost:${PORT}`);
  console.log(`Admin panel:  http://localhost:${PORT}/admin/login.html`);
});
