# Claude project guide

This file gives AI assistants (Claude, Copilot, Cursor, etc.) the context they need to write good commit messages and PRs for this repo. It is also loaded automatically by Claude Code.

---

## What this repo is

A **Shopify Online Store 2.0 theme** converted from a Webflow export for the Panthor brand. The original Webflow export lives in `webflow-source/` for side-by-side verification and is excluded from theme deploys via `.shopifyignore`. Shopify theme files (assets/, config/, layout/, sections/, snippets/, templates/) live at the repo root where Shopify's GitHub integration expects them.

The conversion is **visual-parity first** — original Webflow CSS, JS bundle, class names, and `data-wf-*` attributes are preserved verbatim. See `CONVERSION_GUIDE.md` for the recipe.

---

## Repo layout

**Shopify theme files** (at repo root — picked up by Shopify CLI / GitHub integration):

| Path | What lives here |
|---|---|
| `assets/` | Flat folder — CSS, JS, fonts, images. Shopify forbids subdirs. |
| `config/` | `settings_schema.json` (theme settings) + `settings_data.json` (values). |
| `layout/` | `theme.liquid` (main wrapper) + `password.liquid`. |
| `locales/` | i18n strings (`en.default.json`). |
| `sections/` | `header.liquid`, `footer.liquid`, `home-*` (page-specific), `component-*` (reusable across pages), `page-*` (static pages), `main-*` (cart/search/404/password/list-collections). |
| `snippets/` | `social-icon.liquid`, `wf-form-states.liquid`, `cart-drawer.liquid`, `theme-variables.liquid`. |
| `templates/` | JSON templates wiring sections to routes; `customers/*.liquid` (required); `gift_card.liquid` (required, must be .liquid). |
| `.shopifyignore` | Excludes `webflow-source/`, `webflow-to-shopify-kit/`, `.agents/`, conversion scripts, and docs from theme uploads. |

**Source + tooling** (at repo root — excluded from theme deploys):

| Path | What lives here |
|---|---|
| `webflow-source/` | Original Webflow export — all `*.html` plus `css/`, `js/`, `images/`, `fonts/`. Reference only, never deployed. |
| `webflow-to-shopify-kit/` | Reusable starter kit for converting other Webflow exports. Self-contained — copy this folder to a new project. |
| `.agents/skills/` | Shopify's official AI-assistant skills (shopify-dev, shopify-liquid) for Claude Code / Copilot / Cursor / etc. |
| `CONVERSION_GUIDE.md` | The full recipe — every step, every gotcha. |
| `CLAUDE.md` | This file — AI commit-message context. |
| `convert.cjs`, `convert-forms.cjs`, `split-home.cjs`, `rename-component-schemas.cjs` | One-shot bulk-conversion scripts (already run; kept for re-runs and reference). |
| `sample-products.csv` | Shopify product import for the Panthor Complete Strength System with 3 variants. |

---

## Commit message conventions

Use **Conventional Commits**: `type(scope): short imperative summary`. Keep the summary ≤ 72 chars; add a body only when the *why* needs explaining.

### Types

| Type | When to use |
|---|---|
| `feat` | New section, new template, new merchant-editable setting. |
| `fix` | Broken layout, missing asset, wrong Liquid output, form submitting incorrectly. |
| `style` | CSS-level adjustments only (rare — most styles come from the Webflow CSS). |
| `refactor` | Restructure sections, extract snippets, rename schema settings without changing output. |
| `chore` | Asset re-flattening, dependency bumps, conversion script tweaks, `.shopifyignore` edits. |
| `docs` | Updates to `CONVERSION_GUIDE.md`, `CLAUDE.md`, inline comments. |
| `content` | Default copy/image swaps in section schemas. (Not standard Conventional Commits, but useful here.) |
| `perf` | Image format swaps, lazy-load tweaks, removing unused JS. |

### Scopes

Pick the narrowest scope that fits. Common scopes for this repo:

- `theme` — `layout/theme.liquid`, `layout/password.liquid`
- `header`, `footer` — header/footer sections + section groups
- `home`, `product`, `collection`, `blog`, `article`, `cart`, `search`, `404` — corresponding section + template
- `page-<name>` — static pages: `page-about`, `page-contact`, `page-legal`, `page-affiliates`, `page-thank-you`, `page-style-guide`
- `forms` — newsletter / contact / password form wiring across files
- `assets` — anything inside `assets/`
- `config` — `settings_schema.json` / `settings_data.json`
- `locales` — translation files
- `snippets` — `snippets/*.liquid`
- `guide` — `CONVERSION_GUIDE.md` or `CLAUDE.md`
- `webflow-bridge` — anything related to preserving Webflow JS bundle / `data-wf-*` attributes

### Examples that fit this repo

```
feat(home): split hero into its own section so merchants can swap the image
fix(product): wire Add to Cart button into {% form 'product' %} block
fix(forms): map newsletter email field to contact[email]
refactor(footer): move social SVGs into snippets/social-icon
chore(assets): re-flatten new font files from latest Webflow export
docs(guide): add filename-collision check to step 3
style(product): tighten gallery slide spacing on mobile
```

### When NOT to bundle

- Don't mix a new section with a footer fix — split into two commits.
- Don't bundle asset re-flattening with template edits — they're independent.
- Cross-page form rewiring is fine as one commit if it's the same pattern applied uniformly.

---

## Things to look at before committing

1. **CSS edits**: if the diff touches `assets/*.css`, double-check — the rule is **don't modify Webflow CSS**. Style adjustments belong in section-level inline styles or a new asset file.
2. **`data-wf-*` attributes**: never strip from `<html>` or any element. Webflow's JS keys off them.
3. **Class names**: don't rename. They're load-bearing for both CSS and the bundled JS.
4. **Schema JSON**: every `{% schema %}` block must be valid JSON. The bulk-validator one-liner:
   ```bash
   node -e "const fs=require('fs');for(const f of fs.readdirSync('sections').filter(x=>x.endsWith('.liquid'))){const c=fs.readFileSync('sections/'+f,'utf8');const m=c.match(/\\{%\\s*schema\\s*%\\}([\\s\\S]*?)\\{%\\s*endschema\\s*%\\}/);if(m){try{JSON.parse(m[1])}catch(e){console.log(f+': '+e.message)}}}"
   ```
5. **Liquid tag balance**: `{% form %}` / `{% endform %}`, `{% if %}` / `{% endif %}`, etc. must balance. If you edited a section with a Shopify form, verify both ends.
6. **Asset references**: new images go in `assets/` (flat). Reference them with `{{ 'filename.ext' | asset_url }}`, never with a hard-coded path.
7. **Routes**: use `{{ routes.* }}` (`routes.root_url`, `routes.cart_url`, `routes.collections_url`, etc.) — never hard-code `/cart`, `/collections/all`, etc.

---

## PR / multi-commit guidance

When grouping commits into a PR, the title follows the same convention as the strongest individual commit. The description should call out:

- What user-facing thing changed (or didn't — visual parity)
- Whether the original Webflow markup was touched
- Any new schema settings merchants will see in the theme editor
- Verification: which routes were spot-checked

If unsure whether something deserves its own commit, ask: "would I want to revert this change independently?" If yes → own commit.
