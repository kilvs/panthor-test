# Webflow → Shopify OS 2.0 Kit

A self-contained starter kit that turns any Webflow static-site export into a publishable Shopify Online Store 2.0 theme. Visual parity first, merchant-editable second, commerce-functional third.

Drop this folder next to the unzipped Webflow export, run the scripts in order, fill in the placeholders in `starter-theme/`, and you have a working Shopify theme that passes publish-time validation.

---

## What's in this kit

```
webflow-to-shopify-kit/
├── README.md                 # this file
├── CONVERSION_GUIDE.md       # full ~700-line recipe with every step + gotcha
├── scripts/
│   ├── install-skills.sh     # one-shot: installs shopify-dev + shopify-liquid AI skills
│   ├── install-skills.ps1    # PowerShell equivalent for Windows
│   ├── convert.cjs           # bulk page-content extractor (HTML → sections + templates)
│   ├── convert-forms.cjs     # bulk Webflow newsletter form → Shopify {% form %} converter
│   ├── split-page.cjs        # splits one monolithic page section into per-block sections
│   └── check-required-files.sh  # pre-push verifier — confirms Shopify's required files exist
└── starter-theme/            # universal theme files you can copy verbatim
    ├── assets/
    │   ├── cart-ajax.js      # AJAX cart module — vanilla JS, no jQuery dep
    │   └── cart-drawer.css   # drawer styling, scoped under .cart-drawer__*
    ├── config/
    │   ├── settings_schema.json
    │   └── settings_data.json
    ├── layout/
    │   ├── theme.liquid      # PLACEHOLDERS for data-wf-site + per-template wf_page_id
    │   └── password.liquid
    ├── locales/
    │   └── en.default.json
    ├── sections/
    │   ├── main-cart.liquid
    │   ├── main-search.liquid
    │   ├── main-password.liquid
    │   └── main-list-collections.liquid
    ├── snippets/
    │   ├── cart-drawer.liquid
    │   ├── wf-form-states.liquid
    │   └── social-icon.liquid
    ├── templates/
    │   ├── 404.json
    │   ├── cart.json
    │   ├── search.json
    │   ├── password.json
    │   ├── list-collections.json
    │   ├── gift_card.liquid     # MUST be .liquid, not .json
    │   └── customers/
    │       ├── account.liquid
    │       ├── activate_account.liquid
    │       ├── addresses.liquid
    │       ├── login.liquid
    │       ├── order.liquid
    │       ├── register.liquid
    │       └── reset_password.liquid
    └── .shopifyignore
```

Brand-specific files (`sections/header.liquid`, `sections/footer.liquid`, `sections/page-*.liquid`) are NOT included — those come out of the source HTML via the scripts.

---

## Quickstart

### Prerequisites
- Node.js 18+ (with `pnpm` or `npx`)
- The Webflow export unzipped at a known location
- A Shopify dev store (`shopify.dev/themes/getting-started`)

### Step 0 — install Shopify's AI-assistant skills (recommended)

From your new project's root, run the bundled installer to drop **shopify-dev** + **shopify-liquid** skills into `.agents/skills/`:

```bash
# Unix / git-bash
bash webflow-to-shopify-kit/scripts/install-skills.sh

# Windows PowerShell
pwsh webflow-to-shopify-kit/scripts/install-skills.ps1
```

These are Shopify's official skills for AI coding assistants (Claude Code, GitHub Copilot, Cursor, Amp, Cline, Codex, etc.). Once installed, any AI agent working on the repo has authoritative reference for Liquid tags, Shopify objects, the cart/customer/product APIs, and theme architecture — meaning fewer hallucinated Liquid filters, less guessing about schema settings, faster, more correct PRs.

Commit `.agents/` so collaborators get them too:

```powershell
git add .agents
git commit -m "chore: add shopify-dev + shopify-liquid skills"
```

Skip this step if you're not using AI tooling — nothing else in the kit depends on it.

### Step 1 — audit the source

From inside the unzipped Webflow export:

```bash
# Reusable components vs page-specific sections
for f in *.html; do
  printf "\n--- %s ---\n" "$f"
  grep -oE '<section[^>]*class="[^"]*component_[a-z_]+_section[^"]*"' "$f" \
    | grep -oE 'component_[a-z_]+_section' | sort -u
done

# data-wf-page per page (you'll need these for theme.liquid)
for f in *.html; do echo "$f: $(grep -o 'data-wf-page="[^"]*"' "$f" | head -1)"; done

# data-wf-site (should be constant)
grep -oE 'data-wf-site="[^"]+"' *.html | head -1
```

### Step 2 — flatten assets

