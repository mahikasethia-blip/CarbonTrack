import { auth, db } from "./firebase.js";
import { 
    collection, onSnapshot, query, orderBy, doc, updateDoc, addDoc, serverTimestamp, where, getDocs 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let auditorDocId = null;

document.addEventListener('DOMContentLoaded', () => {

    // 1. UNIFIED AUTH LISTENER
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            
            // CHECK IF LOGGED IN VIA WALLET (Anonymous Session)
            if (user.isAnonymous) {
                console.log("🦊 Wallet Session Detected. Requesting Connection...");
                
                // === THIS IS WHERE WE FORCE THE REQUEST ===
                if (typeof window.ethereum !== 'undefined') {
                    try {
                        const provider = new window.ethers.providers.Web3Provider(window.ethereum);
                        
                        // Force MetaMask Popup ("Ask accept request")
                        const accounts = await provider.send("eth_requestAccounts", []);
                        const walletAddress = accounts[0].toLowerCase();
                        
                        // Find Auditor Profile in DB
                        const q = query(collection(db, "auditors"), where("walletAddress", "==", walletAddress));
                        const snap = await getDocs(q);

                        if(!snap.empty) {
                            auditorDocId = snap.docs[0].id;
                            
                            // UPDATE UI WITH SHORT ADDRESS (BuildChain Style)
                            const profileBadge = document.getElementById('auditorProfileDisplay');
                            if(profileBadge) {
                                const shortAddr = walletAddress.substring(0, 6) + "..." + walletAddress.substring(38);
                                profileBadge.innerHTML = `
                                    <div style="display:flex; align-items:center; gap:8px;">
                                        <i class="fa-solid fa-wallet"></i> 
                                        <span>${shortAddr}</span>
                                        <span style="font-size:0.7rem; background:#166534; color:white; padding:2px 6px; border-radius:4px;">WEB3</span>
                                    </div>
                                `;
                            }
                        } else {
                            // If wallet connected but no profile found (rare edge case if manual deletion)
                            alert("Auditor profile not found.");
                            window.location.href = "index.html";
                        }
                    } catch (err) {
                        console.error("Wallet Access Denied:", err);
                        alert("Please allow wallet access to continue.");
                        window.location.href = "index.html";
                    }
                } else {
                    alert("MetaMask not found.");
                }

            } else {
                // STANDARD EMAIL LOGIN
                auditorDocId = user.uid;
                // Keep default "Auditor Panel" text or fetch name
                const profileBadge = document.getElementById('auditorProfileDisplay');
                if(profileBadge) profileBadge.innerHTML = `<i class="fa-solid fa-user-check"></i> Auditor Panel`;
            }
        } else {
            window.location.href = "index.html";
        }
    });

    const tableBody = document.getElementById('auditTableBody');
    const modal = document.getElementById('historyModal');
    const closeModal = document.querySelector('.close-btn');

    // 2. Load Main Dashboard Data (Standard Logic)
    const q = query(collection(db, "submissions"), orderBy("timestamp", "desc"));
    
    onSnapshot(q, (snapshot) => {
        tableBody.innerHTML = ''; 

        if (snapshot.empty) {
            tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 40px;">No submissions found in queue.</td></tr>';
            return;
        }

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const id = docSnap.id;
            const displayName = data.companyName || 'Unknown';
            const location = data.city ? `<i class="fa-solid fa-location-dot" style="color:#94a3b8;"></i> ${data.city}` : '';
            let statusBadge = `<span class="flag status-${data.status}">${data.status.toUpperCase()}</span>`;
            let isDisabled = data.status === 'verified' ? 'disabled' : '';

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <div id="name-${id}" style="font-weight:bold; color: #1e293b;">${displayName}</div>
                    <div style="font-size:0.85rem; color:#64748b;">${location}</div>
                </td>
                <td style="text-align: center;">
                    <button class="btn-history" data-company-id="${data.companyId}" data-company-name="${displayName}" style="background: #e0f2fe; color: #0284c7; border: none; padding: 6px; border-radius: 6px; cursor: pointer;">
                        History
                    </button>
                </td>
                <td>
                    <div style="font-weight:bold; color: #166534;">${data.totalImpact ? data.totalImpact.toFixed(2) : 0} tCO₂e</div>
                </td>
                <td>
                    <select id="grade-${id}" class="grade-select" ${isDisabled} style="width: 100%;">
                        <option value="A" ${data.grade === 'A' ? 'selected' : ''}>A</option>
                        <option value="B" ${data.grade === 'B' ? 'selected' : ''}>B</option>
                        <option value="C" ${data.grade === 'C' ? 'selected' : ''}>C</option>
                        <option value="D" ${data.grade === 'D' ? 'selected' : ''}>D</option>
                    </select>
                </td>
                <td>
                    <input type="text" id="note-${id}" class="note-input" value="${data.auditorNotes || ''}" ${isDisabled}>
                </td>
                <td>${statusBadge}</td>
                <td>
                    <select class="action-select" data-id="${id}" style="width: 100%;">
                        <option value="pending" ${data.status === 'pending' ? 'selected' : ''}>Pending</option>
                        <option value="verified" ${data.status === 'verified' ? 'selected' : ''}>Verify</option>
                        <option value="resubmit" ${data.status === 'resubmit' ? 'selected' : ''}>Resubmit</option>
                        <option value="incorrect" ${data.status === 'incorrect' ? 'selected' : ''}>Reject</option>
                    </select>
                </td>
            `;
            tableBody.appendChild(row);
        });
    });

    // 3. Handle Verification Actions
    tableBody.addEventListener('change', async (e) => {
        if (e.target.classList.contains('action-select')) {
            const newStatus = e.target.value;
            const docId = e.target.dataset.id;
            
            if(newStatus === 'verified' && !confirm(`Verify report?`)) {
                e.target.value = 'pending';
                return;
            }

            const gradeVal = document.getElementById(`grade-${docId}`).value;
            const noteVal = document.getElementById(`note-${docId}`).value;
            const companyName = document.getElementById(`name-${docId}`).innerText; 

            // Blockchain Mock
            const logData = `${docId}-${newStatus}-${gradeVal}-${Date.now()}`;
            const logHash = window.CryptoJS ? CryptoJS.SHA256(logData).toString() : "HASH_ERR";

            try {
                // Update Submission
                await updateDoc(doc(db, "submissions", docId), { 
                    status: newStatus,
                    grade: gradeVal,
                    auditorNotes: noteVal,
                    auditorId: auditorDocId
                });
                
                // Add to Ledger
                await addDoc(collection(db, "audit_logs"), {
                    auditorId: auditorDocId,
                    companyName: companyName,
                    submissionId: docId,
                    action: newStatus,
                    grade: gradeVal,
                    notes: noteVal,
                    blockchainHash: logHash,
                    timestamp: serverTimestamp()
                });
            } catch (error) {
                console.error("Error:", error);
                alert("Update failed: " + error.message);
            }
        }
    });
    
    // History Modal Logic
    tableBody.addEventListener('click', async (e) => {
        if (e.target.classList.contains('btn-history')) {
            const companyId = e.target.dataset.companyId;
            const companyName = e.target.dataset.companyName;
            document.getElementById('modalTitle').innerText = `History: ${companyName}`;
            const historyBody = document.getElementById('historyTableBody');
            historyBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Loading...</td></tr>';
            modal.style.display = "block";

            try {
                const q = query(collection(db, "submissions"), where("companyId", "==", companyId), orderBy("timestamp", "desc"));
                const snap = await getDocs(q);
                historyBody.innerHTML = '';
                if(snap.empty) {
                    historyBody.innerHTML = '<tr><td colspan="5">No records.</td></tr>';
                } else {
                    snap.forEach(doc => {
                        const d = doc.data();
                        historyBody.innerHTML += `<tr>
                            <td>${d.timestamp ? d.timestamp.toDate().toLocaleDateString() : 'N/A'}</td>
                            <td>${d.totalImpact.toFixed(2)}</td>
                            <td>${d.status}</td>
                            <td>${d.grade || '-'}</td>
                            <td>${d.auditorNotes || ''}</td>
                        </tr>`;
                    });
                }
            } catch(err) { console.error(err); }
        }
    });

    closeModal.onclick = () => modal.style.display = "none";
    window.onclick = (e) => { if(e.target == modal) modal.style.display = "none"; };

    document.getElementById('logoutBtn').addEventListener('click', () => {
        signOut(auth).then(() => window.location.href = "index.html");
    });
});