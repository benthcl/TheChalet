/**
 * Chalet email templates — pure presentation, no Firebase.
 * Kept dependency free so emails can be rendered and previewed
 * offline (see tools/preview-emails.mjs).
 *
 * Rules for anything added here:
 *  - tables + inline styles only (Gmail and Outlook strip <style>)
 *  - no background images, no flexbox, no external fonts
 *  - 600px wide, everything degrades to a single readable column
 */

/* Brand tokens — mirror style.css */
export const C = {
    pine: '#1f3d32',
    pineMid: '#2f5c4a',
    mist: '#e7eeea',
    paper: '#fffcf8',
    line: '#dfe7e2',
    ink: '#1c2420',
    muted: '#5c6b63',
    wood: '#b08d57',
    amber: '#8a6a1f',
    amberBg: '#fdf4e0',
    green: '#1f6b45',
    greenBg: '#dff0e6',
    rust: '#c0653a'
};

const FONT_DISPLAY = "Georgia,'Times New Roman',serif";
const FONT_BODY = "'Helvetica Neue',Helvetica,Arial,sans-serif";

export function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/* ---------------------------- date helpers ---------------------------- */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Parse YYYY-MM-DD as a local date so nothing shifts a day via UTC. */
function parseLocalDate(iso) {
    const parts = String(iso || '').split('-').map(Number);
    if (parts.length !== 3 || parts.some(n => !Number.isFinite(n))) return null;
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    return Number.isNaN(d.getTime()) ? null : d;
}

