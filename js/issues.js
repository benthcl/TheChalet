import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, updateDoc, deleteDoc, increment, getDoc, arrayUnion, arrayRemove } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';
import { db, storage, auth, ADMIN_EMAILS } from './config.js';

let unsubscribe = null;

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

            let authorDisplay = data.userEmail.split('@')[0];
            let avatarIcon = 'bi-person-fill';
            if (data.isAnonymous) {
                avatarIcon = 'bi-incognito';
                authorDisplay = (isAdmin || isAuthor) ? `Anon (${authorDisplay})` : "Anonymous Family Member";
            }
            
            let imageHTML = data.imageUrl ? `<img src="${data.imageUrl}" class="card-img-top" alt="Evidence">` : `<div class="photo-placeholder"><i class="bi bi-image text-white opacity-50"></i></div>`;
            
            const votedBy = data.votedBy || [];
            const hasVoted = votedBy.includes(currentUser.email);
            const voteBtnClass = hasVoted ? 'btn-success text-white' : 'btn-light text-secondary';
            const voteIcon = hasVoted ? 'bi-hand-thumbs-up-fill' : 'bi-hand-thumbs-up';
            const votes = data.votes || 0;

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
                            <span class="badge bg-dark bg-opacity-10 text-dark rounded-pill px-3 py-2">${data.category}</span>
                            ${data.status === 'pending' ? '<span class="badge bg-warning text-dark rounded-pill">Pending Review</span>' : ''}
                        </div>
                        <h4 class="fw-bold mb-2">${data.title}</h4>
                        <p class="text-secondary small mb-4 flex-grow-1">${data.description}</p>
                        <div class="d-flex align-items-center justify-content-between pt-3 border-top border-light">
                            <div class="d-flex align-items-center gap-2">
                                <div class="bg-light rounded-circle d-flex align-items-center justify-content-center" style="width:32px; height:32px;"><i class="bi ${avatarIcon} text-dark"></i></div>
                                <span class="small fw-bold text-secondary">${authorDisplay}</span>
                            </div>
                            <button onclick="window.toggleVote('${id}')" class="btn ${voteBtnClass} rounded-pill px-3 d-flex align-items-center gap-2 border-0 shadow-sm">
                                <i class="bi ${voteIcon}"></i> <span class="fw-bold">${votes}</span>
                            </button>
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
        if (!auth.currentUser) return alert("Please log in.");
        
        const submitBtn = complaintForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true; submitBtn.textContent = "Uploading...";
        
        const title = document.getElementById('complaintTitle').value;
        const cat = document.getElementById('complaintCategory').value;
        const desc = document.getElementById('complaintDescription').value;
        const anon = document.getElementById('anonymousCheck').checked;
        const file = document.getElementById('complaintFile').files[0];

        try {
            let imageUrl = null;
            if (file) {
                const storageRef = ref(storage, 'issues/' + Date.now() + '-' + file.name);
                await uploadBytes(storageRef, file);
                imageUrl = await getDownloadURL(storageRef);
            }
            await addDoc(collection(db, 'complaints'), {
                title, category: cat, description: desc, isAnonymous: anon,
                imageUrl, votes: 0, votedBy: [], status: 'pending', timestamp: serverTimestamp(), userEmail: auth.currentUser.email
            });
            if(window.bootstrap) bootstrap.Modal.getInstance(document.getElementById('addIssueModal'))?.hide();
            complaintForm.reset();
            submitBtn.disabled = false; submitBtn.textContent = "Publish Report";
        } catch (error) { alert("Error: " + error.message); submitBtn.disabled = false; }
    });
}

// --- GLOBAL WINDOW FUNCTIONS ---
window.toggleVote = async (id) => {
    if (!auth.currentUser) return alert("Please log in.");
    const issueRef = doc(db, "complaints", id);
    const issueSnap = await getDoc(issueRef);
    if (issueSnap.exists()) {
        const data = issueSnap.data();
        const myEmail = auth.currentUser.email;
        if ((data.votedBy || []).includes(myEmail)) {
            await updateDoc(issueRef, { votes: increment(-1), votedBy: arrayRemove(myEmail) });
        } else {
            await updateDoc(issueRef, { votes: increment(1), votedBy: arrayUnion(myEmail) });
        }
    }
};

window.approveIssue = async (id) => await updateDoc(doc(db, "complaints", id), { status: "approved" });
window.deleteIssue = async (id) => { if(confirm("Delete this issue?")) await deleteDoc(doc(db, "complaints", id)); };