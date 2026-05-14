# Webflow → Shopify Conversion Guide

A repeatable recipe for turning a Webflow site export into a Shopify Online Store 2.0 theme **without rewriting any styles or markup**. Used to convert this repo; same steps apply to any Webflow export.

The goal is byte-identical visual parity. Only the rendering engine changes (static HTML → Liquid).

---

## 1. Source inventory checklist

Before starting, take stock of the export:

| Asset | What to record |
|---|---|
| HTML pages | Filenames + role (home, product template, etc.). Note shared vs. one-off pages. |
| CSS files | Paths + whether they reference fonts/images via `url(../...)`. |
| JS bundle | Webflow ships one big `*.js` — keep it intact. |
| Images / fonts | Count, formats, subfolders. |
| `<html>` attributes | `data-wf-page` (varies per page), `data-wf-site` (constant). |
| External CDNs | jQuery (Webflow CDN), GSAP, Swiper, etc. — keep as-is. |
| Forms | Newsletter, contact, password-page — all need rewiring. |

---

## 2. Target Shopify theme structure

```
<theme-root>/
├── assets/             # FLAT — Shopify forbids subdirs here
├── config/
│   ├── settings_schema.json
│   └── settings_data.json
├── layout/
│   ├── theme.liquid    # wraps all chrome'd pages
│   └── password.liquid # for the 401 / password page
├── locales/
│   └── en.default.json
├── sections/
│   ├── header.liquid + header-group.json
│   ├── footer.liquid + footer-group.json
│   ├── page-*.liquid   # one per source HTML page (or split further into blocks)
│   └── main-cart.liquid, main-search.liquid
├── snippets/
│   ├── social-icon.liquid
│   └── wf-form-states.liquid
└── templates/
    ├── index.json
    ├── product.json
    ├── collection.json
    ├── blog.json
    ├── article.json
    ├── page.json / page.<handle>.json
    ├── 404.json
    ├── cart.json
    └── search.json
```

---

## 3. Folder remap

| Webflow export | Shopify theme |
|---|---|
| `css/*.css` | `assets/` |
| `js/*.js` | `assets/` |
| `images/*` | `assets/` |
| `fonts/*` | `assets/` |
| `index.html` | `sections/page-index.liquid` + `templates/index.json` |
| `product-template.html` | `sections/page-product.liquid` + `templates/product.json` |
| `shop.html` | `sections/page-collection.liquid` + `templates/collection.json` |
| `blog.html` | `sections/page-blog.liquid` + `templates/blog.json` |
| `article-template.html` | `sections/page-article.liquid` + `templates/article.json` |
| `<page>.html` (static) | `sections/page-<page>.liquid` + `templates/page.<page>.json` |
| `404.html` | `sections/page-404.liquid` + `templates/404.json` |
| `401.html` | `layout/password.liquid` (no sections — full layout) |

**Filename collision check**: confirm no two assets share a name once `images/` and `fonts/` flatten into `assets/`. Prefix font files if needed and update CSS.

---

## 4. Asset URL rewrite rules

### 4.1 CSS

In any Webflow CSS that uses relative paths to siblings:

```
url('../images/foo.png')   →  url('foo.png')
url("../fonts/bar.woff2")  →  url("bar.woff2")
url(../images/foo.png)     →  url(foo.png)
```

Shopify serves everything in `assets/` at the same flat path, so a CSS-relative `url('foo.png')` resolves to `assets/foo.png`. **Don't** rename CSS to `.css.liquid` — it skips CDN edge caching for no benefit when the folder is flat.

One-liner (POSIX sed):

```bash
sed -i "s|\.\./fonts/||g; s|\.\./images/||g" assets/*.css
```

### 4.2 HTML / Liquid

In templates, sections, layouts:

| Find | Replace |
|---|---|
| `<link href="css/X.css" rel="stylesheet" ...>` | `{{ 'X.css' | asset_url | stylesheet_tag }}` |
| `<script src="js/X.js" ...>` | `<script src="{{ 'X.js' | asset_url }}"></script>` |
| `src="images/X.png"` | `src="{{ 'X.png' | asset_url }}"` |
| `srcset="images/A.webp 500w, images/B.webp 800w"` | rewrite each token to `{{ 'A.webp' | asset_url }} 500w, ...` |
| `href="images/X.svg"` | `href="{{ 'X.svg' | asset_url }}"` |
| `url(images/X.png)` (inline style) | `url({{ 'X.png' | asset_url }})` |

A small Node script handles this in bulk. See `convert.cjs` in this repo's history for the pattern.

### 4.3 Internal `.html` link rewrites

| Webflow href | Shopify route |
|---|---|
| `index.html` | `{{ routes.root_url }}` |
| `<static>.html` | `{{ routes.root_url }}pages/<handle>` |
| `shop.html` | `{{ routes.collections_url }}/all` |
| `blog.html` | `{{ routes.root_url }}blogs/news` |
| `product-template.html` | `{{ product.url }}` or `{{ routes.collections_url }}/all` |
| `article-template.html` | `{{ article.url }}` or blog list |
| `404.html` | `/404` |
| `401.html` | `/password` |

---

## 5. `layout/theme.liquid` skeleton

Copy from `index.html`'s head/body skeleton. Key edits:

```liquid
{%- liquid
  case template
    when 'index'
      assign wf_page_id = '<homepage data-wf-page>'
    when 'product'
      assign wf_page_id = '<product data-wf-page>'
    # ...one statement per line inside {% liquid %} — semicolons are NOT valid separators
    else
      assign wf_page_id = '<homepage data-wf-page>'
  endcase
-%}
<!DOCTYPE html>
<html data-wf-page="{{ wf_page_id }}" data-wf-site="<your data-wf-site>" lang="{{ request.locale.iso_code | default: 'en-AU' }}">
<head>
  <meta charset="utf-8">
  <title>{{ page_title }} ... – {{ shop.name }}</title>
  <!-- meta, favicon, css links via asset_url -->
  {{ 'normalize.css' | asset_url | stylesheet_tag }}
  {{ 'components.css' | asset_url | stylesheet_tag }}
  {{ '<site>.css' | asset_url | stylesheet_tag }}
  <!-- ...inline Webflow JS detector + Swiper helpers... -->
  {{ content_for_header }}   <!-- REQUIRED inside <head> -->
</head>
<body>
  <div class="page-wrapper">
    <!-- cursor, global styles (verbatim from Webflow) -->
    {% sections 'header-group' %}
    {{ content_for_layout }}
    {% sections 'footer-group' %}
  </div>
  <!-- jQuery (Webflow CDN), main JS bundle (asset_url), GSAP -->
</body>
</html>
```

**Rules:**
- `{{ content_for_header }}` MUST be in `<head>` (Shopify injects analytics/apps here).
- Keep the existing `<main class="main-wrapper">` inside each section — don't wrap with a duplicate `<main>` here.
- Don't strip the `data-wf-page` / `data-wf-site` attributes — Webflow's JS keys off them.

---

## 6. Section-per-page pattern

For each source HTML page:

1. **Slice** the content between `</header>` and `<footer ...>` (or `<main>...</main>`).
2. **Save** as `sections/page-<name>.liquid`.
3. **Rewrite** asset URLs and internal `.html` hrefs per §4.
4. **Append** a `{% schema %} ... {% endschema %}` block:
   ```liquid
   {% schema %}
   {
     "name": "Page <name>",
     "settings": [ { "type": "paragraph", "content": "Imported from Webflow." } ],
     "presets": [{ "name": "Page <name>" }]
   }
   {% endschema %}
   ```
5. **Wire** a `templates/<name>.json` (or `templates/page.<name>.json` for static pages):
   ```json
   { "sections": { "main": { "type": "page-<name>" } }, "order": ["main"] }
   ```

**Splitting further** *(recommended for the homepage and any landing page the merchant should be able to rearrange)*: slice into one section file per top-level `<section>` element on the page and list each in the JSON template's `order` array. See §6.1.

---

## 6.1 Per-block split recipe

Goal: every top-level `<section class="...">` in a Webflow page becomes a standalone Shopify section file, with at minimum a **show / hide toggle** and a **product picker** for any commerce CTA, so the merchant can rearrange/edit blocks in the theme editor.

### Webflow's two section flavours

Look at the outermost class on each `<section>` — the prefix tells you whether the block is reusable or page-specific. **Audit this before naming any files.**

