# NITYA — laundry franchise homepage (Cloudflare Pages)

Static, framework-free build. `node build.mjs` turns `src/index.html` + `config.json` into `dist/` (the Pages output dir).
No dependencies. If you want Astro later, `dist/index.html` drops into `src/pages/index.astro` unchanged.

## Before launch — fill `config.json`
DOMAIN, PHONE_E164, PHONE_DISPLAY, WHATSAPP_NUMBER (digits only, e.g. 919876543210), EMAIL, ENTITY_NAME,
REGISTERED_ADDRESS, GSTIN, FRANCHISE_OPEN_DATE, STATUS_DATE, LASTMOD, optional CF_ANALYTICS_TOKEN.
`node build.mjs --production` refuses to build while any TBC/placeholder remains.

## Cloudflare Pages settings
- Build command: `node build.mjs --production` · Output dir: `dist` · Functions dir: `functions` (auto)
- Env vars for the form (functions/api/enquiry.js): RESEND_API_KEY, ENQUIRY_TO, ENQUIRY_FROM,
  WA_TOKEN, WA_PHONE_NUMBER_ID, WA_TEMPLATE (approved utility template, 1 body variable = first name), WA_TEMPLATE_LANG
- SSL/TLS → Always Use HTTPS: on. HSTS is sent via `_headers`.
- Rules → Redirect Rule: `www.DOMAIN/*` → `https://DOMAIN/${1}` 301 (single hop; Pages `_redirects` can't match host).
- Brotli + HTTP/3 are on by default on Pages.

## Generated
robots.txt (points to sitemap), sitemap.xml (lists only pages that exist in dist/), _headers (HSTS, CSP with the
inline-style sha256 computed at build, cache rules), _redirects, JSON-LD (Organization, FAQPage built from the visible
FAQ so they never drift, BreadcrumbList). No aggregateRating/review — deliberately.

## Still to build (linked from the homepage)
/franchise-model/ /investment-and-returns/ /faq/ /about/ /contact/ /privacy/ — privacy is required before the form goes live (DPDP Act).
