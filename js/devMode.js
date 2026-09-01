import { ADMIN_EMAILS } from './config.js';

const STORAGE_KEY = 'chalet.devMode';

const DEFAULTS = {
    enabled: false,
    emailsToSelf: true,
    subjectPrefix: true
};

function normalizeEmail(email) {
    return String(email || '').toLowerCase().trim();
}

function readRaw() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { ...DEFAULTS };
        const parsed = JSON.parse(raw);
        return {
            enabled: Boolean(parsed.enabled),
            emailsToSelf: parsed.emailsToSelf !== false,
            subjectPrefix: parsed.subjectPrefix !== false
        };
    } catch {
        return { ...DEFAULTS };
    }
}

export function canUseDevMode(email) {
    if (!email) return false;
    const lower = normalizeEmail(email);
    return ADMIN_EMAILS.some(a => normalizeEmail(a) === lower);
}

export function getDevSettings() {
    return readRaw();
}

export function isDevMode() {
    return readRaw().enabled;
}

export function setDevSettings(partial) {
    const next = { ...readRaw(), ...partial };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
        enabled: Boolean(next.enabled),
        emailsToSelf: next.emailsToSelf !== false,
        subjectPrefix: next.subjectPrefix !== false
    }));
    return getDevSettings();
}

/** When emails-to-self is on, only admins receive notify mail. */
export function resolveNotifyRecipients(fullList) {
    const settings = readRaw();
    const list = (fullList || []).map(normalizeEmail).filter(Boolean);
    if (!settings.enabled || !settings.emailsToSelf) return list;

    const admins = (ADMIN_EMAILS || []).map(normalizeEmail).filter(Boolean);
    const narrowed = list.filter(e => admins.includes(e));
    return narrowed.length ? narrowed : admins;
}

export function applyDevSubject(subject) {
    const settings = readRaw();
    if (!settings.enabled || !settings.subjectPrefix) return subject || '';
    const s = String(subject || '');
    if (s.startsWith('[DEV]')) return s;
    return `[DEV] ${s}`;
}

export function isDevNotifyActive() {
    const s = readRaw();
    return s.enabled && s.emailsToSelf;
}
