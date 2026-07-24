import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, get, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyAsRjj_5VoQwZA7hSBWhkQ58UvUnct-b28",
    authDomain: "bilimal-org.firebaseapp.com",
    databaseURL: "https://bilimal-org-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "bilimal-org",
    storageBucket: "bilimal-org.firebasestorage.app",
    messagingSenderId: "241750360816",
    appId: "1:241750360816:web:a991434eb5afbc470d7835"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);

let currentUser = null;
let currentActiveTestId = null;
let allTests = [];

document.addEventListener("DOMContentLoaded", () => {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            loadTests();
        } else {
            window.location.href = "/auth.html";
        }
    });
});

window.loadTests = async function() {
    if (!currentUser) return;
    try {
        // Ар бир мугалимдин өзүнүн маалыматы
        const testsRef = ref(database, `teachers_data/${currentUser.uid}/tests`);
        const snapshot = await get(testsRef);
        
        allTests = [];
        let totalSubmits = 0;
        let activeCount = 0;

        if (snapshot.exists()) {
            const data = snapshot.val();
            for (let id in data) {
                const test = data[id];
                allTests.push(test);
                
                // Статусту же settings.isPublic'ти текшерүү
                if (test.status === "active" || (test.settings && test.settings.isPublic)) {
                    activeCount++;
                }
                
                // Жыйынтыктар санын эсептөө
                if (test.results) {
                    totalSubmits += Object.keys(test.results).length;
                } else if (test.submissionsCount) {
                    totalSubmits += test.submissionsCount;
                }
            }
        }

        updateDashboardStats(allTests.length, activeCount, totalSubmits);
        renderTests(allTests);

    } catch (error) {
        console.error("Маалымат алууда ката кетти:", error);
    }
};

function updateDashboardStats(total, active, submits) {
    const elTotal = document.getElementById("statTotal");
    const elActive = document.getElementById("statActive");
    const elSubmits = document.getElementById("statSubmits");
    const elAvg = document.getElementById("statAvg");

    if (elTotal) elTotal.innerText = total;
    if (elActive) elActive.innerText = active;
    if (elSubmits) elSubmits.innerText = submits;
    if (elAvg) elAvg.innerText = "0%";
}

function renderTests(tests) {
    const container = document.getElementById("testListContainer");
    if (!container) return;
    container.innerHTML = "";
    
    if (tests.length === 0) {
        container.innerHTML = "<p style='text-align:center; padding: 20px; color:#aaa;'>Сизде азырынча тесттер жок.</p>";
        return;
    }

    tests.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).forEach(test => {
        const div = document.createElement("div");
        div.className = "test-card";
        const createdDate = test.createdAt ? new Date(test.createdAt).toLocaleDateString() : "Белгисиз";
        const statusBadge = test.status === "active" 
            ? '<span style="color:#00f2fe; font-size:12px;">● Активдүү</span>' 
            : '<span style="color:#ffaa00; font-size:12px;">● Черновик</span>';

        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <h4>${test.title || 'Аталышсыз тест'}</h4>
                ${statusBadge}
            </div>
            <div class="test-meta">
                <i class="fas fa-book"></i> ${test.subject || 'Предмет'} | 
                <i class="fas fa-clock"></i> ${createdDate}
            </div>
            <div class="test-meta">
                ID: ${test.id}
            </div>
            <div class="btn-group" style="margin-top:10px;">
                <button class="btn btn-primary" onclick="openTestModal('${test.id}', '${test.title || ''}')">
                    <i class="fas fa-cog"></i> Башкаруу
                </button>
                <button class="btn btn-outline" onclick="window.location.href='/sections/test-builder.html?edit=${test.id}'">
                    <i class="fas fa-pen"></i> Оңдоо
                </button>
            </div>
        `;
        container.appendChild(div);
    });
}

window.openTestModal = function(testId, title) {
    currentActiveTestId = testId;
    const titleEl = document.getElementById("modalTestTitle");
    if (titleEl) titleEl.innerText = title;
    
    // Окуучулар үчүн иштөөчү шилтеме форматы
    const shareUrl = `${window.location.origin}/student-test.html?teacher=${currentUser.uid}&test=${testId}`;
    const shareInput = document.getElementById("shareLinkInput");
    if (shareInput) shareInput.value = shareUrl;
    
    // QR Code түзүү
    const qrContainer = document.getElementById("qrcode");
    if (qrContainer) {
        qrContainer.innerHTML = "";
        if (typeof QRCode !== "undefined") {
            new QRCode(qrContainer, {
                text: shareUrl,
                width: 150,
                height: 150,
                colorDark : "#000000",
                colorLight : "#ffffff",
                correctLevel : QRCode.CorrectLevel.H
            });
        }
    }

    const modal = document.getElementById("testModal");
    if (modal) modal.style.display = "flex";
};

window.closeModal = function() {
    const modal = document.getElementById("testModal");
    if (modal) modal.style.display = "none";
    currentActiveTestId = null;
};

window.copyLink = function() {
    const input = document.getElementById("shareLinkInput");
    if (input) {
        input.select();
        navigator.clipboard.writeText(input.value).then(() => {
            alert("Шилтеме көчүрүлдү!");
        }).catch(() => {
            document.execCommand("copy");
            alert("Шилтеме көчүрүлдү!");
        });
    }
};

window.deleteTest = async function() {
    if (!currentActiveTestId || !currentUser) return;
    if (confirm("Бул тестти биротоло өчүрүүнү каалайсызбы?")) {
        try {
            const testRef = ref(database, `teachers_data/${currentUser.uid}/tests/${currentActiveTestId}`);
            const lookupRef = ref(database, `global_test_lookup/${currentActiveTestId}`);
            
            await remove(testRef);
            await remove(lookupRef);
            
            closeModal();
            loadTests();
        } catch (error) {
            console.error("Өчүрүү катасы:", error);
            alert("Өчүрүүдө ката кетти же уруксат берилген жок.");
        }
    }
};
