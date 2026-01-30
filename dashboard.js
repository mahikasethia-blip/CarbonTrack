import { auth, db } from "./firebase.js";
import { 
    collection, 
    query, 
    where, 
    getDocs,
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Global Chart Instances
let lineChartInstance = null;
let pieChartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Auth Listener
    onAuthStateChanged(auth, async (user) => {
        try {
            if (user) {
                console.log("👤 User Logged In:", user.email);
                setupUI(true); 
                await loadCompanyInfo(user.uid);
                await loadAnalytics(user.uid, true); // Private Data
            } else {
                console.log("🌍 Public View (Global Trends)");
                setupUI(false); 
                await loadAnalytics(null, false); // Public Data
            }
        } catch (e) {
            console.error("Auth Listener Error:", e);
        }
    });

    // 2. Logout Handler
    const logoutBtn = document.getElementById('btnLogout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            signOut(auth).then(() => window.location.href = "index.html");
        });
    }
});

// UI SETUP HELPER 
function setupUI(isLoggedIn) {
    const publicNav = document.getElementById('publicNav');
    const privateNav = document.getElementById('privateNav');
    const alertBox = document.getElementById('alertContainer');
    
    // Elements might not exist in old HTML, so we check
    if(publicNav) publicNav.style.display = isLoggedIn ? 'none' : 'block';
    if(privateNav) privateNav.style.display = isLoggedIn ? 'block' : 'none';
    if(alertBox) alertBox.style.display = isLoggedIn ? 'block' : 'none';

    // Labels
    const title = document.getElementById('thirdCardTitle');
    const context = document.getElementById('thirdCardContext');
    const nameDisplay = document.getElementById('companyNameDisplay');

    if (isLoggedIn) {
        if(title) title.innerText = "Pending Verification";
        if(context) context.innerText = "Reports awaiting audit";
    } else {
        if(nameDisplay) nameDisplay.innerText = "Global Market (All Companies)";
        if(title) title.innerText = "Total Reports";
        if(context) context.innerText = "Submitted across network";
    }
}

// LOAD COMPANY NAME
async function loadCompanyInfo(uid) {
    try {
        const docRef = doc(db, "companies", uid);
        const docSnap = await getDoc(docRef);
        const nameDisplay = document.getElementById('companyNameDisplay');
        if (nameDisplay && docSnap.exists()) {
            nameDisplay.innerText = docSnap.data().name;
        }
    } catch (e) { console.warn("Profile load error:", e); }
}

