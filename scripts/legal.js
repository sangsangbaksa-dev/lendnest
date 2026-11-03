/* Privacy and terms pages (English, short). */
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const PAGES = {
  privacy: ['Privacy', [
    'Lendnest keeps everything you enter (people, items, amounts, notes, photos) in your own browser storage on your device. It is not sent to us or to anyone else.',
    'There is no account, no analytics, no advertising and no third-party scripts. The only network requests are for the app files themselves.',
    'Backups are files you download and keep. Clearing your browser data, or using private mode, erases the data unless you have a backup.',
    'Reminder messages are plain text you copy or share yourself. Lendnest never contacts the people you list.']],
  terms: ['Terms', [
    'Lendnest is a personal note-keeping tool provided free and as is, without warranty. You are responsible for your own records and backups.',
    'Lendnest does not create a legally binding loan agreement or receipt. A handover note is only a text you choose to send.',
    'Do not use Lendnest to harass anyone. Reminder texts are suggestions: read and edit them before sending.',
    'We may change or retire the service at any time.']]
};
exports.render = page => { const [title, paras] = PAGES[page];
  return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · Lendnest</title><link rel="icon" href="/icon.svg" type="image/svg+xml"><link rel="stylesheet" href="/landing.css"></head>\n<body><main class="wrap" style="padding-top:32px"><p><a href="/">← Lendnest</a></p><h1>${title}</h1>\n${paras.map(p => `<p>${esc(p)}</p>`).join('\n')}\n</main></body></html>\n`; };
