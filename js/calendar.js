import { collection, addDoc, query, onSnapshot, serverTimestamp, doc, deleteDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { db, auth, ADMIN_EMAILS, familyName } from './config.js';
import { notifyBooking } from './notify.js';

let calendar = null;
let unsubscribe = null;

/**
 * Trips are colored from this palette by hashing the title, so the same
 * group always gets the same tone and everything stays on-theme.
 * Colors stored on old bookings are ignored — they predate the palette.
 */
const EVENT_PALETTE = ['#2f5c4a', '#3d6b56', '#52796a', '#1f3d32', '#6b8f71', '#8a6a35', '#5c7a6e'];

function eventColor(seed) {
    let hash = 0;
    for (const ch of String(seed || '')) {
        hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    }
    return EVENT_PALETTE[hash % EVENT_PALETTE.length];
}

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function setBookingFormMode(mode, data = null, bookingId = '') {
    const titleEl = document.getElementById('tripModalTitle');
    const submitBtn = document.getElementById('tripSubmitBtn');
    const editId = document.getElementById('tripEditId');
    const form = document.getElementById('booking-form');

    if (!form) return;

    if (mode === 'edit' && data) {
        if (titleEl) titleEl.textContent = 'Edit Trip';
        if (submitBtn) submitBtn.textContent = 'Save Changes';
        if (editId) editId.value = bookingId;
        document.getElementById('tripTitle').value = data.title || '';
        document.getElementById('tripStart').value = data.startDate || '';
        document.getElementById('tripEnd').value = data.endDate || '';
        document.getElementById('tripArrival').value = data.arrivalTime || '';
        document.getElementById('tripDeparture').value = data.departureTime || '';
    } else {
        if (titleEl) titleEl.textContent = 'Plan a Trip';
        if (submitBtn) submitBtn.textContent = 'Confirm Booking';
        if (editId) editId.value = '';
        form.reset();
    }
}

export function initCalendar(currentUser) {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl) return;

    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,listMonth' },
        height: 'auto',
        eventClick: (info) => handleEventClick(info, currentUser),
        events: []
    });
    calendar.render();

    const q = query(collection(db, 'bookings'));

    if (unsubscribe) unsubscribe();

    unsubscribe = onSnapshot(q, (snapshot) => {
        const events = [];
        snapshot.forEach((documentSnapshot) => {
            const data = documentSnapshot.data();
            const id = documentSnapshot.id;

            const [ey, em, ed] = data.endDate.split('-').map(Number);
            const endObj = new Date(ey, em - 1, ed);
            endObj.setDate(endObj.getDate() + 1);
            const adjustedEnd = `${endObj.getFullYear()}-${String(endObj.getMonth() + 1).padStart(2, '0')}-${String(endObj.getDate()).padStart(2, '0')}`;

            events.push({
                id: id, title: data.title, start: data.startDate, end: adjustedEnd,
                backgroundColor: eventColor(data.title), borderColor: 'transparent',
                className: 'trip-event-main', extendedProps: { ...data, type: 'main' }
            });

            if (data.arrivalTime) {
                events.push({
                    id: `${id}-arrival`, title: `🛬 ${data.arrivalTime}`, start: data.startDate,
                    allDay: true, className: 'logistics-event', display: 'block',
                    extendedProps: { ...data, type: 'logistics', bookingId: id }
                });
            }

            if (data.departureTime) {
                events.push({
                    id: `${id}-departure`, title: `🛫 ${data.departureTime}`, start: data.endDate,
                    allDay: true, className: 'logistics-event', display: 'block',
                    extendedProps: { ...data, type: 'logistics', bookingId: id }
                });
            }
        });
        calendar.removeAllEvents();
        calendar.addEventSource(events);
    });

    // Reset form when opening "Book Dates"
    document.getElementById('btn-new-trip')?.addEventListener('click', () => {
        setBookingFormMode('create');
    });

    document.getElementById('addTripModal')?.addEventListener('hidden.bs.modal', () => {
        setBookingFormMode('create');
    });
}

export function cleanupCalendar() {
    if (unsubscribe) unsubscribe();
}

export function refreshCalendar() {
    if (calendar) setTimeout(() => calendar.render(), 100);
}

