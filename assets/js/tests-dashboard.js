import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, get, set, push } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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

// Тестти Firebase базасынан жүктөө
function loadTestFromDatabase() {
    const testRef = ref(database, `teachers/${teacherId}/tests/${testId}`);
    
    get(testRef).then((snapshot) => {
        if (snapshot.exists()) {
            currentTest = snapshot.val();
            console.log("Тест ийгиликтүү жүктөлдү:", currentTest);
            
            // Жарынама бөлүмүн же кошумча элементтерди жаңыртуу
            const banner = document.getElementById("adBannerText");
            if (banner && currentTest.subject) {
                banner.textContent = currentTest.subject === "physics" || currentTest.subject === "Физика" ? "ФИЗИКА БӨЛҮМҮ" : "АСТРОНОМИЯ БӨЛҮМҮ";
            }
        } else {
            console.error("Тест маалымат базасынан табылган жок.");
            alert("Ката: Мындай тест базада жок же өчүрүлгөн!");
        }
    }).catch((error) => {
        console.error("Тестти жүктөөдө ката кетти:", error);
        alert("Тармак катасы: Маалыматтарды жүктөө мүмкүн болгон жок.");
    });
}

// "Тестти баштоо" баскычынын иштеши
function setupStartButton() {
    const startBtn = document.getElementById("btnStartTest") || document.querySelector("button[type='button']") || document.querySelector(".btn-primary") || document.getElementById("startTestBtn");
    
    // Эгер баскычты ID же класс менен таппаса, визуализациядагы "Тестти баштоо" тексти бар баскычты издейбиз
    const allButtons = document.querySelectorAll("button");
    let targetBtn = startBtn;
    if (!targetBtn) {
        allButtons.forEach(btn => {
            if (btn.textContent.includes("баштоо") || btn.textContent.includes("Баштоо")) {
                targetBtn = btn;
            }
        });
    }

    if (targetBtn) {
        targetBtn.addEventListener("click", () => {
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

            // Тест башталганын базага белгилөө же кийинки суроолор баракчасына өткөрүү
            localStorage.setItem("current_student_name", studentName);
            localStorage.setItem("current_student_class", selectedClass);
            localStorage.setItem("current_test_data", JSON.stringify(currentTest));

            // Бул жерде сиздин тестти тапшыруучу негизги баракчаңызга багыттайт
            // Мисалы, эгер суроолор ушул эле баракта ачылса, анда суроолорду көрсөтүү функциясын чакырат:
            if (typeof startActualTest === "function") {
                startActualTest(currentTest, studentName, selectedClass);
            } else {
                // Башка баракка өтүү керек болсо:
                window.location.href = `/sections/do-test.html?teacherId=${teacherId}&id=${testId}`;
            }
        });
    }
}
