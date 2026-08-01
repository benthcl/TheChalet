import { doc, collection, addDoc, query, onSnapshot, setDoc, getDoc, serverTimestamp, orderBy, limit, where, getDocs, deleteDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { db, ADMIN_EMAILS, familyName } from './config.js';
import { notifyHandover } from './notify.js';
import { SUPPLY_ITEMS, HOUSE_CHECKS, SUPPLY_KEYS, CHECK_KEYS, supplyLabel, checkLabel, countMissingSupplies, countFailedChecks } from './houseChecklist.js';

let unsubscribe = null;
let unsubscribeReports = null;
let isAuthorizedToEdit = false;
let currentUserEmail = "";
let currentHouseState = {}; 

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
} 

export async function initStock(currentUser) {
    if(!currentUser) return; 
    currentUserEmail = currentUser.email;
    
    isAuthorizedToEdit = await checkActiveBooking(currentUser);
    updateEditPermissions();

    const docRef = doc(db, 'house', 'status');
    if (unsubscribe) unsubscribe();

    unsubscribe = onSnapshot(docRef, (docSnap) => {
        let data = {
            laundry: false, laundryLoc: "", tea: false, meal: false,
            foodDetails: "", nextGuestNote: "", supplies: {}, checks: {}
        };
        if (docSnap.exists()) data = { ...data, ...docSnap.data() };
        if (!data.supplies) data.supplies = {};
        if (!data.checks) data.checks = {};
        currentHouseState = data;
        renderLaundry(data);
        renderPantry(data);
        renderEssentials(data);
        renderChecks(data);
        renderNextGuestNote(data);
    });

    loadHandoverReports();
    initScrollListener();
}

// --- SMART SCROLL LOGIC ---
function initScrollListener() {
    const container = document.getElementById('handover-list');
    const leftBtn = document.getElementById('scrollLeftBtn');
    const rightBtn = document.getElementById('scrollRightBtn');

    if(container && leftBtn && rightBtn) {
        container.addEventListener('scroll', () => {
            if (container.scrollLeft <= 20) {
                leftBtn.classList.add('hidden');
            } else {
                leftBtn.classList.remove('hidden');
            }
            if (container.scrollLeft + container.clientWidth >= container.scrollWidth - 20) {
                rightBtn.classList.add('hidden');
            } else {
                rightBtn.classList.remove('hidden');
            }
        });
    }
}

window.scrollStream = (direction) => {
    const container = document.getElementById('handover-list');
    const scrollAmount = 474; 
    container.scrollBy({ left: scrollAmount * direction, behavior: 'smooth' });
};

async function checkActiveBooking(user) {
    if (ADMIN_EMAILS.includes(user.email)) return true;
    const now = new Date();
    const today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    const q = query(collection(db, 'bookings'), where('userEmail', '==', user.email));
    const snapshot = await getDocs(q);
    let isActive = false;
    snapshot.forEach(doc => {
        const b = doc.data();
        if (today >= b.startDate && today <= b.endDate) isActive = true;
    });
    return isActive;
}

function updateEditPermissions() {
    const banner = document.getElementById('readOnlyBanner');
    const inputs = document.querySelectorAll('#stock-section input, #stock-section textarea, #stock-section .btn-light, #stock-section .btn-success, #essentials-grid button, #checks-grid button');
    const publishBtn = document.getElementById('btn-publish-report');

    if (isAuthorizedToEdit) {
        if(banner) banner.classList.add('d-none');
        inputs.forEach(el => el.disabled = false);
        if(publishBtn) publishBtn.disabled = false;
    } else {
        if(banner) banner.classList.remove('d-none');
        inputs.forEach(el => el.disabled = true);
        if(publishBtn) publishBtn.disabled = true;
    }
}

// --- RENDERING LIVE DASHBOARD ---
function renderLaundry(data) {
    const toggle = document.getElementById('laundryToggle');
    if(!toggle) return;
    if(document.activeElement !== toggle) toggle.checked = data.laundry;
    const locInput = document.getElementById('laundryLocation');
    if(document.activeElement !== locInput) locInput.value = data.laundryLoc || "";
    
    if(data.laundry) {
        document.getElementById('laundryLocationBox').classList.remove('d-none');
        document.getElementById('laundryCleanMsg').classList.add('d-none');
    } else {
        document.getElementById('laundryLocationBox').classList.add('d-none');
        document.getElementById('laundryCleanMsg').classList.remove('d-none');
    }
    toggle.onclick = async () => {
        if(!isAuthorizedToEdit) return;
        await setDoc(doc(db, 'house', 'status'), { laundry: toggle.checked }, { merge: true });
    };
}

