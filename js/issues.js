import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, updateDoc, deleteDoc, increment, getDoc, arrayUnion, arrayRemove, deleteField } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';
import { db, storage, auth, ADMIN_EMAILS, familyName } from './config.js';
import { notifyIssue, notifyIssueResolved } from './notify.js';

let unsubscribe = null;
let boardFilter = 'open'; // 'open' | 'resolved'
let cachedUser = null;
let lastDocs = [];

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function isAdmin(email) {
    return ADMIN_EMAILS.includes(email);
}

async function compressAndUpload(file, folder) {
    if (!file) return null;
    let fileToUpload = file;
    try {
        fileToUpload = await imageCompression(file, {
            maxSizeMB: 1,
            maxWidthOrHeight: 1920,
            useWebWorker: true
        });
    } catch (error) {
        console.error('Error compressing image:', error);
    }
    const storageRef = ref(storage, `${folder}/${Date.now()}-${fileToUpload.name || 'photo.jpg'}`);
    await uploadBytes(storageRef, fileToUpload);
    return getDownloadURL(storageRef);
}

function statusBadges(data) {
    const bits = [];
    if (data.status === 'pending') {
        bits.push('<span class="badge bg-warning text-dark rounded-pill">Pending Review</span>');
    }
    if (data.status === 'fix_pending') {
        bits.push(`<span class="badge rounded-pill issue-badge-fix-pending">Awaiting confirm · ${escapeHtml(familyName(data.resolvedByEmail))}</span>`);
    }
    if (data.status === 'resolved') {
        bits.push(`<span class="badge rounded-pill issue-badge-resolved">Resolved by ${escapeHtml(familyName(data.resolvedByEmail))}</span>`);
    }
    return bits.join(' ');
}

function resolveControls(data, id, currentUser) {
    const admin = isAdmin(currentUser.email);

    if (data.status === 'approved') {
        return `
        <div class="mt-3">
            <button type="button" onclick="window.openResolveModal('${id}')" class="btn btn-outline-success w-100 rounded-pill btn-sm fw-bold">
                <i class="bi bi-check2-circle me-1"></i>Mark as fixed
            </button>
        </div>`;
    }

    if (data.status === 'fix_pending') {
        const who = familyName(data.resolvedByEmail);
        const note = (data.resolutionNote || '').trim();
        let html = `
        <div class="issue-resolve-claim mt-3">
            <div class="small fw-bold text-secondary mb-1">${escapeHtml(who)} says this is fixed</div>
            ${note ? `<div class="small fst-italic mb-2">“${escapeHtml(note)}”</div>` : ''}
            ${data.resolutionImageUrl ? `<button type="button" class="btn btn-link btn-sm px-0 mb-2" onclick="window.openLightbox('${escapeHtml(data.resolutionImageUrl)}', 'Fixed photo')">View fixed photo</button>` : ''}
        </div>`;
        if (admin) {
            html += `
            <div class="d-flex gap-2 mt-2">
                <button type="button" onclick="window.confirmResolution('${id}')" class="btn btn-success flex-grow-1 rounded-pill btn-sm fw-bold">Confirm fixed</button>
                <button type="button" onclick="window.rejectResolution('${id}')" class="btn btn-light text-secondary rounded-pill btn-sm fw-bold">Not yet</button>
            </div>`;
        } else {
            html += `<div class="small text-secondary">Waiting for Ben to confirm.</div>`;
        }
        return html;
    }

    if (data.status === 'resolved') {
        const who = familyName(data.resolvedByEmail);
        const note = (data.resolutionNote || '').trim();
        return `
        <div class="issue-resolve-done mt-3">
            <div class="small fw-bold" style="color: var(--pine-mid);"><i class="bi bi-patch-check-fill me-1"></i>Fixed by ${escapeHtml(who)}</div>
            ${note ? `<div class="small fst-italic text-secondary mt-1">“${escapeHtml(note)}”</div>` : ''}
            ${data.resolutionImageUrl ? `<button type="button" class="btn btn-link btn-sm px-0 mt-1" onclick="window.openLightbox('${escapeHtml(data.resolutionImageUrl)}', 'Fixed photo')">View fixed photo</button>` : ''}
        </div>`;
    }

    return '';
}