//MAIN ANALYTICS LOGIC 
async function loadAnalytics(uid, isPrivate) {
    try {
        let q;
        
        if (isPrivate) {
            // Private: Filter by Company ID
            q = query(collection(db, "submissions"), where("companyId", "==", uid));
        } else {
            // Public: Get All
            q = query(collection(db, "submissions"));
        }
        
        const snapshot = await getDocs(q);
        
        // HANDLE EMPTY STATE (No Data)
        if (snapshot.empty) {
            console.warn("No data found for this view.");
            updateUIEmptyState();
            return;
        }

        // Extract and Sort Data (Client-Side Sort to fix Index Error)
        const submissions = [];
        snapshot.forEach(doc => submissions.push(doc.data()));

        submissions.sort((a, b) => {
            const dateA = a.timestamp ? a.timestamp.toDate() : new Date(0);
            const dateB = b.timestamp ? b.timestamp.toDate() : new Date(0);
            return dateA - dateB;
        });

        // Process Data for Charts
        let dates = [];
        let impacts = [];
        let totalEmissions = 0;
        let reportCount = 0; 
        let pendingReports = 0;
        let cats = { electricity: 0, fuel: 0, travel: 0, waste: 0 };
        let thisYearSum = 0;
        let lastYearSum = 0;
        const currentYear = new Date().getFullYear();

        submissions.forEach(data => {
            const dateObj = data.timestamp ? data.timestamp.toDate() : new Date();
            const dateStr = dateObj.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
            
            dates.push(dateStr);
            impacts.push(data.totalImpact);
            totalEmissions += data.totalImpact;
            reportCount++;

            cats.electricity += (data.electricity || 0) * 0.85 / 1000;
            cats.fuel += (data.fuel || 0) * 2.31 / 1000;
            cats.travel += (data.travel || 0) * 0.14 / 1000;
            cats.waste += (data.waste || 0) * 0.52 / 1000;

            if (data.status === 'pending' || data.status === 'incorrect' || data.status === 'resubmit') {
                pendingReports++;
            }

            if (dateObj.getFullYear() === currentYear) thisYearSum += data.totalImpact;
            else if (dateObj.getFullYear() === (currentYear - 1)) lastYearSum += data.totalImpact;
        });

        // Update Text Metrics
        const totalEl = document.getElementById('totalEmissions');
        if (totalEl) totalEl.innerText = totalEmissions.toFixed(2);
        
        const pendingEl = document.getElementById('pendingCount');
        if (pendingEl) pendingEl.innerText = isPrivate ? pendingReports : reportCount;

        // Alerts
        const alertBox = document.getElementById('alertContainer');
        const alertMsg = document.getElementById('alertMessage');
        if (isPrivate && alertBox && alertMsg) {
            if (pendingReports > 0) {
                alertBox.style.display = 'flex'; // Ensure Flex layout
                alertMsg.innerHTML = `You have <strong>${pendingReports} report(s)</strong> marked as pending.`;
            } else {
                alertBox.style.display = 'none';
            }
        }

        // YoY
        const yoyEl = document.getElementById('yoyValue');
        if (yoyEl) {
            if (lastYearSum > 0) {
                const change = ((thisYearSum - lastYearSum) / lastYearSum) * 100;
                const sign = change > 0 ? '+' : '';
                yoyEl.innerText = `${sign}${change.toFixed(1)}%`;
                yoyEl.style.color = change > 0 ? "#ef4444" : "#10b981";
            } else {
                yoyEl.innerText = "N/A";
            }
        }

        renderCharts(dates, impacts, cats);

    } catch (error) {
        console.error("Dashboard Logic Error:", error);
    }
}

// HANDLE EMPTY DATA 
function updateUIEmptyState() {
    // 1. Reset Numbers
    const totalEl = document.getElementById('totalEmissions');
    if (totalEl) totalEl.innerText = "0.00";

    const pendingEl = document.getElementById('pendingCount');
    if (pendingEl) pendingEl.innerText = "0";

    // 2. Draw "No Data" on Charts
    const drawNoData = (canvasId) => {
        const canvas = document.getElementById(canvasId);
        if(canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear old chart
            ctx.font = "16px sans-serif";
            ctx.fillStyle = "#64748b";
            ctx.textAlign = "center";
            ctx.fillText("No Data Available Yet", canvas.width / 2, canvas.height / 2);
        }
    };
    
    drawNoData('timeChart');
    drawNoData('categoryChart');
}

// CHART RENDERING
function renderCharts(labels, lineData, catData) {
    const canvasLine = document.getElementById('timeChart');
    const canvasPie = document.getElementById('categoryChart');

    if (!canvasLine || !canvasPie) return;

    // Destroy old charts
    if (lineChartInstance) lineChartInstance.destroy();
    if (pieChartInstance) pieChartInstance.destroy();

    // Check if Chart library loaded
    if (typeof Chart === 'undefined') {
        console.error("Chart.js not loaded");
        return;
    }

    const ctxLine = canvasLine.getContext('2d');
    const ctxPie = canvasPie.getContext('2d');

    // Line Chart
    lineChartInstance = new Chart(ctxLine, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Carbon Footprint (tCO₂e)',
                data: lineData,
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { 
                y: { beginAtZero: true, grid: { borderDash: [5, 5] } }, 
                x: { grid: { display: false } } 
            }
        }
    });

    // Pie Chart
    pieChartInstance = new Chart(ctxPie, {
        type: 'doughnut',
        data: {
            labels: ['Electricity', 'Fuel', 'Travel', 'Waste'],
            datasets: [{
                data: [catData.electricity, catData.fuel, catData.travel, catData.waste],
                backgroundColor: ['#3b82f6', '#f59e0b', '#10b981', '#64748b'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } },
            cutout: '70%'
        }
    });
}