```bash
mkdir -p assets
cp css/*.css js/*.js images/* fonts/* assets/

# Rewrite ../fonts/ and ../images/ from CSS:
sed -i "s|\.\./fonts/||g; s|\.\./images/||g" assets/*.css
```

Check for collisions: `ls assets/ | sort | uniq -d` — should be empty.

### Step 3 — copy the kit's starter-theme

```bash
cp -r webflow-to-shopify-kit/starter-theme/* .
```

This drops in every Shopify-required file: layout, customer templates, gift_card, password, list-collections, AJAX cart, snippets, config, locales.

### Step 4 — fill placeholders in `layout/theme.liquid`

Search for `<your data-wf-site>` and replace with the constant `data-wf-site` value from step 1. Search for `<homepage data-wf-page>` etc. and replace with the per-template values from step 1.

### Step 5 — extract page content

Edit `webflow-to-shopify-kit/scripts/convert.cjs` to list your source HTML files in the `PAGES` array, then:

```bash
node webflow-to-shopify-kit/scripts/convert.cjs
```

Produces `sections/page-*.liquid` and `templates/*.json` for each page. Internal `*.html` links and `images/*` asset references are rewritten to Shopify routes and `{{ 'foo.png' | asset_url }}`.

### Step 6 — convert Webflow forms

```bash
node webflow-to-shopify-kit/scripts/convert-forms.cjs
```

Bulk-replaces Webflow newsletter forms with Shopify's `{% form 'customer' %}` carrying a `newsletter` tag. Contact forms (Webflow's `wf-form-Enquiry-Form`) need manual conversion — see `CONVERSION_GUIDE.md §8`.

### Step 7 — build header + footer sections

These need to be hand-built from each export because the logo SVG, nav menu, and footer socials are unique per brand. See `CONVERSION_GUIDE.md §C` for the template — copy `<header class="component_header">` from your `index.html` verbatim into `sections/header.liquid` and add a `{% schema %}` block.

### Step 8 — split high-traffic pages (optional but recommended)

For the homepage and any landing page where the merchant should be able to reorder blocks in the theme editor:

```bash
# Edit BOUNDARIES in split-page.cjs to point at your monolithic section
node webflow-to-shopify-kit/scripts/split-page.cjs
```

Output: `sections/<page>-NN-<slug>.liquid` for page-specific blocks, `sections/component-<slug>.liquid` for reusable ones (matched by Webflow's `component_*_section` class prefix).

### Step 9 — verify required files

```bash
bash webflow-to-shopify-kit/scripts/check-required-files.sh
```

Lists any Shopify-required file that's missing. Must be empty before you try to publish.

### Step 10 — preview + ship

```bash
shopify theme dev --store <your-store>.myshopify.com
# Visit /, /products/<test>, /collections/all, /pages/about, /cart, /search, /404, /password
shopify theme check  # fix flagged issues WITHOUT touching original Webflow markup
shopify theme push --unpublished
```

In Shopify Admin → Themes → publish. If you get **"Role can't be set to main: missing required file layout/theme.liquid"** the file isn't actually missing — it's a parse error OR another required file is missing. See `CONVERSION_GUIDE.md §13`.

---

## What the kit does NOT do

- Re-style anything. Webflow CSS ships as-is.
- Touch the JS bundle (`*-dev.js` from the export).
- Migrate Webflow CMS collections to Shopify metafields.
- Wire Klaviyo / Mailchimp newsletter sync.
- Auto-generate header/footer sections (logos and nav are unique per brand).
- Generate the brand's `data-wf-page` table (you provide these from step 1).

---

## Sanity checks per stage

| After step | Run this | Expected output |
|---|---|---|
| 2 | `ls assets/ \| sort \| uniq -d` | empty (no collisions) |
| 2 | `grep -c "\.\./" assets/*.css` | 0 |
| 4 | open `theme.liquid` | no `<...>` placeholders left |
| 5 | `node convert.cjs` | "OK" line per source page |
| 5 | `ls sections/page-*.liquid` | one per source HTML |
| 6 | `grep -l "<form\b" sections/*.liquid` | no Webflow newsletter forms remain |
| 9 | `bash check-required-files.sh` | "All required files present." |
| 10 | DevTools console | no 404s on fonts/images; `document.documentElement.className` contains `w-mod-js w-mod-ix3` |

---

## Reading order

1. This README for the high-level pipeline
2. `CONVERSION_GUIDE.md` for the full recipe and every gotcha worth knowing
3. The script source — each is under 200 lines and heavily commented

If you hit something not in the guide, that's a new gotcha — please log it back to `CONVERSION_GUIDE.md §13 Common gotchas` for the next conversion.
