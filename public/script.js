// Fallback content used only if the API can't be reached (so the site never looks empty/broken)
const FALLBACK_PICKS = [
    { title: "Minimalist Watches", description: "Understated. Unmatched.", image_url: "https://i.pinimg.com/736x/38/08/cf/3808cfc400dc5183cc920a4b90fae2bb.jpg", images: ["https://i.pinimg.com/736x/38/08/cf/3808cfc400dc5183cc920a4b90fae2bb.jpg"], bullets: [], affiliate_link: "#", id: null },
    { title: "Premium Wallets", description: "Carry less. Carry better.", image_url: "https://i.pinimg.com/736x/cc/db/b6/ccdbb602a26eb044410ef53a3ff5f3f0.jpg", images: ["https://i.pinimg.com/736x/cc/db/b6/ccdbb602a26eb044410ef53a3ff5f3f0.jpg"], bullets: [], affiliate_link: "#", id: null },
    { title: "Signature Fragrances", description: "Scent is your signature.", image_url: "https://i.pinimg.com/736x/1b/f3/d0/1bf3d0c7a29d4a00761d097ee7af275a.jpg", images: ["https://i.pinimg.com/736x/1b/f3/d0/1bf3d0c7a29d4a00761d097ee7af275a.jpg"], bullets: [], affiliate_link: "#", id: null },
];

function trackEvent(event_type, extra = {}) {
    navigator.sendBeacon
        ? navigator.sendBeacon("/api/track", new Blob([JSON.stringify({ event_type, page: location.pathname, ...extra })], { type: "application/json" }))
        : fetch("/api/track", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ event_type, page: location.pathname, ...extra }),
          }).catch(() => {});
}

function escapeHtmlPublic(str) {
    const div = document.createElement("div");
    div.textContent = str ?? "";
    return div.innerHTML;
}

function buildProductCard(p) {
    const images = (Array.isArray(p.images) && p.images.length ? p.images : (p.image_url ? [p.image_url] : []));
    const bullets = Array.isArray(p.bullets) ? p.bullets.slice(0, 5) : [];

    const card = document.createElement("div");
    card.className = "product-card";

    const thumbsHtml = images.length > 1
        ? `<div class="p-card-thumbs">
            ${images.slice(0, 5).map((src, i) => `<button type="button" class="p-card-thumb${i === 0 ? ' active' : ''}" data-src="${escapeHtmlPublic(src)}" aria-label="View image ${i + 1}"><img src="${escapeHtmlPublic(src)}" alt=""></button>`).join("")}
           </div>`
        : "";

    const bulletsHtml = bullets.length
        ? `<ul class="p-card-bullets">${bullets.map((b) => `<li>${escapeHtmlPublic(b)}</li>`).join("")}</ul>`
        : (p.description ? `<p>${escapeHtmlPublic(p.description)}</p>` : "");

    card.innerHTML = `
        <div class="p-card-img-wrapper">
            <img class="p-card-main-img" src="${escapeHtmlPublic(images[0] || '')}" alt="${escapeHtmlPublic(p.title)}">
        </div>
        ${thumbsHtml}
        <div class="p-card-info">
            <h3>${escapeHtmlPublic(p.title)}</h3>
            ${bulletsHtml}
            <a href="${p.affiliate_link || '#'}" class="p-card-link" data-product-id="${p.id || ''}" target="_blank" rel="noopener sponsored">VIEW PICKS &rarr;</a>
        </div>
    `;

    // Clicking a thumbnail swaps the main hero image, Amazon-style
    const mainImg = card.querySelector(".p-card-main-img");
    card.querySelectorAll(".p-card-thumb").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            mainImg.src = btn.getAttribute("data-src");
            card.querySelectorAll(".p-card-thumb").forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
        });
    });

    return card;
}

async function loadPublishedProducts() {
    const track = document.getElementById("carousel-track");
    if (!track) return;

    let products = FALLBACK_PICKS;
    try {
        const res = await fetch("/api/products");
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) products = data;
        }
    } catch (e) {
        // Stay on fallback content — no server running / offline preview
    }

    track.innerHTML = "";
    products.forEach((p) => track.appendChild(buildProductCard(p)));

    track.querySelectorAll(".p-card-link").forEach((link) => {
        link.addEventListener("click", () => {
            const id = link.getAttribute("data-product-id");
            if (id) trackEvent("affiliate_click", { product_id: Number(id) });
        });
    });

    if ("IntersectionObserver" in window) {
        const seen = new Set();
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                const id = entry.target.getAttribute("data-product-id");
                if (entry.isIntersecting && id && !seen.has(id)) {
                    seen.add(id);
                    trackEvent("product_view", { product_id: Number(id) });
                }
            });
        }, { threshold: 0.5 });
        track.querySelectorAll(".p-card-link").forEach((link) => observer.observe(link));
    }
}

