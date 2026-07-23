import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, set, push, onValue, get, child } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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

let teacherId = "demo_teacher_001";
let activeTestId = null;
let testQuestions = [];

const QUESTION_TYPES = [
    { type: "single", name: "Бир туура жооп", desc: "Классикалык радио баскычтуу тест" },
    { type: "multiple", name: "Бир нече туура жооп", desc: "Чекбокстор менен көптөгөн тандоо" },
    { type: "truefalse", name: "Туура / Туура эмес", desc: "Ооба же жок форматы" },
    { type: "fillblank", name: "Бош жерди толтур", desc: "Тексттин ичиндеги боштуктарды жазуу" },
    { type: "ordering", name: "Сөздөрдү иретке келтир", desc: "Логикалык туура ырааттуулук" },
    { type: "matching", name: "Жупташтыруу", desc: "А жана Б мамычаларын дал келтирүү" },
    { type: "image_q", name: "Сүрөт боюнча суроо", desc: "Графикалык медиа суроолору" },
    { type: "audio_q", name: "Аудио боюнча суроо", desc: "Угуу аркылуу түшүнүү тести" },
    { type: "video_q", name: "Видео боюнча суроо", desc: "Видео шилтемелерди талдоо" },
    { type: "table_q", name: "Таблица менен суроо", desc: "Маалыматтар матрицасын изилдөө" },
    { type: "formula", name: "Формула менен суроо", desc: "LaTeX же математикалык туюнтма" },
    { type: "short_ans", name: "Кыска жооп", desc: "Бир же бир нече сөздөн турган жооп" },
    { type: "essay", name: "Узун эссе жооп", desc: "Мугалим өзү текшерүүчү эркин текст" },
    { type: "numeric", name: "Сандык жооп", desc: "Так сандык жыйынтыкты киргизүү" },
    { type: "chart_q", name: "Диаграмма/график боюнча суроо", desc: "Статистикалык анализ суроолору" },
    { type: "dragdrop", name: "Drag and Drop суроо", desc: "Элементтерди ташып жайгаштыруу" },
    { type: "text_select", name: "Тексттен туура сөздү тандоо", desc: "Контексттик менюдан издөө" },
    { type: "code", name: "Код жазуу суроосу", desc: "Программалоо тапшырмалары" },
    { type: "lab", name: "Лабораториялык иш", desc: "Эксперименталдык виртуалдык суроо" },
    { type: "ai_gen", name: "AI автоматтык суроосу", desc: "Интеллектуалдык жасалма кошумча" }
];

document.addEventListener("DOMContentLoaded", () => {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            teacherId = user.uid;
        } else {
            try {
                teacherId = localStorage.getItem("bilimal_teacher_uid") || "demo_teacher_001";
            } catch(e) {
                teacherId = "demo_teacher_001";
            }
        }
        determineActiveTest();
    });

    setupCoreUiListeners();
    buildTypeGrid();
});

function determineActiveTest() {
    const params = new URLSearchParams(window.location.search);
    const editId = params.get("edit");
    if (editId) {
        activeTestId = editId;
        loadTestFromDb(editId);
    } else {
        activeTestId = "builder_draft_" + Date.now();
        loadLocalBackupIfAny();
    }
}

async function loadTestFromDb(id) {
    try {
        const dbRef = ref(database);
        let snap = await get(child(dbRef, `teachers_data/${teacherId}/tests/${id}`));
        
        if (!snap.exists()) {
            snap = await get(child(dbRef, `teachers_data/demo_teacher_001/tests/${id}`));
        }

        if (snap.exists()) {
            const test = snap.val();
            setInputValue("txtTestTitle", test.title || "");
            setInputValue("selTestSubject", test.subject || "physics");
            setInputValue("txtTestClass", test.classGroup || "");
            setInputValue("txtTestTopic", test.topic || "");
            setInputValue("numDuration", test.duration || 45);
            setInputValue("txtDescription", test.description || "");
            
            testQuestions = test.questions ? Object.keys(test.questions).map(k => test.questions[k]) : [];
            renderQuestionsList();
        } else {
            loadLocalBackupIfAny();
        }
    } catch(err) {
        console.error("Базадан жүктөөдө ката:", err);
        loadLocalBackupIfAny();
    }
}

