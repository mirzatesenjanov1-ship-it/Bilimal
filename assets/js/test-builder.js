import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, get, set, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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
const auth = getAuth(app);

let currentUser = null;
let editingTestId = null;
let questionCounter = 0;

document.addEventListener("DOMContentLoaded", () => {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            initBuilder();
        } else {
            window.location.href = "/auth.html";
        }
    });
});

function initBuilder() {
    extractEditingTestIdFromUrl();
    bindMainActionButtons();
}

function extractEditingTestIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    editingTestId = urlParams.get("edit");

    if (!editingTestId) {
        editingTestId = "test_" + Date.now();
    } else {
        loadExistingTestDataForEditing(editingTestId);
    }
}

async function loadExistingTestDataForEditing(testId) {
    try {
        const testRef = ref(database, `teachers_data/${currentUser.uid}/tests/${testId}`);
        const snapshot = await get(testRef);
        if (snapshot.exists()) {
            const testData = snapshot.val();
            populateBuilderFormWithData(testData);
        }
    } catch (err) {
        console.error("Тестти жүктөөдө ката:", err);
    }
}

function bindMainActionButtons() {
    // 1. Артка баскычы
    const btnBack = document.getElementById("btnBackToDashboard");
    if (btnBack) {
        btnBack.onclick = () => window.location.href = "/sections/tests.html";
    }

    // 2. Жарыялоо
    const publishBtn = document.getElementById("btnPublishTest");
    if (publishBtn) {
        publishBtn.onclick = () => saveTestToFirebaseDatabase("active");
    }

    // 3. Черновик
    const draftBtn = document.getElementById("btnSaveDraft");
    if (draftBtn) {
        draftBtn.onclick = () => saveTestToFirebaseDatabase("draft");
    }

    // 4. Суроо кошуу
    const addQBtn = document.getElementById("btnQuickAddQuestion");
    if (addQBtn) {
        addQBtn.onclick = () => addNewQuestionBlock();
    }

    // 5. Көрүү (Preview)
    const previewBtn = document.getElementById("btnPreviewTest");
    if (previewBtn) {
        previewBtn.onclick = () => {
            alert("Тестти көрүү режими: Азырынча черновик катары сактап, окуучунун шилтемеси аркылуу текшерсеңиз болот.");
        };
    }

    // 6. JSON Экспорт
    const exportBtn = document.getElementById("btnExportTestJSON");
    if (exportBtn) {
        exportBtn.onclick = () => exportTestToJSON();
    }
}

// Суроо блогун динамикалык түзүү
function addNewQuestionBlock(qData = null) {
    const container = document.getElementById("questionsListWrapper");
    if (!container) return;

    questionCounter++;
    const qId = `q_${questionCounter}`;

    const card = document.createElement("div");
    card.className = "builder-card question-node";
    card.setAttribute("data-q-id", qId);

    const qText = qData ? qData.text : "";
    const qPoints = qData ? (qData.points || 5) : 5;
    const options = qData && qData.options ? qData.options : ["", "", "", ""];
    const correctIdx = qData ? (qData.correctOptionIndex || 0) : 0;

    card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <h4 style="margin:0; color: var(--primary);">Суроо #${questionCounter}</h4>
            <button class="btn btn-outline btn-remove-q" style="padding: 4px 10px; border-color: var(--danger); color: var(--danger);">
                <i class="fas fa-trash"></i> Өчүрүү
            </button>
        </div>
        <div class="editor-form-group">
            <label>Суроонун тексти</label>
            <input type="text" class="form-control q-text-input" value="${qText}" placeholder="Суроону жазыңыз...">
        </div>
        <div class="editor-form-group" style="width: 150px;">
            <label>Упай</label>
            <input type="number" class="form-control q-points-input" value="${qPoints}">
        </div>
        <div class="options-wrapper" style="margin-top: 15px;">
            <label style="display:block; font-size: 13px; color: var(--text-muted); margin-bottom: 8px;">
                Жооп варианттары (Туура жоопту радио-баскыч менен белгилеңиз):
            </label>
            <div class="options-list" style="display: flex; flex-direction: column; gap: 10px;">
                ${options.map((opt, idx) => `
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <input type="radio" name="radio_${qId}" class="q-radio" ${idx === correctIdx ? "checked" : ""}>
                        <input type="text" class="form-control q-opt-input" value="${opt}" placeholder="Вариант ${idx + 1}">
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    container.appendChild(card);

    // Өчүрүү окуясы
    card.querySelector(".btn-remove-q").onclick = () => {
        card.remove();
        updateQuestionNumbers();
    };
}

function updateQuestionNumbers() {
    const nodes = document.querySelectorAll(".question-node");
    nodes.forEach((node, index) => {
        const h4 = node.querySelector("h4");
        if (h4) h4.innerText = `Суроо #${index + 1}`;
    });
}