export function formatLongDate(iso) {
    const d = parseLocalDate(iso);
    if (!d) return String(iso || '');
    return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatShortRange(startIso, endIso) {
    const a = parseLocalDate(startIso);
    const b = parseLocalDate(endIso);
    if (!a || !b) return `${startIso || ''} - ${endIso || ''}`;
    const sameMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
    return sameMonth
        ? `${a.getDate()}-${b.getDate()} ${MONTHS[b.getMonth()]}`
        : `${a.getDate()} ${MONTHS[a.getMonth()]} - ${b.getDate()} ${MONTHS[b.getMonth()]}`;
}

export function nightsBetween(startIso, endIso) {
    const a = parseLocalDate(startIso);
    const b = parseLocalDate(endIso);
    if (!a || !b) return null;
    const n = Math.round((b - a) / 86400000);
    return n > 0 ? n : null;
}

export function todayLocalIso(now = new Date()) {
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${m}-${day}`;
}

function plural(n, word) {
    return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/* -------------------------- layout components ------------------------- */

/** Absolute asset URL — mail clients cannot resolve relative paths. */
function asset(siteUrl, path) {
    return `${String(siteUrl || '').replace(/\/+$/, '')}/${path}`;
}

/**
 * Outer shell: pine header wordmark, chalet banner, paper card, CTA, footer.
 * The banner is decorative — everything still reads if images are blocked.
 */
function shell({ eyebrow, heading, tag = '', preheader = '', bodyHtml, ctaLabel, siteUrl }) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="format-detection" content="date=no,telephone=no,address=no">
<title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background:${C.mist};-webkit-font-smoothing:antialiased">
<div style="display:none;font-size:1px;color:${C.mist};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.mist}">
  <tr>
    <td align="center" style="padding:28px 12px 40px">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:${C.paper};border-radius:18px;overflow:hidden">

        <tr>
          <td style="background:${C.pine};padding:22px 32px">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="vertical-align:middle">
                  <div style="font-family:${FONT_DISPLAY};font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.2px">The Chalet</div>
                  <div style="font-family:${FONT_BODY};font-size:11px;letter-spacing:2.4px;text-transform:uppercase;color:${C.wood};padding-top:5px">Family Portal</div>
                </td>
                ${tag ? `<td align="right" style="vertical-align:middle;font-family:${FONT_BODY};font-size:10px;letter-spacing:1.8px;text-transform:uppercase;color:#8fa89c;font-weight:700">${escapeHtml(tag)}</td>` : ''}
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0;background:${C.pine};font-size:0;line-height:0">
            <img src="${escapeHtml(asset(siteUrl, 'photos/email-header.jpg'))}" width="600" alt="The chalet in the snow" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none">
          </td>
        </tr>
        <tr><td style="height:3px;background:${C.wood};font-size:0;line-height:0">&nbsp;</td></tr>

        <tr>
          <td style="padding:30px 32px 4px">
            ${eyebrow ? `<div style="font-family:${FONT_BODY};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${C.wood};font-weight:700;padding-bottom:9px">${escapeHtml(eyebrow)}</div>` : ''}
            <h1 style="margin:0;font-family:${FONT_DISPLAY};font-size:27px;line-height:1.25;color:${C.pine};font-weight:700">${escapeHtml(heading)}</h1>
          </td>
        </tr>

        <tr><td style="padding:16px 32px 4px;font-family:${FONT_BODY};font-size:15px;line-height:1.6;color:${C.ink}">${bodyHtml}</td></tr>

        <tr>
          <td style="padding:22px 32px 32px">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="background:${C.pine};border-radius:999px">
                  <a href="${escapeHtml(siteUrl)}" style="display:inline-block;padding:13px 28px;font-family:${FONT_BODY};font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.3px">${escapeHtml(ctaLabel)} &rarr;</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="background:${C.mist};padding:20px 32px;border-top:1px solid ${C.line}">
            <div style="font-family:${FONT_BODY};font-size:12px;line-height:1.7;color:${C.muted}">
              You are getting this because you are on the family list for The Chalet.<br>
              <a href="${escapeHtml(siteUrl)}" style="color:${C.pineMid};text-decoration:underline">Calendar</a> &nbsp;&middot;&nbsp;
              <a href="${escapeHtml(siteUrl)}" style="color:${C.pineMid};text-decoration:underline">Stockroom</a> &nbsp;&middot;&nbsp;
              <a href="${escapeHtml(siteUrl)}" style="color:${C.pineMid};text-decoration:underline">Board</a>
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function paragraph(html) {
    return `<p style="margin:0 0 16px;font-family:${FONT_BODY};font-size:15px;line-height:1.6;color:${C.ink}">${html}</p>`;
}

/** One calendar tear-off tile: weekday strip, big day number, month. */
function dateTile(iso, caption, time) {
    const d = parseLocalDate(iso);
    const weekday = d ? WEEKDAYS[d.getDay()] : '';
    const dayNum = d ? String(d.getDate()) : '--';
    const monthYear = d ? `${MONTHS[d.getMonth()]} ${d.getFullYear()}` : String(iso || '');
    return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid ${C.line};border-radius:12px">
        <tr>
          <td align="center" style="background:${C.pine};padding:6px 0;font-family:${FONT_BODY};font-size:10px;letter-spacing:1.6px;text-transform:uppercase;color:#ffffff;font-weight:700">${escapeHtml(weekday)}</td>
        </tr>
        <tr>
          <td align="center" style="padding:12px 8px 14px">
            <div style="font-family:${FONT_DISPLAY};font-size:34px;line-height:1;color:${C.pine};font-weight:700">${escapeHtml(dayNum)}</div>
            <div style="font-family:${FONT_BODY};font-size:12px;color:${C.muted};padding-top:5px">${escapeHtml(monthYear)}</div>
            <div style="font-family:${FONT_BODY};font-size:10px;letter-spacing:1.4px;text-transform:uppercase;color:${C.wood};font-weight:700;padding-top:9px">${escapeHtml(caption)}</div>
            ${time ? `<div style="font-family:${FONT_BODY};font-size:12px;color:${C.ink};padding-top:3px">${escapeHtml(time)}</div>` : ''}
          </td>
        </tr>
      </table>`;
}

/** Arrival tile + nights marker + departure tile. */
function dateTicket({ startDate, endDate, arrivalTime, departureTime }) {
    const nights = nightsBetween(startDate, endDate);
    return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:2px 0 22px">
        <tr>
          <td width="43%" style="width:43%;vertical-align:top">${dateTile(startDate, 'Arrive', arrivalTime)}</td>
          <td width="14%" align="center" style="width:14%;vertical-align:middle;padding:0 6px">
            <div style="font-family:${FONT_BODY};font-size:11px;color:${C.muted};line-height:1.4">${nights ? escapeHtml(plural(nights, 'night')) : '&nbsp;'}</div>
            <div style="font-family:${FONT_BODY};font-size:18px;color:${C.wood};line-height:1.4">&rarr;</div>
          </td>
          <td width="43%" style="width:43%;vertical-align:top">${dateTile(endDate, 'Depart', departureTime)}</td>
        </tr>
      </table>`;
}

/** Circular initial avatar. */
function avatar(name, size = 34) {
    const letter = escapeHtml((String(name || '?').trim()[0] || '?').toUpperCase());
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background:${C.pineMid};border-radius:${size}px">
        <tr><td align="center" width="${size}" height="${size}" style="width:${size}px;height:${size}px;font-family:${FONT_DISPLAY};font-size:${Math.round(size * 0.45)}px;color:#ffffff;font-weight:700;line-height:${size}px">${letter}</td></tr>
      </table>`;
}

function sectionLabel(text) {
    return `<div style="font-family:${FONT_BODY};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${C.muted};font-weight:700;padding:14px 0 12px;border-top:1px solid ${C.line}">${escapeHtml(text)}</div>`;
}

function pill(text, bg, color) {
    return `<span style="display:inline-block;background:${bg};color:${color};font-family:${FONT_BODY};font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:3px 9px;border-radius:999px">${escapeHtml(text)}</span>`;
}

/**
 * "Who is at the chalet" panel — current stay plus the next few trips,
 * so the mail answers the real question without anyone logging in.
 * @param {Array<{name:string,startDate:string,endDate:string}>} trips
 */
function tripsPanel(trips, { highlightKey = null, today = todayLocalIso() } = {}) {
    const upcoming = (trips || [])
        .filter(t => t && t.startDate && t.endDate && t.endDate >= today)
        .sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)))
        .slice(0, 4);

    if (!upcoming.length) {
        return sectionLabel('On the calendar') +
            paragraph(`<span style="color:${C.muted}">Nothing booked from here on &mdash; the chalet is wide open.</span>`);
    }

    const rows = upcoming.map(t => {
        const here = t.startDate <= today && t.endDate >= today;
        const isNew = highlightKey && `${t.startDate}|${t.endDate}|${t.name}` === highlightKey;
        const badge = here ? pill('Here now', C.greenBg, C.green)
            : isNew ? pill('New', C.amberBg, C.amber)
            : '';
        const nights = nightsBetween(t.startDate, t.endDate);
        return `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid ${C.line}">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="46" style="width:46px;vertical-align:middle">${avatar(t.name, 34)}</td>
                <td style="vertical-align:middle;font-family:${FONT_BODY}">
                  <div style="font-size:14px;font-weight:700;color:${C.ink}">${escapeHtml(t.name)} ${badge}</div>
                  <div style="font-size:12px;color:${C.muted};padding-top:3px">${escapeHtml(formatShortRange(t.startDate, t.endDate))}</div>
                </td>
                <td align="right" style="vertical-align:middle;font-family:${FONT_BODY};font-size:12px;color:${C.muted}">${nights ? escapeHtml(plural(nights, 'night')).replace(' ', '&nbsp;') : ''}</td>
              </tr>
            </table>
          </td>
        </tr>`;
    }).join('');

    return sectionLabel('On the calendar') +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:6px">${rows}</table>`;
}