function loadLocalBackupIfAny() {
    try {
        const backup = localStorage.getItem(`bilimal_builder_backup_${activeTestId}`);
        if (backup) {
            const parsed = JSON.parse(backup);
            if (parsed) {
                testQuestions = parsed.questions ? Object.keys(parsed.questions).map(k => parsed.questions[k]) : [];
                renderQuestionsList();
            }
        }
    } catch (e) {
        console.warn("Storage чектөөсү:", e);
    }
}

function buildTypeGrid() {
    const grid = document.getElementById("qTypeGrid");
    if (!grid) return;
    grid.innerHTML = "";
    QUESTION_TYPES.forEach(q => {
        const div = document.createElement("div");
        div.className = "type-card";
        div.innerHTML = `<h5>${q.name}</h5><p>${q.desc}</p>`;
        div.addEventListener("click", () => {
            addNewQuestionNode(q.type);
            const modal = document.getElementById("qTypeModal");
            if (modal) modal.style.display = "none";
        });
        grid.appendChild(div);
    });
}

function setupCoreUiListeners() {
    bindClick("navDashboard", () => window.location.href = "/sections/tests.html");
    bindClick("navTestBuilder", () => window.location.href = "/sections/test-builder.html");
    bindClick("navResults", () => window.location.href = "/sections/test-results.html");
    bindClick("btnBackToDashboard", () => window.location.href = "/sections/tests.html");

    const modal = document.getElementById("qTypeModal");
    bindClick("btnQuickAddQuestion", () => { if (modal) modal.style.display = "block"; });
    bindClick("btnCloseTypeModal", () => { if (modal) modal.style.display = "none"; });

    // Саат/Жарыялоо Баскычтары (Коопсуз иштетүү)
    bindClick("btnSaveDraft", (e) => {
        if(e) e.preventDefault();
        saveTestToFirebase("draft");
    });
    
    bindClick("btnPublishTest", (e) => {
        if(e) e.preventDefault();
        saveTestToFirebase("active");
    });
    
    bindClick("btnExportTestJSON", () => {
        const payload = assemblePayload("draft");
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `Test_Schema_${payload.title || 'Untitled'}.json`;
        a.click();
    });

    bindClick("btnPreviewTest", () => {
        alert("Тестти алдын ала көрүү режими: \n" + JSON.stringify(assemblePayload("draft"), null, 2));
    });
}

function bindClick(id, handler) {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", handler);
}

function setInputValue(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
}

function getInputValue(id) {
    const el = document.getElementById(id);
    return el ? el.value : "";
}

function getChkValue(id) {
    const el = document.getElementById(id);
    return el ? el.checked : false;
}

function addNewQuestionNode(type) {
    testQuestions.push({
        id: "q_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
        type: type,
        text: "",
        points: 5,
        required: true,
        options: ["А варианты", "Б варианты", "В варианты", "Г варианты"],
        correctOptionIndex: 0,
        explanation: ""
    });
    renderQuestionsList();
    triggerAutoSave();
}

