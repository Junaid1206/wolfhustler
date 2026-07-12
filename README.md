# WolfHustler — site + admin panel + Pinterest sync

This package adds a full backend to your WolfHustler site:

- **Public site** (`/public`) — your original design, now pulling products from a
  real database instead of hardcoded HTML, and tracking visits/clicks.
- **Admin panel** (`/admin`) — login, dashboard, drafts, edit, upload, Pinterest settings.
- **Pinterest sync** — connects your Pinterest account and pulls new pins from a
  board you choose into the Drafts list, where you finish them (add the Amazon
  affiliate link, description, category) before publishing.

## 1. Install

You need [Node.js](https://nodejs.org) 18+ installed. Then, inside this folder:

```bash
npm install
cp .env.example .env
```

Open `.env` and set:
- `SESSION_SECRET` — any long random string.
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` — your admin login (only used the very first time the server starts, to create the account).

## 2. Run it

```bash
npm start
```

- Website: http://localhost:3000
- Admin panel: http://localhost:3000/admin/login.html

Log in with the username/password from your `.env`. **Change the password**
from Settings after your first login (there's a "change password" API at
`POST /api/admin/change-password`; a UI button can be wired to it later if you want).

## 3. Connect Pinterest (so new pins become drafts)

Pinterest does not push new pins to outside apps instantly — there's no public
"someone just pinned this" webhook for personal accounts. The realistic and
Pinterest-approved way to do this is:

1. Go to https://developers.pinterest.com/apps/ and create an app (free).
2. In the app's settings, add this **exact** redirect URI:
   `http://localhost:3000/auth/pinterest/callback`
   (swap `localhost:3000` for your real domain once you deploy).
3. Copy the **App ID** and **App secret** into your `.env`:
   ```
   PINTEREST_APP_ID=...
   PINTEREST_APP_SECRET=...
   PINTEREST_REDIRECT_URI=http://localhost:3000/auth/pinterest/callback
   ```
4. Restart the server, go to **Admin → Pinterest settings → Connect Pinterest account**,
   and approve access.
5. Pick which board to sync from.
6. Go to **Drafts** and click **Sync Pinterest now** — any pin on that board
   that isn't already in your system shows up as a draft.

After the first connection, it also auto-syncs every 30 minutes on its own
(see the `node-cron` job in `server.js` — change `*/30 * * * *` to sync more
or less often).

## 4. Daily workflow

1. Pin something to your connected Pinterest board (from your phone, browser, anywhere).
2. Within 30 minutes (or press "Sync Pinterest now"), it appears in **Drafts**.
3. Click **Edit & publish**, paste in the Amazon affiliate link, tidy up the
   title/description, pick a category, hit **Save & publish**.
4. It now appears live on the website's product carousel.
5. Check **Dashboard** any time to see how many people visited, how many
   viewed each product, and how many clicked through to Amazon.

You can also skip Pinterest entirely and add something directly from
**Upload product**.

## 5. What the Dashboard tracks

- Every page load → counted as a visit (one anonymous cookie per visitor, no
  login required for shoppers — this is just an anonymous ID, not personal data).
- Every product card that scrolls into view → counted as a "product view".
- Every click on "VIEW PICKS →" → counted as an "affiliate click", right before
  the visitor is sent to your Amazon link.
- The **Recent activity** table on the dashboard shows a live feed: which
  anonymous visitor did what, and when.

## 6. Deploying for real

This runs as a normal Node.js app, so it works on Render, Railway, a VPS, etc.
A few things to change for production:
- Set real values in `.env` on the host (don't commit `.env` to git).
- Update `PINTEREST_REDIRECT_URI` and the redirect URI in your Pinterest app
  settings to your real domain.
- Put the app behind HTTPS (Render/Railway do this for you automatically).
- The database is a single file, `db/wolfhustler.db` — back it up periodically.

## 7. Product photos & AI assistant

Products now support **up to 5 images** (an Amazon-style thumbnail strip on
the site, click one to swap the main photo) plus up to 5 short **feature
bullets** shown under the title, in addition to the one-line description.
Add/remove/reorder images from **Upload** or **Edit** — the first image is
always the "front" image used on cards and previews.

There's also a built-in **AI assistant**, powered by the Anthropic API:

- On **Upload**/**Edit**, click **✨ AI Suggest**, type the product or niche
  (e.g. "minimalist chronograph watch"), and it researches current trends via
  web search, then drafts a title, short description, feature bullets, and
  (if you've already added photos) which one to use as the front image — each
  with a one-click "Use" button.
- On the **Dashboard**, the **Trend research** panel lets you ask "what
  should I sell right now?" for any niche/category. It returns 4 concrete
  product ideas with a "Use this idea →" button that jumps straight into
  Upload, pre-filled.

To turn this on, add an API key to `.env`:
```
ANTHROPIC_API_KEY=your_key_from_console.anthropic.com
```
Without a key, the rest of the admin panel works exactly as before — the AI
buttons just show a short setup message instead of suggestions.

## 8. Site pages

Every navbar and footer link now points to a real page instead of `#`:

- `index.html` — Home
- `about.html` — Brand story
- `watches.html`, `mens-fashion.html`, `fragrances.html`, `travel-essentials.html` —
  category pages. Each pulls published products for that category from
  `/api/products?category=...` automatically — publish a product under a
  category in the admin panel and it appears on the matching page.
- `contact.html` — a real contact form that saves messages to the database
  (view them at **Admin → Messages**).
- `privacy-policy.html`, `terms.html`, `shipping-returns.html`,
  `affiliate-disclosure.html` — standard legal/help pages (template content —
  have a professional review these before going live, especially if you
  operate in a region with specific requirements like GDPR).

If you ever want to regenerate the category/about/legal pages from scratch
(e.g. after changing the shared header or footer in `index.html`), run:

```bash
cd public
python3 ../scripts/generate_pages.py
```

This re-reads the header/footer straight from `index.html`, so keep that file
as the source of truth for site-wide nav and footer changes.

## 9. Contact messages

Every submission from `contact.html` is saved to the `contact_messages` table
and shows up at **Admin → Messages**, where you can mark it read or delete it.
Nothing is emailed automatically — check the admin panel for new messages.



```
server.js                 Entry point — wires everything together
db/db.js                  SQLite connection + schema + seeds the first admin
middleware/requireAdmin.js Login check for admin-only routes
routes/adminApi.js        Login, product CRUD, dashboard analytics, contact messages
routes/publicApi.js       Public product list, visit/click tracking, contact form
routes/pinterest.js       Pinterest OAuth + board sync
scripts/generate_pages.py Regenerates category/about/legal pages from index.html's header/footer
public/                   Your website — home, category, about, contact, and legal pages
admin/                    Admin panel pages (plain HTML + vanilla JS, no build step)
```
