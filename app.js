// Firebase SDKs - Using ES modules via CDN
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Your Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyAiYXGjF9KB2Fd4qvdjjG4vWekLvbmsAik",
  authDomain: "the-chalet-e4581.firebaseapp.com",
  projectId: "the-chalet-e4581",
  storageBucket: "the-chalet-e4581.firebasestorage.app",
  messagingSenderId: "139085912060",
  appId: "1:139085912060:web:51836f6ba88f32aed6c479"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- DOM Elements ---
const loginScreen = document.getElementById('login-screen');
const dashboard = document.getElementById('dashboard');
const loginForm = document.getElementById('login-form');
const loginEmailInput = document.getElementById('loginEmail');
const loginPasswordInput = document.getElementById('loginPassword');
const loginErrorMessage = document.getElementById('login-error-message');
const logoutButton = document.getElementById('logout-button');
const userDisplayEmail = document.getElementById('user-display-email');

const navLinks = document.querySelectorAll('.navbar-nav .nav-link');
const dashboardSections = document.querySelectorAll('.dashboard-section');

const complaintForm = document.getElementById('complaint-form');
const complaintTitleInput = document.getElementById('complaintTitle');
const complaintCategorySelect = document.getElementById('complaintCategory');
const complaintDescriptionTextarea = document.getElementById('complaintDescription');
const complaintMessageDiv = document.getElementById('complaint-message');

const complaintsList = document.getElementById('complaints-list');
const noComplaintsMessage = document.getElementById('no-complaints-message');

// --- Authentication State Management ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is signed in
        loginScreen.classList.add('d-none'); // Hide login
        dashboard.classList.remove('d-none'); // Show dashboard
        userDisplayEmail.textContent = `Logged in as: ${user.email}`;

        // Ensure Home section is active by default after login
        showSection('home-section');
        navLinks.forEach(link => link.classList.remove('active'));
        document.querySelector('[data-section="home"]').classList.add('active');

        loadComplaints(); // Load complaints when user logs in
    } else {
        // User is signed out
        loginScreen.classList.remove('d-none'); // Show login
        dashboard.classList.add('d-none'); // Hide dashboard
        userDisplayEmail.textContent = '';
        complaintsList.innerHTML = ''; // Clear complaints
        noComplaintsMessage.classList.remove('d-none'); // Show no complaints message
    }
});

// --- Login Functionality ---
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = loginEmailInput.value;
    const password = loginPasswordInput.value;
    loginErrorMessage.classList.add('d-none'); // Hide previous error

    try {
        await signInWithEmailAndPassword(auth, email, password);
        // UI update handled by onAuthStateChanged
    } catch (error) {
        let message = 'An unknown error occurred.';
        switch (error.code) {
            case 'auth/invalid-email':
                message = 'Invalid email address format.';
                break;
            case 'auth/user-disabled':
                message = 'Your account has been disabled.';
                break;
            case 'auth/user-not-found':
            case 'auth/wrong-password': // This is a security measure, typically not distinguishing
                message = 'Invalid email or password.';
                break;
            case 'auth/too-many-requests':
                message = 'Too many failed login attempts. Please try again later.';
                break;
            default:
                message = error.message;
        }
        loginErrorMessage.textContent = message;
        loginErrorMessage.classList.remove('d-none');
    }
});

// --- Logout Functionality ---
logoutButton.addEventListener('click', async () => {
    try {
        await signOut(auth);
        // UI update handled by onAuthStateChanged
    } catch (error) {
        console.error('Error signing out:', error);
        alert('Failed to log out. Please try again.');
    }
});

// --- Navigation Functionality ---
navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        navLinks.forEach(nav => nav.classList.remove('active'));
        link.classList.add('active');
        const targetSection = link.dataset.section + '-section';
        showSection(targetSection);
    });
});

function showSection(sectionId) {
    dashboardSections.forEach(section => {
        if (section.id === sectionId) {
            section.classList.remove('d-none');
        } else {
            section.classList.add('d-none');
        }
    });
}

// --- Report Issue Form Submission ---
complaintForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const user = auth.currentUser;
    if (!user) {
        complaintMessageDiv.className = 'mt-3 text-danger';
        complaintMessageDiv.textContent = 'You must be logged in to report an issue.';
        return;
    }

    const title = complaintTitleInput.value;
    const category = complaintCategorySelect.value;
    const description = complaintDescriptionTextarea.value;
    const userEmail = user.email;

    try {
        await addDoc(collection(db, 'complaints'), {
            title,
            category,
            description,
            status: 'pending',
            timestamp: serverTimestamp(), // Use server timestamp for consistency
            userEmail
        });

        complaintMessageDiv.className = 'mt-3 text-success';
        complaintMessageDiv.textContent = 'Issue reported successfully!';
        complaintForm.reset(); // Clear the form
    } catch (error) {
        console.error('Error adding document: ', error);
        complaintMessageDiv.className = 'mt-3 text-danger';
        complaintMessageDiv.textContent = 'Failed to report issue. Please try again.';
    }
});

// --- Maintenance Log (Firestore Real-time Updates) ---
function loadComplaints() {
    const q = query(collection(db, 'complaints'), orderBy('timestamp', 'desc')); // Order by newest first

    onSnapshot(q, (snapshot) => {
        complaintsList.innerHTML = ''; // Clear current list
        if (snapshot.empty) {
            noComplaintsMessage.classList.remove('d-none');
        } else {
            noComplaintsMessage.classList.add('d-none');
            snapshot.forEach((doc) => {
                const complaint = doc.data();
                const complaintId = doc.id;
                const timestamp = complaint.timestamp ? new Date(complaint.timestamp.toDate()).toLocaleString() : 'N/A'; // Convert Firestore Timestamp to readable string

                const complaintItem = `
                    <div class="list-group-item chalet-card-bg">
                        <div class="d-flex w-100 justify-content-between">
                            <h5 class="mb-1 chalet-text-dark">${complaint.title}</h5>
                            <small class="text-muted">${timestamp}</small>
                        </div>
                        <p class="mb-1 chalet-text-dark"><strong>Category:</strong> ${complaint.category}</p>
                        <p class="mb-1 chalet-text-dark"><strong>Status:</strong> <span class="badge ${complaint.status === 'pending' ? 'bg-warning text-dark' : 'bg-success'}">${complaint.status}</span></p>
                        <p class="mb-1 chalet-text-dark">${complaint.description}</p>
                        <small class="text-muted">Reported by: ${complaint.userEmail}</small>
                    </div>
                `;
                complaintsList.innerHTML += complaintItem;
            });
        }
    }, (error) => {
        console.error("Error fetching complaints: ", error);
        complaintsList.innerHTML = '<p class="text-danger">Failed to load complaints.</p>';
        noComplaintsMessage.classList.add('d-none');
    });
}