/** Soft callout card, used for notes and quotes. */
function noteCard(title, bodyHtml, accent = C.wood) {
    return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:2px 0 20px;background:#ffffff;border:1px solid ${C.line};border-left:4px solid ${accent};border-radius:10px">
        <tr>
          <td style="padding:16px 18px">
            <div style="font-family:${FONT_BODY};font-size:10px;letter-spacing:1.6px;text-transform:uppercase;color:${C.muted};font-weight:700;padding-bottom:7px">${escapeHtml(title)}</div>
            <div style="font-family:${FONT_DISPLAY};font-size:16px;line-height:1.55;color:${C.ink}">${bodyHtml}</div>
          </td>
        </tr>
      </table>`;
}

/**
 * Bulleted card for shopping lists and unfinished checks.
 * Typographic bullets, not emoji — emoji render inconsistently
 * between Gmail, Outlook and Apple Mail.
 */
function listCard(title, items, kind = 'buy') {
    const accent = kind === 'buy' ? C.wood : C.rust;
    const rows = items.map(item => `
        <tr>
          <td width="18" style="width:18px;vertical-align:top;font-family:${FONT_BODY};font-size:15px;line-height:1.7;color:${accent}">&bull;</td>
          <td style="font-family:${FONT_BODY};font-size:14px;line-height:1.7;color:${C.ink}">${escapeHtml(item)}</td>
        </tr>`).join('');
    return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:2px 0 20px;background:#ffffff;border:1px solid ${C.line};border-left:4px solid ${accent};border-radius:10px">
        <tr>
          <td style="padding:16px 18px">
            <div style="font-family:${FONT_BODY};font-size:10px;letter-spacing:1.6px;text-transform:uppercase;color:${C.muted};font-weight:700;padding-bottom:9px">${escapeHtml(title)} &middot; ${items.length}</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>
          </td>
        </tr>
      </table>`;
}

