import re

with open('index.html', 'r', encoding='utf-8') as f:
    src = f.read()

# --- Extract the fixed HEADER block (everything from <header class="navbar"> to </header>) ---
header_match = re.search(r'(\s*<!-- 1\. NAVIGATION HEADER -->\s*<header class="navbar">.*?</header>)', src, re.S)
HEADER_BLOCK = header_match.group(1)

# --- Extract the fixed FOOTER + closing scripts block (from <footer class="site-footer"> to </html>) ---
footer_match = re.search(r'(<footer class="site-footer">.*?</html>)', src, re.S)
FOOTER_BLOCK = footer_match.group(1)

NAV_TARGETS = {
    "HOME": "index.html",
    "ABOUT": "about.html",
    "WATCHES": "watches.html",
    "MEN'S FASHION": "mens-fashion.html",
    "FRAGRANCES": "fragrances.html",
    "TRAVEL ESSENTIALS": "travel-essentials.html",
}


def build_header(active_page):
    """Return the header block with the correct nav link marked 'active'."""
    block = HEADER_BLOCK
    for label, href in NAV_TARGETS.items():
        plain = f'<a href="{href}">{label}</a>'
        active = f'<a href="{href}" class="active">{label}</a>'
        # index.html currently has HOME as active by default in the source; normalize first
        block = block.replace(f'<a href="{href}" class="active">{label}</a>', plain)
        block = block.replace(plain, active if href == active_page else plain)
    return block


def build_page(filename, title, description, active_page, body_html, extra_head=""):
    header = build_header(active_page)
    html = f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <meta name="description" content="{description}">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500&family=Playfair+Display:ital,wght@0,600;0,700;1,400&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <link rel="stylesheet" href="style.css">
    <link rel="stylesheet" href="inner-pages.css">
{extra_head}</head>
<body>
{header}

{body_html}

{FOOTER_BLOCK}
'''
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(html)
    print(f"wrote {filename}")


# =========================================================================
# 1. CATEGORY PAGES — Watches / Men's Fashion / Fragrances / Travel Essentials
# =========================================================================
CATEGORIES = [
    ("watches.html", "WATCHES", "watches", "Timeless pieces built to last — curated watches for men who value quiet precision."),
    ("mens-fashion.html", "MEN'S FASHION", "mens-fashion", "Style is silent, confidence is loud — curated men's fashion essentials."),
    ("fragrances.html", "FRAGRANCES", "fragrances", "Leave a mark without a word — signature fragrances worth wearing."),
    ("travel-essentials.html", "TRAVEL ESSENTIALS", "travel-essentials", "Gear built for the journeys that define you."),
]

for filename, heading, slug, tagline in CATEGORIES:
    body = f'''<section class="page-hero">
    <div class="page-hero-content">
        <span class="page-hero-tag">COLLECTION</span>
        <h1>{heading}</h1>
        <p>{tagline}</p>
    </div>
</section>

<section class="category-grid-section">
    <div class="category-grid-container" id="category-grid" data-category="{slug}">
        <p class="grid-empty-msg">Loading picks…</p>
    </div>
</section>'''
    build_page(
        filename,
        f"{heading} | WOLFHUSTLER",
        tagline,
        filename,
        body,
    )

# =========================================================================
# 2. ABOUT PAGE
# =========================================================================
about_body = '''<section class="page-hero">
    <div class="page-hero-content">
        <span class="page-hero-tag">OUR STORY</span>
        <h1>ABOUT WOLFHUSTLER</h1>
        <p>Decoding the 0.1% lifestyle, curated for men who move in silence.</p>
    </div>
</section>

<section class="about-section">
    <div class="container">
        <div class="left-content">
            <span class="subtitle">ABOUT WOLFHUSTLER</span>
            <h2>Decoding the 0.1% <span>Lifestyle.</span></h2>
            <p class="tagline">CURATED FOR MEN. BUILT FOR MORE.</p>
            <p>At WolfHustler, we believe that privacy is the ultimate luxury, but style shouldn't require a fortune. We hunt down the finest men's essentials — from dapper outerwear to stealth-wealth accessories — and bring you the billionaire aesthetic at an accessible value. Curated in silence, built for the ambitious.</p>
            <p>Every product on this site is hand-picked, cross-checked, and only makes the cut if it earns its place in a disciplined, no-noise lifestyle. We're not here to sell you everything — just the few things worth owning.</p>
            <p class="highlight">Just curated recommendations for men who appreciate quality, discipline, and timeless style.</p>
        </div>
    </div>

    <div class="features">
        <div class="feature">
            <i class="fa-solid fa-magnifying-glass"></i>
            <h4>CAREFUL RESEARCH</h4>
            <p>We analyze dozens of products to find only the best options.</p>
        </div>
        <div class="feature">
            <i class="fa-solid fa-award"></i>
            <h4>QUALITY FIRST</h4>
            <p>Premium products selected for performance and long-term value.</p>
        </div>
        <div class="feature">
            <i class="fa-solid fa-tags"></i>
            <h4>BEST VALUE</h4>
            <p>Luxury aesthetics and premium feel without luxury pricing.</p>
        </div>
        <div class="feature">
            <i class="fa-solid fa-shield-halved"></i>
            <h4>TRUSTED PICKS</h4>
            <p>Honest recommendations and curated products you can trust.</p>
        </div>
    </div>
