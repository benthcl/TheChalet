import { collection, addDoc, serverTimestamp, query, where, orderBy, limit, getDocs } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { db, getNotifyEmails, familyName, EMAIL_FROM, EMAIL_REPLY_TO, SITE_URL } from './config.js';
import {
    resolveNotifyRecipients,
    applyDevSubject,
    isDevNotifyActive,
    isDevMode
} from './devMode.js';
import {
    renderBookingEmail,
    renderHandoverEmail,
    renderIssueEmail,
    renderIssueResolvedEmail,
    renderSimpleEmail,
    todayLocalIso
} from './emailTemplate.js';

/**
 * Trips that have not finished yet, so every mail can show who is around.
 * A range filter and sort on the same field needs no composite index.
 */
async function fetchUpcomingTrips(max = 6) {
    try {
        const snap = await getDocs(query(
            collection(db, 'bookings'),
            where('endDate', '>=', todayLocalIso()),
            orderBy('endDate'),
            limit(max)
        ));
        return snap.docs.map(d => {
            const t = d.data();
            return {
                name: t.title || familyName(t.userEmail),
                startDate: t.startDate,
                endDate: t.endDate
            };
        });
    } catch (err) {
        console.warn('Could not load trips for email:', err.message);
        return [];
    }
}

/**
 * Queue a family email via Firestore `mail` docs.
 * Needs Firebase Extension: Trigger Email from Firestore.
 * Everyone on the notify list is included, including the person who triggered it.
 * Throws if the mail doc cannot be written (callers should warn the user).
 */
export async function notifyFamily({ subject, text, html, meta = {} }) {
    const recipients = resolveNotifyRecipients(getNotifyEmails());
    if (!recipients.length) return;

    const finalSubject = applyDevSubject(subject);
    const mailMeta = {
        ...meta,
        ...(isDevMode() ? { devMode: true, emailsToSelf: isDevNotifyActive() } : {})
    };

    try {
        await addDoc(collection(db, 'mail'), {
            to: recipients,
            from: EMAIL_FROM,
            replyTo: EMAIL_REPLY_TO,
            message: {
                subject: finalSubject,
                text,
                html: html || renderSimpleEmail({ subject: finalSubject, text, siteUrl: SITE_URL }).html
            },
            createdAt: serverTimestamp(),
            meta: mailMeta
        });
    } catch (err) {
        console.warn('Could not queue family email:', err.message);
        throw err;
    }
}

export async function notifyBooking({ action, title, startDate, endDate, arrivalTime, departureTime, bookerEmail }) {
    const mail = renderBookingEmail({
        action,
        who: familyName(bookerEmail),
        title,
        startDate,
        endDate,
        arrivalTime,
        departureTime,
        trips: await fetchUpcomingTrips(),
        siteUrl: SITE_URL
    });

    await notifyFamily({
        ...mail,
        meta: { type: 'booking', action, bookerEmail }
    });
}

export async function notifyHandover({ userEmail, nextGuestNote, shoppingList = [], openChecks = [], laundryLeft = false }) {
    const mail = renderHandoverEmail({
        who: familyName(userEmail),
        nextGuestNote,
        shoppingList,
        openChecks,
        laundryLeft,
        trips: await fetchUpcomingTrips(),
        siteUrl: SITE_URL
    });

    await notifyFamily({
        ...mail,
        meta: { type: 'handover', userEmail }
    });
}

export async function notifyIssue({ userEmail, title, category, isAnonymous, description = '' }) {
    const mail = renderIssueEmail({
        who: isAnonymous ? 'A family member' : familyName(userEmail),
        title,
        category,
        description,
        siteUrl: SITE_URL
    });

    await notifyFamily({
        ...mail,
        meta: { type: 'issue', userEmail, category }
    });
}

export async function notifyIssueResolved({ resolverEmail, title, category, note = '' }) {
    const mail = renderIssueResolvedEmail({
        who: familyName(resolverEmail),
        title,
        category,
        note,
        siteUrl: SITE_URL
    });

    await notifyFamily({
        ...mail,
        meta: { type: 'issue_resolved', resolverEmail, category }
    });
}
