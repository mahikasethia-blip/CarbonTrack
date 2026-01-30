import { auth, db } from "./firebase.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    
    const registerForm = document.getElementById('registerForm');

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const name = document.getElementById('regName').value;
            const state = document.getElementById('regState').value;
            const city = document.getElementById('regCity').value;
            const email = document.getElementById('regEmail').value;
            const password = document.getElementById('regPass').value;
            const baselineEmissions = document.getElementById('regBaseline').value; 
            const sustainabilityReportUrl = document.getElementById('regReport').value; 

            try {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                // Create Genesis Hash
                let genesisHash = "GENESIS";
                if (window.CryptoJS) {
                    const registrationData = `${name}-${email}-${Date.now()}`;
                    genesisHash = CryptoJS.SHA256(registrationData).toString();
                }

                // Save to Firestore
                await setDoc(doc(db, "companies", user.uid), {
                    name: name,
                    state: state,
                    city: city,
                    email: email,
                    role: "company",
                    baselineEmissions: parseFloat(baselineEmissions) || 0,
                    sustainabilityReport: sustainabilityReportUrl || "None Provided",
                    genesisHash: genesisHash,
                    createdAt: serverTimestamp(),
                    verifiedStatus: "pending"
                });

                alert("Registration Successful!");
                window.location.href = "company-dashboard.html";

            } catch (error) {
                console.error("Error:", error);
                alert("Registration Error: " + error.message);
            }
        });
    }  
});