import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyD5qbmXjNl5SvWcrlz_VoY2cXcnZXDsNjc",
    authDomain: "carbontrack-406c1.firebaseapp.com",
    projectId: "carbontrack-406c1",
    storageBucket: "carbontrack-406c1.firebasestorage.app",
    messagingSenderId: "432872734402",
    appId: "1:432872734402:web:9f6eed7e1a157ff0e3055b"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);