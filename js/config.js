import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

const firebaseConfig = {
  apiKey: "AIzaSyAiYXGjF9KB2Fd4qvdjjG4vWekLvbmsAik",
  authDomain: "the-chalet-e4581.firebaseapp.com",
  projectId: "the-chalet-e4581",
  storageBucket: "the-chalet-e4581.firebasestorage.app",
  messagingSenderId: "139085912060",
  appId: "1:139085912060:web:51836f6ba88f32aed6c479"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

/**
 * Family directory — names shown in the app instead of email prefixes.
 * Keys may be a full email or just the local part (before @).
 */
const FAMILY_NAME_MAP = {
    'alexpihouee94': 'Alex',
    'alexpihouee94@gmail.com': 'Alex',
    'danielpihouee': 'Dan',
    'danielpihouee@outlook.fr': 'Dan',
    'englishcentroadvance': 'Sal',
    'englishcentroadvance@gmail.com': 'Sal',
    'jat709': 'Jen',
    'jat709@gmail.com': 'Jen',
    'micky.thomas': 'Micky',
    'micky.thomas@gmail.com': 'Micky',
    'stephen.farmer': 'Stephen',
    'stephen.farmer@gmail.com': 'Stephen',
    'susie_pihouee': 'Susie',
    'susie_pihouee@gmail.com': 'Susie',
    'thomasclubbben': 'Ben',
    'thomasclubbben@gmail.com': 'Ben',
    'maxthomasclubb': 'Max',
    'maxthomasclubb@gmail.com': 'Max',
    'tpihouee': 'Tim',
    'tpihouee@gmail.com': 'Tim'
};

/**
 * Removed / test accounts — still may exist in old Firestore docs,
 * but must never appear on the leaderboard or in family UI lists.
 */
export const EXCLUDED_EMAILS = [
    'cousing@gmail.com',
    'cousing'
];

/** Admins can approve issues, delete reports, edit stock anytime, etc. */
export const ADMIN_EMAILS = [
    'thomasclubbben@gmail.com'
];

/**
 * Family email list — notified on chalet updates (bookings, handovers, issues).
 * The person who triggered the update is skipped when others are on the list.
 *
 * Sending requires Firebase Extension "Trigger Email from Firestore"
 * (collection id: mail) + Firestore rules allowing create on `mail`.
 */
export const FAMILY_EMAIL_LIST = [
    'thomasclubbben@gmail.com',       // Ben
    'maxthomasclubb@gmail.com',       // Max
    'alexpihouee94@gmail.com',        // Alex
    'danielpihouee@outlook.fr',       // Dan
    'englishcentroadvance@gmail.com', // Sal
    'jat709@gmail.com',               // Jen
    'micky.thomas@gmail.com',         // Micky
    'stephen.farmer@gmail.com',       // Stephen
    'susie_pihouee@gmail.com',        // Susie
    'tpihouee@gmail.com'              // Tim
];

/** @deprecated use FAMILY_EMAIL_LIST — kept so older imports keep working */
export const NOTIFY_EMAILS = FAMILY_EMAIL_LIST;

/**
 * Email branding. FROM must use an address verified in Brevo.
 * Brevo may rewrite the visible address until a sending domain is
 * authenticated, but the "The Chalet" display name still shows.
 */
export const EMAIL_FROM = 'The Chalet <thomasclubbben@gmail.com>';
export const EMAIL_REPLY_TO = 'thomasclubbben@gmail.com';
export const SITE_URL = 'https://benthcl.github.io/TheChalet/';

function normalizeEmail(email) {
    return String(email || '').toLowerCase().trim();
}

export function isExcludedEmail(email) {
    if (!email) return true;
    const lower = normalizeEmail(email);
    const local = lower.split('@')[0];
    return EXCLUDED_EMAILS.some(x => {
        const n = normalizeEmail(x);
        return n === lower || n === local;
    });
}

/** True if this email maps to a known family member (and is not excluded). */
export function isKnownFamily(email) {
    if (!email || isExcludedEmail(email)) return false;
    const lower = normalizeEmail(email);
    const local = lower.split('@')[0];
    return Boolean(FAMILY_NAME_MAP[lower] || FAMILY_NAME_MAP[local]);
}

export function familyName(email) {
    if (!email) return 'Family member';
    const lower = normalizeEmail(email);
    if (FAMILY_NAME_MAP[lower]) return FAMILY_NAME_MAP[lower];
    const local = lower.split('@')[0];
    return FAMILY_NAME_MAP[local] || local;
}

/**
 * One stable email per person for leaderboard / scoring.
 * Merges Susie_Pihouee@… with susie_pihouee@gmail.com, etc.
 */
export function canonicalFamilyEmail(email) {
    if (!email || isExcludedEmail(email)) return null;
    const lower = normalizeEmail(email);
    const local = lower.split('@')[0];

    const fromList = (FAMILY_EMAIL_LIST || []).find(e => {
        const n = normalizeEmail(e);
        return n === lower || n.split('@')[0] === local;
    });
    if (fromList) return normalizeEmail(fromList);

    if (FAMILY_NAME_MAP[lower]) return lower;
    if (FAMILY_NAME_MAP[local]) {
        const gmail = `${local}@gmail.com`;
        return FAMILY_NAME_MAP[gmail] ? gmail : local;
    }
    return lower;
}

export function getNotifyEmails() {
    return [...new Set((FAMILY_EMAIL_LIST || []).map(normalizeEmail).filter(e => e && !isExcludedEmail(e)))];
}

/**
 * Leaderboard scoring. Keep LIVE false until you're ready —
 * everyone shows 0 and profiles have no point history yet.
 */
export const LEADERBOARD_SCORING_LIVE = false;
export const LEADERBOARD_SCORE_FROM = '2026-07-28';

/**
 * Chalet coordinates for weather (Open-Meteo / Météo-France AROME).
 * Les Contamines-Montjoie — house: 45°49'46.10"N 6°43'38.31"E, 1,094 m
 */
export const CHALET_LOCATION = {
    label: 'Les Contamines-Montjoie',
    latitude: 45.829472,
    longitude: 6.727308,
    elevation: 1094,
    timezone: 'Europe/Paris'
};