function renderPantry(data) {
    const btnTea = document.getElementById('btn-tea');
    const btnMeal = document.getElementById('btn-meal');
    if(!btnTea || !btnMeal) return;
    const setBtn = (el, active) => {
        if(active) { 
            el.classList.remove('btn-light', 'text-secondary'); 
            el.classList.add('btn-success', 'text-white'); 
        } else { 
            el.classList.add('btn-light', 'text-secondary'); 
            el.classList.remove('btn-success', 'text-white'); 
        }
    };
    setBtn(btnTea, data.tea);
    setBtn(btnMeal, data.meal);
    const textFood = document.getElementById('pantryDetails');
    if(document.activeElement !== textFood) textFood.value = data.foodDetails || "";
}

function renderEssentials(data) {
    const grid = document.getElementById('essentials-grid');
    if (!grid) return;

    grid.innerHTML = '';
    SUPPLY_ITEMS.forEach(item => {
        const isStocked = data.supplies && data.supplies[item.key] === true;
        grid.innerHTML += `
        <div class="col-6 col-md-4 col-lg-3">
            <button onclick="window.toggleSupply('${item.key}')" class="btn w-100 p-3 rounded-4 shadow-sm d-flex flex-column align-items-center justify-content-center gap-2 ${isStocked ? 'btn-success' : 'btn-outline-danger'}" style="height: 110px; transition: all 0.2s;" ${!isAuthorizedToEdit ? 'disabled' : ''}>
                <i class="bi ${isStocked ? 'bi-check-circle-fill' : 'bi-x-circle'} fs-3"></i>
                <div class="lh-1 text-center">
                    <div class="fw-bold small">${escapeHtml(item.label)}</div>
                    <div class="badge bg-white text-dark mt-2" style="font-size: 0.6rem;">${isStocked ? 'STOCKED' : 'EMPTY'}</div>
                </div>
            </button>
        </div>`;
    });
}

function renderChecks(data) {
    const grid = document.getElementById('checks-grid');
    if (!grid) return;

    grid.innerHTML = '';
    HOUSE_CHECKS.forEach(item => {
        const ok = data.checks && data.checks[item.key] === true;
        grid.innerHTML += `
        <div class="col-6 col-md-4 col-lg-3">
            <button onclick="window.toggleCheck('${item.key}')" class="btn w-100 p-3 rounded-4 shadow-sm d-flex flex-column align-items-center justify-content-center gap-2 ${ok ? 'btn-success' : 'btn-outline-warning'}" style="min-height: 100px; transition: all 0.2s;" ${!isAuthorizedToEdit ? 'disabled' : ''}>
                <i class="bi ${ok ? 'bi-check2-square' : 'bi-square'} fs-3"></i>
                <div class="lh-sm text-center">
                    <div class="fw-bold small">${escapeHtml(item.label)}</div>
                    <div class="badge bg-white text-dark mt-2" style="font-size: 0.6rem;">${ok ? 'DONE' : 'TODO'}</div>
                </div>
            </button>
        </div>`;
    });
}

function renderNextGuestNote(data) {
    const el = document.getElementById('nextGuestNote');
    if (!el) return;
    if (document.activeElement !== el) el.value = data.nextGuestNote || '';
}

