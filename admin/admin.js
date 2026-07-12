// Shared helpers used by every admin page.

async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    ...options,
  });
  if (res.status === 401) {
    window.location.href = "/admin/login.html";
    throw new Error("Not logged in");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function requireLogin() {
  const me = await fetch("/api/admin/me").then((r) => r.json());
  if (!me.loggedIn) {
    window.location.href = "/admin/login.html";
    return null;
  }
  const nameEl = document.getElementById("admin-username");
  if (nameEl) nameEl.textContent = me.username;
  return me;
}

function showToast(message) {
  let toast = document.querySelector(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove("show"), 2500);
}

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr + "Z").getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

// ===================== Multi-image gallery (Upload / Edit) =====================
// Renders one row per image URL: preview thumb, url input, "make front" button, remove button.
// The first row is always treated as the front/hero image shown on the site.

function renderImageRows(container, urls) {
  container.innerHTML = "";
  const list = urls && urls.length ? urls.slice(0, 5) : [""];
  list.forEach((url) => addImageRow(container, url));
}

function addImageRow(container, url = "") {
  if (container.children.length >= 5) return;
  const row = document.createElement("div");
  row.className = "image-row";
  row.innerHTML = `
    <div class="thumb-wrap" style="position:relative;">
      <img class="thumb" src="${escapeHtml(url)}" onerror="this.style.visibility='hidden'">
      <span class="front-badge" style="display:none;">FRONT</span>
    </div>
    <input type="text" class="image-url-input" placeholder="https://..." value="${escapeHtml(url)}">
    <button type="button" class="image-row-makefront">Make front</button>
    <button type="button" class="image-row-remove" title="Remove">&times;</button>
  `;
  const img = row.querySelector("img");
  const input = row.querySelector(".image-url-input");
  input.addEventListener("input", () => { img.src = input.value.trim(); img.style.visibility = "visible"; });
  row.querySelector(".image-row-remove").addEventListener("click", () => {
    row.remove();
    if (container.children.length === 0) addImageRow(container, "");
    markFrontRow(container);
  });
  row.querySelector(".image-row-makefront").addEventListener("click", () => {
    container.insertBefore(row, container.firstChild);
    markFrontRow(container);
  });
  container.appendChild(row);
  markFrontRow(container);
}

function markFrontRow(container) {
  [...container.children].forEach((row, i) => {
    row.classList.toggle("is-front", i === 0);
    const badge = row.querySelector(".front-badge");
    if (badge) badge.style.display = i === 0 ? "block" : "none";
  });
}

function getImagesFromUI(container) {
  return [...container.querySelectorAll(".image-url-input")]
    .map((i) => i.value.trim())
    .filter(Boolean)
    .slice(0, 5);
}

// Reorder so the image at `index` becomes the front image, then re-render
function makeImageFront(container, index) {
  const urls = getImagesFromUI(container);
  if (index <= 0 || index >= urls.length) return;
  const [chosen] = urls.splice(index, 1);
  urls.unshift(chosen);
  renderImageRows(container, urls);
}

// ===================== Feature bullets (Amazon-style) =====================

function renderBulletRows(container, bullets) {
  container.innerHTML = "";
  const list = bullets && bullets.length ? bullets.slice(0, 5) : [""];
  list.forEach((b) => addBulletRow(container, b));
}

function addBulletRow(container, value = "") {
  if (container.children.length >= 5) return;
  const row = document.createElement("div");
  row.className = "bullet-row";
  row.innerHTML = `
    <input type="text" class="bullet-input" maxlength="90" placeholder="e.g. Sapphire crystal, scratch resistant" value="${escapeHtml(value)}">
    <button type="button" class="image-row-remove" title="Remove">&times;</button>
  `;
  row.querySelector(".image-row-remove").addEventListener("click", () => {
    row.remove();
    if (container.children.length === 0) addBulletRow(container, "");
  });
  container.appendChild(row);
}

function getBulletsFromUI(container) {
  return [...container.querySelectorAll(".bullet-input")]
    .map((i) => i.value.trim())
    .filter(Boolean)
    .slice(0, 5);
}

function setBulletsInUI(container, bullets) {
  renderBulletRows(container, bullets);
}

