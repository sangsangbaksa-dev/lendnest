/* Renders icon-192.png, icon-512.png and og.png from icon.svg with Playwright (dev-only). NODE_PATH=$(npm root -g) node scripts/make-images.js */
const { chromium } = require('playwright'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), svg = fs.readFileSync(path.join(root, 'icon.svg'), 'utf8');
(async () => {
  const b = await chromium.launch(), pg = await b.newPage();
  for (const s of [192, 512]) { await pg.setViewportSize({ width: s, height: s }); await pg.setContent(`<body style="margin:0">${svg.replace('<svg ', `<svg width="${s}" height="${s}" `)}</body>`); await pg.screenshot({ path: path.join(root, `icon-${s}.png`), omitBackground: true }); }
  await pg.setViewportSize({ width: 1200, height: 630 });
  await pg.setContent(`<body style="margin:0;background:#0f766e;color:#fff;font:700 64px system-ui,sans-serif;display:flex;align-items:center;gap:48px;height:630px;padding:0 90px;box-sizing:border-box"><div style="width:220px;height:220px;flex:none">${svg.replace('<svg ', '<svg width="220" height="220" ')}</div><div>Lendnest<div style="font-weight:500;font-size:38px;margin-top:18px;opacity:.92;line-height:1.3">Never wonder who has<br>your drill again.</div></div></body>`);
  await pg.screenshot({ path: path.join(root, 'og.png') }); await b.close();
})();