// --- RENDER WIDE CARDS (History) ---
function loadHandoverReports() {
    const q = query(collection(db, 'handover_reports'), orderBy('timestamp', 'desc'), limit(20));
    if (unsubscribeReports) unsubscribeReports();
    
    unsubscribeReports = onSnapshot(q, (snapshot) => {
        const list = document.getElementById('handover-list');
        if(!list) return;
        list.innerHTML = '';

        if(snapshot.empty) {
            list.innerHTML = `<div class="w-100 text-center text-muted py-5">No reports yet.</div>`;
            return;
        }

        snapshot.forEach(docSnap => {
            const r = docSnap.data();
            const id = docSnap.id;
            const dateObj = r.timestamp ? r.timestamp.toDate() : new Date();
            const day = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
            const time = dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            const name = familyName(r.userEmail);
            const initial = name.charAt(0).toUpperCase();
            
            let deleteBtn = '';
            if (ADMIN_EMAILS.includes(currentUserEmail)) {
                deleteBtn = `<button onclick="window.deleteHandoverReport('${id}')" class="btn btn-sm btn-white text-danger shadow-sm rounded-circle position-absolute bottom-0 end-0 m-4" style="z-index: 10; width: 32px; height: 32px;"><i class="bi bi-trash"></i></button>`;
            }

            const supplies = r.supplies || {};
            const checks = r.checks || {};
            const missingKeys = SUPPLY_KEYS.filter(k => supplies[k] !== true);
            const failedChecks = CHECK_KEYS.filter(k => checks[k] !== true);

            let essentialsHTML = '';
            if (missingKeys.length === 0) {
                essentialsHTML = `<div class="status-pill bg-success bg-opacity-10 text-success mb-2"><i class="bi bi-check2 me-1"></i>All essentials stocked</div>`;
            } else {
                const visible = missingKeys.slice(0, 3).map(k => supplyLabel(k)).join(', ');
                const remaining = missingKeys.length - 3;
                const extraText = remaining > 0 ? ` +${remaining}` : '';
                essentialsHTML = `<div class="status-pill bg-danger bg-opacity-10 text-danger mb-2"><i class="bi bi-exclamation-circle me-1"></i>Missing: ${escapeHtml(visible)}${extraText}</div>`;
            }

            if (failedChecks.length === 0 && Object.keys(checks).length > 0) {
                essentialsHTML += `<div class="status-pill bg-success bg-opacity-10 text-success"><i class="bi bi-check2 me-1"></i>Leaving checklist complete</div>`;
            } else if (failedChecks.length > 0) {
                essentialsHTML += `<div class="status-pill bg-warning bg-opacity-10 text-warning-emphasis"><i class="bi bi-list-check me-1"></i>${failedChecks.length} check${failedChecks.length > 1 ? 's' : ''} skipped</div>`;
            }

            const laundryHTML = r.laundry 
                ? `<div class="d-flex align-items-center gap-2 text-danger fw-bold small mb-2"><div class="bg-danger rounded-circle p-1" style="width:8px;height:8px;"></div> Laundry Left</div>
                   <div class="small bg-danger bg-opacity-10 text-danger p-2 rounded-3 fst-italic">"${escapeHtml(r.laundryLoc)}"</div>`
                : `<div class="d-flex align-items-center gap-2 text-success fw-bold small"><div class="bg-success rounded-circle p-1" style="width:8px;height:8px;"></div> Laundry Clean</div>`;

            const teaClass = r.tea ? 'bg-success text-white' : 'bg-light text-secondary border';
            const teaIcon = r.tea ? 'bi-check-lg' : 'bi-dash';
            const mealClass = r.meal ? 'bg-success text-white' : 'bg-light text-secondary border';
            const mealIcon = r.meal ? 'bi-check-lg' : 'bi-dash';
            const noteText = r.foodDetails ? escapeHtml(r.foodDetails) : '<span class="text-muted opacity-50">No food notes left.</span>';
            const guestNote = r.nextGuestNote
                ? `<div class="mt-3 pt-3 border-top border-secondary border-opacity-10"><span class="small fw-bold text-secondary d-block mb-1">FOR NEXT GUESTS</span><div class="small">${escapeHtml(r.nextGuestNote)}</div></div>`
                : '';

            list.innerHTML += `
            <div class="report-card-wrapper"> 
                <div class="card h-100 pro-card rounded-5 position-relative overflow-hidden border-0">
                    ${deleteBtn}
                    
                    <div class="p-4 d-flex justify-content-between align-items-start">
                        <div class="d-flex align-items-center gap-3">
                            <div class="bg-dark text-white rounded-circle d-flex align-items-center justify-content-center fw-bold shadow-sm" style="width:48px; height:48px; font-size: 1.4rem;">${escapeHtml(initial)}</div>
                            <div class="lh-1">
                                <div class="fw-bold text-dark fs-5">${escapeHtml(name)}</div>
                                <div class="text-secondary small mt-1">${day} &bull; ${time}</div>
                            </div>
                        </div>
                    </div>

                    <div class="px-4 pb-4">
                        <div class="mb-4">
                            ${essentialsHTML}
                        </div>

                        <div class="bg-white bg-opacity-50 rounded-4 p-4 border border-white shadow-sm">
                            <div class="mb-3 pb-3 border-bottom border-secondary border-opacity-10">
                                ${laundryHTML}
                            </div>
                            <div>
                                <span class="small fw-bold text-secondary d-block mb-2">PANTRY STATUS</span>
                                <div class="d-flex gap-2 mb-3">
                                    <span class="badge-pill-text ${teaClass}"><i class="bi ${teaIcon}"></i> Tea/Coffee</span>
                                    <span class="badge-pill-text ${mealClass}"><i class="bi ${mealIcon}"></i> 1 Meal</span>
                                </div>
                                <div class="pantry-note-box">
                                    ${noteText}
                                </div>
                                ${guestNote}
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
        });
    });
}

// AUTO-SAVE FUNCTIONS
window.saveLaundry = async () => {
    if(!isAuthorizedToEdit) return;
    const loc = document.getElementById('laundryLocation').value;
    await setDoc(doc(db, 'house', 'status'), { laundryLoc: loc }, { merge: true });
};
window.savePantry = async () => {
    if(!isAuthorizedToEdit) return;
    const details = document.getElementById('pantryDetails').value;
    await setDoc(doc(db, 'house', 'status'), { foodDetails: details }, { merge: true });
};
window.togglePantry = async (type) => {
    if(!isAuthorizedToEdit) return;
    const docRef = doc(db, 'house', 'status');
    const docSnap = await getDoc(docRef);
    let current = false;
    if(docSnap.exists()) current = docSnap.data()[type];
    await setDoc(docRef, { [type]: !current }, { merge: true });
};
window.toggleSupply = async (key) => {
    if(!isAuthorizedToEdit) return;
    const docRef = doc(db, 'house', 'status');
    const docSnap = await getDoc(docRef);
    let supplies = {};
    if(docSnap.exists()) supplies = docSnap.data().supplies || {};
    supplies[key] = !supplies[key];
    await setDoc(docRef, { supplies: supplies }, { merge: true });
};
window.toggleCheck = async (key) => {
    if (!isAuthorizedToEdit) return;
    const docRef = doc(db, 'house', 'status');
    const docSnap = await getDoc(docRef);
    let checks = {};
    if (docSnap.exists()) checks = docSnap.data().checks || {};
    checks[key] = !checks[key];
    await setDoc(docRef, { checks }, { merge: true });
};
window.saveNextGuestNote = async () => {
    if (!isAuthorizedToEdit) return;
    const note = document.getElementById('nextGuestNote')?.value || '';
    await setDoc(doc(db, 'house', 'status'), { nextGuestNote: note }, { merge: true });
};
window.publishHandover = async () => {
    if(!isAuthorizedToEdit) return;
    const liveLaundryLoc = document.getElementById('laundryLocation').value;
    const liveFoodDetails = document.getElementById('pantryDetails').value;
    const liveNote = document.getElementById('nextGuestNote')?.value || '';
    const missing = countMissingSupplies(currentHouseState.supplies);
    const failed = countFailedChecks(currentHouseState.checks);
    const warnBits = [];
    if (missing) warnBits.push(`${missing} empty supply`);
    if (failed) warnBits.push(`${failed} checklist item open`);
    if (currentHouseState.laundry) warnBits.push('laundry left');

    const confirm = await Swal.fire({
        title: 'Sign off & publish?',
        html: warnBits.length
            ? `<p>This publishes a handover for the next family.</p><p class="text-warning-emphasis small mb-0">Still open: ${warnBits.join(', ')}.</p>`
            : 'House looks tidy — nice one. Publish for the next family?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#1f3d32',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Publish report',
        customClass: { popup: 'glass-panel' }
    });
    if (!confirm.isConfirmed) return;
    try {
        const report = {
            ...currentHouseState,
            laundryLoc: liveLaundryLoc,
            foodDetails: liveFoodDetails,
            nextGuestNote: liveNote,
            userEmail: currentUserEmail,
            timestamp: serverTimestamp()
        };
        await addDoc(collection(db, 'handover_reports'), report);
        await notifyHandover({
            userEmail: currentUserEmail,
            nextGuestNote: liveNote,
            shoppingList: SUPPLY_KEYS.filter(k => currentHouseState.supplies?.[k] !== true).map(supplyLabel),
            openChecks: CHECK_KEYS.filter(k => currentHouseState.checks?.[k] !== true).map(checkLabel),
            laundryLeft: Boolean(currentHouseState.laundry)
        });
        Swal.fire({
            title: 'Published!',
            text: 'Handover report is live for the next guests.',
            icon: 'success',
            timer: 2200,
            showConfirmButton: false,
            customClass: { popup: 'glass-panel' }
        });
    } catch (error) {
        Swal.fire({
            title: 'Publish failed',
            text: error.message,
            icon: 'error',
            confirmButtonColor: '#1f3d32',
            customClass: { popup: 'glass-panel' }
        });
    }
};
window.deleteHandoverReport = async (id) => {
    const result = await Swal.fire({
        title: 'Delete this report?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Delete',
        customClass: { popup: 'glass-panel' }
    });
    if (!result.isConfirmed) return;
    await deleteDoc(doc(db, "handover_reports", id));
};
export function cleanupStock() {
    if (unsubscribe) unsubscribe();
    if (unsubscribeReports) unsubscribeReports();
}