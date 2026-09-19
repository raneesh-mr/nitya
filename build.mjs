// NITYA static build: src/index.html + config.json -> dist/ (Cloudflare Pages output dir)
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
const cfg = JSON.parse(fs.readFileSync('config.json','utf8'));
const strict = process.argv.includes('--production');
const unset = Object.entries(cfg).filter(([k,v]) => /TBC|0000000000/.test(v) && k!=='INDEXABLE').map(([k])=>k);
if (unset.length) { console.warn('⚠ Unset config values:', unset.join(', ')); if (strict) { console.error('Refusing --production build with placeholders.'); process.exit(1); } }
const D = `https://${cfg.DOMAIN}/`;
const indexable = cfg.INDEXABLE !== 'false'; // false = staging: noindex everywhere
if (!indexable) console.warn('⚠ INDEXABLE=false: site is built noindex (staging).');
let html = fs.readFileSync('src/index.html','utf8');

// FAQ schema generated from the visible FAQ so the two can never drift apart
const faqSection = html.slice(html.indexOf('id="faq"'), html.indexOf('<!-- 11 FORM'));
const strip = s => s.replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
const faqs = [...faqSection.matchAll(/<summary>(.*?)<\/summary><div class="body">(.*?)<\/div><\/details>/gs)]
  .map(m => ({ '@type':'Question', name: strip(m[1]), acceptedAnswer: { '@type':'Answer', text: strip(m[2]) } }));
if (faqs.length !== 10) throw new Error('Expected 10 FAQs, got ' + faqs.length);

const org = { '@context':'https://schema.org', '@type':'Organization', '@id': D+'#org', name:'NITYA', url:D, logo:D+'logo.png',
  description:'Laundry and dry-cleaning franchise in India. Hub-and-spoke model — franchise partners run collection stores; NITYA owns and operates the processing plant.',
  foundingDate:'2026', areaServed:{ '@type':'Country', name:'India' },
  founder:[{ '@type':'Person', name:'Raneesh Raveendran' },{ '@type':'Person', name:'Sajitha' },{ '@type':'Person', name:'Ajesh' }],
  contactPoint:{ '@type':'ContactPoint', telephone:cfg.PHONE_E164, contactType:'sales', areaServed:'IN', availableLanguage:['en','ml','hi'] },
  makesOffer:[
    { '@type':'Offer', name:'Collection Point Franchise', price:'416000', priceCurrency:'INR', category:'Franchise opportunity' },
    { '@type':'Offer', name:'Standard Store Franchise', price:'990000', priceCurrency:'INR', category:'Franchise opportunity' },
    { '@type':'Offer', name:'Master District Franchise', price:'2750000', priceCurrency:'INR', category:'Franchise opportunity' } ] };
const faq = { '@context':'https://schema.org', '@type':'FAQPage', mainEntity: faqs };
const crumbs = { '@context':'https://schema.org', '@type':'BreadcrumbList', itemListElement:[{ '@type':'ListItem', position:1, name:'Laundry franchise in India', item:D }] };
const ld = [org, faq, crumbs].map(o => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g,'\\u003c')}</script>`).join('\n');

const analytics = cfg.CF_ANALYTICS_TOKEN ? `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"${cfg.CF_ANALYTICS_TOKEN}"}'></script>` : '';
if (!indexable) html = html.replace('<meta name="robots" content="index, follow, max-snippet:-1">','<meta name="robots" content="noindex, nofollow">');
html = html.replace('{{JSONLD}}', ld).replace('{{ANALYTICS}}', analytics);
html = html.replace(/\{\{(\w+)\}\}/g, (m,k) => { if (!(k in cfg)) throw new Error('Unknown token '+k); return cfg[k]; });
// light minify: strip comments and inter-tag whitespace
html = html.replace(/<!--(?!\s*\[)[\s\S]*?-->/g,'').replace(/>\s+</g,'> <').replace(/\n\s*/g,'\n');

// CSP: hash the single inline <style>
const style = html.match(/<style>([\s\S]*?)<\/style>/)[1];
const sh = crypto.createHash('sha256').update(style).digest('base64');
const cfA = cfg.CF_ANALYTICS_TOKEN ? ' https://static.cloudflareinsights.com' : '';
const csp = `default-src 'self'; script-src 'self'${cfA}; style-src 'self' 'sha256-${sh}'; img-src 'self' data:; font-src 'self'; connect-src 'self'${cfg.CF_ANALYTICS_TOKEN?' https://cloudflareinsights.com':''}; form-action 'self'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'; upgrade-insecure-requests`;

fs.rmSync('dist',{recursive:true,force:true}); fs.cpSync('public','dist',{recursive:true});
fs.writeFileSync('dist/index.html', html);
fs.writeFileSync('dist/robots.txt', indexable ? `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${D}sitemap.xml\n` : `User-agent: *\nAllow: /\n`); // staging: crawlable so the noindex is seen
// Only list pages that exist in dist (never 404s / noindex URLs)
const pages = [''].concat(['franchise-model','investment-and-returns','faq','about','contact','privacy'].filter(p=>fs.existsSync(`dist/${p}/index.html`)).map(p=>p+'/'));
fs.writeFileSync('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map(p=>`  <url><loc>${D}${p}</loc><lastmod>${cfg.LASTMOD}</lastmod></url>`).join('\n')}\n</urlset>\n`);
fs.writeFileSync('dist/_headers', `/*
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  Content-Security-Policy: ${csp}
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
  X-Frame-Options: DENY
${indexable ? '' : '  X-Robots-Tag: noindex, nofollow\n'}
/
  Cache-Control: public, max-age=0, must-revalidate

/fonts/*
  Cache-Control: public, max-age=31536000, immutable
/img/*
  Cache-Control: public, max-age=31536000, immutable
/form.js
  Cache-Control: public, max-age=86400
`);
// Uppercase / legacy paths -> canonical (host-level http->https and www->apex are Cloudflare rules, see README)
fs.writeFileSync('dist/_redirects', `/index.html / 301\n/home / 301\n`);
const kb = f => (fs.statSync(f).size/1024).toFixed(1)+' KB';
console.log('Built dist/: index.html', kb('dist/index.html'), '| form.js', kb('dist/form.js'), '| sitemap URLs:', pages.length);
