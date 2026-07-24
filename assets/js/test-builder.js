import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, set, get, child } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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
    { type: "short_ans", name: "Кыска жооп", desc: "Бир же бир нече сөздөн турган жооп" },
    { type: "essay", name: "Узун эссе жооп", desc: "Мугалим өзү текшерүүчү эркин текст" }
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

function normalizeQuestions(rawQuestions) {
    if (!rawQuestions) return [];
    if (Array.isArray(rawQuestions)) {
        return rawQuestions.filter(q => q !== null && q !== undefined);
    }
    if (typeof rawQuestions === "object") {
        return Object.keys(rawQuestions).map(key => rawQuestions[key]).filter(q => q !== null && q !== undefined);
    }
    return [];
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
            
            const extractedQuestions = normalizeQuestions(test.questions);
            if (extractedQuestions.length > 0) {
                testQuestions = extractedQuestions;
            } else {
                loadLocalBackupIfAny();
            }
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
            if (parsed && parsed.questions) {
                testQuestions = normalizeQuestions(parsed.questions);
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
        div.style.cssText = "padding:10px; border:1px solid rgba(255,255,255,0.1); border-radius:8px; cursor:pointer; margin-bottom:8px;";
        div.innerHTML = `<h5 style="margin:0; color:#00f2fe;">${q.name}</h5><p style="margin:4px 0 0; font-size:12px; color:#aaa;">${q.desc}</p>`;
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
    const newQ = {
        id: "q_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
        type: type || "single",
        text: "",
        points: 5,
        required: true,
        options: type === "truefalse" ? ["Туура", "Туура эмес"] : ["А варианты", "Б варианты", "В варианты", "Г варианты"],
        correctOptionIndex: 0,
        correctOptionIndices: [0], // Multiple тандалган учурлар үчүн
        explanation: ""
    };
    testQuestions.push(newQ);
    renderQuestionsList();
    triggerAutoSave();
}

function renderQuestionsList() {
    const container = document.getElementById("questionsListWrapper");
    if (!container) return;
    container.innerHTML = "";

    if (testQuestions.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding: 40px; color: #888;">
            <i class="fas fa-folder-open" style="font-size: 40px; margin-bottom: 10px;"></i>
            <p>Азырынча суроолор кошула элек. Төмөнкү баскычты басып суроо кошуңуз.</p>
        </div>`;
        return;
    }

    testQuestions.forEach((q, idx) => {
        const typeName = q.type ? q.type.toUpperCase() : "SINGLE";
        const div = document.createElement("div");
        div.className = "question-node";
        div.style.cssText = "background: rgba(255, 255, 255, 0.05); padding: 15px; margin-bottom: 15px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);";
        
        div.innerHTML = `
            <div class="question-node-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <strong>Суроо №${idx + 1} <span style="color:#00f2fe;">[${typeName}]</span></strong>
                <div class="question-node-controls">
                    <button class="node-btn move-up" data-idx="${idx}"><i class="fas fa-arrow-up"></i></button>
                    <button class="node-btn move-down" data-idx="${idx}"><i class="fas fa-arrow-down"></i></button>
                    <button class="node-btn del" data-idx="${idx}" style="color:#ff4757;"><i class="fas fa-trash"></i> Өчүрүү</button>
                </div>
            </div>
            <div class="editor-form-group" style="margin-bottom:10px;">
                <input type="text" class="q-text-input" data-idx="${idx}" value="${q.text || ''}" placeholder="Суроонун текстин ушул жерге жазыңыз..." style="width:100%; padding:8px; border-radius:4px; border:1px solid #444; background:#222; color:#fff;">
            </div>
            <div class="options-list" id="options_box_${idx}" style="margin-bottom:10px;"></div>
            ${["single", "multiple"].includes(q.type) ? `<button type="button" class="add-opt-btn" data-idx="${idx}" style="font-size:12px; padding:4px 8px; margin-bottom:10px;">+ Вариант кошуу</button>` : ''}
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:10px;">
                <div class="editor-form-group"><label style="font-size:12px;">Упай:</label> <input type="number" class="q-points" data-idx="${idx}" value="${q.points || 5}" style="width:100%; padding:5px; background:#222; color:#fff; border:1px solid #444;"></div>
                <div class="editor-form-group"><label style="font-size:12px;">Түшүндүрмө:</label> <input type="text" class="q-exp" data-idx="${idx}" value="${q.explanation || ''}" placeholder="Туура жооптун түшүндүрмөсү" style="width:100%; padding:5px; background:#222; color:#fff; border:1px solid #444;"></div>
            </div>
        `;
        container.appendChild(div);

        const optionsBox = div.querySelector(`#options_box_${idx}`);
        const opts = q.options || [];

        if (optionsBox && ["single", "multiple", "truefalse"].includes(q.type || "single")) {
            opts.forEach((opt, oIdx) => {
                const isChecked = q.type === 'multiple' 
                    ? (q.correctOptionIndices && q.correctOptionIndices.includes(oIdx))
                    : q.correctOptionIndex === oIdx;

                const optDiv = document.createElement("div");
                optDiv.className = "option-item";
                optDiv.style.cssText = "display:flex; align-items:center; gap:8px; margin-bottom:5px;";
                optDiv.innerHTML = `
                    <input type="${q.type === 'multiple' ? 'checkbox' : 'radio'}" name="correct_${idx}" ${isChecked ? 'checked' : ''} data-qidx="${idx}" data-oidx="${oIdx}" class="q-opt-check">
                    <input type="text" value="${opt || ''}" data-qidx="${idx}" data-oidx="${oIdx}" class="q-opt-text" style="flex:1; background:none; border:none; border-bottom:1px solid rgba(255,255,255,0.2); color:#fff; padding:4px;">
                    ${opts.length > 2 && q.type !== 'truefalse' ? `<button type="button" class="del-opt-btn" data-qidx="${idx}" data-oidx="${oIdx}" style="color:#ff4757; background:none; border:none; cursor:pointer;">&times;</button>` : ''}
                `;
                optionsBox.appendChild(optDiv);
            });
        }
    });

    bindNodesEvents();
}