| Webflow class prefix | Meaning | Shopify file location |
|---|---|---|
| `home_*_section`, `about_*_section`, `shop_*_section`, `blog_*_section`, `article_*_section`, `contact_*_section`, `product_*_section` | **Page-specific** — appears on one page only (the home banner, the blog header, etc.) | `sections/<page>-<NN>-<slug>.liquid` |
| `component_*_section` | **Reusable component** — Webflow's design system intends it to appear on multiple pages (newsletter sign-up, news feed, FAQ, testimonials, etc.) | `sections/component-<slug>.liquid` |

Run this audit on a fresh Webflow export to see which components are reused and where:

```bash
for f in *.html; do
  printf "\n--- %s ---\n" "$f"
  grep -oE '<section[^>]*class="[^"]*component_[a-z_]+_section[^"]*"' "$f" \
    | grep -oE 'component_[a-z_]+_section' | sort -u
done
```

### Naming convention

**Page-specific sections** — keep the page prefix and a 2-digit order index so the file list reads in render order:

```
sections/home-01-banner.liquid          # home_banner_section
sections/home-02-overview.liquid        # home_overview_section
sections/home-06-story.liquid           # home_story_section
sections/about-01-intro.liquid          # about_intro_section
sections/article-01-hero.liquid         # article_hero_section
```

**Reusable component sections** — flat name, no page prefix, no order index (each page that uses it picks its own position in its own JSON template):

```
sections/component-marquee.liquid
sections/component-explore.liquid
sections/component-blurb.liquid
sections/component-platform.liquid
sections/component-product-overview.liquid
sections/component-testimonial.liquid
sections/component-faq.liquid
sections/component-newsletter.liquid
sections/component-news.liquid
```

A Shopify section file is its own **type** — multiple JSON templates can reference the same type, so the markup lives once and stays in sync everywhere it's used.

### Minimum schema every split section gets

```liquid
{%- if section.settings.show_section -%}
<!-- ...original Webflow markup verbatim... -->
{%- endif -%}

{% schema %}
{
  "name": "Home — Banner",
  "tag": "section",
  "class": "shopify-section-home-banner",
  "settings": [
    { "type": "checkbox", "id": "show_section", "label": "Show this section", "default": true },
    { "type": "header", "content": "Imported from Webflow" },
    { "type": "paragraph", "content": "Edit text/images here as you split further. Default values match the static export." }
  ],
  "presets": [{ "name": "Home — Banner" }]
}
{% endschema %}
```

**Why `show_section` defaults to `true`**: the page renders identically to the Webflow original out of the box. Merchants can toggle a section off without deleting it.

### When a section contains a commerce CTA

Add a `product` picker + `cta_url_fallback` + `cta_label` to the schema:

```json
{ "type": "product", "id": "cta_product", "label": "Product for primary CTA" },
{ "type": "url",     "id": "cta_url",     "label": "Custom URL (overrides product)" },
{ "type": "text",    "id": "cta_label",   "label": "CTA button label", "default": "Buy Now" }
```

Then in the markup:

```liquid
{%- assign _cta_url = section.settings.cta_url -%}
{%- if _cta_url == blank and section.settings.cta_product -%}
  {%- assign _cta_url = section.settings.cta_product.url -%}
{%- endif -%}
{%- assign _cta_url = _cta_url | default: routes.collections_url | append: '/all' -%}
<a href="{{ _cta_url }}" class="button-primary w-button">{{ section.settings.cta_label | default: 'Buy Now' }}</a>
```

Same pattern for **collection** pickers (use `"type": "collection"`), **blog** pickers, **link_list** pickers.

### Conditional visibility for blocks within a section

Inside repeating areas (testimonials, FAQ items, news cards), use `schema.blocks` so merchants can add/remove items. The render loop is:

```liquid
{%- for block in section.blocks -%}
  {%- if block.settings.is_visible -%}
    <div {{ block.shopify_attributes }}>…{{ block.settings.heading }}…</div>
  {%- endif -%}
{%- endfor -%}
```

With block schema:

```json
"blocks": [
  {
    "type": "item",
    "name": "Item",
    "settings": [
      { "type": "checkbox", "id": "is_visible", "label": "Visible", "default": true },
      { "type": "text", "id": "heading", "label": "Heading" }
    ]
  }
]
```

