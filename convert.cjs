#!/usr/bin/env node
/**
 * Webflow-to-Shopify page body extractor.
 * For each HTML file, slices content between </header> and <footer> (the "main"),
 * rewrites asset paths and internal links to Shopify equivalents, and writes
 * the result to sections/page-<slug>.liquid plus a templates/<name>.json.
 *
 * Page-specific dynamic data wiring (product/collection/blog/article) is added
 * separately after this script runs.
 *
 * This script is run once and may be deleted afterward.
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

const PAGES = [
  { html: 'index.html',             section: 'page-index',        template: 'index',         templateFile: 'templates/index.json' },
  { html: 'product-template.html',  section: 'page-product',      template: 'product',       templateFile: 'templates/product.json' },
  { html: 'shop.html',              section: 'page-collection',   template: 'collection',    templateFile: 'templates/collection.json' },
  { html: 'blog.html',              section: 'page-blog',         template: 'blog',          templateFile: 'templates/blog.json' },
  { html: 'article-template.html',  section: 'page-article',      template: 'article',       templateFile: 'templates/article.json' },
  { html: 'about.html',             section: 'page-about',        template: 'page.about',    templateFile: 'templates/page.about.json' },
  { html: 'affiliates.html',        section: 'page-affiliates',   template: 'page.affiliates', templateFile: 'templates/page.affiliates.json' },
  { html: 'contact.html',           section: 'page-contact',      template: 'page.contact',  templateFile: 'templates/page.contact.json' },
  { html: 'legal.html',             section: 'page-legal',        template: 'page',          templateFile: 'templates/page.json' },
  { html: 'thank-you.html',         section: 'page-thank-you',    template: 'page.thank-you', templateFile: 'templates/page.thank-you.json' },
  { html: 'style-guide.html',       section: 'page-style-guide',  template: 'page.style-guide', templateFile: 'templates/page.style-guide.json' },
  { html: '404.html',               section: 'page-404',          template: '404',           templateFile: 'templates/404.json' },
];

// Map .html links to Shopify routes
const HREF_MAP = {
  'index.html':              "{{ routes.root_url }}",
  'about.html':              "{{ routes.root_url }}pages/about",
  'shop.html':               "{{ routes.collections_url }}/all",
  'affiliates.html':         "{{ routes.root_url }}pages/affiliates",
  'blog.html':               "{{ routes.root_url }}blogs/news",
  'contact.html':            "{{ routes.root_url }}pages/contact",
  'legal.html':              "{{ routes.root_url }}pages/legal",
  'thank-you.html':          "{{ routes.root_url }}pages/thank-you",
  'style-guide.html':        "{{ routes.root_url }}pages/style-guide",
  '404.html':                "/404",
  '401.html':                "/password",
  'product-template.html':   "{{ routes.collections_url }}/all",
  'article-template.html':   "{{ routes.root_url }}blogs/news",
};

function extractMain(html) {
  // Slice between the closing </header> and the opening <footer
  const hEnd = html.indexOf('</header>');
  const fStart = html.indexOf('<footer');
  if (hEnd !== -1 && fStart !== -1 && fStart > hEnd) {
    return html.substring(hEnd + '</header>'.length, fStart).trim();
  }
  // Fallback: between <main and </main>
  const mStart = html.search(/<main\b/);
  const mEnd = html.indexOf('</main>');
  if (mStart !== -1 && mEnd !== -1) {
    return html.substring(mStart, mEnd + '</main>'.length).trim();
  }
  // Final fallback: between <body> and </body>
  const bStart = html.indexOf('<body');
  const bEnd = html.indexOf('</body>');
  if (bStart !== -1 && bEnd !== -1) {
    const bodyOpen = html.indexOf('>', bStart) + 1;
    return html.substring(bodyOpen, bEnd).trim();
  }
  return html;
}

function extractTrailingScript(html) {
  // Find any <script> tags between </footer> (or end of main) and </body>
  // that look like page-specific init code (not just the standard CDN scripts)
  const bEnd = html.indexOf('</body>');
  const fEnd = html.indexOf('</footer>');
  const startMarker = fEnd !== -1 ? fEnd + '</footer>'.length : 0;
  if (bEnd === -1) return '';
  const tail = html.substring(startMarker, bEnd);
  // Extract only inline <script> blocks (no src=) — those are the page-specific ones
  const scripts = [];
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(tail)) !== null) {
    scripts.push(m[0]);
  }
  return scripts.join('\n');
}

function rewriteAssets(html) {
  // src="images/X" → src="{{ 'X' | asset_url }}"
  html = html.replace(/src="images\/([^"]+)"/g, (_, f) => `src="{{ '${f}' | asset_url }}"`);
  // srcset="images/X..." entries (Webflow uses srcset for responsive webp)
  html = html.replace(/srcset="([^"]*images\/[^"]+)"/g, (_, sset) => {
    const fixed = sset.replace(/images\/([^\s,]+)/g, (_, file) => `{{ '${file}' | asset_url }}`);
    return `srcset="${fixed}"`;
  });
  // href="images/X" → href="{{ 'X' | asset_url }}"
  html = html.replace(/href="images\/([^"]+)"/g, (_, f) => `href="{{ '${f}' | asset_url }}"`);
  // CSS background-image: url(images/X) etc in inline styles (rare)
  html = html.replace(/url\(images\/([^)]+)\)/g, (_, f) => `url({{ '${f}' | asset_url }})`);
  return html;
}

function rewriteHrefs(html) {
  return html.replace(/href="([^"#?]+\.html)"/g, (orig, href) => {
    const repl = HREF_MAP[href];
    return repl ? `href="${repl}"` : orig;
  });
}

function wrapSection(content, sectionName, displayName, trailingScript) {
  const schema = {
    name: displayName,
    settings: [
      { type: 'paragraph', content: `Imported from Webflow. Markup is preserved verbatim. To edit text/images, replace the static content in sections/${sectionName}.liquid or split this into smaller sections.` }
    ],
    presets: [{ name: displayName }]
  };
  return content + (trailingScript ? `\n${trailingScript}\n` : '') +
    `\n\n{% schema %}\n${JSON.stringify(schema, null, 2)}\n{% endschema %}\n`;
}

function buildTemplateJson(sectionType, displayName) {
  return {
    sections: {
      main: {
        type: sectionType,
        settings: {}
      }
    },
    order: ['main']
  };
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

ensureDir(path.join(ROOT, 'sections'));
ensureDir(path.join(ROOT, 'templates'));

for (const p of PAGES) {
  const srcPath = path.join(ROOT, p.html);
  if (!fs.existsSync(srcPath)) {
    console.warn(`MISSING: ${p.html}`);
    continue;
  }
  const raw = fs.readFileSync(srcPath, 'utf8');
  let main = extractMain(raw);
  const trailing = extractTrailingScript(raw);
  main = rewriteAssets(main);
  main = rewriteHrefs(main);

  const displayName = p.section.replace(/^page-/, '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Page';
  const sectionContent = wrapSection(main, p.section, displayName, trailing);
  const sectionPath = path.join(ROOT, 'sections', `${p.section}.liquid`);
  fs.writeFileSync(sectionPath, sectionContent, 'utf8');

  const tplJson = buildTemplateJson(p.section, displayName);
  const tplPath = path.join(ROOT, p.templateFile);
  ensureDir(path.dirname(tplPath));
  fs.writeFileSync(tplPath, JSON.stringify(tplJson, null, 2) + '\n', 'utf8');

  console.log(`OK ${p.html} -> sections/${p.section}.liquid + ${p.templateFile}`);
}

console.log('\nDone.');