function bindNodesEvents() {
    document.querySelectorAll(".q-text-input").forEach(input => input.addEventListener("input", (e) => {
        const idx = e.target.getAttribute("data-idx");
        if(testQuestions[idx]) testQuestions[idx].text = e.target.value;
        triggerAutoSave();
    }));

    document.querySelectorAll(".q-points").forEach(input => input.addEventListener("input", (e) => {
        const idx = e.target.getAttribute("data-idx");
        if(testQuestions[idx]) testQuestions[idx].points = parseInt(e.target.value) || 0;
        triggerAutoSave();
    }));

    document.querySelectorAll(".q-exp").forEach(input => input.addEventListener("input", (e) => {
        const idx = e.target.getAttribute("data-idx");
        if(testQuestions[idx]) testQuestions[idx].explanation = e.target.value;
        triggerAutoSave();
    }));

    document.querySelectorAll(".q-opt-text").forEach(input => input.addEventListener("input", (e) => {
        const qidx = e.target.getAttribute("data-qidx");
        const oidx = e.target.getAttribute("data-oidx");
        if(testQuestions[qidx] && testQuestions[qidx].options) {
            testQuestions[qidx].options[oidx] = e.target.value;
        }
        triggerAutoSave();
    }));

    document.querySelectorAll(".q-opt-check").forEach(elem => elem.addEventListener("change", (e) => {
        const qidx = e.target.getAttribute("data-qidx");
        const oidx = parseInt(e.target.getAttribute("data-oidx"));
        const q = testQuestions[qidx];
        if(!q) return;

        if (q.type === 'multiple') {
            if (!q.correctOptionIndices) q.correctOptionIndices = [];
            if (e.target.checked) {
                if (!q.correctOptionIndices.includes(oidx)) q.correctOptionIndices.push(oidx);
            } else {
                q.correctOptionIndices = q.correctOptionIndices.filter(i => i !== oidx);
            }
        } else {
            q.correctOptionIndex = oidx;
        }
        triggerAutoSave();
    }));

    // Вариант кошуу
    document.querySelectorAll(".add-opt-btn").forEach(btn => btn.addEventListener("click", (e) => {
        const idx = e.target.getAttribute("data-idx");
        if(testQuestions[idx]) {
            testQuestions[idx].options.push(`Жаңы вариант ${testQuestions[idx].options.length + 1}`);
            renderQuestionsList();
            triggerAutoSave();
        }
    }));

    // Вариант өчүрүү
    document.querySelectorAll(".del-opt-btn").forEach(btn => btn.addEventListener("click", (e) => {
        const qidx = e.target.getAttribute("data-qidx");
        const oidx = parseInt(e.target.getAttribute("data-oidx"));
        if(testQuestions[qidx] && testQuestions[qidx].options) {
            testQuestions[qidx].options.splice(oidx, 1);
            renderQuestionsList();
            triggerAutoSave();
        }
    }));

    // Өйдө/ылдый жылдыруу
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

    // Суроону өчүрүү
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
    let finalTestId = activeTestId;
    if (status === "active" && activeTestId.startsWith("builder_draft_")) {
        finalTestId = "test_" + Date.now();
    }

    const payload = assemblePayload(status);
    payload.id = finalTestId;

    try {
        // 1. Мугалимдин базасына сактоо
        const teacherTestRef = ref(database, `teachers_data/${teacherId}/tests/${finalTestId}`);
        await set(teacherTestRef, payload);

        // 2. Глобалдык издөө реестрине сактоо
        const globalLookupRef = ref(database, `global_test_lookup/${finalTestId}`);
        await set(globalLookupRef, { teacherUid: teacherId });

        try {
            localStorage.removeItem(`bilimal_builder_backup_${activeTestId}`);
        } catch (e) {}

        if (status === "active") {
            const shareUrl = `${window.location.origin}/student-test.html?teacher=${teacherId}&test=${finalTestId}`;
            alert("Тест ийгиликтүү жарыяланды!\nОкуучулар үчүн шилтеме: " + shareUrl);
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
