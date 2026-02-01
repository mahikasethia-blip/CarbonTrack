import { auth, db } from "./firebase.js";
import { 
    collection, addDoc, query, where, orderBy, limit, getDocs, serverTimestamp, doc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let companyDocId = null;
let companyEmail = null; // Store email for the receipt

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Simple Auth Check
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            companyDocId = user.uid;
            companyEmail = user.email; // Capture email
        } else {
            window.location.href = "index.html";
        }
    });

    const submitBtn = document.getElementById('submitData');
    
    const textFields = ['company_name', 'state', 'city'];
    const numFields = ['elec', 'fuel', 'travel', 'waste', 'offsets'];
    const allIds = [...textFields, ...numFields];

    // 2. Helper: Get Last Hash
    async function getLastHash() {
        if (!companyDocId) return "GENESIS";
        try {
            const q = query(
                collection(db, "submissions"), 
                where("companyId", "==", companyDocId), 
                orderBy("timestamp", "desc"), 
                limit(1)
            );
            const querySnapshot = await getDocs(q);
            return !querySnapshot.empty ? querySnapshot.docs[0].data().blockchainHash : "GENESIS_BLOCK_0000000000000000";
        } catch (e) { 
            return "GENESIS_BLOCK_0000000000000000"; 
        }
    }

    // 3. Validation & Calculation
    const validateAndCalculate = () => {
        const data = {};
        let allFilled = true;
        
        textFields.forEach(id => {
            const el = document.getElementById(id);
            const val = el ? el.value.trim() : "";
            if (!val) allFilled = false;
            data[id] = val;
        });
        
        numFields.forEach(id => {
            const el = document.getElementById(id);
            const val = el ? parseFloat(el.value) : 0;
            data[id] = isNaN(val) ? 0 : val;
        });

        const factors = { elec: 0.85, fuel: 2.31, travel: 0.14, waste: 0.52 };
        const grossCO2 = (data.elec * factors.elec) + (data.fuel * factors.fuel) + (data.travel * factors.travel) + (data.waste * factors.waste);
        const totalImpact = (grossCO2 / 1000) - data.offsets;
        
        const co2Display = document.getElementById('co2Val');
        if(co2Display) co2Display.innerText = totalImpact.toFixed(3);

        if (allFilled) {
            submitBtn.disabled = false;
            submitBtn.style.opacity = "1";
            submitBtn.style.cursor = "pointer";
            return { ...data, totalImpact };
        } else {
            submitBtn.disabled = true;
            submitBtn.style.opacity = "0.5";
            return null;
        }
    };

    allIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', validateAndCalculate);
    });

    // 4. Submit Logic (With PDF Restoration)
    if (submitBtn) {
        submitBtn.addEventListener('click', async () => {
            const currentData = validateAndCalculate();
            if (!currentData || !companyDocId) return;

            submitBtn.innerText = "Submitting...";
            submitBtn.disabled = true;

            try {
                const prevHash = await getLastHash();
                
                // Create a Hash of the data to simulate blockchain integrity
                const rawString = JSON.stringify(currentData) + prevHash + Date.now();
                const simulatedHash = window.CryptoJS ? CryptoJS.SHA256(rawString).toString() : "HASH_GENERATED_" + Date.now();

                await addDoc(collection(db, "submissions"), {
                    companyId: companyDocId,
                    companyName: currentData.company_name,
                    state: currentData.state,
                    city: currentData.city,
                    electricity: currentData.elec,
                    fuel: currentData.fuel,
                    travel: currentData.travel,
                    waste: currentData.waste,
                    offsets: currentData.offsets,
                    totalImpact: currentData.totalImpact,
                    previousHash: prevHash,
                    blockchainHash: simulatedHash, 
                    status: "pending",
                    grade: "N/A",
                    timestamp: serverTimestamp()
                });

                // === RESTORED PDF LOGIC ===
                showNotification("✅ Report Submitted! Click to download receipt.", "success", { actionText: "Download", actionCallback: () => generateReceiptPDF(currentData, simulatedHash), duration: 6000 });
                setTimeout(() => location.reload(), 1500); 

            } catch (error) {
                console.error("Submission Error:", error);
                showNotification("Failed: " + error.message, "error");
                submitBtn.disabled = false;
                submitBtn.innerText = "Submit Report";
            }
        });
    }

    // 5. PDF Generation Function (Updated for No-Wallet)
    function generateReceiptPDF(data, hash) {
        if (!window.jspdf) {
            console.error("jspdf not loaded");
            return;
        }
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Header
        doc.setFillColor(22, 101, 52); // Green
        doc.rect(0, 0, 210, 30, 'F');
        doc.setFontSize(22); 
        doc.setTextColor(255, 255, 255);
        doc.text("Submission Receipt", 105, 20, null, null, "center");
        
        // Body
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(12);
        
        let y = 50;
        doc.text(`Company: ${data.company_name}`, 20, y); y+=10;
        doc.text(`Registered Email: ${companyEmail || 'N/A'}`, 20, y); y+=10;
        doc.text(`Date: ${new Date().toLocaleString()}`, 20, y); y+=10;
        
        doc.setLineWidth(0.5);
        doc.line(20, y, 190, y); y+=10;
        
        doc.setFontSize(14); 
        doc.setTextColor(22, 101, 52);
        doc.text(`Total Impact: ${data.totalImpact.toFixed(3)} tCO2e`, 20, y); y+=15;
        
        // Hash Section
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text("Digital Fingerprint (Hash):", 20, y); y+=5;
        doc.setFont("courier");
        doc.setFontSize(8);
        doc.text(hash, 20, y);

        doc.save(`Carbon_Receipt_${Date.now()}.pdf`);
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if(logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            signOut(auth).then(() => window.location.href = "index.html");
        });
    }
    
    //Modal Logic (Unchanged)
    const modal = document.getElementById('reportModal');
    const closeReportModal = document.getElementById('closeReportModal');
    
    const viewReportBtn = document.getElementById('viewReportBtn'); // If you have this button in HTML
    if (viewReportBtn) {
        viewReportBtn.addEventListener('click', () => {
            modal.style.display = "block";
        });
    }

    if(closeReportModal) closeReportModal.onclick = () => modal.style.display = "none";
    window.onclick = (e) => { if(e.target == modal) modal.style.display = "none"; };

    document.getElementById('btnSaveLink').addEventListener('click', async () => {
        const link = document.getElementById('driveLinkInput').value;
        if(link && companyDocId) {
            try {
                await updateDoc(doc(db, "companies", companyDocId), { sustainabilityReport: link });
                showNotification("Link Saved!", "success");
            } catch(e) { showNotification("Error saving link", "error"); }
        }
    });
    
    document.getElementById('btnOpenDrive').addEventListener('click', () => {
        const link = document.getElementById('driveLinkInput').value;
        if(link) window.open(link, '_blank');
    });

    document.getElementById('btnGeneratePDF').addEventListener('click', () => {
       showNotification("Feature coming soon: Auto-generate full report.", "info");
    });
});