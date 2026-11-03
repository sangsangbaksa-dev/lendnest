# Lendnest

A ledger for everything you lend and borrow, items and money, in one place. Static site, no server, data in localStorage. 5 languages (en, ko, ja, zh, es). Free, no licence check.

- `index.html` landing (copy lives in `app/i18n.js` under `LAND`, switched client-side), `app/` the app, `privacy.html` / `terms.html` (generated).
- What it does: lent and borrowed lists with overdue / due-soon status, money with partial repayments and a progress bar, return-date extensions, write-off and reopen with undo, per-person on-time score and a "loan check" before you lend again, reminder text writer (gentle / firm / final, 5 languages, copy or share), handover note, optional photo (downscaled, stored locally), search, Insights (totals per currency, 6-month lent vs returned chart, who has the most), backup / merge-restore JSON, CSV export, calendar `.ics` export with a day-before alert, dark mode, offline PWA.
- Logic is in `app/core.js` (pure, no DOM, unit-tested). All DOM is built with `textContent`, never `innerHTML`; imports are sanitised (`sanitize`) and the CSP forbids inline script.
- Tests: `node --test test/*.test.js` (unit), `NODE_PATH=$(npm root -g) node test/e2e.js [screenshot-dir]` (Playwright).
- Build: `node scripts/build.js --dist` regenerates legal pages / sitemap / robots from `config.js` and copies the public files to `dist/` (Cloudflare Pages output). `scripts/make-images.js` re-renders the PNG icons from `icon.svg`.
- Hosting: Cloudflare Pages project `lendnest`, deployed by `../.github/workflows/deploy-cloudflare.yml`. Live at `https://lendnest-90u.pages.dev`; if the URL changes, update `siteUrl` in `config.js`.
