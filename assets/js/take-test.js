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
        showStatusError("Ката: Тесттин идентификатору (ID) шилтемеде табылган жок!");
        return;
    }

    // Баскычка окуучу маалыматын текшерүү эвентин туташтыруу
    setupStartButton();

    // Тестти базадан жүктөө
    await fetchTestContent();
});

async function fetchTestContent() {
    const dbRef = ref(database);

    try {
        // 1. Эгер teacherUid шилтемеде жок болсо, глобалдык издөөдөн анын мугалимин табабыз
        if (!teacherUid) {
            const lookupSnap = await get(child(dbRef, `global_test_lookup/${testId}`));
            if (lookupSnap.exists()) {
                teacherUid = lookupSnap.val().teacherUid;
            }
        }

        // 2. Мугалимдин UIDинде дагы эле жок болсо, дефолттук же туруктуу IDлерди текшеребиз
        const possibleTeachers = teacherUid 
            ? [teacherUid, "demo_teacher_001"] 
            : ["demo_teacher_001"];

        let found = false;

        for (const tid of possibleTeachers) {
            const testSnap = await get(child(dbRef, `teachers_data/${tid}/tests/${testId}`));
            if (testSnap.exists()) {
                currentTest = testSnap.val();
                teacherUid = tid;
                found = true;
                break;
            }
        }

        // 3. Эгерде тест дагы эле табылбаса (мисалы, черновик ID же өчүрүлгөн болсо)
        if (!found) {
            // Браузердин локалдык бэкабынан издеп көрүү
            try {
                const localData = localStorage.getItem(`bilimal_builder_backup_${testId}`) || localStorage.getItem(`bilimal_test_draft_${testId}`);
                if (localData) {
                    currentTest = JSON.parse(localData);
                    found = true;
                }
            } catch (e) {
                console.warn("Storage купуялуулук чектөөсүнөн улам окулбады:", e);
            }
        }

        if (found && currentTest) {
            console.log("Тест ийгиликтүү жүктөлдү:", currentTest);
            updateUIWithTestInfo(currentTest);
        } else {
            showStatusError("Ката: Бул тест серверде табылган жок же мугалим тарабынан али жарыялана элек (Черновик режиминде).");
        }

    } catch (err) {
        console.error("Firebase тармактык катасы:", err);
        showStatusError("Тармактык ката: Базадан тестти жүктөө мүмкүн болгон жок. Жүктөөнү кайрадан аракет кылыңыз.");
    }
}

function updateUIWithTestInfo(test) {
    // Тесттин аталышын же маалыматтарын баракчага чагылдыруу
    const titleEl = document.getElementById("lblTestTitle") || document.querySelector("h2") || document.querySelector("h1");
    if (titleEl && test.title) {
        titleEl.textContent = test.title;
    }
}

function showStatusError(msg) {
    const startBtn = document.getElementById("btnStartTest") || document.querySelector("button.btn-primary") || document.querySelector("button");
    if (startBtn) {
        startBtn.disabled = true;
        startBtn.style.opacity = "0.5";
        startBtn.style.cursor = "not-allowed";
    }
    alert(msg);
}

function setupStartButton() {
    const startBtn = document.getElementById("btnStartTest") || document.querySelector("button.btn-primary") || document.querySelector("button");
    
    if (startBtn) {
        startBtn.addEventListener("click", (e) => {
            e.preventDefault();

            if (!currentTest) {
                alert("Тест толук жүктөлө элек же базада табылган жок. Баракты жаңыртып көрүңүз.");
                return;
            }

            const nameInput = document.getElementById("studentName") || document.querySelector("input[type='text']");
            const classSelect = document.getElementById("studentClass") || document.querySelector("select");

            if (!nameInput || !nameInput.value.trim()) {
                alert("Сураныч, аты-жөнүңүздү (ФИО) киргизиңиз.");
                return;
            }

            const studentName = nameInput.value.trim();
            const selectedClass = classSelect ? classSelect.value : "11-класс";

            // Сактагычка жазуу (Safe setItem)
            try {
                localStorage.setItem("current_student_name", studentName);
                localStorage.setItem("current_student_class", selectedClass);
                localStorage.setItem("current_test_data", JSON.stringify(currentTest));
                localStorage.setItem("current_teacher_uid", teacherUid);
            } catch (storageErr) {
                console.warn("Локалдык сактагычка жазуу бөгөттөлгөн:", storageErr);
            }

            // Тест тапшыруу баракчасына багыттоо
            window.location.href = `/sections/do-test.html?teacherUid=${teacherUid}&id=${testId}`;
        });
    }
}