### `templates/index.json` after splitting

Each section gets its own entry, with the `type` matching the section file name (page-specific or component). Multiple page templates can reuse the same component types.

```json
{
  "sections": {
    "banner":           { "type": "home-01-banner",             "settings": { "show_section": true } },
    "overview":         { "type": "home-02-overview",           "settings": { "show_section": true } },
    "marquee":          { "type": "component-marquee",          "settings": { "show_section": true } },
    "explore":          { "type": "component-explore",          "settings": { "show_section": true } },
    "blurb":            { "type": "component-blurb",            "settings": { "show_section": true } },
    "story":            { "type": "home-06-story",              "settings": { "show_section": true } },
    "platform":         { "type": "component-platform",         "settings": { "show_section": true } },
    "product-overview": { "type": "component-product-overview", "settings": { "show_section": true } },
    "testimonial":      { "type": "component-testimonial",      "settings": { "show_section": true } },
    "faq":              { "type": "component-faq",              "settings": { "show_section": true } },
    "newsletter":       { "type": "component-newsletter",       "settings": { "show_section": true } },
    "news":             { "type": "component-news",             "settings": { "show_section": true } }
  },
  "order": ["banner","overview","marquee","explore","blurb","story","platform","product-overview","testimonial","faq","newsletter","news"]
}
```

Then on every *other* page that uses the same component, reference the same `type` in that page's JSON template — for example `templates/page.about.json` includes `"newsletter": { "type": "component-newsletter" }` and gets the same section automatically. Update the markup once, all pages get it.

Delete the old monolithic `sections/page-<name>.liquid` after splitting — keeping both leaves dead code.

### Automation

The split is mechanical — write it once as a Node script. The script:

1. Reads `sections/page-<name>.liquid`.
2. Slices `<section class="...">…</section>` blocks at the **outermost** depth (be careful: some Webflow pages have nested `<section>` tags — match by indentation level, not just `<section>`).
3. Writes each to `sections/<page>-<NN>-<slug>.liquid` with the minimum schema appended.
4. Generates a fresh `templates/<page>.json` with sections listed in render order.

Save the script alongside `convert.cjs` — it's reusable across Webflow exports.

---

## 7. Dynamic data binding (commerce pages)

### Product page (`page-product.liquid`)

| Static markup | Replace with |
|---|---|
| `<h1>Panthor Complete Strength System</h1>` | `<h1>{{ product.title \| default: '<static fallback>' }}</h1>` |
| `<p>$50,000</p>` | `<p>{% if product != blank %}{{ product.price \| money }}{% else %}$50,000{% endif %}</p>` |
| `<p>...description...</p>` | wrap in `{% if product != blank and product.description != blank %}{{ product.description }}{% else %}<static p>{% endif %}` |
| `<img src="images/featured.webp">` | `{% if product.featured_image %}{{ product.featured_image \| image_url: width: 1360 }}{% else %}<static>{% endif %}` |
| Variant buttons | inside `{% form 'product', product %}`, render `{% for variant in product.variants %}<button name="id" value="{{ variant.id }}">{{ variant.title }}</button>{% endfor %}` |
| Quantity input | add `name="quantity"` |
| Add-to-cart button | `<button type="submit" name="add">Add to cart</button>{% endform %}` |

### Collection page

Wrap the existing product-card grid with:

```liquid
{%- if collection != blank and collection.products.size > 0 -%}
  {%- paginate collection.products by 24 -%}
    {%- for product in collection.products -%}
      <a href="{{ product.url }}" class="component_product_card">…</a>
    {%- endfor -%}
    {{ paginate | default_pagination }}
  {%- endpaginate -%}
{%- else -%}
  <!-- original static cards as fallback -->
{%- endif -%}
```

### Blog list / article

Same pattern with `blog.articles` and `article.title / article.image / article.content / article.published_at`.

---

## 8. Forms

### Newsletter (Webflow `wf-form-Newsletter-Form`)

```liquid
{%- form 'customer', id: 'wf-form-Newsletter-Form', class: 'component_newsletter_form' -%}
  <input type="hidden" name="contact[tags]" value="newsletter">
  <input type="email" name="contact[email]" ...>
  <input type="checkbox" name="contact[accepts_marketing]" ...>
  <button type="submit">Submit</button>
  {% render 'wf-form-states', form: form %}
{%- endform -%}
```

