import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, push, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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
const teacherId = "demo_teacher_001";

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
    determineActiveTest();
    setupCoreUiListeners();
    buildTypeGrid();
});

function determineActiveTest() {
    const params = new URLSearchParams(window.location.search);
    const editId = params.get("edit");
    if(editId) {
        activeTestId = editId;
        loadTestFromDb(editId);
    } else {
        activeTestId = "builder_draft_" + Date.now();
        loadLocalBackupIfAny();
    }
}

function loadTestFromDb(id) {
    onValue(ref(database, `teachers/${teacherId}/tests/${id}`), (snap) => {
        const test = snap.val();
        if(test) {
            document.getElementById("txtTestTitle").value = test.title || "";
            document.getElementById("selTestSubject").value = test.subject || "physics";
            document.getElementById("txtTestClass").value = test.classGroup || "";
            document.getElementById("txtTestTopic").value = test.topic || "";
            document.getElementById("numDuration").value = test.duration || 45;
            document.getElementById("txtDescription").value = test.description || "";
            
            testQuestions = test.questions ? Object.keys(test.questions).map(k => test.questions[k]) : [];
            renderQuestionsList();
        }
    });
}

function loadLocalBackupIfAny() {
    const backup = localStorage.getItem(`bilimal_builder_backup_${activeTestId}`);
    if(backup) {
        try {
            const parsed = JSON.parse(backup);
            if(parsed) {
                testQuestions = parsed.questions || [];
                renderQuestionsList();
            }
        } catch(e){}
    }
}

function buildTypeGrid() {
    const grid = document.getElementById("qTypeGrid");
    grid.innerHTML = "";
    QUESTION_TYPES.forEach(q => {
        const div = document.createElement("div");
        div.className = "type-card";
        div.innerHTML = `<h5>${q.name}</h5><p>${q.desc}</p>`;
        div.addEventListener("click", () => {
            addNewQuestionNode(q.type);
            document.getElementById("qTypeModal").style.display = "none";
        });
        grid.appendChild(div);
    });
}

function setupCoreUiListeners() {
    document.getElementById("navDashboard").addEventListener("click", () => window.location.href = "/sections/tests.html");
    document.getElementById("navTestBuilder").addEventListener("click", () => window.location.href = "/sections/test-builder.html");
    document.getElementById("navResults").addEventListener("click", () => window.location.href = "/sections/test-results.html");
    document.getElementById("btnBackToDashboard").addEventListener("click", () => window.location.href = "/sections/tests.html");

    const modal = document.getElementById("qTypeModal");
    document.getElementById("btnQuickAddQuestion").addEventListener("click", () => modal.style.display = "block");
    document.getElementById("btnCloseTypeModal").addEventListener("click", () => modal.style.display = "none");

    document.getElementById("btnSaveDraft").addEventListener("click", () => saveTestToFirebase("draft"));
    document.getElementById("btnPublishTest").addEventListener("click", () => saveTestToFirebase("active"));
    
    document.getElementById("btnExportTestJSON").addEventListener("click", () => {
        const payload = assemblePayload("draft");
        const blob = new Blob([JSON.stringify(payload, null, 2)], {type: 'application/json'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `Test_Schema_${payload.title || 'Untitled'}.json`;
        a.click();
    });

    document.getElementById("btnPreviewTest").addEventListener("click", () => {
        alert("Тестти алдын ала көрүү режими: \n" + JSON.stringify(assemblePayload("draft"), null, 2));
    });
}

function addNewQuestionNode(type) {
    testQuestions.push({
        id: "q_" + Date.now() + "_" + Math.floor(Math.random()*1000),
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
                <button class="rich-btn" onclick="document.execCommand('bold')"><b>B</b></button>
                <button class="rich-btn" onclick="document.execCommand('italic')"><i>I</i></button>
                <button class="rich-btn" onclick="document.execCommand('underline')"><u>U</u></button>
                <button class="rich-btn"><i class="fas fa-square-root-alt"></i> Формула</button>
                <button class="rich-btn"><i class="fas fa-table"></i> Таблица</button>
            </div>
            <div class="editor-form-group">
                <input type="text" class="q-text-input" data-idx="${idx}" value="${q.text}" placeholder="Суроонун текстин ушул жерге жазыңыз...">
            </div>
            <div class="options-list" id="options_box_${idx}"></div>
            <div class="dropzone">Сүрөт кошуу үчүн файлды бул жерге таштаңыз же шилтеме киргизиңиз</div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:10px;">
                <div class="editor-form-group"><label>Упай</label><input type="number" class="q-points" data-idx="${idx}" value="${q.points}"></div>
                <div class="editor-form-group"><label>Түшүндүрмө</label><input type="text" class="q-exp" data-idx="${idx}" value="${q.explanation || ''}" placeholder="Туура жооптун түшүндүрмөсү"></div>
            </div>
        `;
        container.appendChild(div);

        const optionsBox = div.querySelector(`#options_box_${idx}`);
        if(["single", "multiple", "truefalse"].includes(q.type)) {
            q.options.forEach((opt, oIdx) => {
                const optDiv = document.createElement("div");
                optDiv.className = "option-item";
                optDiv.innerHTML = `
                    <input type="${q.type === 'multiple'?'checkbox':'radio'}" name="correct_${idx}" ${q.correctOptionIndex === oIdx ? 'checked':''} data-qidx="${idx}" data-oidx="${oIdx}" class="q-opt-check">
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
        if(idx > 0) {
            const temp = testQuestions[idx];
            testQuestions[idx] = testQuestions[idx-1];
            testQuestions[idx-1] = temp;
            renderQuestionsList();
            triggerAutoSave();
        }
    }));

    document.querySelectorAll(".move-down").forEach(btn => btn.addEventListener("click", (e) => {
        const idx = parseInt(e.currentTarget.getAttribute("data-idx"));
        if(idx < testQuestions.length - 1) {
            const temp = testQuestions[idx];
            testQuestions[idx] = testQuestions[idx+1];
            testQuestions[idx+1] = temp;
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
        title: document.getElementById("txtTestTitle").value || "Аталышсыз тест",
        subject: document.getElementById("selTestSubject").value,
        classGroup: document.getElementById("txtTestClass").value,
        topic: document.getElementById("txtTestTopic").value,
        duration: parseInt(document.getElementById("numDuration").value) || 45,
        description: document.getElementById("txtDescription").value,
        gradingSystem: document.getElementById("selGradingSystem").value,
        passingScore: parseInt(document.getElementById("numPassingScore").value) || 60,
        status: status,
        createdAt: new Date().toISOString(),
        questions: qMap,
        security: {
            preventCopy: document.getElementById("chkPreventCopy").checked,
            preventPaste: document.getElementById("chkPreventPaste").checked,
            windowSwitchTrack: document.getElementById("chkWindowSwitchTrack").checked
        }
    };
}

function triggerAutoSave() {
    const statusText = document.getElementById("autosaveStatus").querySelector("span");
    statusText.textContent = "Сакталууда...";
    const payload = assemblePayload("draft");
    localStorage.setItem(`bilimal_builder_backup_${activeTestId}`, JSON.stringify(payload));
    setTimeout(() => { statusText.textContent = "Локалдык сакталды"; }, 500);
}

function saveTestToFirebase(status) {
    const payload = assemblePayload(status);
    set(ref(database, `teachers/${teacherId}/tests/${activeTestId}`), payload)
        .then(() => {
            alert("Тест ийгиликтүү базага сакталды!");
            window.location.href = "/sections/tests.html";
        })
        .catch(() => alert("Базага туташууда ката кетти. Локалдык сактагыч иштеп жатат."));
}