function renderQuestionsList() {
    const container = document.getElementById("questionsListWrapper");
    if (!container) return;
    container.innerHTML = "";

    testQuestions.forEach((q, idx) => {
        const div = document.createElement("div");
        div.className = "question-node";
        div.innerHTML = `
            <div class="question-node-header">
                <strong>Суроо №${idx + 1} <span style="color:#00f2fe;">[${q.type.toUpperCase()}]</span></strong>
                <div class="question-node-controls">
                    <button class="node-btn move-up" data-idx="${idx}"><i class="fas fa-arrow-up"></i></button>
                    <button class="node-btn move-down" data-idx="${idx}"><i class="fas fa-arrow-down"></i></button>
                    <button class="node-btn del" data-idx="${idx}"><i class="fas fa-trash"></i> Өчүрүү</button>
                </div>
            </div>
            <div class="rich-toolbar">
                <button class="rich-btn" type="button" onclick="document.execCommand('bold')"><b>B</b></button>
                <button class="rich-btn" type="button" onclick="document.execCommand('italic')"><i>I</i></button>
                <button class="rich-btn" type="button" onclick="document.execCommand('underline')"><u>U</u></button>
            </div>
            <div class="editor-form-group">
                <input type="text" class="q-text-input" data-idx="${idx}" value="${q.text || ''}" placeholder="Суроонун текстин ушул жерге жазыңыз...">
            </div>
            <div class="options-list" id="options_box_${idx}"></div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:10px;">
                <div class="editor-form-group"><label>Упай</label><input type="number" class="q-points" data-idx="${idx}" value="${q.points || 5}"></div>
                <div class="editor-form-group"><label>Түшүндүрмө</label><input type="text" class="q-exp" data-idx="${idx}" value="${q.explanation || ''}" placeholder="Туура жооптун түшүндүрмөсү"></div>
            </div>
        `;
        container.appendChild(div);

        const optionsBox = div.querySelector(`#options_box_${idx}`);
        if (optionsBox && ["single", "multiple", "truefalse"].includes(q.type) && q.options) {
            q.options.forEach((opt, oIdx) => {
                const optDiv = document.createElement("div");
                optDiv.className = "option-item";
                optDiv.innerHTML = `
                    <input type="${q.type === 'multiple' ? 'checkbox' : 'radio'}" name="correct_${idx}" ${q.correctOptionIndex === oIdx ? 'checked' : ''} data-qidx="${idx}" data-oidx="${oIdx}" class="q-opt-check">
                    <input type="text" value="${opt}" data-qidx="${idx}" data-oidx="${oIdx}" class="q-opt-text" style="background:none; border-bottom:1px solid rgba(255,255,255,0.1); color:#fff;">
                `;
                optionsBox.appendChild(optDiv);
            });
        }
    });

    bindNodesEvents();
}

function bindNodesEvents() {
    document.querySelectorAll(".q-text-input").forEach(input => input.addEventListener("input", (e) => {
        testQuestions[e.target.getAttribute("data-idx")].text = e.target.value;
        triggerAutoSave();
    }));
    document.querySelectorAll(".q-points").forEach(input => input.addEventListener("input", (e) => {
        testQuestions[e.target.getAttribute("data-idx")].points = parseInt(e.target.value) || 0;
        triggerAutoSave();
    }));
    document.querySelectorAll(".q-exp").forEach(input => input.addEventListener("input", (e) => {
        testQuestions[e.target.getAttribute("data-idx")].explanation = e.target.value;
        triggerAutoSave();
    }));

    document.querySelectorAll(".q-opt-text").forEach(input => input.addEventListener("input", (e) => {
        const qidx = e.target.getAttribute("data-qidx");
        const oidx = e.target.getAttribute("data-oidx");
        testQuestions[qidx].options[oidx] = e.target.value;
        triggerAutoSave();
    }));

    document.querySelectorAll(".q-opt-check").forEach(radio => radio.addEventListener("change", (e) => {
        const qidx = e.target.getAttribute("data-qidx");
        const oidx = parseInt(e.target.getAttribute("data-oidx"));
        testQuestions[qidx].correctOptionIndex = oidx;
        triggerAutoSave();
    }));

    document.querySelectorAll(".move-up").forEach(btn => btn.addEventListener("click", (e) => {
        const idx = parseInt(e.currentTarget.getAttribute("data-idx"));
        if (idx > 0) {
            const temp = testQuestions[idx];
            testQuestions[idx] = testQuestions[idx - 1];
            testQuestions[idx - 1] = temp;
            renderQuestionsList();
            triggerAutoSave();
        }
    }));

    document.querySelectorAll(".move-down").forEach(btn => btn.addEventListener("click", (e) => {
        const idx = parseInt(e.currentTarget.getAttribute("data-idx"));
        if (idx < testQuestions.length - 1) {
            const temp = testQuestions[idx];
            testQuestions[idx] = testQuestions[idx + 1];
            testQuestions[idx + 1] = temp;
            renderQuestionsList();
            triggerAutoSave();
        }
    }));

    document.querySelectorAll(".question-node .del").forEach(btn => btn.addEventListener("click", (e) => {
        const idx = parseInt(e.currentTarget.getAttribute("data-idx"));
        testQuestions.splice(idx, 1);
        renderQuestionsList();
        triggerAutoSave();
    }));
}

