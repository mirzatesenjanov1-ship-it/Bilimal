// Firebase Compat катары иштөөсү (Import'торсуз)
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

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const database = firebase.database();

let currentTeacherUid = "aZATfeK3qNV9iQPWxRHqwzsIFT42"; // Учурдагы мугалимдин UID'и
let editingTestId = null;

document.addEventListener("DOMContentLoaded", function () {
    extractEditingTestIdFromUrl();
    bindMainActionButtons();
});

function extractEditingTestIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    editingTestId = urlParams.get("edit");

    if (!editingTestId) {
        editingTestId = "test_" + Date.now();
    } else {
        loadExistingTestDataForEditing(editingTestId);
    }
}

function loadExistingTestDataForEditing(testId) {
    database.ref(`teachers_data/${currentTeacherUid}/tests/${testId}`).once('value')
        .then(function (snapshot) {
            if (snapshot.exists()) {
                const testData = snapshot.val();
                populateBuilderFormWithData(testData);
            }
        })
        .catch(function (err) {
            console.error("Тестти жүктөөдө ката:", err);
        });
}

function bindMainActionButtons() {
    const publishBtn = document.querySelector(".btn-publish") || document.getElementById("publishTestBtn");
    if (publishBtn) {
        publishBtn.onclick = function () {
            saveTestToFirebaseDatabase(true);
        };
    }

    const draftBtn = document.querySelector(".btn-draft") || document.getElementById("saveDraftBtn");
    if (draftBtn) {
        draftBtn.onclick = function () {
            saveTestToFirebaseDatabase(false);
        };
    }
}

function collectTestPayloadDataFromUI() {
    // Формадагы бардык суроолорду жыйнап алуу
    const questionsList = [];
    const questionBlocks = document.querySelectorAll(".question-block, [data-question-id]");

    questionBlocks.forEach(function (qBlock, index) {
        const qTextEl = qBlock.querySelector(".question-text-input") || qBlock.querySelector("input[type='text']");
        const pointsEl = qBlock.querySelector(".question-points-input");
        
        const optionsList = [];
        let correctIdx = 0;

        const optionInputs = qBlock.querySelectorAll(".option-text-input, .variant-input");
        const optionRadios = qBlock.querySelectorAll("input[type='radio'], input[type='checkbox']");

        optionInputs.forEach(function (optInput, oIdx) {
            if (optInput.value.trim() !== "") {
                optionsList.push(optInput.value.trim());
            }
        });

        optionRadios.forEach(function (radio, rIdx) {
            if (radio.checked) {
                correctIdx = rIdx;
            }
        });

        if (qTextEl && qTextEl.value.trim() !== "") {
            questionsList.push({
                text: qTextEl.value.trim(),
                options: optionsList.length > 0 ? optionsList : ["А варианты", "Б варианты"],
                correctOptionIndex: correctIdx,
                points: pointsEl ? parseInt(pointsEl.value) || 5 : 5,
                type: "single"
            });
        }
    });

    const testTitleEl = document.getElementById("testTitleInput") || document.querySelector(".test-title-input");
    const testSubjectEl = document.getElementById("testSubjectInput");
    const testClassEl = document.getElementById("testClassInput");
    const testDurationEl = document.getElementById("testDurationInput");

    return {
        id: editingTestId,
        title: testTitleEl ? testTitleEl.value.trim() : "Жаңы Тест",
        subject: testSubjectEl ? testSubjectEl.value.trim() : "Жалпы",
        classGroup: testClassEl ? testClassEl.value.trim() : "Бардыгы",
        duration: testDurationEl ? parseInt(testDurationEl.value) || 45 : 45,
        questions: questionsList,
        updatedAt: Date.now(),
        teacherUid: currentTeacherUid,
        status: "published"
    };
}

function saveTestToFirebaseDatabase(isPublish) {
    const testPayload = collectTestPayloadDataFromUI();
    testPayload.status = isPublish ? "published" : "draft";

    const updates = {};
    // 1. Мугалимдин өзүнүн базасына сактоо
    updates[`teachers_data/${currentTeacherUid}/tests/${editingTestId}`] = testPayload;
    
    // 2. Окуучулар тестти оңой табышы үчүн глобалдык индекске сактоо
    updates[`global_test_lookup/${editingTestId}`] = {
        teacherUid: currentTeacherUid,
        title: testPayload.title,
        status: testPayload.status
    };

    // Базага сактоо операциясы
    database.ref().update(updates)
        .then(function () {
            alert(isPublish ? "Тест ийгиликтүү жарыяланды!" : "Черновик болуп сакталды!");
            
            // Тесттин даяр шилтемесин көрсөтүү
            const studentLink = `https://bilimal.org/student-test.html?teacher=${currentTeacherUid}&test=${editingTestId}`;
            console.log("Окуучулар үчүн шилтеме:", studentLink);
        })
        .catch(function (error) {
            console.error("Firebase сактоо катасы:", error);
            if (error.code === "PERMISSION_DENIED" || error.message.includes("PERMISSION_DENIED")) {
                alert("Ката: Firebase базасына жазууга уруксат берилген эмес! Эрежелерди (Rules) текшериңиз.");
            } else {
                alert("Базага сактоодо ката кетти. Интернет байланышыңызды текшериңиз.");
            }
        });
}

function populateBuilderFormWithData(testData) {
    const testTitleEl = document.getElementById("testTitleInput") || document.querySelector(".test-title-input");
    if (testTitleEl && testData.title) testTitleEl.value = testData.title;
}