// ===================== AI product-suggestion panel (Upload / Edit) =====================
// Wires up a "✨ AI Suggest" toggle button + panel that calls /admin/ai/suggest-product
// and lets the admin apply the returned title/description/bullets/front image with one click.
//
// opts: {
//   toggleBtn, panel, searchInput, searchBtn, statusEl, resultEl,
//   getCategory(), getImages(), applyTitle(v), applyDescription(v), applyBullets(arr), applyFrontImage(index)
// }
function wireAiSuggestPanel(opts) {
  opts.toggleBtn.addEventListener("click", () => {
    opts.panel.classList.toggle("open");
    if (opts.panel.classList.contains("open") && !opts.searchInput.value) {
      opts.searchInput.focus();
    }
  });

  async function runSuggest() {
    const query = opts.searchInput.value.trim();
    if (!query) {
      opts.statusEl.textContent = "Type a product name or niche first.";
      opts.statusEl.classList.add("error");
      return;
    }
    opts.statusEl.classList.remove("error");
    opts.statusEl.textContent = "Researching current trends and drafting suggestions…";
    opts.resultEl.classList.remove("open");
    opts.searchBtn.disabled = true;

    try {
      const images = opts.getImages ? opts.getImages() : [];
      const data = await api("/admin/ai/suggest-product", {
        method: "POST",
        body: JSON.stringify({ query, category: opts.getCategory ? opts.getCategory() : "", existing_images: images }),
      });
      renderAiResult(opts, data, images);
      opts.statusEl.textContent = "Done — click \"Use\" on anything you want to apply.";
    } catch (err) {
      opts.statusEl.classList.add("error");
      opts.statusEl.textContent = err.message || "Something went wrong.";
    }
    opts.searchBtn.disabled = false;
  }

  opts.searchBtn.addEventListener("click", runSuggest);
  opts.searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); runSuggest(); }
  });
}

function renderAiResult(opts, data, images) {
  opts.resultEl.classList.add("open");
  const bulletsHtml = (data.bullets || []).map((b) => `<li>${escapeHtml(b)}</li>`).join("");
  const frontIdx = data.recommended_front_image_index;
  const hasFrontRec = Number.isInteger(frontIdx) && images && images[frontIdx];

  opts.resultEl.innerHTML = `
    <div class="ai-result-field">
      <div class="label-row"><span class="k">Suggested title</span><button type="button" class="use-btn" data-use="title">Use title</button></div>
      <div class="val">${escapeHtml(data.title || "")}</div>
    </div>
    <div class="ai-result-field">
      <div class="label-row"><span class="k">Suggested description</span><button type="button" class="use-btn" data-use="description">Use description</button></div>
      <div class="val">${escapeHtml(data.description || "")}</div>
    </div>
    <div class="ai-result-field">
      <div class="label-row"><span class="k">Suggested feature bullets</span><button type="button" class="use-btn" data-use="bullets">Use bullets</button></div>
      <ul>${bulletsHtml}</ul>
    </div>
    ${hasFrontRec ? `
    <div class="ai-result-field">
      <div class="label-row"><span class="k">Recommended front image</span><button type="button" class="use-btn" data-use="frontimage">Use as front</button></div>
      <div class="val">Image #${frontIdx + 1} looks like the strongest hero shot for current trends.</div>
    </div>` : ""}
    ${data.trend_notes ? `<p class="ai-trend-note">${escapeHtml(data.trend_notes)}</p>` : ""}
  `;

  opts.resultEl.querySelector('[data-use="title"]')?.addEventListener("click", () => opts.applyTitle?.(data.title || ""));
  opts.resultEl.querySelector('[data-use="description"]')?.addEventListener("click", () => opts.applyDescription?.(data.description || ""));
  opts.resultEl.querySelector('[data-use="bullets"]')?.addEventListener("click", () => opts.applyBullets?.(data.bullets || []));
  opts.resultEl.querySelector('[data-use="frontimage"]')?.addEventListener("click", () => opts.applyFrontImage?.(frontIdx));
}

document.addEventListener("DOMContentLoaded", () => {
  const logoutLink = document.querySelector(".logout-link");
  if (logoutLink) {
    logoutLink.addEventListener("click", async (e) => {
      e.preventDefault();
      await fetch("/api/admin/logout", { method: "POST" });
      window.location.href = "/admin/login.html";
    });
  }
});
