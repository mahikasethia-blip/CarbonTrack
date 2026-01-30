import { auth, db } from "./firebase.js";
import { collection, getDocs, query, where, orderBy, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Global Data
let allData = [];
let currentSort = { field: 'emissions', direction: 'asc' };

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Auth Listener (For Navbar Buttons)
    onAuthStateChanged(auth, (user) => {
        const publicNav = document.getElementById('publicNav');
        const privateNav = document.getElementById('privateNav');
        const walletSession = sessionStorage.getItem('walletUser');
        const isLoggedIn = user || walletSession;

        if (isLoggedIn) {
            if(publicNav) publicNav.style.display = 'none';
            if(privateNav) privateNav.style.display = 'block';
        } else {
            if(publicNav) publicNav.style.display = 'block';
            if(privateNav) privateNav.style.display = 'none';
        }
    });

    // 2. Logout Handler
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            sessionStorage.removeItem('walletUser'); // Clear wallet session
            signOut(auth).then(() => window.location.href = "index.html");
        });
    }

    // 3. Load Data
    loadScorecard();
    
    // 4. Attach Search
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            handleSearch(e.target.value);
        });
    }

    // 5. Global Sort
    window.sortTable = (field) => {
        handleSort(field);
    };
});

async function loadScorecard() {
    const tableBody = document.getElementById('scorecardTableBody');
    
    try {
        const q = query(
            collection(db, "submissions"), 
            where("status", "==", "verified")
        );

        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 30px; color: #64748b;">No verified sustainability reports found yet.</td></tr>';
            return;
        }

        allData = [];
        
        for (const submissionDoc of querySnapshot.docs) {
            const data = submissionDoc.data();
            
            let companyName = data.companyName;
            if (!companyName) {
                companyName = await getCompanyName(data.companyId || data.uid);
            }
            companyName = companyName || data.email || "Unknown Company";

            allData.push({
                rank: 0,
                companyName: companyName,
                hash: data.blockchainHash,
                city: data.city || '',
                state: data.state || '',
                totalImpact: data.totalImpact || 0,
                grade: data.grade || 'N/A',
                notes: data.auditorNotes || ''
            });
        }

        sortData('emissions', 'asc');
        renderTable(allData);

    } catch (error) {
        console.error("Scorecard Error:", error);
        tableBody.innerHTML = `<tr><td colspan="5" style="color:red; text-align:center; padding: 20px;">Error loading data.</td></tr>`;
    }
}

function renderTable(dataToRender) {
    const tableBody = document.getElementById('scorecardTableBody');
    tableBody.innerHTML = '';

    if (dataToRender.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 30px;">No matching records found.</td></tr>';
        return;
    }

    let rankCounter = 1;

    dataToRender.forEach(item => {
        const notesDisplay = item.notes ? `<br><small style="color:#64748b; font-style:italic;">📝 ${item.notes}</small>` : '';
        const hashDisplay = item.hash ? item.hash.substring(0,10)+'...' : 'N/A';

        const row = `
            <tr>
                <td><div class="rank-circle">${rankCounter++}</div></td>
                <td>
                    <div style="font-weight:bold; font-size: 1.1rem; color: #1e293b;">${item.companyName}</div>
                    <div style="font-size:0.8rem; color:#15803d; font-family: monospace; margin-top: 4px;">
                        <i class="fa-solid fa-link"></i> ${hashDisplay}
                    </div>
                </td>
                <td>
                    <i class="fa-solid fa-location-dot" style="color:#86efac; margin-right:5px;"></i> 
                    ${item.city ? item.city + ', ' : ''}${item.state}
                </td>
                <td>
                    <strong style="color: #166534; font-size: 1.1rem;">${item.totalImpact.toFixed(2)}</strong> <span style="font-size:0.9rem;">tCO₂e</span>
                    ${notesDisplay}
                </td>
                <td style="text-align: center;">
                    <span class="grade-badge ${item.grade}" style="width: 40px; height: 40px; line-height: 40px; font-size: 1.2rem;">${item.grade}</span>
                </td>
            </tr>
        `;
        tableBody.insertAdjacentHTML('beforeend', row);
    });
}

function handleSearch(queryText) {
    const lowerQuery = queryText.toLowerCase();
    const filteredData = allData.filter(item => {
        return (
            item.companyName.toLowerCase().includes(lowerQuery) ||
            item.city.toLowerCase().includes(lowerQuery) ||
            item.state.toLowerCase().includes(lowerQuery)
        );
    });
    renderTable(filteredData);
}

function handleSort(field) {
    if (currentSort.field === field) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.field = field;
        currentSort.direction = 'asc';
    }
    sortData(field, currentSort.direction);
    const currentSearch = document.getElementById('searchInput').value;
    handleSearch(currentSearch); 
}

function sortData(field, direction) {
    allData.sort((a, b) => {
        let valA, valB;
        switch (field) {
            case 'company': valA = a.companyName.toLowerCase(); valB = b.companyName.toLowerCase(); break;
            case 'location': valA = a.state.toLowerCase(); valB = b.state.toLowerCase(); break;
            case 'emissions': valA = a.totalImpact; valB = b.totalImpact; break;
            case 'grade': 
                const gradeMap = { 'A': 1, 'B': 2, 'C': 3, 'D': 4, 'N/A': 5 };
                valA = gradeMap[a.grade] || 99; valB = gradeMap[b.grade] || 99; break;
            case 'rank': default: valA = a.totalImpact; valB = b.totalImpact; break;
        }
        if (valA < valB) return direction === 'asc' ? -1 : 1;
        if (valA > valB) return direction === 'asc' ? 1 : -1;
        return 0;
    });
}

async function getCompanyName(uid) {
    if (!uid) return null;
    try {
        const docRef = doc(db, "companies", uid);
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? docSnap.data().name : null;
    } catch (e) { return null; }
}