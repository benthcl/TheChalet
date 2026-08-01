import { collection, addDoc, serverTimestamp, query, where, orderBy, limit, getDocs } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { db, getNotifyEmails, familyName, EMAIL_FROM, EMAIL_REPLY_TO, SITE_URL } from './config.js';
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
 *
 * During testing with a single address, the actor is still included
 * so you receive the message and can confirm delivery.
 */
export async function notifyFamily({ subject, text, html, meta = {}, excludeEmail = null }) {
    let recipients = getNotifyEmails();
    if (!recipients.length) return;

    // Only skip the actor when there are other people to notify
    if (excludeEmail && recipients.length > 1) {
        recipients = recipients.filter(e => e !== excludeEmail.toLowerCase());
    }
    if (!recipients.length) return;

    try {
        await addDoc(collection(db, 'mail'), {
            to: recipients,
            from: EMAIL_FROM,
            replyTo: EMAIL_REPLY_TO,
            message: {
                subject,
                text,
                html: html || renderSimpleEmail({ subject, text, siteUrl: SITE_URL }).html
            },
            createdAt: serverTimestamp(),
            meta
        });
    } catch (err) {
        console.warn('Could not queue family email:', err.message);
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
        meta: { type: 'booking', action, bookerEmail },
        excludeEmail: bookerEmail
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
        meta: { type: 'handover', userEmail },
        excludeEmail: userEmail
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
        meta: { type: 'issue', userEmail, category },
        excludeEmail: isAnonymous ? null : userEmail
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
        meta: { type: 'issue_resolved', resolverEmail, category },
        excludeEmail: resolverEmail
    });
}