function renderIssueCard(documentSnapshot, currentUser) {
    const data = documentSnapshot.data();
    const id = documentSnapshot.id;
    const admin = isAdmin(currentUser.email);
    const isAuthor = data.userEmail === currentUser.email;

    // Visibility
    if (data.status === 'pending' && !admin && !isAuthor) return '';
    if (boardFilter === 'resolved' && data.status !== 'resolved') return '';
    if (boardFilter === 'open' && data.status === 'resolved') return '';

    let authorDisplay = familyName(data.userEmail);
    let avatarIcon = 'bi-person-fill';
    if (data.isAnonymous) {
        avatarIcon = 'bi-incognito';
        authorDisplay = (admin || isAuthor) ? `Anon (${familyName(data.userEmail)})` : 'Anonymous Family Member';
    }

    const imageHTML = data.imageUrl
        ? `<img src="${escapeHtml(data.imageUrl)}" class="card-img-top" alt="Evidence">`
        : `<div class="photo-placeholder"><i class="bi bi-image text-white opacity-50"></i></div>`;

    const votedBy = data.votedBy || [];
    const downvotedBy = data.downvotedBy || [];
    const hasUpvoted = votedBy.includes(currentUser.email);
    const hasDownvoted = downvotedBy.includes(currentUser.email);
    const upCount = votedBy.length;
    const downCount = downvotedBy.length;
    const netVotes = typeof data.votes === 'number' ? data.votes : (upCount - downCount);
    const upBtnClass = hasUpvoted ? 'btn-success text-white' : 'btn-light text-secondary';
    const downBtnClass = hasDownvoted ? 'btn-danger text-white' : 'btn-light text-secondary';
    const votesDisabled = data.status === 'resolved' ? 'disabled' : '';

    let adminControls = '';
    if (admin) {
        const del = `<button onclick="window.deleteIssue('${id}')" class="btn btn-sm btn-light text-danger rounded-circle shadow-sm" style="width:32px;height:32px;" title="Delete"><i class="bi bi-trash"></i></button>`;
        if (data.status === 'pending') {
            adminControls = `<div class="mt-3 d-flex gap-2"><button onclick="window.approveIssue('${id}')" class="btn btn-success flex-grow-1 rounded-pill btn-sm fw-bold">Approve</button>${del}</div>`;
        } else {
            adminControls = `<div class="position-absolute top-0 end-0 m-2">${del}</div>`;
        }
    }

    return `
    <div class="col-md-6 col-lg-4 fade-in">
        <div class="card issue-card h-100 shadow-sm glass-panel ${data.status === 'resolved' ? 'issue-card-resolved' : ''}">
            ${imageHTML}
            <div class="card-body d-flex flex-column p-4">
                <div class="d-flex justify-content-between align-items-start mb-3 gap-2 flex-wrap">
                    <span class="badge bg-dark bg-opacity-10 text-dark rounded-pill px-3 py-2">${escapeHtml(data.category)}</span>
                    <div class="d-flex flex-wrap gap-1 justify-content-end">${statusBadges(data)}</div>
                </div>
                <h4 class="fw-bold mb-2">${escapeHtml(data.title)}</h4>
                <p class="text-secondary small mb-4 flex-grow-1">${escapeHtml(data.description)}</p>
                <div class="d-flex align-items-center justify-content-between pt-3 border-top border-light">
                    <div class="d-flex align-items-center gap-2">
                        <div class="bg-light rounded-circle d-flex align-items-center justify-content-center" style="width:32px; height:32px;"><i class="bi ${avatarIcon} text-dark"></i></div>
                        <span class="small fw-bold text-secondary">${escapeHtml(authorDisplay)}</span>
                    </div>
                    <div class="vote-controls d-flex align-items-center gap-1">
                        <button onclick="window.castVote('${id}', 'up')" class="btn ${upBtnClass} rounded-pill px-2 py-1 d-flex align-items-center gap-1 border-0 shadow-sm" title="Upvote" ${votesDisabled}>
                            <i class="bi ${hasUpvoted ? 'bi-hand-thumbs-up-fill' : 'bi-hand-thumbs-up'}"></i>
                            <span class="fw-bold small">${upCount}</span>
                        </button>
                        <span class="vote-net fw-bold small px-1 ${netVotes > 0 ? 'text-success' : netVotes < 0 ? 'text-danger' : 'text-secondary'}">${netVotes}</span>
                        <button onclick="window.castVote('${id}', 'down')" class="btn ${downBtnClass} rounded-pill px-2 py-1 d-flex align-items-center gap-1 border-0 shadow-sm" title="Downvote" ${votesDisabled}>
                            <i class="bi ${hasDownvoted ? 'bi-hand-thumbs-down-fill' : 'bi-hand-thumbs-down'}"></i>
                            <span class="fw-bold small">${downCount}</span>
                        </button>
                    </div>
                </div>
                ${resolveControls(data, id, currentUser)}
                ${adminControls}
            </div>
        </div>
    </div>`;
}

function paintBoard() {
    const list = document.getElementById('complaints-list');
    if (!list || !cachedUser) return;

    let html = '';
    lastDocs.forEach((documentSnapshot) => {
        html += renderIssueCard(documentSnapshot, cachedUser);
    });

    list.innerHTML = html || `
        <div class="col-12">
            <div class="glass-panel rounded-5 p-5 text-center text-secondary">
                ${boardFilter === 'resolved'
                    ? 'No resolved issues yet — first fix earns bragging rights.'
                    : 'Nothing open on the board. Peaceful chalet days.'}
            </div>
        </div>`;
}

