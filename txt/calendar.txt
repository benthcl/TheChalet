import { collection, addDoc, query, onSnapshot, serverTimestamp, doc, deleteDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { db, auth, ADMIN_EMAILS } from './config.js';

let calendar = null;
let unsubscribe = null;

export function initCalendar(currentUser) {
    const calendarEl = document.getElementById('calendar');
    if(!calendarEl) return;

    // Initialize FullCalendar (Global library)
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
            
            let endObj = new Date(data.endDate);
            endObj.setDate(endObj.getDate() + 1);
            const adjustedEnd = endObj.toISOString().split('T')[0];

            // Main Bar
            events.push({
                id: id, title: data.title, start: data.startDate, end: adjustedEnd,
                backgroundColor: data.color || '#2c3e50', borderColor: 'transparent',
                className: 'trip-event-main', extendedProps: { ...data, type: 'main' }
            });

            // Arrival Text
            if(data.arrivalTime) {
                events.push({
                    id: id, title: `🛬 ${data.arrivalTime}`, start: data.startDate,
                    allDay: true, className: 'logistics-event', display: 'block',
                    extendedProps: { ...data, type: 'logistics' }
                });
            }

            // Departure Text
            if(data.departureTime) {
                events.push({
                    id: id, title: `🛫 ${data.departureTime}`, start: data.endDate,
                    allDay: true, className: 'logistics-event', display: 'block',
                    extendedProps: { ...data, type: 'logistics' }
                });
            }
        });
        calendar.removeAllEvents();
        calendar.addEventSource(events);
    });
}

export function cleanupCalendar() {
    if (unsubscribe) unsubscribe();
}

// Refresh Function (Called when switching tabs)
export function refreshCalendar() {
    if(calendar) setTimeout(() => calendar.render(), 100);
}

function handleEventClick(info, currentUser) {
    const data = info.event.extendedProps;
    const bookingId = info.event.id;
    const modalEl = document.getElementById('viewTripModal');
    const contentEl = document.getElementById('viewTripContent');
    const controlsEl = document.getElementById('tripControls');
    const deleteBtn = document.getElementById('deleteTripBtn');

    contentEl.innerHTML = `
        <h3 class="fw-bold mb-3">${data.title}</h3>
        <p class="mb-1"><strong>Arrive:</strong> ${data.startDate} ${data.arrivalTime ? '@ ' + data.arrivalTime : ''}</p>
        <p class="mb-3"><strong>Depart:</strong> ${data.endDate} ${data.departureTime ? '@ ' + data.departureTime : ''}</p>
        <div class="small text-secondary">Booked by: ${data.userEmail}</div>
    `;

    const isOwner = data.userEmail === currentUser.email;
    const isAdmin = ADMIN_EMAILS.includes(currentUser.email);

    if (isOwner || isAdmin) {
        controlsEl.classList.remove('d-none');
        deleteBtn.onclick = async () => {
            if(confirm("Cancel this booking?")) {
                await deleteDoc(doc(db, "bookings", bookingId));
                bootstrap.Modal.getInstance(modalEl).hide();
            }
        };
    } else {
        controlsEl.classList.add('d-none');
    }

    new bootstrap.Modal(modalEl).show();
}

// Form Handler
const bookingForm = document.getElementById('booking-form');
if(bookingForm) {
    bookingForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if(!auth.currentUser) return;

        const title = document.getElementById('tripTitle').value;
        const start = document.getElementById('tripStart').value;
        const end = document.getElementById('tripEnd').value;
        const arrive = document.getElementById('tripArrival').value;
        const depart = document.getElementById('tripDeparture').value;
        const colors = ['#1abc9c', '#2ecc71', '#3498db', '#9b59b6', '#34495e', '#e67e22', '#e74c3c'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];

        try {
            await addDoc(collection(db, 'bookings'), {
                title, startDate: start, endDate: end, arrivalTime: arrive, departureTime: depart,
                color: randomColor, userEmail: auth.currentUser.email, timestamp: serverTimestamp()
            });
            bootstrap.Modal.getInstance(document.getElementById('addTripModal'))?.hide();
            bookingForm.reset();
        } catch (error) { alert("Error: " + error.message); }
    });
}