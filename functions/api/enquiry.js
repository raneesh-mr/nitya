// Cloudflare Pages Function: POST /api/enquiry
// Env vars (Pages > Settings > Variables, mark secrets as encrypted):
//   RESEND_API_KEY      – email to the brand via Resend (https://resend.com)
//   ENQUIRY_TO          – brand inbox, e.g. partners@yourdomain.in
//   ENQUIRY_FROM        – verified sender, e.g. "NITYA Enquiries <enquiries@yourdomain.in>"
//   WA_TOKEN            – WhatsApp Cloud API permanent token
//   WA_PHONE_NUMBER_ID  – WhatsApp Cloud API phone-number ID
//   WA_TEMPLATE         – approved utility template name (1 body variable: first name), e.g. "nitya_enquiry_received"
//   WA_TEMPLATE_LANG    – template language code, default "en"
const REQUIRED = ['name','phone','city','occupation','capital','timing','location','operator','acknowledge'];
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export async function onRequestPost({ request, env }) {
  const wantsJson = (request.headers.get('Accept') || '').includes('application/json');
  const reply = (status, body) => wantsJson
    ? new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
    : Response.redirect(new URL(status < 300 ? '/?enquiry=sent#register' : '/?enquiry=error#register', request.url), 303);

  let form; try { form = await request.formData(); } catch { return reply(400, { error: 'Invalid submission.' }); }
  const d = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v).trim().slice(0, 200)]));
  if (d.website) return reply(200, { name: '' });                       // honeypot: silently accept bots
  const missing = REQUIRED.filter(k => !d[k]);
  if (missing.length) return reply(422, { error: 'Please complete every field and tick the confirmation box.' });

  const cc = d.country_code === 'other' ? '' : (d.country_code || '+91');
  const digits = (cc + d.phone).replace(/[^\d]/g, '');
  if (digits.length < 10 || digits.length > 15) return reply(422, { error: 'Please enter a valid WhatsApp number with country code.' });
  const first = d.name.split(/\s+/)[0];

  const rows = [['Name', d.name], ['WhatsApp', '+' + digits], ['City / state', d.city], ['Occupation', d.occupation],
    ['Capital', d.capital], ['Opening', d.timing], ['Location in mind', d.location], ['Run by', d.operator],
    ['Acknowledged zero stores open', d.acknowledge], ['Received', new Date().toISOString()]];
  const tasks = [];

  if (env.RESEND_API_KEY && env.ENQUIRY_TO) {
    tasks.push(fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.ENQUIRY_FROM, to: [env.ENQUIRY_TO],
        subject: `Founding partner enquiry — ${d.name}, ${d.city} (${d.capital})`,
        html: `<table cellpadding="6">${rows.map(([k, v]) => `<tr><th align="left">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table>` })
    }).then(r => { if (!r.ok) throw new Error('email ' + r.status); }));
  }
  if (env.WA_TOKEN && env.WA_PHONE_NUMBER_ID && env.WA_TEMPLATE) {
    tasks.push(fetch(`https://graph.facebook.com/v21.0/${env.WA_PHONE_NUMBER_ID}/messages`, {
      method: 'POST', headers: { Authorization: `Bearer ${env.WA_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: digits, type: 'template',
        template: { name: env.WA_TEMPLATE, language: { code: env.WA_TEMPLATE_LANG || 'en' },
          components: [{ type: 'body', parameters: [{ type: 'text', text: first }] }] } })
    }).then(r => { if (!r.ok) throw new Error('whatsapp ' + r.status); }));
  }
  if (!tasks.length) return reply(503, { error: 'Enquiries are not switched on yet. Please WhatsApp us.' });

  const results = await Promise.allSettled(tasks);
  const failed = results.filter(r => r.status === 'rejected');
  failed.forEach(f => console.error('enquiry delivery failed:', f.reason));
  if (failed.length === results.length) return reply(502, { error: 'We could not record your enquiry. Please WhatsApp us.' });
  return reply(200, { name: first });
}
export const onRequest = () => new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } });
