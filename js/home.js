import { collection, query, orderBy, onSnapshot, doc, limit } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { db, ADMIN_EMAILS, FAMILY_EMAIL_LIST, LEADERBOARD_SCORING_LIVE, LEADERBOARD_SCORE_FROM, familyName, isKnownFamily, isExcludedEmail } from './config.js';
import {
    SUPPLY_KEYS, CHECK_KEYS, supplyLabel, checkLabel,
    countMissingSupplies, countFailedChecks
} from './houseChecklist.js';

let unsubTrip = null;
let unsubStatus = null;
let unsubIssues = null;
let unsubBoard = null;
let unsubHandovers = null;
let unsubBookingsLb = null;
let unsubLastHandover = null;

/** Cached players for profile clicks */
let leaderboardCache = {};

const POINTS = {
    missedHandover: -15,
    missingEssential: -2,
    failedCheck: -3,
    laundryLeft: -5,
    noTea: -1,
    noMeal: -1,
    perfectExit: 10,
    issue: 2,
    vote: 1
};

const leaderboardState = {
    bookings: [],
    issues: [],
    handovers: []
};

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function displayName(email) {
    return familyName(email);
}

function todayStr() {
    return new Date().toISOString().split('T')[0];
}

function addDays(dateStr, days) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + days);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function handoverDay(h) {
    if (h.timestamp && typeof h.timestamp.toDate === 'function') {
        return h.timestamp.toDate().toISOString().split('T')[0];
    }
    return null;
}

function issueDay(issue) {
    if (issue.timestamp && typeof issue.timestamp.toDate === 'function') {
        return issue.timestamp.toDate().toISOString().split('T')[0];
    }
    return null;
}

function findHandoverForBooking(booking, handovers) {
    const graceEnd = addDays(booking.endDate, 2);
    const matches = handovers.filter(h => {
        if (h.userEmail !== booking.userEmail) return false;
        const day = handoverDay(h);
        if (!day) return false;
        return day >= booking.startDate && day <= graceEnd;
    });
    if (!matches.length) return null;
    return matches.sort((a, b) => {
        const ta = a.timestamp?.toMillis?.() ?? 0;
        const tb = b.timestamp?.toMillis?.() ?? 0;
        return tb - ta;
    })[0];
}

function pushEvent(player, event) {
    player.events.push(event);
    player.score += event.points;
}

function ensurePlayer(map, email) {
    if (!email || isExcludedEmail(email) || !isKnownFamily(email)) return null;
    if (!map[email]) {
        map[email] = {
            email,
            score: 0,
            missedHandovers: 0,
            perfectExits: 0,
            messyExits: 0,
            issues: 0,
            votes: 0,
            events: []
        };
    }
    return map[email];
}

function buildLeaderboardMap() {
    const map = {};
    const today = todayStr();
    const scoreFrom = LEADERBOARD_SCORE_FROM || today;

    // Seed known family emails so the board isn't empty while scoring is off
    [...ADMIN_EMAILS, ...FAMILY_EMAIL_LIST, 'maxthomasclubb@gmail.com'].forEach(email => ensurePlayer(map, email));
    leaderboardState.bookings.forEach(b => ensurePlayer(map, b.userEmail));
    leaderboardState.handovers.forEach(h => ensurePlayer(map, h.userEmail));
    leaderboardState.issues.forEach(i => {
        ensurePlayer(map, i.userEmail);
        (i.votedBy || []).forEach(e => ensurePlayer(map, e));
        (i.downvotedBy || []).forEach(e => ensurePlayer(map, e));
    });

    if (!LEADERBOARD_SCORING_LIVE) {
        Object.values(map).forEach(p => {
            p.score = 0;
            p.events = [];
            p.missedHandovers = 0;
            p.perfectExits = 0;
            p.messyExits = 0;
            p.issues = 0;
            p.votes = 0;
        });
        return map;
    }

    // Past stays ending on/after SCORE_FROM
    leaderboardState.bookings.forEach(booking => {
        if (!booking.userEmail || !booking.endDate) return;
        if (booking.endDate >= today) return;
        if (booking.endDate < scoreFrom) return;

        const player = ensurePlayer(map, booking.userEmail);
        if (!player) return;

        const tripLabel = booking.title || 'Trip';
        const report = findHandoverForBooking(booking, leaderboardState.handovers);

        if (!report) {
            player.missedHandovers += 1;
            pushEvent(player, {
                points: POINTS.missedHandover,
                title: 'Left without signing off',
                detail: `${tripLabel} · ended ${booking.endDate}`,
                date: booking.endDate
            });
            return;
        }

        const supplies = report.supplies || {};
        const checks = report.checks || {};
        const missing = SUPPLY_KEYS.filter(k => supplies[k] !== true).length;
        const failed = CHECK_KEYS.filter(k => checks[k] !== true).length;
        const reportDay = handoverDay(report) || booking.endDate;

        // Signing off is expected → 0 event (shown for clarity)
        pushEvent(player, {
            points: 0,
            title: 'Signed off',
            detail: `${tripLabel} · ${reportDay}`,
            date: reportDay
        });

        if (missing > 0) {
            pushEvent(player, {
                points: missing * POINTS.missingEssential,
                title: `${missing} essential${missing > 1 ? 's' : ''} left empty`,
                detail: tripLabel,
                date: reportDay
            });
        }
        if (failed > 0) {
            pushEvent(player, {
                points: failed * POINTS.failedCheck,
                title: `${failed} leaving-check${failed > 1 ? 's' : ''} skipped`,
                detail: tripLabel,
                date: reportDay
            });
        }
        if (report.laundry) {
            pushEvent(player, {
                points: POINTS.laundryLeft,
                title: 'Dirty laundry left behind',
                detail: tripLabel,
                date: reportDay
            });
        }
        if (!report.tea) {
            pushEvent(player, {
                points: POINTS.noTea,
                title: 'No tea/coffee left',
                detail: tripLabel,
                date: reportDay
            });
        }
        if (!report.meal) {
            pushEvent(player, {
                points: POINTS.noMeal,
                title: 'No meal left for next guests',
                detail: tripLabel,
                date: reportDay
            });
        }

        const isPerfect = missing === 0 && failed === 0 && !report.laundry && report.tea && report.meal;
        if (isPerfect) {
            player.perfectExits += 1;
            pushEvent(player, {
                points: POINTS.perfectExit,
                title: 'Perfect exit',
                detail: `${tripLabel} — clean, stocked & checks done`,
                date: reportDay
            });
        } else if (missing > 0 || failed > 0 || report.laundry || !report.tea || !report.meal) {
            player.messyExits += 1;
        }
    });

    leaderboardState.issues.forEach(issue => {
        const day = issueDay(issue);
        if (day && day < scoreFrom) return;

        if (issue.userEmail) {
            const author = ensurePlayer(map, issue.userEmail);
            if (author) {
                author.issues += 1;
                pushEvent(author, {
                    points: POINTS.issue,
                    title: 'Issue reported',
                    detail: issue.title || 'Community board',
                    date: day || ''
                });
            }
        }

        const voters = new Set([
            ...(issue.votedBy || []),
            ...(issue.downvotedBy || [])
        ]);
        voters.forEach(voterEmail => {
            const voter = ensurePlayer(map, voterEmail);
            if (!voter) return;
            voter.votes += 1;
            const kind = (issue.votedBy || []).includes(voterEmail) ? 'Upvoted' : 'Downvoted';
            pushEvent(voter, {
                points: POINTS.vote,
                title: `${kind} an issue`,
                detail: issue.title || 'Community board',
                date: day || ''
            });
        });
    });

    // Sort each player's events newest-ish first
    Object.values(map).forEach(p => {
        p.events.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    });

    return map;
}

function openLeaderboardProfile(email) {
    const player = leaderboardCache[email];
    if (!player) return;

    const name = displayName(email);
    const avatar = document.getElementById('profileAvatar');
    const nameEl = document.getElementById('profileName');
    const emailEl = document.getElementById('profileEmail');
    const scoreEl = document.getElementById('profileScore');
    const eventsEl = document.getElementById('profileEvents');

    if (avatar) avatar.textContent = name.charAt(0).toUpperCase();
    if (nameEl) nameEl.textContent = name;
    if (emailEl) emailEl.textContent = email;

    const displayScore = LEADERBOARD_SCORING_LIVE ? player.score : 0;
    if (scoreEl) {
        scoreEl.classList.toggle('is-negative', displayScore < 0);
        scoreEl.innerHTML = `${displayScore > 0 ? '+' : ''}${displayScore}<span>pts</span>`;
    }

    if (eventsEl) {
        if (!LEADERBOARD_SCORING_LIVE) {
            eventsEl.innerHTML = `
                <div class="text-secondary small py-2">
                    Scoring is paused — everyone is at <strong>0</strong> for now.
                    When scoring goes live, every gain and penalty will appear here.
                </div>`;
        } else if (!player.events.length) {
            eventsEl.innerHTML = `<div class="text-secondary small py-2">No point events yet.</div>`;
        } else {
            eventsEl.innerHTML = player.events.map(ev => {
                const ptsClass = ev.points < 0 ? 'is-negative' : ev.points === 0 ? 'is-zero' : '';
                const ptsLabel = ev.points > 0 ? `+${ev.points}` : `${ev.points}`;
                return `
                <div class="profile-event">
                    <div>
                        <div class="profile-event-title">${escapeHtml(ev.title)}</div>
                        <div class="profile-event-meta">${escapeHtml(ev.detail)}${ev.date ? ' · ' + escapeHtml(ev.date) : ''}</div>
                    </div>
                    <div class="profile-event-pts ${ptsClass}">${ptsLabel}</div>
                </div>`;
            }).join('');
        }
    }

    const modalEl = document.getElementById('leaderboardProfileModal');
    if (modalEl && window.bootstrap) new bootstrap.Modal(modalEl).show();
}

window.openLeaderboardProfile = openLeaderboardProfile;

function renderLeaderboard() {
    const el = document.getElementById('leaderboard-list');
    if (!el) return;

    const banner = document.getElementById('leaderboard-status-banner');
    if (banner) {
        if (!LEADERBOARD_SCORING_LIVE) {
            banner.classList.remove('d-none');
            banner.textContent = 'Scoring is paused. Everyone is at 0 — click a profile to open it. Turn scoring on in config when you’re ready.';
        } else {
            banner.classList.remove('d-none');
            banner.textContent = `Scoring live from ${LEADERBOARD_SCORE_FROM}. Click someone to see their full point history.`;
        }
    }

    const map = buildLeaderboardMap();
    leaderboardCache = map;

    const ranked = Object.values(map)
        .sort((a, b) => {
            const sa = LEADERBOARD_SCORING_LIVE ? a.score : 0;
            const sb = LEADERBOARD_SCORING_LIVE ? b.score : 0;
            if (sb !== sa) return sb - sa;
            return displayName(a.email).localeCompare(displayName(b.email));
        });

    if (!ranked.length) {
        el.innerHTML = `<div class="text-secondary small py-3">No family members found yet.</div>`;
        return;
    }

    el.innerHTML = ranked.map((p, i) => {
        const rank = i + 1;
        const name = displayName(p.email);
        const score = LEADERBOARD_SCORING_LIVE ? p.score : 0;
        const scoreClass = score < 0 ? 'is-negative' : '';
        const scoreLabel = score > 0 ? `+${score}` : `${score}`;

        let subtitle = 'Tap for details';
        if (LEADERBOARD_SCORING_LIVE) {
            const bits = [];
            if (p.perfectExits) bits.push(`${p.perfectExits} perfect`);
            if (p.messyExits) bits.push(`${p.messyExits} messy`);
            if (p.missedHandovers) bits.push(`${p.missedHandovers} missed`);
            if (p.issues) bits.push(`${p.issues} reports`);
            if (p.votes) bits.push(`${p.votes} votes`);
            if (bits.length) subtitle = bits.join(' · ');
        }

        return `
        <div class="leaderboard-row rank-${rank <= 3 ? rank : 'x'}" role="button" tabindex="0" data-email="${escapeHtml(p.email)}">
            <div class="leaderboard-rank">${rank}</div>
            <div class="leaderboard-avatar">${escapeHtml(name.charAt(0).toUpperCase())}</div>
            <div class="leaderboard-meta">
                <div class="leaderboard-name">${escapeHtml(name)}</div>
                <div class="leaderboard-breakdown">${escapeHtml(subtitle)}</div>
            </div>
            <div class="leaderboard-score ${scoreClass}">${scoreLabel}<span>pts</span></div>
        </div>`;
    }).join('');

    el.querySelectorAll('.leaderboard-row[data-email]').forEach(row => {
        const open = () => openLeaderboardProfile(row.dataset.email);
        row.addEventListener('click', open);
        row.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                open();
            }
        });
    });
}

function startLeaderboard() {
    if (unsubBoard) unsubBoard();
    if (unsubHandovers) unsubHandovers();
    if (unsubBookingsLb) unsubBookingsLb();

    unsubBookingsLb = onSnapshot(collection(db, 'bookings'), (snap) => {
        leaderboardState.bookings = snap.docs.map(d => d.data());
        renderLeaderboard();
    });

    unsubBoard = onSnapshot(collection(db, 'complaints'), (snap) => {
        leaderboardState.issues = snap.docs.map(d => d.data());
        renderLeaderboard();
    });

    unsubHandovers = onSnapshot(collection(db, 'handover_reports'), (snap) => {
        leaderboardState.handovers = snap.docs.map(d => d.data());
        renderLeaderboard();
    });
}


export function initHome(user) {
    const welcomeEl = document.getElementById('welcome-title');
    if (welcomeEl) welcomeEl.textContent = 'Welcome Home.';

    startTripListener();
    startStatusListener();
    startIssuesListener();
    startShoppingAndNoteWidgets();
    startLeaderboard();
}

function startShoppingAndNoteWidgets() {
    if (unsubLastHandover) unsubLastHandover();

    // Shopping list + house status already come from house/status via startStatusListener —
    // also render shopping list there. Latest handover note:
    const q = query(collection(db, 'handover_reports'), orderBy('timestamp', 'desc'), limit(1));
    unsubLastHandover = onSnapshot(q, (snap) => {
        const el = document.getElementById('last-handover-note');
        if (!el) return;
        if (snap.empty) {
            el.innerHTML = `<div class="text-secondary small">No handover notes yet. First family to sign off sets the tone.</div>`;
            return;
        }
        const r = snap.docs[0].data();
        const who = familyName(r.userEmail) || 'Someone';
        const note = (r.nextGuestNote || '').trim();
        const food = (r.foodDetails || '').trim();
        if (note) {
            el.innerHTML = `
                <div class="fst-italic mb-2">“${escapeHtml(note)}”</div>
                <div class="small text-secondary">— ${escapeHtml(who)}</div>`;
        } else if (food) {
            el.innerHTML = `
                <div class="small text-secondary mb-1">Food left behind:</div>
                <div class="mb-2">${escapeHtml(food)}</div>
                <div class="small text-secondary">— ${escapeHtml(who)}</div>`;
        } else {
            el.innerHTML = `<div class="text-secondary small">${escapeHtml(who)} signed off but left no note. Add one next time!</div>`;
        }
    });
}

function startTripListener() {
    const today = new Date().toISOString().split('T')[0];
    const q = query(collection(db, 'bookings'), orderBy('startDate', 'asc'));

    if (unsubTrip) unsubTrip();

    unsubTrip = onSnapshot(q, (snapshot) => {
        let nextTrip = null;
        snapshot.forEach(docSnap => {
            const b = docSnap.data();
            if (!nextTrip && b.endDate >= today) nextTrip = b;
        });

        const el = document.getElementById('widget-next-trip');
        if (!el) return;

        if (nextTrip) {
            const isNow = (today >= nextTrip.startDate && today <= nextTrip.endDate);
            const label = isNow ? 'HAPPENING NOW' : 'NEXT UP';
            const colorClass = isNow ? 'text-success' : '';
            const colorStyle = isNow ? '' : 'color: var(--pine-mid);';

            el.innerHTML = `
                <div class="small fw-bold mb-1 ${colorClass}" style="${colorStyle}">${label}</div>
                <div class="fw-bold fs-5 text-dark text-truncate">${escapeHtml(nextTrip.title)}</div>
                <div class="text-secondary small">${escapeHtml(nextTrip.startDate)} &bull; ${escapeHtml(nextTrip.endDate)}</div>
            `;
        } else {
            el.innerHTML = `<div class="text-secondary small py-2">No upcoming trips. Plan one!</div>`;
        }
    });
}

function startStatusListener() {
    const docRef = doc(db, 'house', 'status');

    if (unsubStatus) unsubStatus();

    unsubStatus = onSnapshot(docRef, (docSnap) => {
        const el = document.getElementById('widget-status');
        if (!el) return;

        if (docSnap.exists()) {
            const data = docSnap.data();
            const supplies = data.supplies || {};
            const checks = data.checks || {};
            const missingCount = countMissingSupplies(supplies);
            const failedChecks = countFailedChecks(checks);

            let icon, text, subtext;

            if (missingCount > 0 || failedChecks > 0) {
                icon = 'bi-exclamation-circle-fill text-danger';
                text = 'Needs attention';
                const bits = [];
                if (missingCount) bits.push(`${missingCount} empty`);
                if (failedChecks) bits.push(`${failedChecks} checks open`);
                subtext = bits.join(' · ');
            } else if (data.laundry) {
                icon = 'bi-basket-fill text-warning';
                text = 'Laundry Waiting';
                subtext = 'Check hallway/bathroom';
            } else {
                icon = 'bi-check-circle-fill text-success';
                text = 'House is Ready';
                subtext = 'All Clean & Stocked';
            }

            el.innerHTML = `
                <div class="d-flex align-items-center gap-3">
                    <i class="bi ${icon} fs-1"></i>
                    <div class="lh-1">
                        <div class="small fw-bold text-secondary">LIVE STATE</div>
                        <div class="fw-bold fs-5 text-dark">${text}</div>
                        <div class="small text-secondary">${subtext}</div>
                    </div>
                </div>
            `;

            const shop = document.getElementById('shopping-list-widget');
            if (shop) {
                const empty = SUPPLY_KEYS.filter(k => supplies[k] !== true);
                if (!empty.length) {
                    shop.innerHTML = `<div class="text-success small fw-bold"><i class="bi bi-check-circle me-1"></i>Nothing to buy — stockroom looks full.</div>`;
                } else {
                    shop.innerHTML = `
                        <ul class="list-unstyled mb-0 shopping-chips">
                            ${empty.map(k => `<li><span class="shop-chip">${escapeHtml(supplyLabel(k))}</span></li>`).join('')}
                        </ul>
                        <div class="small text-secondary mt-3">Open Stockroom to update after shopping.</div>`;
                }
            }
        } else {
            el.innerHTML = `<div class="text-secondary small">Status unknown.</div>`;
            const shop = document.getElementById('shopping-list-widget');
            if (shop) shop.innerHTML = `<div class="text-secondary small">No stock data yet.</div>`;
        }
    });
}

function startIssuesListener() {
    const q = query(collection(db, 'complaints'));

    if (unsubIssues) unsubIssues();

    unsubIssues = onSnapshot(q, (snapshot) => {
        let count = 0;
        snapshot.forEach(docSnap => {
            const s = docSnap.data().status;
            if (s === 'pending' || s === 'approved') count++;
        });

        const el = document.getElementById('widget-issues');
        if (!el) return;

        if (count > 0) {
            el.innerHTML = `
                <div class="d-flex align-items-center justify-content-between">
                    <div>
                        <div class="display-5 fw-bold text-danger mb-0 lh-1">${count}</div>
                        <div class="small text-danger fw-bold">Active Issue${count > 1 ? 's' : ''}</div>
                    </div>
                    <i class="bi bi-tools text-danger opacity-25" style="font-size: 2.5rem;"></i>
                </div>`;
        } else {
            el.innerHTML = `
                <div class="d-flex align-items-center justify-content-between">
                    <div>
                        <div class="display-5 fw-bold text-success mb-0 lh-1">0</div>
                        <div class="small text-success fw-bold">All Good</div>
                    </div>
                    <i class="bi bi-shield-check text-success opacity-25" style="font-size: 2.5rem;"></i>
                </div>`;
        }
    });
}
