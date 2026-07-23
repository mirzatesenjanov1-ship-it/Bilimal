import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, get, child } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyAsRjj_5VoQwZA7hSBWhkQ58UvUnct-b28",
    authDomain: "bilimal-org.firebaseapp.com",
    databaseURL: "https://bilimal-org-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "bilimal-org",
    storageBucket: "bilimal-org.firebasestorage.app",
    messagingSenderId: "241750360816",
    appId: "1:241750360816:web:a991434eb5afbc470d7835",
    measurementId: "G-9GSQV60QV0"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

let currentTest = null;
let teacherUid = "";
let testId = "";

document.addEventListener("DOMContentLoaded", async () => {
    const urlParams = new URLSearchParams(window.location.search);
    testId = urlParams.get("id");
    teacherUid = urlParams.get("teacherId");

    if (!testId) {
        alert("Тесттин коду табылган жок! Шилтемени туура көчүргөнүңүздү текшериңиз.");
        return;
    }

    setupStartButton();
    await fetchTestContent();
});

async function fetchTestContent() {
    const dbRef = ref(database);

    try {
        // 1. Глобалдык таблицадан мугалимдин IDси изделет
        if (!teacherUid) {
            const lookupSnap = await get(child(dbRef, `global_test_lookup/${testId}`));
            if (lookupSnap.exists()) {
                teacherUid = lookupSnap.val().teacherUid;
            }
        }

        // Издөө жүргүзүлүүчү IDлер
        const teachersToSearch = teacherUid ? [teacherUid, "demo_teacher_001"] : ["demo_teacher_001"];

        for (const tid of teachersToSearch) {
            const testSnap = await get(child(dbRef, `teachers_data/${tid}/tests/${testId}`));
            if (testSnap.exists()) {
                currentTest = testSnap.val();
                teacherUid = tid;
                break;
            }
        }

        if (currentTest) {
            const titleEl = document.getElementById("lblTestTitle") || document.querySelector("h2");
            if (titleEl && currentTest.title) titleEl.textContent = currentTest.title;
        } else {
            alert("Бул тест базада табылган жок! Мугалим тестти сактап, 'Жарыялоо' баскычын басканын текшериңиз.");
        }

    } catch (err) {
        console.error("Firebase тармактык катасы:", err);
        alert("Сервер менен байланыш үзүлдү. Баракты жаңыртып көрүңүз.");
    }
}

function setupStartButton() {
    const startBtn = document.getElementById("btnStartTest") || document.querySelector("button.btn-primary") || document.querySelector("button");
    
    if (startBtn) {
        startBtn.addEventListener("click", (e) => {
            e.preventDefault();

            if (!currentTest) {
                alert("Тест толук жүктөлө элек же базада табылган жок.");
                return;
            }

            const nameInput = document.getElementById("studentName") || document.querySelector("input[type='text']");
            const classSelect = document.getElementById("studentClass") || document.querySelector("select");

            if (!nameInput || !nameInput.value.trim()) {
                alert("Сураныч, аты-жөнүңүздү (ФИО) киргизиңиз.");
                return;
            }

            try {
                localStorage.setItem("current_student_name", nameInput.value.trim());
                localStorage.setItem("current_student_class", classSelect ? classSelect.value : "");
                localStorage.setItem("current_test_data", JSON.stringify(currentTest));
            } catch (e) {}

            window.location.href = `/sections/do-test.html?teacherUid=${teacherUid}&id=${testId}`;
        });
    }
}
