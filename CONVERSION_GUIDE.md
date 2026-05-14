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
    when 'index'         ; assign wf_page_id = '<homepage data-wf-page>'
    when 'product'       ; assign wf_page_id = '<product data-wf-page>'
    # ...
    else                 ; assign wf_page_id = '<homepage data-wf-page>'
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

**Splitting further**: if the merchant needs to reorder/edit individual blocks, slice the section into one section file per top-level `<section>` element on the page and add each to the JSON template's `order` array. Default: one section per page (simpler, equally valid OS 2.0).

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

## 11. Verification

1. `shopify theme dev --store <dev>.myshopify.com`
2. Visit every route and side-by-side compare to the original Webflow HTML:
   - `/` `/products/<test>` `/collections/all` `/blogs/news` `/blogs/news/<article>`
   - `/pages/about`, `/pages/contact`, `/pages/legal`, etc.
   - `/cart` `/search` `/404` `/password`
3. Browser DevTools: confirm no 404s on assets, no JS errors, fonts load.
4. Theme editor: open each template, reorder a section on the homepage, confirm preview updates (with refresh for Webflow animations).
5. Submit the contact form — verify email in admin → Settings → Notifications.
6. Submit the newsletter — verify a customer is created with `newsletter` tag.
7. `shopify theme check` — fix flagged issues *without* touching the original Webflow markup.

---

## 12. Common gotchas

- **Flat assets**: Shopify rejects subdirs in `assets/`. Flatten ruthlessly.
- **Double `<main>`**: each Webflow page has its own `<main class="main-wrapper">`. Don't wrap `{{ content_for_layout }}` with another `<main>` in `theme.liquid`.
- **Form `action` URLs**: Webflow forms post to `webflow.com`. After conversion to `{% form %}`, the action is replaced by Shopify — old `action=...` attrs are ignored.
- **Class names**: do NOT rename. Webflow JS, GSAP triggers, and CSS all depend on them.
- **`url(...)` in inline `<style>` blocks**: rare but check. Same rewrite rule as in CSS files.
- **HTTP vs HTTPS**: Webflow's CDN scripts already use `https://`. Leave them.
- **Customer account pages**: not in this conversion — Shopify uses fallback templates if not provided. Add `templates/customers/*.liquid` later if you want them styled to match.
- **Cart drawer / line item properties**: Webflow doesn't model these. Add later via section blocks if needed.

---

## 13. What this conversion does NOT do

- Re-style any element. CSS is byte-identical.
- Rebuild the JS bundle. Webflow's `panthor-dev.js` ships verbatim.
- Convert the "Customise Your Machine" product UI into Shopify variants/line item properties. Currently static placeholder.
- Map Webflow CMS collections to Shopify metafields. (This export had no CMS lists.)
- Wire up Klaviyo / Mailchimp newsletter sync.

These are good follow-up tasks once visual parity is verified.
