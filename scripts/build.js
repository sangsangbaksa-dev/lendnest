/* Builds legal pages, sitemap, robots; with --dist copies the public files into dist/ (Cloudflare Pages output).
   Run: node scripts/build.js [--dist]. No dependencies. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const sb = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(root, 'config.js'), 'utf8'), sb);
const base = sb.window.LN_SITE.siteUrl.replace(/\/+$/, '');
const LEGAL = require('./legal.js');
const put = (rel, text) => fs.writeFileSync(path.join(root, rel), text);
for (const p of ['privacy', 'terms']) put(`${p}.html`, LEGAL.render(p));
put('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n<url><loc>${base}/</loc></url>\n<url><loc>${base}/privacy</loc></url>\n<url><loc>${base}/terms</loc></url>\n</urlset>\n`);
put('robots.txt', `User-agent: *\nAllow: /\nDisallow: /app/\n\nSitemap: ${base}/sitemap.xml\n`);
console.log('built for', base);
if (process.argv.includes('--dist')) {
  const out = path.join(root, 'dist'); fs.rmSync(out, { recursive: true, force: true });
  const items = ['index.html', 'privacy.html', 'terms.html', 'landing.css', 'landing.js', 'config.js', 'icon.svg', 'icon-192.png', 'icon-512.png', 'og.png', 'manifest.webmanifest', 'sitemap.xml', 'robots.txt', '_headers', 'app'];
  for (const f of items) { const to = path.join(out, f); fs.mkdirSync(path.dirname(to), { recursive: true }); fs.cpSync(path.join(root, f), to, { recursive: true }); }
  console.log('dist ready:', items.length, 'entries');
}