/** Key/value list styled like the site's detail rows. */
function detailRows(pairs) {
    const rows = pairs.filter(p => p && p.value).map(p => `
        <tr>
          <td width="34%" style="width:34%;padding:10px 0;border-bottom:1px solid ${C.line};font-family:${FONT_BODY};font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:${C.muted};font-weight:700;vertical-align:top">${escapeHtml(p.label)}</td>
          <td style="padding:10px 0;border-bottom:1px solid ${C.line};font-family:${FONT_BODY};font-size:14px;color:${C.ink};vertical-align:top">${p.raw ? p.value : escapeHtml(p.value)}</td>
        </tr>`).join('');
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 6px">${rows}</table>`;
}

/* ------------------------------ templates ----------------------------- */

/**
 * @param {object} o
 * @param {'booked'|'updated'} o.action
 * @param {Array<{name:string,startDate:string,endDate:string}>} o.trips
 * @returns {{subject:string,text:string,html:string}}
 */
export function renderBookingEmail({
    action, who, title, startDate, endDate, arrivalTime, departureTime,
    trips = [], siteUrl = '', today = todayLocalIso()
}) {
    const isUpdate = action === 'updated';
    const verb = isUpdate ? 'updated' : 'booked';
    const nights = nightsBetween(startDate, endDate);
    const range = formatShortRange(startDate, endDate);

    const subject = `${isUpdate ? 'Trip updated' : 'New trip'} · ${title} · ${range}`;

    const text = [
        `${who} has ${verb} a trip at The Chalet.`,
        '',
        `Party: ${title}`,
        `Arrive: ${formatLongDate(startDate)}${arrivalTime ? ` at ${arrivalTime}` : ''}`,
        `Depart: ${formatLongDate(endDate)}${departureTime ? ` at ${departureTime}` : ''}`,
        nights ? `Length: ${plural(nights, 'night')}` : null,
        '',
        `Full calendar: ${siteUrl}`
    ].filter(Boolean).join('\n');

    const lead = isUpdate
        ? `<strong>${escapeHtml(who)}</strong> moved their trip&mdash;here are the new dates${nights ? `, <strong>${escapeHtml(plural(nights, 'night'))}</strong> in total` : ''}.`
        : `<strong>${escapeHtml(who)}</strong> booked a stay${nights ? ` of <strong>${escapeHtml(plural(nights, 'night'))}</strong>` : ''}. Overlapping is fine &mdash; the more the merrier.`;

    const bodyHtml = [
        paragraph(lead),
        dateTicket({ startDate, endDate, arrivalTime, departureTime }),
        detailRows([
            { label: 'Who is coming', value: title },
            { label: 'Booked by', value: who }
        ]),
        tripsPanel(trips, { highlightKey: `${startDate}|${endDate}|${title}`, today })
    ].join('');

    return {
        subject,
        text,
        html: shell({
            eyebrow: isUpdate ? 'Calendar update' : 'New booking',
            heading: isUpdate ? `${who} changed their dates` : `${who} is coming to the chalet`,
            tag: 'Calendar',
            preheader: `${range}${nights ? ` · ${plural(nights, 'night')}` : ''}`,
            bodyHtml,
            ctaLabel: 'View the calendar',
            siteUrl
        })
    };
}

