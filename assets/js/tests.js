import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, get, query, orderByChild, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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
        // ТАЛАП 1: Ар бир мугалим өзүнүн маалыматтарын гана көрөт (Isolation)
        const testsRef = ref(database, `teachers_data/${currentUser.uid}/tests`);
        const snapshot = await get(testsRef);
        
        allTests = [];
        let totalSubmits = 0;
        let activeCount = 0;

        if (snapshot.exists()) {
            const data = snapshot.val();
            for (let id in data) {
                const test = data[id];
                // Double check for security requirement
                if (test.ownerId === currentUser.uid) {
                    allTests.push(test);
                    if (test.settings && test.settings.isPublic) activeCount++;
                    // Assume test.submissionsCount exists or calculate from results
                    totalSubmits += test.submissionsCount || 0; 
                }
            }
        }

        updateDashboardStats(allTests.length, activeCount, totalSubmits);
        renderTests(allTests);

    } catch (error) {
        console.error("Маалымат алууда ката кетти:", error);
    }
}

function updateDashboardStats(total, active, submits) {
    document.getElementById("statTotal").innerText = total;
    document.getElementById("statActive").innerText = active;
    document.getElementById("statSubmits").innerText = submits;
    document.getElementById("statAvg").innerText = "0%"; // Requires result aggregation logic
}

function renderTests(tests) {
    const container = document.getElementById("testListContainer");
    container.innerHTML = "";
    
    if (tests.length === 0) {
        container.innerHTML = "<p>Сизде азырынча тесттер жок.</p>";
        return;
    }

    tests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).forEach(test => {
        const div = document.createElement("div");
        div.className = "test-card";
        div.innerHTML = `
            <h4>${test.title}</h4>
            <div class="test-meta">
                <i class="fas fa-book"></i> ${test.subject} | 
                <i class="fas fa-clock"></i> ${new Date(test.createdAt).toLocaleDateString()}
            </div>
            <div class="test-meta">
                ID: ${test.id}
            </div>
            <div class="btn-group">
                <button class="btn btn-primary" onclick="openTestModal('${test.id}', '${test.title}')">
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
    document.getElementById("modalTestTitle").innerText = title;
    
    // ТАЛАП 2: Уникалдуу шилтеме
    const shareUrl = `${window.location.origin}/sections/play-test.html?id=${testId}`;
    document.getElementById("shareLinkInput").value = shareUrl;
    
    // ТАЛАП 7: QR Code автоматтык түзүлөт
    const qrContainer = document.getElementById("qrcode");
    qrContainer.innerHTML = "";
    new QRCode(qrContainer, {
        text: shareUrl,
        width: 150,
        height: 150,
        colorDark : "#000000",
        colorLight : "#ffffff",
        correctLevel : QRCode.CorrectLevel.H
    });

    document.getElementById("testModal").style.display = "flex";
}

window.closeModal = function() {
    document.getElementById("testModal").style.display = "none";
    currentActiveTestId = null;
}

window.copyLink = function() {
    const input = document.getElementById("shareLinkInput");
    input.select();
    document.execCommand("copy");
    alert("Шилтеме көчүрүлдү!");
}

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
            alert("Коопсуздук эрежесине ылайык өчүрүү мүмкүн эмес же ката кетти.");
        }
    }
}
