import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyBJKbrTLHxuNvFxnoz6bwxvBCS2Fk3jrRE",
  authDomain: "movilidad-diaria.firebaseapp.com",
  projectId: "movilidad-diaria",
  storageBucket: "movilidad-diaria.firebasestorage.app",
  messagingSenderId: "274742741929",
  appId: "1:274742741929:web:6f8dc77dd59983677452b8"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
