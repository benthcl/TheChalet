import { initHome } from './home.js';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { auth, familyName } from './config.js';
import { initIssues, cleanupIssues } from './issues.js';
import { initCalendar, cleanupCalendar, refreshCalendar } from './calendar.js';
import { initStock, cleanupStock } from './stock.js';
import { initWeather, refreshWeatherView, cleanupWeather } from './weather.js';

const SECTION_GROUPS = {
    home: null,
    calendar: 'stay',
    weather: 'stay',
    stock: 'stay',
    issues: 'family',
    gallery: 'family',
    leaderboard: 'family'
};

// DOM ELEMENTS
const loginScreen = document.getElementById('login-screen');
const dashboard = document.getElementById('dashboard');

function setActiveNav(section) {
    document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.dropdown-item').forEach(n => n.classList.remove('active'));

    const group = SECTION_GROUPS[section];
    if (group) {
        document.querySelector(`[data-nav-group="${group}"]`)?.classList.add('active');
        document.querySelector(`.dropdown-item[data-section="${section}"]`)?.classList.add('active');
    } else {
        document.querySelector(`.nav-link[data-section="${section}"]`)?.classList.add('active');
    }
}

function showSection(section) {
    if (!section) return;
    setActiveNav(section);

    document.querySelectorAll('.dashboard-section').forEach(s => s.classList.add('d-none'));
    const targetSection = document.getElementById(`${section}-section`);
    if (!targetSection) return;

    targetSection.classList.remove('d-none');
    if (section === 'calendar') refreshCalendar();
    if (section === 'weather') refreshWeatherView();
}

// AUTH LISTENER
onAuthStateChanged(auth, (user) => {
    if (user) {
        if (loginScreen) loginScreen.classList.add('d-none');
        if (dashboard) dashboard.classList.remove('d-none');
        const userDisplay = document.getElementById('user-display-email');
        if (userDisplay) userDisplay.textContent = familyName(user.email);

        initIssues(user);
        initCalendar(user);
        initStock(user);
        initHome(user);
        initWeather();
    } else {
        if (loginScreen) loginScreen.classList.remove('d-none');
        if (dashboard) dashboard.classList.add('d-none');

        cleanupIssues();
        cleanupCalendar();
        cleanupStock();
        cleanupWeather();
    }
});

// LOGIN
document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        await signInWithEmailAndPassword(
            auth,
            document.getElementById('loginEmail').value,
            document.getElementById('loginPassword').value
        );
    } catch (error) {
        const message = error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found'
            ? 'Incorrect email or password.'
            : (error.message || 'Something went wrong.');
        Swal.fire({
            title: 'Login Failed',
            text: message,
            icon: 'error',
            confirmButtonColor: '#1f3d32',
            confirmButtonText: 'Try Again',
            customClass: { popup: 'glass-panel' }
        });
    }
});

// LOGOUT
document.getElementById('logout-button')?.addEventListener('click', () => signOut(auth));

// NAVIGATION
document.querySelectorAll('[data-section]').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        showSection(link.dataset.section);
    });
});

// Close mobile navbar on link click / outside tap
document.addEventListener('DOMContentLoaded', () => {
    const navLinks = document.querySelectorAll('.navbar-nav .nav-link, .navbar-nav .dropdown-item');
    const navCollapse = document.getElementById('navbarNav');
    if (!navCollapse || typeof bootstrap === 'undefined') return;

    const bsCollapse = bootstrap.Collapse.getOrCreateInstance(navCollapse, { toggle: false });

    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (navCollapse.classList.contains('show') && link.dataset.section) bsCollapse.hide();
        });
    });

    document.addEventListener('click', (e) => {
        if (!navCollapse.contains(e.target) && !e.target.closest('.navbar-toggler') && navCollapse.classList.contains('show')) {
            bsCollapse.hide();
        }
    });
});

// --- LIGHTBOX LOGIC ---
window.openLightbox = (src, caption) => {
    const lightbox = document.getElementById('lightbox');
    const img = document.getElementById('lightbox-img');
    const cap = document.getElementById('lightbox-caption');

    if (lightbox && img) {
        img.src = src;
        if (cap) cap.textContent = caption || '';
        lightbox.classList.add('active');
    }
};

window.closeLightbox = () => {
    const lightbox = document.getElementById('lightbox');
    if (lightbox) lightbox.classList.remove('active');
};
