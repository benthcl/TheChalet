import { collection, query, orderBy, limit, onSnapshot, doc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { db } from './config.js';

let unsubTrip = null;
let unsubStatus = null;
let unsubIssues = null;

export function initHome(user) {
    // OLD: const name = user.email.split('@')[0];
    
    // NEW: Clean Welcome Logic
    // Just say "Welcome Home" to keep it clean and professional.
    const welcomeEl = document.getElementById('welcome-title');
    if(welcomeEl) welcomeEl.textContent = "Welcome Home.";

    startTripListener();
    startStatusListener();
    startIssuesListener();
}

function startTripListener() {
    const today = new Date().toISOString().split('T')[0];
    const q = query(collection(db, 'bookings'), orderBy('startDate', 'asc')); 
    
    if (unsubTrip) unsubTrip();

    unsubTrip = onSnapshot(q, (snapshot) => {
        let nextTrip = null;
        snapshot.forEach(doc => {
            const b = doc.data();
            if(!nextTrip && b.endDate >= today) {
                nextTrip = b;
            }
        });

        const el = document.getElementById('widget-next-trip');
        if(!el) return;

        if (nextTrip) {
            const isNow = (today >= nextTrip.startDate && today <= nextTrip.endDate);
            const label = isNow ? "HAPPENING NOW" : "NEXT UP";
            const color = isNow ? "text-success" : "text-primary";
            
            el.innerHTML = `
                <div class="small fw-bold ${color} mb-1">${label}</div>
                <div class="fw-bold fs-5 text-dark text-truncate">${nextTrip.title}</div>
                <div class="text-secondary small">${nextTrip.startDate} &bull; ${nextTrip.endDate}</div>
            `;
        } else {
            el.innerHTML = `<div class="text-secondary small py-2">No upcoming trips. Plan one!</div>`;
        }
    });
}

// --- UPDATED: LISTENS TO LIVE STATE (house/status) ---
function startStatusListener() {
    const docRef = doc(db, 'house', 'status');
    
    if (unsubStatus) unsubStatus();

    unsubStatus = onSnapshot(docRef, (docSnap) => {
        const el = document.getElementById('widget-status');
        if(!el) return;

        if (docSnap.exists()) {
            const data = docSnap.data();
            
            // 1. Check Supplies against our List of 8
            const essentials = ['toiletroll', 'binbags', 'washingupliquid', 'dishwashertabs', 'logs', 'oliveoil', 'matches', 'shampoo'];
            const supplies = data.supplies || {};
            
            // In your stock.js, "true" means stocked. "false" or missing means empty.
            // We count how many are explicitly NOT true.
            const missingCount = essentials.filter(k => supplies[k] !== true).length;
            
            let icon, text, subtext;

            if (missingCount > 0) {
                // RED: Critical - Supplies are missing (Live State)
                icon = 'bi-exclamation-circle-fill text-danger';
                text = 'Restock Needed';
                subtext = `${missingCount} Item${missingCount > 1 ? 's' : ''} Missing`;
            } else if (data.laundry) {
                // ORANGE: Warning - Just laundry
                icon = 'bi-basket-fill text-warning';
                text = 'Laundry Waiting';
                subtext = 'Check hallway/bathroom';
            } else {
                // GREEN: Perfect
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
        } else {
            // Default state if DB is empty
            el.innerHTML = `<div class="text-secondary small">Status unknown.</div>`;
        }
    });
}

function startIssuesListener() {
    const q = query(collection(db, 'complaints'));
    
    if (unsubIssues) unsubIssues();

    unsubIssues = onSnapshot(q, (snapshot) => {
        let count = 0;
        snapshot.forEach(doc => {
            const s = doc.data().status;
            if(s === 'pending' || s === 'approved') count++;
        });

        const el = document.getElementById('widget-issues');
        if(!el) return;

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