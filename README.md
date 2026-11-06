# Lendnest

A ledger for everything you lend and borrow, items and money, in one place. App data is stored in browser localStorage; the optional licence check uses a serverless endpoint and an external licensing service. 5 languages (en, ko, ja, zh, es). Paid: one payment, unlocked per device with a licence key (`functions/api/license.js`, Lemon Squeezy; set `LEMONSQUEEZY_PRODUCT_ID` on the Pages project, and `checkoutUrl` in `config.js` once the product exists).

- `index.html` landing (copy lives in `app/i18n.js` under `LAND`, switched client-side), `app/` the app, `privacy.html` / `terms.html` (generated).
- What it does: lent and borrowed lists with overdue / due-soon status, money with partial repayments and a progress bar, return-date extensions, write-off and reopen with undo, item returns with a condition note, per-person on-time score and a "loan check" before you lend again, reminder text writer (gentle / firm / final, 5 languages, copy or share), handover note, optional photo (downscaled, stored locally), search, status / type / person filters on the lists, a printable statement per person (Print, from the person's card), Insights (totals per currency, 6-month lent vs returned chart, who has the most), backup / merge-restore JSON, CSV export (with a condition column), calendar `.ics` export with a day-before alert, dark mode, offline PWA.
- Logic is in `app/core.js` (pure, no DOM, unit-tested). All DOM is built with `textContent`, never `innerHTML`; imports are sanitised (`sanitize`) and the CSP forbids inline script.
- Tests: `node --test test/*.test.js` (unit), `NODE_PATH=$(npm root -g) node test/e2e.js [screenshot-dir]` (Playwright).
- Build: `node scripts/build.js --dist` regenerates legal pages / sitemap / robots from `config.js` and copies the public files to `dist/` (Cloudflare Pages output). `scripts/make-images.js` re-renders the PNG icons from `icon.svg`.
- Features added: tags with a filter, a reminder log (every copied or shared reminder shows on the card and in history), a licence gate with a paywall, and the review fixes (form conflict keeps the form open, repayment dates outside the loan are refused, focus returns to the opener).
- Hosting: Cloudflare Pages project `lendnest`, deployed by `../.github/workflows/deploy-cloudflare.yml`. Live at `https://lendnest-90u.pages.dev`; if the URL changes, update `siteUrl` in `config.js`.

## 배포 전 검증

설치·빌드·브라우저 검사·Cloudflare 배포 파일 구성은 [PREDEPLOY.md](PREDEPLOY.md)를 참고하세요. `codex/predeploy-2026-11-06` 브랜치의 검증 워크플로에는 배포 단계가 없습니다.

When an import exceeds 20 MiB, the app asks before reading it because large files can slow the browser. Larger backup files remain importable.