export function renderHandoverEmail({
    who, nextGuestNote = '', shoppingList = [], openChecks = [], laundryLeft = false,
    trips = [], siteUrl = '', today = todayLocalIso()
}) {
    const note = String(nextGuestNote || '').trim();
    const allClear = !shoppingList.length && !openChecks.length && !laundryLeft;

    const subject = allClear
        ? `Handover done · ${who} left the chalet spotless`
        : `Handover done · ${who} signed off${shoppingList.length ? ` · ${shoppingList.length} to buy` : ''}`;

    const text = [
        `${who} signed off the chalet.`,
        '',
        shoppingList.length ? `Bring with you: ${shoppingList.join(', ')}` : 'Supplies are all stocked.',
        openChecks.length ? `Left open: ${openChecks.join(', ')}` : null,
        laundryLeft ? 'Laundry was left behind.' : null,
        '',
        note ? `Note for the next guests: ${note}` : 'No note left.',
        '',
        `Stockroom: ${siteUrl}`
    ].filter(Boolean).join('\n');

    const bodyHtml = [
        paragraph(allClear
            ? `<strong>${escapeHtml(who)}</strong> has left and signed off the checklist &mdash; everything stocked, nothing open. Whoever is next gets an easy arrival.`
            : `<strong>${escapeHtml(who)}</strong> has left and signed off the checklist. Here is what the next family needs to know.`),
        shoppingList.length
            ? listCard('Bring with you', shoppingList, 'buy')
            : noteCard('Supplies', `<span style="font-family:${FONT_BODY};font-size:14px;font-weight:700;color:${C.green}">All stocked &mdash; nothing to buy.</span>`, C.green),
        openChecks.length ? listCard('Still not done', openChecks, 'open') : '',
        laundryLeft ? noteCard('Laundry', `<span style="font-family:${FONT_BODY};font-size:14px;color:${C.rust}">Someone left washing behind.</span>`, C.rust) : '',
        note
            ? noteCard('Note for the next guests', `&ldquo;${escapeHtml(note)}&rdquo;`)
            : noteCard('Note for the next guests', `<span style="font-family:${FONT_BODY};font-size:14px;color:${C.muted}">Nothing left this time.</span>`, C.line),
        tripsPanel(trips, { today })
    ].join('');

    return {
        subject,
        text,
        html: shell({
            eyebrow: 'Handover',
            heading: allClear ? `${who} left the house spotless` : `${who} signed off the house`,
            tag: 'Stockroom',
            preheader: shoppingList.length
                ? `Bring: ${shoppingList.slice(0, 4).join(', ')}`
                : (note || 'Everything stocked and checked.').slice(0, 100),
            bodyHtml,
            ctaLabel: 'Check the Stockroom',
            siteUrl
        })
    };
}

export function renderIssueEmail({ who, title, category, description = '', siteUrl = '' }) {
    const desc = String(description || '').trim();
    const subject = `Board · ${category}: ${title}`;

    const text = [
        `${who} reported an issue on the board.`,
        '',
        `Title: ${title}`,
        `Category: ${category}`,
        desc ? `Details: ${desc}` : null,
        '',
        `Vote on the board: ${siteUrl}`
    ].filter(Boolean).join('\n');

    const bodyHtml = [
        paragraph(`<strong>${escapeHtml(who)}</strong> added something to the community board. Cast a vote so we know what to deal with first.`),
        `<div style="padding-bottom:14px">${pill(category, C.amberBg, C.amber)}</div>`,
        noteCard('The report', desc
            ? escapeHtml(desc).replace(/\n/g, '<br>')
            : `<span style="font-family:${FONT_BODY};font-size:14px;color:${C.muted}">No extra details given.</span>`)
    ].join('');

    return {
        subject,
        text,
        html: shell({
            eyebrow: 'Community board',
            heading: title,
            tag: 'Board',
            preheader: `${category} · reported by ${who}`,
            bodyHtml,
            ctaLabel: 'Vote on the board',
            siteUrl
        })
    };
}

export function renderIssueResolvedEmail({
    who, title, category, note = '', siteUrl = ''
}) {
    const cleanNote = String(note || '').trim();
    const subject = `Fixed · ${who} solved ${title}`;

    const text = [
        `${who} solved: ${title}`,
        category ? `Category: ${category}` : null,
        cleanNote ? `Note: ${cleanNote}` : null,
        '',
        `See the board: ${siteUrl}`
    ].filter(Boolean).join('\n');

    const bodyHtml = [
        paragraph(`Good news from the chalet &mdash; <strong>${escapeHtml(who)}</strong> has fixed <strong>${escapeHtml(title)}</strong>. Confirmed and closed on the family board.`),
        category ? `<div style="padding-bottom:14px">${pill(category, C.greenBg, C.green)}</div>` : '',
        cleanNote
            ? noteCard('From the fixer', `&ldquo;${escapeHtml(cleanNote)}&rdquo;`, C.green)
            : noteCard('Status', `<span style="font-family:${FONT_BODY};font-size:14px;font-weight:700;color:${C.green}">Resolved and verified.</span>`, C.green)
    ].join('');

    return {
        subject,
        text,
        html: shell({
            eyebrow: 'Problem solved',
            heading: `${who} solved ${title}`,
            tag: 'Board',
            preheader: `${who} fixed it · ${category || 'Chalet'}`,
            bodyHtml,
            ctaLabel: 'See the board',
            siteUrl
        })
    };
}

/** Plain fallback for ad-hoc messages. */
export function renderSimpleEmail({ subject, text, siteUrl = '' }) {
    return {
        subject,
        text,
        html: shell({
            heading: subject,
            preheader: String(text).split('\n')[0] || '',
            bodyHtml: paragraph(escapeHtml(text).replace(/\n/g, '<br>')),
            ctaLabel: 'Open the family portal',
            siteUrl
        })
    };
}