function wireBoardFilters() {
    document.querySelectorAll('[data-board-filter]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.boardFilter === boardFilter);
        btn.onclick = () => {
            boardFilter = btn.dataset.boardFilter;
            document.querySelectorAll('[data-board-filter]').forEach(b => {
                b.classList.toggle('active', b.dataset.boardFilter === boardFilter);
            });
            paintBoard();
        };
    });
}

export function initIssues(currentUser) {
    cachedUser = currentUser;
    wireBoardFilters();

    const q = query(collection(db, 'complaints'), orderBy('timestamp', 'desc'));

    if (unsubscribe) unsubscribe();

    unsubscribe = onSnapshot(q, (snapshot) => {
        lastDocs = snapshot.docs;
        paintBoard();
    });
}

export function cleanupIssues() {
    if (unsubscribe) unsubscribe();
    cachedUser = null;
    lastDocs = [];
}

// --- FORM HANDLING ---
const complaintForm = document.getElementById('complaint-form');
if (complaintForm) {
    complaintForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!auth.currentUser) {
            return Swal.fire({
                title: 'Hold on!',
                text: 'You need to be logged in to do that.',
                icon: 'warning',
                confirmButtonColor: '#1f3d32',
                customClass: { popup: 'glass-panel' }
            });
        }

        const submitBtn = complaintForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Uploading...';

        const title = document.getElementById('complaintTitle').value;
        const cat = document.getElementById('complaintCategory').value;
        const desc = document.getElementById('complaintDescription').value;
        const anon = document.getElementById('anonymousCheck').checked;
        const originalFile = document.getElementById('complaintFile').files[0];

        try {
            const imageUrl = await compressAndUpload(originalFile, 'issues');

            await addDoc(collection(db, 'complaints'), {
                title, category: cat, description: desc, isAnonymous: anon,
                imageUrl, votes: 0, votedBy: [], downvotedBy: [],
                status: 'pending', timestamp: serverTimestamp(), userEmail: auth.currentUser.email
            });

            await notifyIssue({
                userEmail: auth.currentUser.email,
                title,
                category: cat,
                description: desc,
                isAnonymous: anon
            });

            if (window.bootstrap) bootstrap.Modal.getInstance(document.getElementById('addIssueModal'))?.hide();
            complaintForm.reset();
            submitBtn.disabled = false;
            submitBtn.textContent = 'Publish Report';
            Swal.fire({
                title: 'Submitted!',
                text: 'Your report is pending admin review.',
                icon: 'success',
                timer: 2200,
                showConfirmButton: false,
                customClass: { popup: 'glass-panel' }
            });
        } catch (error) {
            Swal.fire({
                title: 'Upload Failed',
                text: error.message,
                icon: 'error',
                confirmButtonColor: '#1f3d32',
                customClass: { popup: 'glass-panel' }
            });
            submitBtn.disabled = false;
            submitBtn.textContent = 'Publish Report';
        }
    });
}

const resolveForm = document.getElementById('resolve-form');
if (resolveForm) {
    resolveForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!auth.currentUser) return;

        const issueId = document.getElementById('resolveIssueId').value;
        if (!issueId) return;

        const note = document.getElementById('resolveNote').value.trim();
        const file = document.getElementById('resolveFile').files[0];
        const submitBtn = document.getElementById('resolveSubmitBtn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving…';

        try {
            const issueRef = doc(db, 'complaints', issueId);
            const snap = await getDoc(issueRef);
            if (!snap.exists() || snap.data().status !== 'approved') {
                throw new Error('This issue is not open for fixing right now.');
            }

            const resolutionImageUrl = await compressAndUpload(file, 'resolutions');

            await updateDoc(issueRef, {
                status: 'fix_pending',
                resolvedByEmail: auth.currentUser.email,
                resolutionNote: note,
                resolutionImageUrl: resolutionImageUrl || null,
                resolvedClaimedAt: serverTimestamp()
            });

            bootstrap.Modal.getInstance(document.getElementById('resolveIssueModal'))?.hide();
            resolveForm.reset();
            Swal.fire({
                title: 'Logged as fixed',
                text: 'Ben will confirm it, then the family gets the good news.',
                icon: 'success',
                timer: 2400,
                showConfirmButton: false,
                customClass: { popup: 'glass-panel' }
            });
        } catch (error) {
            Swal.fire({
                title: 'Could not save',
                text: error.message,
                icon: 'error',
                confirmButtonColor: '#1f3d32',
                customClass: { popup: 'glass-panel' }
            });
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit for confirm';
        }
    });
}

