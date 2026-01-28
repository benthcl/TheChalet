// --- IMPORTS (Must be at the top) ---
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// --- CONFIGURATION ---
// ⚠️ ADMIN LIST: Add the emails of the 3 Chiefs here!
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

// --- INITIALIZE ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- DOM ELEMENTS ---
const loginScreen = document.getElementById('login-screen');
const dashboard = document.getElementById('dashboard');
const loginForm = document.getElementById('login-form');

// --- AUTHENTICATION LISTENER ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User logged in
        loginScreen.classList.add('d-none');
        dashboard.classList.remove('d-none');
        document.getElementById('user-display-email').textContent = user.email;
        
        // Start listening for issues immediately
        loadComplaints(user); 
    } else {
        // User logged out
        loginScreen.classList.remove('d-none');
        dashboard.classList.add('d-none');
    }
});

// --- LOGIN SUBMIT ---
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        const errorMsg = document.getElementById('login-error-message');
        errorMsg.textContent = "Login failed: " + error.message;
        errorMsg.classList.remove('d-none');
    }
});

// --- LOGOUT ---
document.getElementById('logout-button').addEventListener('click', () => {
    signOut(auth);
});

// --- NAVIGATION (TABS) ---
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        // 1. Remove active class from all links
        document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));
        // 2. Add active class to clicked link
        link.classList.add('active');
        
        // 3. Hide all sections
        document.querySelectorAll('.dashboard-section').forEach(s => s.classList.add('d-none'));
        // 4. Show target section
        const targetId = link.dataset.section + '-section';
        document.getElementById(targetId).classList.remove('d-none');
    });
});

// --- SUBMIT NEW ISSUE (MODAL) ---
document.getElementById('complaint-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    const title = document.getElementById('complaintTitle').value;
    const category = document.getElementById('complaintCategory').value;
    const description = document.getElementById('complaintDescription').value;
    const isAnonymous = document.getElementById('anonymousCheck').checked;

    try {
        await addDoc(collection(db, 'complaints'), {
            title, 
            category, 
            description,
            isAnonymous,
            status: 'pending', // Always starts as pending
            timestamp: serverTimestamp(),
            userEmail: auth.currentUser.email
        });

        // Close Modal & Reset Form
        const modalEl = document.getElementById('addIssueModal');
        const modalInstance = bootstrap.Modal.getInstance(modalEl);
        modalInstance.hide();
        document.getElementById('complaint-form').reset();

        // Show Success Alert
        const alertBox = document.getElementById('success-alert');
        alertBox.classList.remove('d-none');
        alertBox.classList.add('d-flex');
        setTimeout(() => {
            alertBox.classList.add('d-none');
            alertBox.classList.remove('d-flex');
        }, 3000);

    } catch (error) {
        alert("Error: " + error.message);
    }
});

// --- THE CORE LOGIC: DISPLAYING ISSUES ---
function loadComplaints(currentUser) {
    const q = query(collection(db, 'complaints'), orderBy('timestamp', 'desc'));

    onSnapshot(q, (snapshot) => {
        const listContainer = document.getElementById('complaints-list');
        listContainer.innerHTML = ''; // Clear list to avoid duplicates

        snapshot.forEach((doc) => {
            const data = doc.data();
            const issueId = doc.id;
            const isAdmin = ADMIN_EMAILS.includes(currentUser.email);
            const isAuthor = data.userEmail === currentUser.email;

            // --- 1. VISIBILITY RULES (The Filter) ---
            // Rule A: Everyone sees "approved"
            // Rule B: Admins see EVERYTHING
            // Rule C: Authors see their own "pending"
            let isVisible = false;
            
            if (data.status === 'approved') isVisible = true;
            else if (isAdmin) isVisible = true;
            else if (isAuthor) isVisible = true;

            // If not visible, skip this item entirely
            if (!isVisible) return;

            // --- 2. FORMATTING ---
            const dateStr = data.timestamp ? new Date(data.timestamp.toDate()).toLocaleDateString() : '...';
            
            // Handle Anonymity: 
            // If Anonymous: Show "Anonymous" to public, but show Real Name to Admin
            let displayAuthor = data.userEmail.split('@')[0];
            if (data.isAnonymous) {
                if (isAdmin || isAuthor) {
                    displayAuthor = `Anonymous (${data.userEmail.split('@')[0]})`; // Admins see who it is
                } else {
                    displayAuthor = "Anonymous Member"; // Public sees this
                }
            }

            const statusBadgeColor = data.status === 'pending' ? 'bg-warning text-dark' : 'bg-success text-white';

            // --- 3. ADMIN BUTTONS ---
            let adminControls = '';
            if (isAdmin && data.status === 'pending') {
                adminControls = `
                    <div class="mt-3 pt-3 border-top">
                        <button onclick="window.approveIssue('${issueId}')" class="btn btn-sm btn-success w-100 fw-bold shadow-sm">
                            <i class="bi bi-check-lg"></i> Approve & Publish
                        </button>
                    </div>
                `;
            }

            // --- 4. RENDER HTML ---
            const cardHTML = `
            <div class="col-md-6 col-lg-4 fade-in">
                <div class="card issue-card h-100 border-0 shadow-sm rounded-4">
                    <div class="photo-placeholder">
                        <i class="bi bi-camera"></i>
                    </div>
                    <div class="card-body d-flex flex-column">
                        <div class="d-flex justify-content-between mb-2">
                            <span class="badge bg-light text-dark border">${data.category}</span>
                            <span class="badge ${statusBadgeColor} text-uppercase" style="font-size: 0.7rem; letter-spacing:1px;">${data.status}</span>
                        </div>
                        <h5 class="fw-bold text-dark mb-2">${data.title}</h5>
                        <p class="text-muted small mb-4 flex-grow-1">${data.description}</p>
                        
                        <div class="d-flex align-items-center">
                            <div class="bg-light rounded-circle d-flex align-items-center justify-content-center me-2" style="width:32px; height:32px;">
                                <i class="bi bi-person-fill text-secondary"></i>
                            </div>
                            <div class="small">
                                <div class="fw-bold text-dark">${displayAuthor}</div>
                                <div class="text-muted" style="font-size: 0.75rem">${dateStr}</div>
                            </div>
                        </div>
                        ${adminControls}
                    </div>
                </div>
            </div>`;
            
            listContainer.innerHTML += cardHTML;
        });
    });
}

// --- GLOBAL APPROVE FUNCTION ---
window.approveIssue = async (id) => {
    if(!confirm("Are you sure you want to approve this issue? It will become visible to everyone.")) return;
    
    const issueRef = doc(db, "complaints", id);
    try {
        await updateDoc(issueRef, { status: "approved" });
        // The list will auto-refresh because of onSnapshot
    } catch (err) {
        alert("Error approving: " + err.message);
    }
};