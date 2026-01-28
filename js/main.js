import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { auth } from './config.js';
import { initIssues, cleanupIssues } from './issues.js';
import { initCalendar, cleanupCalendar, refreshCalendar } from './calendar.js';
import { initStock, cleanupStock } from './stock.js';

// DOM ELEMENTS
const loginScreen = document.getElementById('login-screen');
const dashboard = document.getElementById('dashboard');

// AUTH LISTENER
onAuthStateChanged(auth, (user) => {
    if (user) {
        // LOGGED IN
        if(loginScreen) loginScreen.classList.add('d-none');
        if(dashboard) dashboard.classList.remove('d-none');
        const userDisplay = document.getElementById('user-display-email');
        if(userDisplay) userDisplay.textContent = user.email;
        
        // Initialize Modules
        initIssues(user);
        initCalendar(user);
        initStock(user); // <--- ✅ ADD (user) HERE
        
    } else {
        // LOGGED OUT
        if(loginScreen) loginScreen.classList.remove('d-none');
        if(dashboard) dashboard.classList.add('d-none');
        
        // Cleanup Modules
        cleanupIssues();
        cleanupCalendar();
        cleanupStock();
    }
});

// LOGIN
document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try { 
        await signInWithEmailAndPassword(auth, document.getElementById('loginEmail').value, document.getElementById('loginPassword').value); 
    } catch (error) { 
        alert("Login Failed: " + error.message); 
    }
});

// LOGOUT
document.getElementById('logout-button')?.addEventListener('click', () => signOut(auth));

// NAVIGATION
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Update Tabs
        document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));
        link.classList.add('active');
        
        // Update Sections
        document.querySelectorAll('.dashboard-section').forEach(s => s.classList.add('d-none'));
        const targetId = link.dataset.section + '-section';
        const targetSection = document.getElementById(targetId);
        
        if(targetSection) {
            targetSection.classList.remove('d-none');
            // Specific fix for calendar rendering issues when hidden
            if(targetId === 'calendar-section') refreshCalendar();
        }
    });
});