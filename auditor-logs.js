import { auth, db } from "./firebase.js";
import { collection, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {

    // 1. Auth Guard
    onAuthStateChanged(auth, (user) => {
        if (!user) window.location.href = "index.html";
    });

    const logsTable = document.getElementById('logsTableBody');
    
    // 2. Fetch Logs (Real-time)
    const q = query(collection(db, "audit_logs"), orderBy("timestamp", "desc"));

    onSnapshot(q, (snapshot) => {
        logsTable.innerHTML = '';
        
        if (snapshot.empty) {
            logsTable.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 40px;">No verification history found in the ledger.</td></tr>';
            return;
        }

        snapshot.forEach((doc) => {
            const data = doc.data();
            const date = data.timestamp ? data.timestamp.toDate().toLocaleString() : 'Just now';
            
            // Display Name Handling
            const displayName = data.companyName || data.companyEmail || "Unknown Company";
            
            // Status Badge Logic
            let badgeClass = 'status-pending';
            let icon = '';
            
            if(data.action === 'verified') {
                badgeClass = 'status-verified';
                icon = '<i class="fa-solid fa-check-circle"></i> ';
            } else if(data.action === 'incorrect') {
                badgeClass = 'status-incorrect';
                icon = '<i class="fa-solid fa-circle-xmark"></i> ';
            } else if(data.action === 'resubmit') {
                badgeClass = 'status-resubmit';
                icon = '<i class="fa-solid fa-rotate-right"></i> ';
            }

            // Hash Handling
            const hashDisplay = data.blockchainHash 
                ? `<span class="hash-code" title="${data.blockchainHash}">${data.blockchainHash.substring(0, 14)}...</span>` 
                : '<span style="color:#94a3b8;">Pending</span>';

            const row = `
                <tr>
                    <td style="font-size: 0.9rem; color: #475569;">
                        <i class="fa-regular fa-clock" style="margin-right: 5px;"></i> ${date}
                    </td>
                    <td>
                        <strong style="color: #1e293b;">${displayName}</strong>
                    </td>
                    <td>
                        <span class="flag ${badgeClass}" style="font-size: 0.75rem;">${icon}${data.action.toUpperCase()}</span>
                    </td>
                    <td style="text-align: center;">
                        <span class="grade-badge ${data.grade || 'N/A'}" style="width:30px; height:30px; line-height:30px; font-size:0.85rem;">
                            ${data.grade || '-'}
                        </span>
                    </td>
                    <td style="color:#555; font-size: 0.9rem;">
                        ${data.notes || '<span style="color:#cbd5e1; font-style:italic;">No notes</span>'}
                    </td>
                    <td>
                        ${hashDisplay}
                    </td>
                </tr>
            `;
            logsTable.insertAdjacentHTML('beforeend', row);
        });
    });

    // 3. Logout Handler
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            signOut(auth).then(() => window.location.href = "index.html");
        });
    }
});