function assemblePayload(status) {
    const qMap = {};
    testQuestions.forEach((q, i) => { qMap["q_" + i] = q; });

    return {
        id: activeTestId,
        teacherUid: teacherId,
        title: getInputValue("txtTestTitle") || "Аталышсыз тест",
        subject: getInputValue("selTestSubject") || "physics",
        classGroup: getInputValue("txtTestClass") || "",
        topic: getInputValue("txtTestTopic") || "",
        duration: parseInt(getInputValue("numDuration")) || 45,
        description: getInputValue("txtDescription") || "",
        gradingSystem: getInputValue("selGradingSystem") || "standard",
        passingScore: parseInt(getInputValue("numPassingScore")) || 60,
        status: status,
        createdAt: new Date().toISOString(),
        questions: qMap,
        security: {
            preventCopy: getChkValue("chkPreventCopy"),
            preventPaste: getChkValue("chkPreventPaste"),
            windowSwitchTrack: getChkValue("chkWindowSwitchTrack")
        }
    };
}

function triggerAutoSave() {
    const statusBox = document.getElementById("autosaveStatus");
    if (!statusBox) return;
    const statusText = statusBox.querySelector("span") || statusBox;
    statusText.textContent = "Сакталууда...";
    const payload = assemblePayload("draft");
    try {
        localStorage.setItem(`bilimal_builder_backup_${activeTestId}`, JSON.stringify(payload));
    } catch(e){}
    setTimeout(() => { statusText.textContent = "Локалдык сакталды"; }, 500);
}

async function saveTestToFirebase(status) {
    // 1. Тартиптүү ID түзүү (draft сөзүнөн арылуу)
    let finalTestId = activeTestId;
    if (status === "active" && activeTestId.startsWith("builder_draft_")) {
        finalTestId = "test_" + Date.now();
    }

    const payload = assemblePayload(status);
    payload.id = finalTestId;

    try {
        // 2. Базага сактоо
        const teacherTestRef = ref(database, `teachers_data/${teacherId}/tests/${finalTestId}`);
        await set(teacherTestRef, payload);

        // 3. Глобалдык lookup'ка каттоо (Окуучулар шилтеме аркылуу таба алуусу үчүн)
        const globalLookupRef = ref(database, `global_test_lookup/${finalTestId}`);
        await set(globalLookupRef, { teacherUid: teacherId });

        // 4. Убактылуу файлдарды тазалоо
        try {
            localStorage.removeItem(`bilimal_builder_backup_${activeTestId}`);
        } catch (e) {}

        if (status === "active") {
            const shareUrl = `https://bilimal.org/sections/take-test.html?id=${finalTestId}`;
            prompt("Тест ийгиликтүү жарыяланды! Окуучуларга жөнөтүлүүчү шилтеме:", shareUrl);
            window.location.href = "/sections/tests.html";
        } else {
            alert("Тест черновик катары сакталды!");
            window.location.href = "/sections/tests.html";
        }
    } catch (error) {
        console.error("Firebase сактоо катасы:", error);
        alert("Базага сактоодо ката кетти. Интернет байланышыңызды текшериңиз.");
    }
}
