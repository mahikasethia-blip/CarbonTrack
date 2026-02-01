import { auth, db } from "./firebase.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const regForm = document.getElementById('auditorRegForm');

    if (regForm) {
        regForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = document.getElementById('audName').value;
            const certId = document.getElementById('audCert').value;
            const email = document.getElementById('audEmail').value;
            const password = document.getElementById('audPass').value;

            try {
                // 1. Create Authentication User
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                // 2. Save Auditor Profile to Firestore
                await setDoc(doc(db, "auditors", user.uid), {
                    name: name,
                    certificationId: certId,
                    email: email,
                    role: "auditor",
                    createdAt: serverTimestamp()
                });

                showNotification("Auditor Account Created! Redirecting to Dashboard...", "success");
                window.location.href = "auditor-dashboard.html";

            } catch (error) {
                console.error("Registration Error:", error);
                showNotification("Error: " + error.message, "error");
            }
        });
    }
});