</section>

<section class="disclosure-note-section">
    <div class="page-copy-container">
        <p>WolfHustler participates in the Amazon Associates Program and other affiliate programs. As an Amazon
        Associate, we earn from qualifying purchases at no extra cost to you. See our
        <a href="affiliate-disclosure.html">Affiliate Disclosure</a> for details.</p>
    </div>
</section>'''
build_page("about.html", "About Us | WOLFHUSTLER", "The story behind WolfHustler — curated luxury essentials for ambitious men.", "about.html", about_body)

# =========================================================================
# 3. CONTACT PAGE (real working form, posts to /api/contact)
# =========================================================================
contact_body = '''<section class="page-hero">
    <div class="page-hero-content">
        <span class="page-hero-tag">GET IN TOUCH</span>
        <h1>CONTACT US</h1>
        <p>Question about a pick, a partnership, or just want to say hi? Send it over.</p>
    </div>
</section>

<section class="form-page-section">
    <div class="page-copy-container narrow">
        <form id="contact-form" class="site-form">
            <div id="contact-success" class="form-success" style="display:none;">
                Thanks — your message has been sent. We'll get back to you soon.
            </div>
            <div id="contact-error" class="form-error" style="display:none;"></div>

            <label for="c-name">Name</label>
            <input type="text" id="c-name" name="name" required>

            <label for="c-email">Email</label>
            <input type="email" id="c-email" name="email" required>

            <label for="c-subject">Subject</label>
            <input type="text" id="c-subject" name="subject">

            <label for="c-message">Message</label>
            <textarea id="c-message" name="message" rows="6" required></textarea>

            <button type="submit" class="cta-button" id="contact-submit-btn">SEND MESSAGE <span class="arrow">→</span></button>
        </form>
    </div>
</section>'''
build_page("contact.html", "Contact Us | WOLFHUSTLER", "Get in touch with the WolfHustler team.", "contact.html", contact_body)

# =========================================================================
# 4. PRIVACY POLICY
# =========================================================================
privacy_body = '''<section class="page-hero small">
    <div class="page-hero-content">
        <span class="page-hero-tag">LEGAL</span>
        <h1>PRIVACY POLICY</h1>
    </div>
</section>

<section class="legal-page-section">
    <div class="page-copy-container">
        <p class="legal-updated">Last updated: 2026</p>

        <h2>1. Information We Collect</h2>
        <p>When you visit WolfHustler, we may automatically collect basic, non-identifying analytics data — such as which pages you view, which products you look at, and anonymous session identifiers stored in a cookie. If you submit our contact form or newsletter signup, we collect the name and email address you provide.</p>

        <h2>2. How We Use Information</h2>
        <p>We use this information to understand which products and pages resonate with visitors, to respond to messages sent through our contact form, and to send occasional updates to newsletter subscribers. We do not sell your personal information to third parties.</p>

        <h2>3. Cookies</h2>
        <p>We use a cookie to recognize repeat visits anonymously, purely for internal analytics. You can clear or block cookies through your browser settings at any time.</p>

        <h2>4. Affiliate Links</h2>
        <p>WolfHustler contains affiliate links, including links to Amazon. If you click one of these links and make a purchase, we may earn a commission at no extra cost to you. See our <a href="affiliate-disclosure.html">Affiliate Disclosure</a> for more detail.</p>

        <h2>5. Third-Party Services</h2>
        <p>Product images and inspiration are sourced in part from Pinterest. Clicking through to a product may take you to a third-party retailer's site, which has its own privacy policy that we encourage you to review.</p>

        <h2>6. Your Choices</h2>
        <p>You can request that we delete any information you've submitted via our contact form by emailing us directly.</p>

        <h2>7. Contact</h2>
        <p>Questions about this policy can be sent through our <a href="contact.html">Contact page</a>.</p>

        <p class="legal-note">This is a template privacy policy provided for a small affiliate site and is not a substitute for legal advice. Please have it reviewed by a qualified professional before relying on it, especially if you collect payment information or operate in regions with specific requirements (e.g. GDPR, CCPA).</p>
    </div>
</section>'''
build_page("privacy-policy.html", "Privacy Policy | WOLFHUSTLER", "How WolfHustler collects, uses, and protects your information.", "privacy-policy.html", privacy_body)

# =========================================================================
# 5. TERMS & CONDITIONS
# =========================================================================
terms_body = '''<section class="page-hero small">
    <div class="page-hero-content">
        <span class="page-hero-tag">LEGAL</span>
        <h1>TERMS & CONDITIONS</h1>
    </div>
