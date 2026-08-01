import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, updateDoc, deleteDoc, increment, getDoc, arrayUnion, arrayRemove } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';
import { db, storage, auth, ADMIN_EMAILS, familyName } from './config.js';
import { notifyIssue } from './notify.js';

let unsubscribe = null;

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function initIssues(currentUser) {
    const q = query(collection(db, 'complaints'), orderBy('timestamp', 'desc'));
    
    if (unsubscribe) unsubscribe();

    unsubscribe = onSnapshot(q, (snapshot) => {
        const list = document.getElementById('complaints-list');
        if(!list) return;
        list.innerHTML = '';
        
        snapshot.forEach((documentSnapshot) => {
            const data = documentSnapshot.data();
            const id = documentSnapshot.id;
            const isAdmin = ADMIN_EMAILS.includes(currentUser.email);
            const isAuthor = data.userEmail === currentUser.email;

            if (data.status !== 'approved' && !isAdmin && !isAuthor) return;

            let authorDisplay = familyName(data.userEmail);
            let avatarIcon = 'bi-person-fill';
            if (data.isAnonymous) {
                avatarIcon = 'bi-incognito';
                authorDisplay = (isAdmin || isAuthor) ? `Anon (${familyName(data.userEmail)})` : 'Anonymous Family Member';
            }
            
            let imageHTML = data.imageUrl
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

            let adminControls = '';
            if (isAdmin) {
                const del = `<button onclick="window.deleteIssue('${id}')" class="btn btn-sm btn-light text-danger rounded-circle shadow-sm" style="width:32px;height:32px;"><i class="bi bi-trash"></i></button>`;
                if (data.status === 'pending') adminControls = `<div class="mt-3 d-flex gap-2"><button onclick="window.approveIssue('${id}')" class="btn btn-success flex-grow-1 rounded-pill btn-sm fw-bold">Approve</button>${del}</div>`;
                else adminControls = `<div class="position-absolute top-0 end-0 m-2">${del}</div>`;
            }

            list.innerHTML += `
            <div class="col-md-6 col-lg-4 fade-in">
                <div class="card issue-card h-100 shadow-sm glass-panel">
                    ${imageHTML}
                    <div class="card-body d-flex flex-column p-4">
                        <div class="d-flex justify-content-between align-items-start mb-3">
                            <span class="badge bg-dark bg-opacity-10 text-dark rounded-pill px-3 py-2">${escapeHtml(data.category)}</span>
                            ${data.status === 'pending' ? '<span class="badge bg-warning text-dark rounded-pill">Pending Review</span>' : ''}
                        </div>
                        <h4 class="fw-bold mb-2">${escapeHtml(data.title)}</h4>
                        <p class="text-secondary small mb-4 flex-grow-1">${escapeHtml(data.description)}</p>
                        <div class="d-flex align-items-center justify-content-between pt-3 border-top border-light">
                            <div class="d-flex align-items-center gap-2">
                                <div class="bg-light rounded-circle d-flex align-items-center justify-content-center" style="width:32px; height:32px;"><i class="bi ${avatarIcon} text-dark"></i></div>
                                <span class="small fw-bold text-secondary">${escapeHtml(authorDisplay)}</span>
                            </div>
                            <div class="vote-controls d-flex align-items-center gap-1">
                                <button onclick="window.castVote('${id}', 'up')" class="btn ${upBtnClass} rounded-pill px-2 py-1 d-flex align-items-center gap-1 border-0 shadow-sm" title="Upvote">
                                    <i class="bi ${hasUpvoted ? 'bi-hand-thumbs-up-fill' : 'bi-hand-thumbs-up'}"></i>
                                    <span class="fw-bold small">${upCount}</span>
                                </button>
                                <span class="vote-net fw-bold small px-1 ${netVotes > 0 ? 'text-success' : netVotes < 0 ? 'text-danger' : 'text-secondary'}">${netVotes}</span>
                                <button onclick="window.castVote('${id}', 'down')" class="btn ${downBtnClass} rounded-pill px-2 py-1 d-flex align-items-center gap-1 border-0 shadow-sm" title="Downvote">
                                    <i class="bi ${hasDownvoted ? 'bi-hand-thumbs-down-fill' : 'bi-hand-thumbs-down'}"></i>
                                    <span class="fw-bold small">${downCount}</span>
                                </button>
                            </div>
                        </div>
                        ${adminControls}
                    </div>
                </div>
            </div>`;
        });
    });
}

