import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, get, push, set, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyAsRjj_5VoQwZA7hSBWhkQ58UvUnct-b28",
    authDomain: "bilimal-org.firebaseapp.com",
    databaseURL: "https://bilimal-org-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "bilimal-org",
    storageBucket: "bilimal-org.firebasestorage.app"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

let currentTest = null;
let teacherUid = null;
let testId = null;
let startTime = null;

// ТАЛАП 4: Security & Anti-Cheat Events
document.addEventListener("keydown", (e) => {
    // Ctrl+C, Ctrl+V, PrintScreen
    if ((e.ctrlKey && (e.key === 'c' || e.key === 'v')) || e.key === 'PrintScreen' || e.key === 'F12') {
        e.preventDefault();
        alert("Коопсуздук саясаты: Бул аракетке тыюу салынган.");
    }
});

document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === 'hidden' && currentTest && currentTest.settings?.windowSwitchTrack) {
        document.getElementById("antiCheatWarning").style.display = "flex";
    }
});

window.hideWarning = function() {
    document.getElementById("antiCheatWarning").style.display = "none";
}

document.addEventListener("DOMContentLoaded", async () => {
    const params = new URLSearchParams(window.location.search);
    testId = params.get("id");

    if (!testId) {
        alert("Тесттин IDси көрсөтүлгөн жок!");
        return;
    }

    try {
        // ТАЛАП 8: IDOR коргоо - Биринчи тест кимге таандык экенин глобалдык индекстен карайбыз
        const lookupSnap = await get(ref(database, `global_test_lookup/${testId}`));
        if (!lookupSnap.exists()) {
            throw new Error("Тест табылган жок же өчүрүлгөн.");
        }
        
        teacherUid = lookupSnap.val().teacherUid;

        // Тесттин өзүн мугалимдин папкасынан алабыз
        const testSnap = await get(ref(database, `teachers_data/${teacherUid}/tests/${testId}`));
        if (!testSnap.exists()) {
            throw new Error("Маалымат базасынан тестти алуу мүмкүн эмес.");
        }

        currentTest = testSnap.val();
        
        document.getElementById("pubTestTitle").innerText = currentTest.title;
        document.getElementById("pubTestSubject").innerHTML = `<i class="fas fa-book"></i> ${currentTest.subject}`;
        document.getElementById("pubTestAuthor").innerHTML = `<i class="fas fa-user-tie"></i> ${currentTest.ownerName || "Мугалим"}`;
        document.getElementById("pubTestDuration").innerHTML = `<i class="fas fa-clock"></i> ${currentTest.duration} мин`;

    } catch (error) {
        document.getElementById("registrationForm").innerHTML = `<h2 style='color:red;'>Ката: ${error.message}</h2>`;
    }
});

window.startTest = function() {
    const name = document.getElementById("studentName").value.trim();
    const surname = document.getElementById("studentSurname").value.trim();
    
    if (!name || !surname) {
        alert("Аты-жөнүңүздү толук жазыңыз.");
        return;
    }

    // ТАЛАП 4: Full Screen
    if (currentTest.settings?.fullScreen) {
        document.documentElement.requestFullscreen().catch(e => console.log(e));
    }

    startTime = Date.now();
    document.getElementById("registrationForm").style.display = "none";
    document.getElementById("testInterface").style.display = "block";
    renderQuestions();
}

function renderQuestions() {
    const container = document.getElementById("questionContainer");
    let html = "";
    
    // Convert object to array if needed
    const questions = Array.isArray(currentTest.questions) ? currentTest.questions : Object.values(currentTest.questions);

    questions.forEach((q, i) => {
        html += `<div style="margin-bottom:30px; background:#1e293b; padding:20px; border-radius:8px;">
            <h3 style="margin-top:0;">${i+1}. ${sanitizeHTML(q.text)}</h3>`;
            
        q.options.forEach((opt, optIdx) => {
            html += `<div style="margin-bottom:10px;">
                <label style="cursor:pointer; display:flex; align-items:center; gap:10px;">
                    <input type="radio" name="q_${i}" value="${optIdx}">
                    ${sanitizeHTML(opt)}
                </label>
            </div>`;
        });
        html += `</div>`;
    });
    
    container.innerHTML = html;
}

// ТАЛАП 8: Input Validation & Sanitization
function sanitizeHTML(str) {
    const temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML;
}

window.submitTest = async function() {
    if (!confirm("Тестти бүтүрүүнү каалайсызбы?")) return;
    
    const questions = Array.isArray(currentTest.questions) ? currentTest.questions : Object.values(currentTest.questions);
    let score = 0;
    let correct = 0;
    let wrong = 0;
    
    questions.forEach((q, i) => {
        const selected = document.querySelector(`input[name="q_${i}"]:checked`);
        if (selected && parseInt(selected.value) === q.correctOptionIndex) {
            score += parseInt(q.points || 1);
            correct++;
        } else {
            wrong++;
        }
    });

    const percent = Math.round((correct / questions.length) * 100);
    const duration = Math.round((Date.now() - startTime) / 60000); // minutes

    // ТАЛАП 5: Жыйынтык авто сакталат (толук структура)
    const resultPayload = {
        testId: testId,
        ownerId: teacherUid, // ТАЛАП 1: ээсинин IDси
        studentName: document.getElementById("studentName").value + " " + document.getElementById("studentSurname").value,
        class: document.getElementById("studentClass").value,
        school: document.getElementById("studentSchool").value,
        score: score,
        correct: correct,
        wrong: wrong,
        percent: percent,
        startedAt: startTime,
        finishedAt: Date.now(),
        duration: duration,
        browser: navigator.userAgent,
        createdAt: serverTimestamp()
    };

    try {
        const resultsRef = ref(database, `teachers_data/${teacherUid}/results`);
        const newResultRef = push(resultsRef);
        await set(newResultRef, resultPayload);
        
        document.getElementById("testInterface").innerHTML = `
            <div style="text-align:center; padding:40px;">
                <i class="fas fa-check-circle" style="font-size:60px; color:#10b981; margin-bottom:20px;"></i>
                <h2>Тест ийгиликтүү аяктады!</h2>
                <p style="font-size:18px;">Сиздин жыйынтык: <strong>${percent}%</strong></p>
                <p>Туура жооптор: ${correct} / ${questions.length}</p>
            </div>
        `;
    } catch (e) {
        alert("Сактоодо ката кетти: " + e.message);
    }
}