### Contact / Enquiry

```liquid
{%- form 'contact', id: 'wf-form-Enquiry-Form', class: 'component_form' -%}
  <input name="contact[name]" required>
  <input name="contact[email]" type="email" required>
  <textarea name="contact[body]"></textarea>
  <button type="submit">Submit</button>
  {% render 'wf-form-states', form: form %}
{%- endform -%}
```

### Password page (`layout/password.liquid`)

```liquid
{%- form 'storefront_password' -%}
  <input type="password" name="password" required>
  <button type="submit">Submit</button>
  {%- if form.errors -%}<div class="w-form-fail">Incorrect password.</div>{%- endif -%}
{%- endform -%}
```

The `wf-form-states` snippet renders success/error blocks that match Webflow's `.w-form-done` / `.w-form-fail` classes, so existing CSS keeps styling them.

---

## 9. Header / footer section groups (OS 2.0)

Header markup (logo + nav + cart icon) goes in `sections/header.liquid` with a schema exposing logo image and menu picker. Footer similar, with social-link blocks.

Bind each with a section group JSON file:

```json
// sections/header-group.json
{
  "type": "header",
  "name": "Header group",
  "sections": { "header": { "type": "header" } },
  "order": ["header"]
}
```

Then in `theme.liquid`: `{% sections 'header-group' %}`.

---

## 10. Webflow JS preservation gotchas

- **`data-wf-page` per page** — Webflow interactions key off this. Per-template override via `{% case template %}` in `theme.liquid`.
- **`data-wf-site` is constant** — hardcode it.
- **Section render API** — Shopify's live theme editor re-injects sections via XHR. Webflow's interactions only run on `DOMContentLoaded` and won't re-init. Merchants must refresh the editor preview to see animations.
- **CDN scripts** stay external — jQuery, GSAP, Swiper. Don't self-host unless needed.
- **`<form action="webflow.com/...">`** is dead in Shopify. All forms must use `{% form %}`.

---

## 11. Required Shopify theme files (don't skip!)

A Webflow export has none of these. Shopify rejects the theme — with the (misleading) error **"Role can't be set to main: missing required file layout/theme.liquid"** — if any are absent at publish time. Add stubs even when you don't have Webflow designs for them.

### Layout
- `layout/theme.liquid` — main wrapper for every chromed page.
- `layout/password.liquid` — wrapper for the storefront password page. Should just render `{{ content_for_layout }}`; the form belongs in a section.