// --- GLOBAL WINDOW FUNCTIONS ---
window.castVote = async (id, direction) => {
    if (!auth.currentUser) {
        return Swal.fire({
            title: 'Hold on!',
            text: 'You need to be logged in to vote.',
            icon: 'warning',
            confirmButtonColor: '#1f3d32',
            customClass: { popup: 'glass-panel' }
        });
    }

    const issueRef = doc(db, 'complaints', id);
    const issueSnap = await getDoc(issueRef);
    if (!issueSnap.exists()) return;

    const data = issueSnap.data();
    if (data.status === 'resolved') return;

    const myEmail = auth.currentUser.email;
    const votedBy = data.votedBy || [];
    const downvotedBy = data.downvotedBy || [];
    const hasUp = votedBy.includes(myEmail);
    const hasDown = downvotedBy.includes(myEmail);

    const updates = {};

    if (direction === 'up') {
        if (hasUp) {
            updates.votes = increment(-1);
            updates.votedBy = arrayRemove(myEmail);
        } else {
            updates.votes = increment(hasDown ? 2 : 1);
            updates.votedBy = arrayUnion(myEmail);
            if (hasDown) updates.downvotedBy = arrayRemove(myEmail);
        }
    } else {
        if (hasDown) {
            updates.votes = increment(1);
            updates.downvotedBy = arrayRemove(myEmail);
        } else {
            updates.votes = increment(hasUp ? -2 : -1);
            updates.downvotedBy = arrayUnion(myEmail);
            if (hasUp) updates.votedBy = arrayRemove(myEmail);
        }
    }

    await updateDoc(issueRef, updates);
};

window.toggleVote = (id) => window.castVote(id, 'up');

window.openResolveModal = (id) => {
    const idInput = document.getElementById('resolveIssueId');
    const form = document.getElementById('resolve-form');
    if (idInput) idInput.value = id;
    form?.reset();
    if (idInput) idInput.value = id;
    new bootstrap.Modal(document.getElementById('resolveIssueModal')).show();
};

window.approveIssue = async (id) => {
    if (!auth.currentUser || !isAdmin(auth.currentUser.email)) return;
    await updateDoc(doc(db, 'complaints', id), { status: 'approved' });
    Swal.fire({
        title: 'Approved',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false,
        customClass: { popup: 'glass-panel' }
    });
};

window.confirmResolution = async (id) => {
    if (!auth.currentUser || !isAdmin(auth.currentUser.email)) return;

    const issueRef = doc(db, 'complaints', id);
    const snap = await getDoc(issueRef);
    if (!snap.exists()) return;
    const data = snap.data();
    if (data.status !== 'fix_pending' || !data.resolvedByEmail) return;

    const result = await Swal.fire({
        title: `Confirm ${familyName(data.resolvedByEmail)} fixed it?`,
        text: data.title || '',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#1f3d32',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Yes, it’s fixed',
        customClass: { popup: 'glass-panel' }
    });
    if (!result.isConfirmed) return;

    await updateDoc(issueRef, {
        status: 'resolved',
        resolvedAt: serverTimestamp(),
        resolutionConfirmedBy: auth.currentUser.email
    });

    await notifyIssueResolved({
        resolverEmail: data.resolvedByEmail,
        title: data.title,
        category: data.category,
        note: data.resolutionNote || ''
    });

    Swal.fire({
        title: 'Resolved!',
        text: `Family email sent — ${familyName(data.resolvedByEmail)} gets the credit.`,
        icon: 'success',
        timer: 2400,
        showConfirmButton: false,
        customClass: { popup: 'glass-panel' }
    });
};

window.rejectResolution = async (id) => {
    if (!auth.currentUser || !isAdmin(auth.currentUser.email)) return;

    const result = await Swal.fire({
        title: 'Not fixed yet?',
        text: 'This puts the issue back on the open board.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#a35a28',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Send back to open',
        customClass: { popup: 'glass-panel' }
    });
    if (!result.isConfirmed) return;

    await updateDoc(doc(db, 'complaints', id), {
        status: 'approved',
        resolvedByEmail: deleteField(),
        resolutionNote: deleteField(),
        resolutionImageUrl: deleteField(),
        resolvedClaimedAt: deleteField()
    });

    Swal.fire({
        title: 'Back on the board',
        icon: 'success',
        timer: 1600,
        showConfirmButton: false,
        customClass: { popup: 'glass-panel' }
    });
};

window.deleteIssue = async (id) => {
    if (!auth.currentUser || !isAdmin(auth.currentUser.email)) return;
    const result = await Swal.fire({
        title: 'Delete this issue?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Delete',
        customClass: { popup: 'glass-panel' }
    });
    if (result.isConfirmed) await deleteDoc(doc(db, 'complaints', id));
};
