#!/usr/bin/env node
/**
 * Splits sections/page-index.liquid into per-block sections.
 *
 * Webflow's classes use two patterns:
 *   - <section class="home_*_section">       -> page-specific  -> sections/home-NN-<slug>.liquid
 *   - <section class="component_*_section">  -> REUSABLE       -> sections/component-<slug>.liquid
 *
 * Component sections are reused across multiple pages (newsletter, news,
 * faq, testimonial, etc.) — they get a flat name without page prefix so
 * any other page's JSON template can reference the same type.
 *
 * The script also writes templates/index.json with the section render order.
 *
 * One-shot. Safe to delete after running.
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'sections', 'page-index.liquid');
const OUT_DIR = path.join(ROOT, 'sections');
const TEMPLATE = path.join(ROOT, 'templates', 'index.json');

// Section boundaries in the source file (1-based, inclusive).
// `kind` decides naming + whether the section is page-specific or reusable.
const BOUNDARIES = [
  { kind: 'home',      orderIdx: 1,  slug: 'banner',           name: 'Home — Banner',  startLine: 2,   endLine: 21  },
  { kind: 'home',      orderIdx: 2,  slug: 'overview',         name: 'Home — Overview', startLine: 22,  endLine: 63  },
  { kind: 'component', slug: 'marquee',          name: 'Marquee',          startLine: 64,  endLine: 115 },
  { kind: 'component', slug: 'explore',          name: 'Explore',          startLine: 116, endLine: 166 },
  { kind: 'component', slug: 'blurb',            name: 'Blurb',            startLine: 167, endLine: 263 },
  { kind: 'home',      orderIdx: 6,  slug: 'story',            name: 'Home — Story',    startLine: 264, endLine: 284 },
  { kind: 'component', slug: 'platform',         name: 'Platform',         startLine: 285, endLine: 324 },
  { kind: 'component', slug: 'product-overview', name: 'Product Overview', startLine: 325, endLine: 579 },
  { kind: 'component', slug: 'testimonial',      name: 'Testimonial',      startLine: 580, endLine: 677 },
  { kind: 'component', slug: 'faq',              name: 'FAQ',              startLine: 678, endLine: 785 },
  { kind: 'component', slug: 'newsletter',       name: 'Newsletter',       startLine: 786, endLine: 815 },
  { kind: 'component', slug: 'news',             name: 'News',             startLine: 816, endLine: 972 },
];

function pad2(n) { return n < 10 ? '0' + n : String(n); }

function fileNameFor(b) {
  return b.kind === 'home'
    ? `home-${pad2(b.orderIdx)}-${b.slug}.liquid`
    : `component-${b.slug}.liquid`;
}

function schemaFor(b) {
  const cls = b.kind === 'home'
    ? `shopify-section-home-${b.slug}`
    : `shopify-section-component-${b.slug}`;
  return {
    name: b.name,
    tag: 'section',
    class: cls,
    settings: [
      { type: 'checkbox', id: 'show_section', label: 'Show this section', default: true },
      { type: 'header', content: 'Imported from Webflow' },
      { type: 'paragraph', content: 'Markup is preserved verbatim from the Webflow export. Add more settings here to make text/images merchant-editable.' }
    ],
    presets: [{ name: b.name }]
  };
}

const src = fs.readFileSync(SRC, 'utf8');
const lines = src.split(/\r?\n/);

const orderKeys = [];
const sectionsManifest = {};

for (const b of BOUNDARIES) {
  const slice = lines.slice(b.startLine - 1, b.endLine).join('\n');
  const fileName = fileNameFor(b);
  const schemaBlock = `\n\n{% schema %}\n${JSON.stringify(schemaFor(b), null, 2)}\n{% endschema %}\n`;
  const content =
`{%- if section.settings.show_section -%}
${slice}
{%- endif -%}${schemaBlock}`;
  fs.writeFileSync(path.join(OUT_DIR, fileName), content, 'utf8');
  console.log(`WROTE sections/${fileName}`);

  const sectionType = fileName.replace(/\.liquid$/, '');
  const orderKey = b.slug;
  orderKeys.push(orderKey);
  sectionsManifest[orderKey] = {
    type: sectionType,
    settings: { show_section: true }
  };
}

const template = { sections: sectionsManifest, order: orderKeys };
fs.writeFileSync(TEMPLATE, JSON.stringify(template, null, 2) + '\n', 'utf8');
console.log(`WROTE templates/index.json`);
console.log(`\nDone. Verify rendering, then delete sections/page-index.liquid.`);