export function cleanupIssues() {
    if (unsubscribe) unsubscribe();
}

// --- FORM HANDLING ---
const complaintForm = document.getElementById('complaint-form');
if(complaintForm) {
    complaintForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // 1. Auth Check
        if (!auth.currentUser) {
            return Swal.fire({
                title: 'Hold on!',
                text: 'You need to be logged in to do that.',
                icon: 'warning',
                confirmButtonColor: '#1a1a1a',
                customClass: { popup: 'glass-panel' }
            });
        }
        
        const submitBtn = complaintForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true; 
        submitBtn.textContent = "Uploading...";
        
        const title = document.getElementById('complaintTitle').value;
        const cat = document.getElementById('complaintCategory').value;
        const desc = document.getElementById('complaintDescription').value;
        const anon = document.getElementById('anonymousCheck').checked;
        const originalFile = document.getElementById('complaintFile').files[0];

        try {
            let imageUrl = null;
            let fileToUpload = originalFile;
            
            // 2. Image Compression Logic
            if (originalFile) {
                const compressionOptions = {
                    maxSizeMB: 1, 
                    maxWidthOrHeight: 1920,
                    useWebWorker: true 
                };
                
                try {
                    fileToUpload = await imageCompression(originalFile, compressionOptions);
                } catch (error) {
                    console.error("Error compressing image:", error);
                }
            }

            // 3. Upload to Firebase
            if (fileToUpload) {
                const storageRef = ref(storage, 'issues/' + Date.now() + '-' + fileToUpload.name);
                await uploadBytes(storageRef, fileToUpload);
                imageUrl = await getDownloadURL(storageRef);
            }
            
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
            
            if(window.bootstrap) bootstrap.Modal.getInstance(document.getElementById('addIssueModal'))?.hide();
            complaintForm.reset();
            submitBtn.disabled = false; 
            submitBtn.textContent = "Publish Report";
            Swal.fire({
                title: 'Submitted!',
                text: 'Your report is pending admin review.',
                icon: 'success',
                timer: 2200,
                showConfirmButton: false,
                customClass: { popup: 'glass-panel' }
            });
            
        } catch (error) { 
            // Swapped alert for SweetAlert
            Swal.fire({
                title: 'Upload Failed',
                text: error.message,
                icon: 'error',
                confirmButtonColor: '#1a1a1a',
                customClass: { popup: 'glass-panel' }
            });
            submitBtn.disabled = false; 
            submitBtn.textContent = "Publish Report"; 
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
    const myEmail = auth.currentUser.email;
    const votedBy = data.votedBy || [];
    const downvotedBy = data.downvotedBy || [];
    const hasUp = votedBy.includes(myEmail);
    const hasDown = downvotedBy.includes(myEmail);

    const updates = {};

    if (direction === 'up') {
        if (hasUp) {
            // Remove upvote
            updates.votes = increment(-1);
            updates.votedBy = arrayRemove(myEmail);
        } else {
            updates.votes = increment(hasDown ? 2 : 1); // switch from down → up is +2 net
            updates.votedBy = arrayUnion(myEmail);
            if (hasDown) updates.downvotedBy = arrayRemove(myEmail);
        }
    } else {
        if (hasDown) {
            // Remove downvote
            updates.votes = increment(1);
            updates.downvotedBy = arrayRemove(myEmail);
        } else {
            updates.votes = increment(hasUp ? -2 : -1); // switch from up → down is -2 net
            updates.downvotedBy = arrayUnion(myEmail);
            if (hasUp) updates.votedBy = arrayRemove(myEmail);
        }
    }

    await updateDoc(issueRef, updates);
};

// Keep old name as alias so any leftover callers still work
window.toggleVote = (id) => window.castVote(id, 'up');

window.approveIssue = async (id) => {
    await updateDoc(doc(db, "complaints", id), { status: "approved" });
    Swal.fire({
        title: 'Approved',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false,
        customClass: { popup: 'glass-panel' }
    });
};
window.deleteIssue = async (id) => {
    const result = await Swal.fire({
        title: 'Delete this issue?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Delete',
        customClass: { popup: 'glass-panel' }
    });
    if (result.isConfirmed) await deleteDoc(doc(db, "complaints", id));
};