### Templates
- `templates/index.{liquid,json}`
- `templates/product.{liquid,json}`
- `templates/collection.{liquid,json}`
- `templates/list-collections.{liquid,json}` — the `/collections` route. Easy to miss.
- `templates/page.{liquid,json}` (+ alternates like `page.about.json`)
- `templates/blog.{liquid,json}`
- `templates/article.{liquid,json}`
- `templates/search.{liquid,json}`
- `templates/cart.{liquid,json}`
- `templates/404.{liquid,json}`
- `templates/password.{liquid,json}` — content for the password page. The layout alone isn't enough.
- `templates/gift_card.liquid` — **must be `.liquid`, not `.json`** (it's a full standalone HTML doc, no theme layout).

### Customer templates (all 7 required, all `.liquid`)
- `templates/customers/account.liquid`
- `templates/customers/activate_account.liquid`
- `templates/customers/addresses.liquid`
- `templates/customers/login.liquid`
- `templates/customers/order.liquid`
- `templates/customers/register.liquid`
- `templates/customers/reset_password.liquid`

Each uses a built-in Shopify form: `customer_login`, `create_customer`, `customer_address`, `reset_customer_password`, `recover_customer_password`, `activate_customer_password`. Stub them with the Webflow form classes (`component_form`, `w-input`, `w-button`) so existing CSS styles them automatically.

### Config & locales
- `config/settings_schema.json`
- `config/settings_data.json`
- `locales/en.default.json` (at minimum — other locales optional)

### One-liner check before pushing

```bash
for f in layout/theme.liquid layout/password.liquid \
  templates/index.json templates/product.json templates/collection.json \
  templates/list-collections.json templates/page.json templates/blog.json \
  templates/article.json templates/search.json templates/cart.json \
  templates/404.json templates/password.json templates/gift_card.liquid \
  templates/customers/account.liquid templates/customers/activate_account.liquid \
  templates/customers/addresses.liquid templates/customers/login.liquid \
  templates/customers/order.liquid templates/customers/register.liquid \
  templates/customers/reset_password.liquid \
  config/settings_schema.json config/settings_data.json \
  locales/en.default.json; do
    [ -e "$f" ] || echo "MISSING: $f"
done
```

---

## 12. Verification

1. `shopify theme dev --store <dev>.myshopify.com`
2. Visit every route and side-by-side compare to the original Webflow HTML:
   - `/` `/products/<test>` `/collections/all` `/blogs/news` `/blogs/news/<article>`
   - `/pages/about`, `/pages/contact`, `/pages/legal`, etc.
   - `/cart` `/search` `/404` `/password`
   - `/account`, `/account/login`, `/account/register`
   - `/collections` (list-collections)
3. Browser DevTools: confirm no 404s on assets, no JS errors, fonts load.
4. Theme editor: open each template, reorder a section on the homepage, confirm preview updates (with refresh for Webflow animations).
5. Submit the contact form — verify email in admin → Settings → Notifications.
6. Submit the newsletter — verify a customer is created with `newsletter` tag.
7. **Try publishing** in Shopify Admin → Themes → "Publish". This is the only way to catch missing-required-template errors *before* customers see them. If you get **"Role can't be set to main: missing required file …"**, the named file is missing OR contains a Liquid parse error (Shopify reports parse errors as missing). Don't trust the error text literally — check §13 for both root causes.
8. `shopify theme check` — fix flagged issues *without* touching the original Webflow markup.

---

## 13. Common gotchas

- **"Missing required file layout/theme.liquid" when the file exists.** This error fires when (a) any required template from §11 is actually missing, OR (b) `layout/theme.liquid` has a Liquid parse error that prevents loading. Shopify reports parse failures as if the file were missing.
- **`{% liquid %}` tag uses one statement per line.** Semicolons are NOT valid separators. This crashes parsing silently and triggers the "missing layout/theme.liquid" error above. ❌ `when 'index' ; assign x = 'a'` ✅
  ```liquid
  {%- liquid
    case template
      when 'index'
        assign x = 'a'
      when 'product'
        assign x = 'b'
    endcase
  -%}
  ```
- **Flat assets**: Shopify rejects subdirs in `assets/`. Flatten ruthlessly.
- **Double `<main>`**: each Webflow page has its own `<main class="main-wrapper">`. Don't wrap `{{ content_for_layout }}` with another `<main>` in `theme.liquid`.
- **Form `action` URLs**: Webflow forms post to `webflow.com`. After conversion to `{% form %}`, the action is replaced by Shopify — old `action=...` attrs are ignored.
- **Class names**: do NOT rename. Webflow JS, GSAP triggers, and CSS all depend on them.
- **`url(...)` in inline `<style>` blocks**: rare but check. Same rewrite rule as in CSS files.
- **HTTP vs HTTPS**: Webflow's CDN scripts already use `https://`. Leave them.
- **Cart drawer / line item properties**: Webflow doesn't model these. Add later via section blocks if needed.
- **`gift_card.liquid` is a full HTML doc** — it doesn't go through `layout/theme.liquid` and must contain its own `<!DOCTYPE html>` / `<head>` / `<body>` and load its own CSS. Don't reference `{{ content_for_header }}` from theme.liquid here.
- **`layout/password.liquid` and `templates/password.json` are separate.** The layout is just the HTML shell; the form/section goes in the template. Putting the form in the layout works visually but breaks the principle that templates own their content and editor sections.

---

## 14. What this conversion does NOT do

- Re-style any element. CSS is byte-identical.
- Rebuild the JS bundle. Webflow's `panthor-dev.js` ships verbatim.
- Convert the "Customise Your Machine" product UI into Shopify variants/line item properties. Currently static placeholder.
- Map Webflow CMS collections to Shopify metafields. (This export had no CMS lists.)
- Wire up Klaviyo / Mailchimp newsletter sync.

These are good follow-up tasks once visual parity is verified.