async function loadCategoryGrid() {
    const grid = document.getElementById("category-grid");
    if (!grid) return;
    const category = grid.getAttribute("data-category");

    try {
        const res = await fetch(`/api/products?category=${encodeURIComponent(category)}`);
        const products = res.ok ? await res.json() : [];

        if (!Array.isArray(products) || products.length === 0) {
            grid.innerHTML = `<p class="grid-empty-msg">New picks for this collection are on the way — check back soon.</p>`;
            return;
        }

        grid.innerHTML = "";
        products.forEach((p) => grid.appendChild(buildProductCard(p)));

        grid.querySelectorAll(".p-card-link").forEach((link) => {
            link.addEventListener("click", () => {
                const id = link.getAttribute("data-product-id");
                if (id) trackEvent("affiliate_click", { product_id: Number(id) });
            });
        });

        if ("IntersectionObserver" in window) {
            const seen = new Set();
            const observer = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    const id = entry.target.getAttribute("data-product-id");
                    if (entry.isIntersecting && id && !seen.has(id)) {
                        seen.add(id);
                        trackEvent("product_view", { product_id: Number(id) });
                    }
                });
            }, { threshold: 0.5 });
            grid.querySelectorAll(".p-card-link").forEach((link) => observer.observe(link));
        }
    } catch (e) {
        grid.innerHTML = `<p class="grid-empty-msg">Couldn't load products right now — please refresh.</p>`;
    }
}

function setupContactForm() {
    const form = document.getElementById("contact-form");
    if (!form) return;

    const successEl = document.getElementById("contact-success");
    const errorEl = document.getElementById("contact-error");
    const submitBtn = document.getElementById("contact-submit-btn");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        successEl.style.display = "none";
        errorEl.style.display = "none";
        submitBtn.disabled = true;

        const payload = {
            name: document.getElementById("c-name").value.trim(),
            email: document.getElementById("c-email").value.trim(),
            subject: document.getElementById("c-subject").value.trim(),
            message: document.getElementById("c-message").value.trim(),
        };

        try {
            const res = await fetch("/api/contact", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Something went wrong.");
            successEl.style.display = "block";
            form.reset();
        } catch (err) {
            errorEl.textContent = err.message || "Couldn't send your message. Please try again.";
            errorEl.style.display = "block";
        }
        submitBtn.disabled = false;
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    trackEvent("page_view");

    // === 1. HAMBURGER MOBILE MENU LOGIC ===
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const navMenu = document.getElementById('nav-menu');

    if (mobileMenuBtn && navMenu) {
        mobileMenuBtn.addEventListener('click', () => {
            mobileMenuBtn.classList.toggle('active');
            navMenu.classList.toggle('active');
        });

        const navLinks = navMenu.querySelectorAll('a');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                mobileMenuBtn.classList.remove('active');
                navMenu.classList.remove('active');
            });
        });
    }

    // === 2. CATEGORY PAGE PRODUCT GRID (watches.html, mens-fashion.html, etc.) ===
    await loadCategoryGrid();

    // === 3. CONTACT FORM (contact.html) ===
    setupContactForm();

    // === 4. LOAD REAL PRODUCTS, THEN SET UP THE CAROUSEL ON TOP OF THEM (home page only) ===
    await loadPublishedProducts();

    const track = document.getElementById('carousel-track');
    const nextBtn = document.getElementById('next-btn');
    const prevBtn = document.getElementById('prev-btn');
    const cards = document.querySelectorAll('.product-card');

    if (track && nextBtn && prevBtn && cards.length > 0) {
        let index = 0;
        const gap = 20;
        let cardsVisible = getVisibleCardsCount();
        let maxIndex = Math.max(0, cards.length - cardsVisible);

        function getVisibleCardsCount() {
            if (window.innerWidth <= 650) return 1;
            if (window.innerWidth <= 1100) return 2;
            return 3;
        }

        function moveCarousel() {
            const cardWidth = cards[0].getBoundingClientRect().width;
            const amountToMove = index * (cardWidth + gap);
            track.style.transform = `translateX(-${amountToMove}px)`;
        }

        function handleNext() {
            if (index < maxIndex) index++; else index = 0;
            moveCarousel();
        }

        function handlePrev() {
            if (index > 0) index--; else index = maxIndex;
            moveCarousel();
        }

        nextBtn.addEventListener('click', handleNext);
        prevBtn.addEventListener('click', handlePrev);

        let autoSlideInterval = setInterval(handleNext, 3500);

        const carouselSide = document.querySelector('.picks-carousel-side');
        if (carouselSide) {
            carouselSide.addEventListener('mouseenter', () => clearInterval(autoSlideInterval));
            carouselSide.addEventListener('mouseleave', () => {
                autoSlideInterval = setInterval(handleNext, 3500);
            });
        }

        window.addEventListener('resize', () => {
            cardsVisible = getVisibleCardsCount();
            maxIndex = Math.max(0, cards.length - cardsVisible);
            if (index > maxIndex) index = maxIndex;
            moveCarousel();
        });
    }
});