</section>

<section class="legal-page-section">
    <div class="page-copy-container">
        <p class="legal-updated">Last updated: 2026</p>

        <h2>1. Acceptance of Terms</h2>
        <p>By accessing WolfHustler, you agree to these terms. If you don't agree, please don't use the site.</p>

        <h2>2. Nature of Content</h2>
        <p>WolfHustler publishes curated product recommendations for informational purposes. We do not sell products directly — links on this site may take you to third-party retailers such as Amazon.</p>

        <h2>3. Affiliate Relationships</h2>
        <p>We participate in affiliate programs, including the Amazon Associates Program, and may earn a commission on qualifying purchases made through links on this site. This never affects the price you pay.</p>

        <h2>4. No Warranty</h2>
        <p>Product recommendations reflect our own research and opinions at the time of publishing. We do our best to keep information accurate, but prices, availability, and specifications are controlled by the third-party retailer and can change without notice.</p>

        <h2>5. Intellectual Property</h2>
        <p>All original text, design, and branding on WolfHustler belong to WolfHustler. Product images belong to their respective owners/retailers.</p>

        <h2>6. Limitation of Liability</h2>
        <p>WolfHustler is not liable for any purchase decisions, product issues, or damages arising from your use of linked third-party sites.</p>

        <h2>7. Changes to These Terms</h2>
        <p>We may update these terms occasionally. Continued use of the site after changes means you accept the updated terms.</p>

        <h2>8. Contact</h2>
        <p>Questions? Reach us through our <a href="contact.html">Contact page</a>.</p>

        <p class="legal-note">This is a template terms page provided for a small affiliate site and is not a substitute for legal advice.</p>
    </div>
</section>'''
build_page("terms.html", "Terms & Conditions | WOLFHUSTLER", "The terms that govern your use of the WolfHustler website.", "terms.html", terms_body)

# =========================================================================
# 6. SHIPPING & RETURNS
# =========================================================================
shipping_body = '''<section class="page-hero small">
    <div class="page-hero-content">
        <span class="page-hero-tag">HELP</span>
        <h1>SHIPPING & RETURNS</h1>
    </div>
</section>

<section class="legal-page-section">
    <div class="page-copy-container">
        <h2>Where do I buy the products?</h2>
        <p>WolfHustler is a curation site, not a store. Every product links out to the retailer that actually sells and ships it — most often Amazon. Shipping times, costs, and tracking are all handled directly by that retailer.</p>

        <h2>What's the shipping policy?</h2>
        <p>Because WolfHustler doesn't hold or ship inventory, shipping speed and cost depend entirely on the retailer you're redirected to. Check the product page on the retailer's site for exact delivery estimates.</p>

        <h2>How do I return something?</h2>
        <p>Since your purchase happens on the retailer's site (e.g. Amazon), all returns and refunds are handled by that retailer under their own return policy. We recommend checking their returns page or your order confirmation email for instructions.</p>

        <h2>Still need help?</h2>
        <p>If you're not sure where an order was placed or need help finding a retailer's support page, reach out through our <a href="contact.html">Contact page</a> and we'll point you in the right direction.</p>
    </div>
</section>'''
build_page("shipping-returns.html", "Shipping & Returns | WOLFHUSTLER", "How shipping and returns work for products featured on WolfHustler.", "shipping-returns.html", shipping_body)

# =========================================================================
# 7. AFFILIATE DISCLOSURE
# =========================================================================
affiliate_body = '''<section class="page-hero small">
    <div class="page-hero-content">
        <span class="page-hero-tag">TRANSPARENCY</span>
        <h1>AFFILIATE DISCLOSURE</h1>
    </div>
</section>

<section class="legal-page-section">
    <div class="page-copy-container">
        <p>WolfHustler is a participant in the Amazon Services LLC Associates Program, an affiliate advertising
        program designed to provide a means for sites to earn advertising fees by advertising and linking to
        Amazon.com and affiliated sites. We may also participate in other affiliate programs.</p>

        <h2>What this means</h2>
        <p>When you click a product link on WolfHustler and go on to make a purchase, we may earn a small
        commission — at absolutely no extra cost to you. The price you pay is the same whether you use our
        link or go to the retailer directly.</p>

        <h2>How this shapes our picks</h2>
        <p>Earning a commission never determines whether a product gets featured. Every item on this site is
        chosen first because we believe it's genuinely worth recommending; the affiliate link is simply how we
        keep the site running.</p>

        <h2>Questions</h2>
        <p>If you'd like more detail on any specific recommendation or partnership, reach out through our
        <a href="contact.html">Contact page</a>.</p>
    </div>
</section>'''
build_page("affiliate-disclosure.html", "Affiliate Disclosure | WOLFHUSTLER", "How WolfHustler's affiliate links and commissions work.", "affiliate-disclosure.html", affiliate_body)

print("done")
