import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

const firebaseConfig = {
  apiKey: "AIzaSyAiYXGjF9KB2Fd4qvdjjG4vWekLvbmsAik",
  authDomain: "the-chalet-e4581.firebaseapp.com",
  projectId: "the-chalet-e4581",
  storageBucket: "the-chalet-e4581.firebasestorage.app",
  messagingSenderId: "139085912060",
  appId: "1:139085912060:web:51836f6ba88f32aed6c479"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export const ADMIN_EMAILS = [ 
    "thomasclubbben@gmail.com"
];