function collectTestPayloadDataFromUI() {
    const questionsList = [];
    const questionNodes = document.querySelectorAll(".question-node");

    questionNodes.forEach((qNode) => {
        const textInput = qNode.querySelector(".q-text-input");
        const pointsInput = qNode.querySelector(".q-points-input");
        const optInputs = qNode.querySelectorAll(".q-opt-input");
        const radios = qNode.querySelectorAll(".q-radio");

        const qText = textInput ? textInput.value.trim() : "";
        if (!qText) return;

        const options = [];
        let correctIdx = 0;

        optInputs.forEach((optInp, idx) => {
            const val = optInp.value.trim();
            if (val) options.push(val);
        });

        radios.forEach((r, idx) => {
            if (r.checked) correctIdx = idx;
        });

        questionsList.push({
            text: qText,
            options: options.length > 0 ? options : ["Вариант A", "Вариант B"],
            correctOptionIndex: correctIdx,
            points: pointsInput ? (parseInt(pointsInput.value) || 5) : 5,
            type: "single"
        });
    });

    const getVal = (id) => {
        const el = document.getElementById(id);
        return el ? el.value.trim() : "";
    };

    const getChk = (id) => {
        const el = document.getElementById(id);
        return el ? el.checked : false;
    };

    return {
        id: editingTestId,
        title: getVal("txtTestTitle") || "Аталышсыз тест",
        subject: getVal("selTestSubject") || "Жалпы",
        classGroup: getVal("txtTestClass") || "",
        topic: getVal("txtTestTopic") || "",
        academicYear: getVal("txtAcademicYear") || "",
        startTime: getVal("txtStartTime") || "",
        endTime: getVal("txtEndTime") || "",
        duration: parseInt(getVal("numDuration")) || 45,
        attempts: getVal("selAttempts") || "1",
        description: getVal("txtDescription") || "",
        
        gradingSystem: getVal("selGradingSystem") || "5",
        passingScore: parseInt(getVal("numPassingScore")) || 60,

        settings: {
            shuffleQuestions: getChk("chkShuffleQuestions"),
            shuffleOptions: getChk("chkShuffleOptions"),
            preventCopy: getChk("chkPreventCopy"),
            preventPaste: getChk("chkPreventPaste"),
            blockRightClick: getChk("chkBlockRightClick"),
            windowSwitchTrack: getChk("chkWindowSwitchTrack"),
            requireFullscreen: getChk("chkRequireFullscreen"),
            instantResults: getChk("chkInstantResults"),
            showCorrectAnswers: getChk("chkShowCorrectAnswers"),
            password: getVal("txtTestPassword") || ""
        },

        questions: questionsList,
        updatedAt: Date.now(),
        createdAt: Date.now(),
        teacherUid: currentUser.uid,
        status: "active"
    };
}

async function saveTestToFirebaseDatabase(statusType) {
    if (!currentUser) return;

    const payload = collectTestPayloadDataFromUI();
    payload.status = statusType;

    const autoSaveStatus = document.getElementById("autosaveStatus");
    if (autoSaveStatus) autoSaveStatus.innerHTML = `<i class="fas fa-spinner fa-spin" style="color:var(--warning)"></i> Сакталууда...`;

    try {
        const updates = {};
        updates[`teachers_data/${currentUser.uid}/tests/${editingTestId}`] = payload;
        updates[`global_test_lookup/${editingTestId}`] = {
            teacherUid: currentUser.uid,
            title: payload.title,
            subject: payload.subject,
            status: payload.status
        };

        await update(ref(database), updates);

        if (autoSaveStatus) {
            autoSaveStatus.innerHTML = `<i class="fas fa-check-circle" style="color: var(--success);"></i> <span>Сакталды</span>`;
        }

        alert(statusType === "active" ? "Тест ийгиликтүү жарыяланды!" : "Черновик катары сакталды!");
    } catch (error) {
        console.error("Firebase сактоо катасы:", error);
        alert("Сактоодо ката кетти. Интернетти же уруксаттарды текшериңиз.");
    }
}

function populateBuilderFormWithData(data) {
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el && val !== undefined) el.value = val;
    };
    const setChk = (id, val) => {
        const el = document.getElementById(id);
        if (el && val !== undefined) el.checked = !!val;
    };

    setVal("txtTestTitle", data.title);
    setVal("selTestSubject", data.subject);
    setVal("txtTestClass", data.classGroup);
    setVal("txtTestTopic", data.topic);
    setVal("txtAcademicYear", data.academicYear);
    setVal("txtStartTime", data.startTime);
    setVal("txtEndTime", data.endTime);
    setVal("numDuration", data.duration);
    setVal("selAttempts", data.attempts);
    setVal("txtDescription", data.description);

    setVal("selGradingSystem", data.gradingSystem);
    setVal("numPassingScore", data.passingScore);

    if (data.settings) {
        setChk("chkShuffleQuestions", data.settings.shuffleQuestions);
        setChk("chkShuffleOptions", data.settings.shuffleOptions);
        setChk("chkPreventCopy", data.settings.preventCopy);
        setChk("chkPreventPaste", data.settings.preventPaste);
        setChk("chkBlockRightClick", data.settings.blockRightClick);
        setChk("chkWindowSwitchTrack", data.settings.windowSwitchTrack);
        setChk("chkRequireFullscreen", data.settings.requireFullscreen);
        setChk("chkInstantResults", data.settings.instantResults);
        setChk("chkShowCorrectAnswers", data.settings.showCorrectAnswers);
        setVal("txtTestPassword", data.settings.password);
    }

    const container = document.getElementById("questionsListWrapper");
    if (container) container.innerHTML = "";
    questionCounter = 0;

    if (data.questions && Array.isArray(data.questions)) {
        data.questions.forEach(q => addNewQuestionBlock(q));
    }
}

function exportTestToJSON() {
    const payload = collectTestPayloadDataFromUI();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${payload.title || 'test'}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}
