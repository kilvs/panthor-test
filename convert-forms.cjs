#!/usr/bin/env node
/**
 * Bulk-replaces remaining Webflow newsletter forms in section files with
 * Shopify {% form 'customer' %} equivalents. Same markup, same classes,
 * different name attributes and form wrapper.
 *
 * Run once. Can be deleted afterward.
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

const FILES = [
  'page-404',
  'page-about',
  'page-blog',
  'page-collection',
  'page-product',
  'page-article',
  'page-legal',
].map(n => path.join(ROOT, 'sections', `${n}.liquid`));

const newsletterRegex = /<form id="wf-form-Newsletter-Form"[^>]*>([\s\S]*?)<\/form>\s*<div class="w-form-done">\s*<div>[^<]*<\/div>\s*<\/div>\s*<div class="w-form-fail">\s*<div>[^<]*<\/div>\s*<\/div>/g;

let counter = 0;
function nextId() {
  counter += 1;
  return `wf-form-Newsletter-${counter}`;
}

for (const file of FILES) {
  if (!fs.existsSync(file)) {
    console.warn(`SKIP (missing): ${file}`);
    continue;
  }
  let content = fs.readFileSync(file, 'utf8');
  const formId = nextId();
  const emailId = `Email-Newsletter-${counter}`;
  const termsId = `Newsletter-Terms-${counter}`;

  const replacement = `{%- form 'customer', id: '${formId}', class: 'component_newsletter_form' -%}
                    <input type="hidden" name="contact[tags]" value="newsletter">
                    <label for="${emailId}" class="form_label">Email</label>
                    <input class="form_input w-input" maxlength="256" name="contact[email]" data-name="Email Newsletter" placeholder="panthor@email.com" type="email" id="${emailId}" required="">
                    <div class="spacer-medium"></div>
                    <label class="w-checkbox form_checkbox_field"><input type="checkbox" name="contact[accepts_marketing]" id="${termsId}" data-name="Newsletter Terms" required="" class="w-checkbox-input form_checkbox"><span class="text-size-tiny w-form-label" for="${termsId}">I confirm I wish to receive emails from Panthor. You may opt out of these emails at any time.</span></label>
                    <div class="spacer-medium"></div>
                    <div class="button-group"><input type="submit" data-wait="Please wait..." class="button-tertiary w-button" value="Submit"></div>
                    {% render 'wf-form-states', form: form %}
                  {%- endform -%}`;

  const updated = content.replace(newsletterRegex, replacement);
  if (updated === content) {
    console.warn(`NO MATCH: ${path.basename(file)}`);
  } else {
    fs.writeFileSync(file, updated, 'utf8');
    console.log(`OK ${path.basename(file)}`);
  }
}
