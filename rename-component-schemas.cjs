#!/usr/bin/env node
/**
 * For each sections/component-*.liquid, rewrite the schema's `name`,
 * `class`, and the preset name so they reflect the new "reusable component"
 * naming (drop the "Home — " prefix).
 *
 * One-shot. Safe to delete after.
 */
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, 'sections');

const MAP = {
  'component-marquee.liquid':          { name: 'Marquee',          cls: 'shopify-section-component-marquee' },
  'component-explore.liquid':          { name: 'Explore',          cls: 'shopify-section-component-explore' },
  'component-blurb.liquid':            { name: 'Blurb',            cls: 'shopify-section-component-blurb' },
  'component-platform.liquid':         { name: 'Platform',         cls: 'shopify-section-component-platform' },
  'component-product-overview.liquid': { name: 'Product Overview', cls: 'shopify-section-component-product-overview' },
  'component-testimonial.liquid':      { name: 'Testimonial',      cls: 'shopify-section-component-testimonial' },
  'component-faq.liquid':              { name: 'FAQ',              cls: 'shopify-section-component-faq' },
  'component-newsletter.liquid':       { name: 'Newsletter',       cls: 'shopify-section-component-newsletter' },
  'component-news.liquid':             { name: 'News',             cls: 'shopify-section-component-news' },
};

for (const [file, { name, cls }] of Object.entries(MAP)) {
  const fp = path.join(DIR, file);
  let content = fs.readFileSync(fp, 'utf8');
  const before = content;

  // Rewrite "name": ... at the top level (first occurrence is the section name)
  content = content.replace(/("name":\s*)"Home — [^"]+"/, `$1"${name}"`);
  // Rewrite class
  content = content.replace(/("class":\s*)"shopify-section-home-[^"]+"/, `$1"${cls}"`);
  // Rewrite preset name (Home — X -> X)
  content = content.replace(/("name":\s*)"Home — [^"]+"/g, `$1"${name}"`);

  if (content === before) {
    console.log(`NO CHANGE: ${file}`);
  } else {
    fs.writeFileSync(fp, content, 'utf8');
    console.log(`UPDATED: ${file} -> "${name}"`);
  }
}
