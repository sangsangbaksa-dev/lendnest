/* Privacy and terms pages (English, short). */
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const PAGES = {
  privacy: ['Privacy', [
    'Lendnest keeps everything you enter (people, items, amounts, notes, photos) in your own browser storage on your device. It is not sent to us or to anyone else.',
    'There is no account, no analytics, no advertising and no third-party scripts. The only network requests are for the app files, and the licence check described below.',
    'Licence check: when you enter a licence key, only that key is sent to our server function, which checks it with Lemon Squeezy, the payment provider that sells Lendnest. The key is not logged or stored on our server. Your entries are never sent.',
    'Backups are files you download and keep. Clearing your browser data, or using private mode, erases the data unless you have a backup.',
    'Reminder messages are plain text you copy or share yourself. Lendnest never contacts the people you list.']],
  terms: ['Terms', [
    'Lendnest is a paid app: one payment, no subscription. It is provided as is, without warranty. You are responsible for your own records and backups. Payment is handled by Lemon Squeezy, the seller of record. Refunds are available within 14 days of purchase.',
    'Lendnest does not create a legally binding loan agreement or receipt. A handover note is only a text you choose to send.',
    'Do not use Lendnest to harass anyone. Reminder texts are suggestions: read and edit them before sending.',
    'We may change or retire the service at any time.']]
};
exports.render = page => { const [title, paras] = PAGES[page];
  return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · Lendnest</title><link rel="icon" href="/icon.svg" type="image/svg+xml"><link rel="stylesheet" href="/landing.css"></head>\n<body><main class="wrap" style="padding-top:32px"><p><a href="/">← Lendnest</a></p><h1>${title}</h1>\n${paras.map(p => `<p>${esc(p)}</p>`).join('\n')}\n</main></body></html>\n`; };
