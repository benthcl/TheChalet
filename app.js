import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// --- CONFIGURATION ---
const ADMIN_EMAILS = [
    "thomasclubbben@gmail.com"
];

const firebaseConfig = {
  apiKey: "AIzaSyAiYXGjF9KB2Fd4qvdjjG4vWekLvbmsAik",
  authDomain: "the-chalet-e4581.firebaseapp.com",
  projectId: "the-chalet-e4581",
  storageBucket: "the-chalet-e4581.firebasestorage.app",
  messagingSenderId: "139085912060",
  appId: "1:139085912060:web:51836f6ba88f32aed6c479"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- SAFELY GET ELEMENTS ---
const loginScreen = document.getElementById('login-screen');
const dashboard = document.getElementById('dashboard');
const loginForm = document.getElementById('login-form');

// --- AUTH LISTENER ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        if(loginScreen) loginScreen.classList.add('d-none');
        if(dashboard) dashboard.classList.remove('d-none');
        const userDisplay = document.getElementById('user-display-email');
        if(userDisplay) userDisplay.textContent = user.email;
        loadComplaints(user); 
    } else {
        if(loginScreen) loginScreen.classList.remove('d-none');
        if(dashboard) dashboard.classList.add('d-none');
    }
});

// --- LOGIN ---
if(loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await signInWithEmailAndPassword(auth, document.getElementById('loginEmail').value, document.getElementById('loginPassword').value);
        } catch (error) {
            alert("Login Failed: " + error.message);
        }
    });
}

// --- LOGOUT ---
const logoutBtn = document.getElementById('logout-button');
if(logoutBtn) logoutBtn.addEventListener('click', () => signOut(auth));

// --- NAVIGATION ---
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));
        link.classList.add('active');
        document.querySelectorAll('.dashboard-section').forEach(s => s.classList.add('d-none'));
        const target = document.getElementById(link.dataset.section + '-section');
        if(target) target.classList.remove('d-none');
    });
});

// --- SUBMIT ISSUE ---
const complaintForm = document.getElementById('complaint-form');
if(complaintForm) {
    complaintForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!auth.currentUser) return alert("Please log in.");

        const title = document.getElementById('complaintTitle').value;
        const cat = document.getElementById('complaintCategory').value;
        const desc = document.getElementById('complaintDescription').value;
        const anon = document.getElementById('anonymousCheck').checked;

        try {
            await addDoc(collection(db, 'complaints'), {
                title, category: cat, description: desc, isAnonymous: anon,
                status: 'pending', timestamp: serverTimestamp(), userEmail: auth.currentUser.email
            });

            // Close Modal (Try Bootstrap method, fallback to manual)
            const modalEl = document.getElementById('addIssueModal');
            if(window.bootstrap) {
                const modal = bootstrap.Modal.getInstance(modalEl);
                if(modal) modal.hide();
            } else {
                const closeBtn = modalEl.querySelector('.btn-close');
                if(closeBtn) closeBtn.click();
            }
            
            complaintForm.reset();
            const alertBox = document.getElementById('success-alert');
            if(alertBox) {
                alertBox.classList.remove('d-none');
                alertBox.classList.add('d-flex');
                setTimeout(() => { alertBox.classList.add('d-none'); alertBox.classList.remove('d-flex'); }, 3000);
            }
        } catch (error) {
            alert("Error: " + error.message);
        }
    });
}

// --- LOAD ISSUES ---
function loadComplaints(currentUser) {
    const q = query(collection(db, 'complaints'), orderBy('timestamp', 'desc'));
    onSnapshot(q, (snapshot) => {
        const list = document.getElementById('complaints-list');
        if(!list) return; // THIS PREVENTS THE CRASH
        
        list.innerHTML = '';
        snapshot.forEach((doc) => {
            const data = doc.data();
            const isAdmin = ADMIN_EMAILS.includes(currentUser.email);
            const isAuthor = data.userEmail === currentUser.email;

            if (data.status !== 'approved' && !isAdmin && !isAuthor) return;

            let authorName = data.userEmail.split('@')[0];
            if (data.isAnonymous) authorName = (isAdmin || isAuthor) ? `Anon (${authorName})` : "Anonymous Member";

            let adminControls = '';
            if (isAdmin && data.status === 'pending') {
                adminControls = `<div class="mt-3 pt-3 border-top"><button onclick="window.approveIssue('${doc.id}')" class="btn btn-sm btn-success w-100 fw-bold">Approve</button></div>`;
            }

            const statusColor = data.status === 'pending' ? 'bg-warning text-dark' : 'bg-success text-white';
            
            list.innerHTML += `
            <div class="col-md-6 col-lg-4 fade-in">
                <div class="card issue-card h-100 border-0 shadow-sm rounded-4">
                    <div class="card-body">
                        <div class="d-flex justify-content-between mb-2">
                            <span class="badge bg-light text-dark border">${data.category}</span>
                            <span class="badge ${statusColor}">${data.status}</span>
                        </div>
                        <h5 class="fw-bold text-dark">${data.title}</h5>
                        <p class="text-muted small mb-3">${data.description}</p>
                        <div class="small text-muted fw-bold">${authorName}</div>
                        ${adminControls}
                    </div>
                </div>
            </div>`;
        });
    });
}

window.approveIssue = async (id) => {
    if(confirm("Approve this issue?")) {
        await updateDoc(doc(db, "complaints", id), { status: "approved" });
    }
};