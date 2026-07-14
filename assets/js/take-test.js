import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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
let teacherId = "";
let testId = "";

document.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
    teacherId = urlParams.get("teacherId") || "demo_teacher_001";
    testId = urlParams.get("id");

    if (!testId) {
        alert("Ката: Тесттин идентификатору табылган жок!");
        return;
    }

    loadTestFromDatabase();
    setupStartButton();
});

function loadTestFromDatabase() {
    const testRef = ref(database, `teachers/${teacherId}/tests/${testId}`);
    
    get(testRef).then((snapshot) => {
        if (snapshot.exists()) {
            currentTest = snapshot.val();
            console.log("Тест жүктөлдү:", currentTest);
        } else {
            alert("Ката: Бул тест табылган жок же өчүрүлгөн!");
        }
    }).catch((error) => {
        console.error("Ката кетти:", error);
        alert("Тармак катасы: Тест маалыматтарын жүктөө мүмкүн болгон жок.");
    });
}

function setupStartButton() {
    const startBtn = document.getElementById("btnStartTest") || document.querySelector("button") || document.querySelector(".btn-primary");
    
    if (startBtn) {
        startBtn.addEventListener("click", () => {
            if (!currentTest) {
                alert("Тест толук жүктөлө элек, бир аз күтө туруңуз.");
                return;
            }

            const nameInput = document.querySelector("input[type='text']") || document.getElementById("studentName");
            const classSelect = document.querySelector("select") || document.getElementById("studentClass");

            if (!nameInput || !nameInput.value.trim()) {
                alert("Сураныч, аты-жөнүңүздү (ФИО) толтуруңуз.");
                return;
            }

            const studentName = nameInput.value.trim();
            const selectedClass = classSelect ? classSelect.value : "Белгисиз класс";

            localStorage.setItem("current_student_name", studentName);
            localStorage.setItem("current_student_class", selectedClass);
            localStorage.setItem("current_test_data", JSON.stringify(currentTest));

            if (typeof startActualTest === "function") {
                startActualTest(currentTest, studentName, selectedClass);
            } else {
                window.location.href = `/sections/do-test.html?teacherId=${teacherId}&id=${testId}`;
            }
        });
    }
}