function handleEventClick(info, currentUser) {
    const data = info.event.extendedProps;
    const bookingId = data.bookingId || info.event.id;
    const modalEl = document.getElementById('viewTripModal');
    const contentEl = document.getElementById('viewTripContent');
    const controlsEl = document.getElementById('tripControls');
    const deleteBtn = document.getElementById('deleteTripBtn');
    const editBtn = document.getElementById('editTripBtn');

    contentEl.innerHTML = `
        <h3 class="fw-bold mb-3">${escapeHtml(data.title)}</h3>
        <p class="mb-1"><strong>Arrive:</strong> ${escapeHtml(data.startDate)} ${data.arrivalTime ? '@ ' + escapeHtml(data.arrivalTime) : ''}</p>
        <p class="mb-3"><strong>Depart:</strong> ${escapeHtml(data.endDate)} ${data.departureTime ? '@ ' + escapeHtml(data.departureTime) : ''}</p>
        <div class="small text-secondary">Booked by: ${escapeHtml(familyName(data.userEmail))}</div>
    `;

    const isOwner = data.userEmail === currentUser.email;
    const isAdmin = ADMIN_EMAILS.includes(currentUser.email);

    if (isOwner || isAdmin) {
        controlsEl.classList.remove('d-none');

        editBtn.onclick = () => {
            bootstrap.Modal.getInstance(modalEl)?.hide();
            setBookingFormMode('edit', data, bookingId);
            new bootstrap.Modal(document.getElementById('addTripModal')).show();
        };

        deleteBtn.onclick = async () => {
            const result = await Swal.fire({
                title: 'Cancel this booking?',
                text: 'This cannot be undone.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#a35a28',
                cancelButtonColor: '#6c757d',
                confirmButtonText: 'Yes, cancel it',
                customClass: { popup: 'glass-panel' }
            });
            if (result.isConfirmed) {
                await deleteDoc(doc(db, 'bookings', bookingId));
                bootstrap.Modal.getInstance(modalEl)?.hide();
            }
        };
    } else {
        controlsEl.classList.add('d-none');
    }

    new bootstrap.Modal(modalEl).show();
}

const bookingForm = document.getElementById('booking-form');
if (bookingForm) {
    bookingForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!auth.currentUser) return;

        const editId = document.getElementById('tripEditId').value.trim();
        const title = document.getElementById('tripTitle').value.trim();
        const start = document.getElementById('tripStart').value;
        const end = document.getElementById('tripEnd').value;
        const arrive = document.getElementById('tripArrival').value.trim();
        const depart = document.getElementById('tripDeparture').value.trim();

        if (end < start) {
            return Swal.fire({
                title: 'Invalid dates',
                text: 'Departure must be on or after arrival.',
                icon: 'warning',
                confirmButtonColor: '#1f3d32',
                customClass: { popup: 'glass-panel' }
            });
        }

        const submitBtn = document.getElementById('tripSubmitBtn');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = editId ? 'Saving…' : 'Booking…';
        }

        try {
            const payload = {
                title,
                startDate: start,
                endDate: end,
                arrivalTime: arrive,
                departureTime: depart
            };

            if (editId) {
                await updateDoc(doc(db, 'bookings', editId), {
                    ...payload,
                    updatedAt: serverTimestamp()
                });
                bootstrap.Modal.getInstance(document.getElementById('addTripModal'))?.hide();
                setBookingFormMode('create');
                try {
                    await notifyBooking({
                        action: 'updated',
                        ...payload,
                        bookerEmail: auth.currentUser.email
                    });
                    Swal.fire({
                        title: 'Updated!',
                        text: 'Your trip changes are saved.',
                        icon: 'success',
                        timer: 2000,
                        showConfirmButton: false,
                        customClass: { popup: 'glass-panel' }
                    });
                } catch {
                    Swal.fire({
                        title: 'Updated',
                        text: 'Saved, but the family email could not be queued.',
                        icon: 'warning',
                        confirmButtonColor: '#1f3d32',
                        customClass: { popup: 'glass-panel' }
                    });
                }
            } else {
                await addDoc(collection(db, 'bookings'), {
                    ...payload,
                    userEmail: auth.currentUser.email,
                    timestamp: serverTimestamp()
                });
                bootstrap.Modal.getInstance(document.getElementById('addTripModal'))?.hide();
                setBookingFormMode('create');
                try {
                    await notifyBooking({
                        action: 'booked',
                        ...payload,
                        bookerEmail: auth.currentUser.email
                    });
                    Swal.fire({
                        title: 'Booked!',
                        text: 'Your trip has been added to the calendar.',
                        icon: 'success',
                        timer: 2000,
                        showConfirmButton: false,
                        customClass: { popup: 'glass-panel' }
                    });
                } catch {
                    Swal.fire({
                        title: 'Booked',
                        text: 'Saved, but the family email could not be queued.',
                        icon: 'warning',
                        confirmButtonColor: '#1f3d32',
                        customClass: { popup: 'glass-panel' }
                    });
                }
            }
        } catch (error) {
            Swal.fire({
                title: editId ? 'Update failed' : 'Booking failed',
                text: error.message,
                icon: 'error',
                confirmButtonColor: '#1f3d32',
                customClass: { popup: 'glass-panel' }
            });
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = editId ? 'Save Changes' : 'Confirm Booking';
            }
        }
    });
}
