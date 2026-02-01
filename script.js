import { auth, db } from "./firebase.js";
import { signInWithEmailAndPassword, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 1. Email Login Logic (Standard for Companies & Auditors who prefer email)
async function handleLogin(role) {
    const emailInput = document.getElementById(`${role}Email`);
    const passInput = document.getElementById(`${role}Password`);
    const btn = document.getElementById(`${role}LoginBtn`);
    
    if (!emailInput || !passInput) return;

    const email = emailInput.value;
    const pass = passInput.value;

    if (!email || !pass) {
        showNotification("Please enter both email and password.", "warning");
        return;
    }

    const originalText = btn.innerText;
    btn.innerText = "Verifying...";
    btn.disabled = true;

    try {
        await signInWithEmailAndPassword(auth, email, pass);
        // Role redirection is handled by the auth listeners in dashboard files
        // But we force it here for speed/UX
        if (role === 'company') window.location.href = 'company-dashboard.html';
        else window.location.href = 'auditor-dashboard.html';
        
    } catch (error) {
        console.error("Login Error:", error);
        showNotification("Login Failed: " + error.message, "error");
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// 2. AUDITOR-ONLY WALLET LOGIN (Auto-Register Logic)
async function handleWalletLogin() {
    if (typeof window.ethereum === 'undefined') {
        showNotification("MetaMask is not installed. Please install it to use this feature.", "warning");
        return;
    }

    const btn = document.getElementById('navWalletLogin');
    if(btn) btn.innerText = "Connecting...";

    try {
        // A. Connect Wallet
        const provider = new window.ethers.providers.Web3Provider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
        const signer = provider.getSigner();
        const walletAddress = (await signer.getAddress()).toLowerCase();
        
        console.log("🦊 Wallet Address:", walletAddress);

        // B. Sign In Anonymously (Secure Session)
        const userCredential = await signInAnonymously(auth);
        const user = userCredential.user;

        // C. Check if Auditor Profile Exists
        const q = query(collection(db, "auditors"), where("walletAddress", "==", walletAddress));
        const snap = await getDocs(q);

        if (snap.empty) {
            // === AUTO-REGISTER (BuildChain Style) ===
            // Create a new Auditor profile linked to this wallet
            await setDoc(doc(db, "auditors", user.uid), {
                name: `Auditor ${walletAddress.substring(0, 6)}`, // Default Name
                walletAddress: walletAddress,
                role: "auditor",
                email: "wallet-user@carbontracker.eth", // Placeholder
                certificationId: "PENDING-VERIFICATION",
                createdAt: serverTimestamp()
            });
            console.log("✅ New Auditor Account Created!");
        } else {
            console.log("✅ Existing Auditor Found.");
        }

        // D. Redirect to Auditor Dashboard
        window.location.href = 'auditor-dashboard.html';

    } catch (error) {
        console.error("Wallet Login Error:", error);
        showNotification("Login Error: " + error.message, "error");
        if(btn) btn.innerText = "Login with Wallet";
    }
}

// 3. UI Helpers (Unchanged)
function toggleLoginUI(role) {
    document.querySelectorAll('.expand-trigger').forEach(btn => btn.style.display = 'block');
    document.querySelectorAll('.login-collapse').forEach(div => div.classList.remove('active'));

    const collapseDiv = document.getElementById(`${role}Collapse`);
    const triggerBtn = document.getElementById(role === 'company' ? 'btnExpandCompany' : 'btnExpandAuditor');

    if (collapseDiv && triggerBtn) {
        collapseDiv.classList.add('active');
        triggerBtn.style.display = 'none';
    }
}

function triggerLoginFromNav(role) {
    const section = document.getElementById('portal-section');
    if (section) section.scrollIntoView({ behavior: 'smooth' });
    setTimeout(() => { toggleLoginUI(role); }, 500);
}

// 4. Event Listeners 
document.addEventListener('DOMContentLoaded', () => {
    const navComp = document.getElementById('navCompanyLogin');
    if(navComp) navComp.addEventListener('click', (e) => { e.preventDefault(); triggerLoginFromNav('company'); });

    const navAud = document.getElementById('navAuditorLogin');
    if(navAud) navAud.addEventListener('click', (e) => { e.preventDefault(); triggerLoginFromNav('auditor'); });

    const btnExpandComp = document.getElementById('btnExpandCompany');
    if(btnExpandComp) btnExpandComp.addEventListener('click', () => toggleLoginUI('company'));

    const btnExpandAud = document.getElementById('btnExpandAuditor');
    if(btnExpandAud) btnExpandAud.addEventListener('click', () => toggleLoginUI('auditor'));

    const btnLoginComp = document.getElementById('companyLoginBtn');
    if(btnLoginComp) btnLoginComp.addEventListener('click', () => handleLogin('company'));

    const btnLoginAud = document.getElementById('auditorLoginBtn');
    if(btnLoginAud) btnLoginAud.addEventListener('click', () => handleLogin('auditor'));

    // Wallet Buttons (Now explicit for Auditors)
    const navWallet = document.getElementById('navWalletLogin');
    if(navWallet) navWallet.addEventListener('click', handleWalletLogin);

    const heroWallet = document.getElementById('heroWalletLogin');
    if(heroWallet) heroWallet.addEventListener('click', handleWalletLogin);
});