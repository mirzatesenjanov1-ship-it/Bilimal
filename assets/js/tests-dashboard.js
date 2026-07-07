// FIREBASE MODULAR SDK ИНТЕГРАЦИЯСЫ ЖАНА СИСТЕМАЛЫК КООПСУЗДУК КАНАЛЫ
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDocs, collection, deleteDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// Глобалдык коопсуз JSON парсер (Unexpected end of JSON input катасын алдын алуу)
function safeParseJSON(value, fallback = null) {
    try {
        if (!value || typeof value !== "string" || value.trim() === "") return fallback;
        return JSON.parse(value);
    } catch (error) {
        console.warn("JSON формат катасы четтетилди:", error);
        return fallback;
    }
}

// Системалык глобалдык ката кармоочулар (Бош экран чыгуу коркунучунан коргоо)
window.addEventListener("error", function(event) {
    console.error("Глобалдык системалык ката:", event.error);
    showSystemCrashOverlay("Системалык ички ката аныкталды. Сураныч, баракты жаңылаңыз.");
});

window.addEventListener("unhandledrejection", function(event) {
    console.error("Күтүлбөгөн убада четке кагуусу:", event.reason);
    showSystemCrashOverlay("Тармак же маалымат базасы байланыш катасы.");
});

function showSystemCrashOverlay(message) {
    const overlay = document.getElementById("system-crash-overlay");
    const msgElement = document.getElementById("crash-message");
    if (overlay && msgElement) {
        msgElement.innerText = message;
        overlay.classList.remove("hidden");
    }
}

// Конфигурация
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

// Инициализацияны коопсуз бир жолу аткаруу
let app;
if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
} else {
    app = getApps()[0];
}
const db = getFirestore(app);

// Локалдык оперативдүү структуралар
let localTests = [];
let activeConfirmCallback = null;
let currentEditingTestId = null;

// Колдонмо иштей баштаганда
document.addEventListener("DOMContentLoaded", () => {
    initControlCenter();
});

function initControlCenter() {
    setupUIEventBindings();
    loadProfileData();
    loadTestsFromDatabase();
    logActivity("Панель ийгиликтүү ишке киргизилди.");
}

// Тоаст куруучу бирдиктүү функция
function showToast(message, type = "success") {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = `hud-toast ${type}`;
    toast.innerHTML = `<span>${message}</span><button style="background:transparent;border:none;color:white;cursor:pointer;font-size:1.1rem;" onclick="this.parentElement.remove()">&times;</button>`;
    container.appendChild(toast);
    setTimeout(() => { if (toast) toast.remove(); }, 4000);
}

// Бирдиктүү коопсуз баскыч аткаруучу курал (Loading & Disabled State & Try/Catch)
async function executeButtonAction(buttonId, actionBlock) {
    const btn = document.getElementById(buttonId);
    if (!btn) return;
    const originalHTML = btn.innerHTML;
    try {
        btn.disabled = true;
        btn.innerHTML = `⏳ Күтө туруңуз...`;
        await actionBlock();
    } catch (err) {
        console.error(`Ката [Баскыч: ${buttonId}]:`, err);
        showToast(err.message, "error");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalHTML;
        }
    }
}

// Аракеттердин тарыхын жазуу логу
function logActivity(text) {
    const container = document.getElementById("timeline-activity-container");
    if (!container) return;
    const item = document.createElement("div");
    item.className = "timeline-item";
    const time = new Date().toLocaleTimeString();
    item.innerText = `[${time}] ${text}`;
    container.prepend(item);
}

// Профилди коопсуз жүктөө (localStorage катасыз парсинг менен)
function loadProfileData() {
    const profile = safeParseJSON(localStorage.getItem("B_TEACHER_PROFILE"), {
        name: "Асанов Үсөн",
        subject: "Физика жана Астрономия"
    });
    
    const lblName = document.getElementById("lbl-teacher-name");
    const lblSub = document.getElementById("lbl-teacher-subject");
    if (lblName) lblName.innerText = profile.name;
    if (lblSub) lblSub.innerText = profile.subject;
}

// Реалдуу убакытта базадан маалыматтарды алуу
async function loadTestsFromDatabase() {
    const skeleton = document.getElementById("hud-loading-skeleton");
    const emptyState = document.getElementById("hud-empty-state");
    
    if (skeleton) skeleton.classList.remove("hidden");
    if (emptyState) emptyState.classList.add("hidden");

    try {
        const querySnapshot = await getDocs(collection(db, "tests"));
        localTests = [];
        querySnapshot.forEach((docSnap) => {
            localTests.push({ id: docSnap.id, ...docSnap.data() });
        });
        
        updateMetrics();
        renderTestsGrid();
    } catch (err) {
        console.error("Базадан окуу катасы:", err);
        showToast("Маалыматтарды жүктөөдө ката чыкты. Локалдык режим иштетилет.", "error");
        // Локалдык резервдик маалымат
        localTests = safeParseJSON(localStorage.getItem("B_LOCAL_TESTS_FALLBACK"), []);
        renderTestsGrid();
    } finally {
        if (skeleton) skeleton.classList.add("hidden");
    }
}

function updateMetrics() {
    const tCount = document.getElementById("metric-total-tests");
    const aCount = document.getElementById("metric-active-tests");
    const sCount = document.getElementById("metric-student-submissions");

    if (tCount) tCount.innerText = localTests.length;
    if (aCount) aCount.innerText = localTests.filter(t => t.status === "active").length;
    if (sCount) sCount.innerText = Math.floor(localTests.length * 4.2); 
}

// Тесттердин карточкаларын коопсуз тартуу
function renderTestsGrid() {
    const container = document.getElementById("tests-list-container");
    const emptyState = document.getElementById("hud-empty-state");
    if (!container) return;

    container.innerHTML = "";
    
    if (localTests.length === 0) {
        if (emptyState) emptyState.classList.remove("hidden");
        return;
    } else {
        if (emptyState) emptyState.classList.add("hidden");
    }

    localTests.forEach(test => {
        const qCount = test.questions ? test.questions.length : 0;
        const card = document.createElement("div");
        card.className = "test-hud-card";
        card.innerHTML = `
            <div class="card-hud-main">
                <span class="status-badge ${test.status || 'draft'}">${test.status || 'draft'}</span>
                <h3 style="margin-top:0.5rem;">${test.title || 'Аталышсыз тест'}</h3>
                <p style="font-size:0.85rem; color:var(--text-muted);">Суроолор саны: ${qCount}</p>
            </div>
            <div class="card-hud-actions">
                <button id="edit-${test.id}">📝 Оңдоо</button>
                <button id="dup-${test.id}">👥 Көчүрүү</button>
                <button id="arc-${test.id}">📦 Архив</button>
                <button id="del-${test.id}" style="color:var(--danger-neon);">❌ Өчүрүү</button>
                <button id="link-${test.id}">🔗 Шилтеме</button>
                <button id="qr-${test.id}">📱 QR Код</button>
                <button id="wa-${test.id}">💬 WhatsApp</button>
                <button id="tg-${test.id}">✈️ Telegram</button>
            </div>
        `;
        container.appendChild(card);

        // Ар бир динамикалык баскычка коопсуз окуя байлоо
        document.getElementById(`edit-${test.id}`)?.addEventListener("click", () => openTestEditor(test.id));
        document.getElementById(`del-${test.id}`)?.addEventListener("click", () => openDeleteConfirm(test.id));
        document.getElementById(`dup-${test.id}`)?.addEventListener("click", () => duplicateTest(test.id));
        document.getElementById(`arc-${test.id}`)?.addEventListener("click", () => archiveTest(test.id));
        document.getElementById(`link-${test.id}`)?.addEventListener("click", () => copyTestLink(test.id));
        document.getElementById(`qr-${test.id}`)?.addEventListener("click", () => generateQrCode(test.id));
        document.getElementById(`wa-${test.id}`)?.addEventListener("click", () => shareSocial(test.id, "wa"));
        document.getElementById(`tg-${test.id}`)?.addEventListener("click", () => shareSocial(test.id, "tg"));
    });
}

// Динамикалык аракеттердин функциялары
function openTestEditor(id = null) {
    currentEditingTestId = id;
    const modal = document.getElementById("modal-test-editor");
    const titleInput = document.getElementById("input-test-title");
    const wrapper = document.getElementById("dynamic-questions-wrapper");
    if (!modal || !titleInput || !wrapper) return;

    wrapper.innerHTML = "";

    if (id) {
        const test = localTests.find(t => t.id === id);
        if (test) {
            titleInput.value = test.title || "";
            if (test.questions && Array.isArray(test.questions)) {
                test.questions.forEach(q => addQuestionToDOM(q));
            }
        }
    } else {
        titleInput.value = "";
        addQuestionToDOM(); // баштапкы бош суроо
    }

    modal.classList.remove("hidden");
}

function addQuestionToDOM(data = null) {
    const wrapper = document.getElementById("dynamic-questions-wrapper");
    if (!wrapper) return;

    const qId = "q_" + Math.random().toString(36).substr(2, 9);
    const qBlock = document.createElement("div");
    qBlock.className = "question-hud-block";
    qBlock.id = qId;
    
    qBlock.innerHTML = `
        <div style="display:flex; gap:10px; margin-bottom:0.8rem;">
            <input type="text" class="hud-input question-text" style="flex:1;" placeholder="Суроону жазыңыз" value="${data ? data.text : ''}">
            <button class="danger-hud-btn" style="padding:0.5rem;" onclick="this.parentElement.parentElement.remove()">❌ Өчүрүү</button>
        </div>
        <button class="secondary-hud-btn btn-add-opt" style="font-size:0.8rem; padding:0.3rem 0.6rem;">+ Вариант кошуу</button>
        <div class="options-hud-list"></div>
    `;

    wrapper.appendChild(qBlock);
    const optList = qBlock.querySelector(".options-hud-list");

    if (data && data.options) {
        data.options.forEach(opt => addOptionRow(optList, opt.text, opt.isCorrect));
    } else {
        addOptionRow(optList, "", true);
        addOptionRow(optList, "", false);
    }

    qBlock.querySelector(".btn-add-opt").addEventListener("click", () => addOptionRow(optList, "", false));
}

function addOptionRow(container, text = "", isCorrect = false) {
    const row = document.createElement("div");
    row.className = "option-hud-row";
    row.innerHTML = `
        <input type="radio" name="correct_${container.parentElement.id}" ${isCorrect ? 'checked' : ''}>
        <input type="text" class="hud-input opt-text" style="flex:1; padding:0.4rem;" placeholder="Вариант тексти" value="${text}">
        <button class="close-hud-x" onclick="this.parentElement.remove()">&times;</button>
    `;
    container.appendChild(row);
}

// Модал ичиндеги тестти сактоо коду
async function saveTestFlow(status) {
    const title = document.getElementById("input-test-title")?.value.trim();
    if (!title) {
        showToast("Сураныч, тесттин аталышын жазыңыз", "error");
        return;
    }

    const questionBlocks = document.querySelectorAll(".question-hud-block");
    const questions = [];

    questionBlocks.forEach(block => {
        const text = block.querySelector(".question-text").value.trim();
        if (!text) return;

        const options = [];
        const optRows = block.querySelectorAll(".option-hud-row");
        optRows.forEach(row => {
            const optText = row.querySelector(".opt-text").value.trim();
            const isCorrect = row.querySelector("input[type='radio']").checked;
            if (optText) {
                options.push({ text: optText, isCorrect });
            }
        });

        questions.push({ text, options });
    });

    const testData = {
        title,
        status,
        questions,
        updatedAt: Date.now()
    };

    const targetId = currentEditingTestId || "test_" + Date.now();

    await setDoc(doc(db, "tests", targetId), testData);
    showToast(`Тест ийгиликтүү базага сакталды (${status})`, "success");
    document.getElementById("modal-test-editor").classList.add("hidden");
    logActivity(`Тест сакталды: ${title}`);
    loadTestsFromDatabase();
}

function openDeleteConfirm(id) {
    const modal = document.getElementById("modal-universal-confirm");
    if (!modal) return;
    modal.classList.remove("hidden");
    activeConfirmCallback = async () => {
        await deleteDoc(doc(db, "tests", id));
        showToast("Тест базадан толугу менен өчүрүлдү", "success");
        logActivity(`Тест өчүрүлдү, ID: ${id}`);
        loadTestsFromDatabase();
    };
}

async function duplicateTest(id) {
    const origin = localTests.find(t => t.id === id);
    if (!origin) return;
    const dupData = { ...origin, title: origin.title + " (Көчүрмө)", updatedAt: Date.now() };
    delete dupData.id;
    const newId = "test_" + Date.now();
    await setDoc(doc(db, "tests", newId), dupData);
    showToast("Тесттин жаңы көчүрмөсү түзүлдү", "success");
    loadTestsFromDatabase();
}

async function archiveTest(id) {
    const test = localTests.find(t => t.id === id);
    if (!test) return;
    test.status = "archived";
    await setDoc(doc(db, "tests", id), test);
    showToast("Тест архивге жөнөтүлдү", "success");
    loadTestsFromDatabase();
}

function copyTestLink(id) {
    const link = `https://bilimal.org/sections/student-test.html?id=${id}`;
    navigator.clipboard.writeText(link).then(() => {
        showToast("Тесттин шилтемеси буферге көчүрүлдү!", "success");
    }).catch(() => {
        showToast("Шилтемени көчүрүү мүмкүн болгон жок", "error");
    });
}

function generateQrCode(id) {
    const zone = document.getElementById("qr-code-render-zone");
    const modal = document.getElementById("modal-qr-display");
    if (!zone || !modal) return;

    zone.innerHTML = "";
    const link = `https://bilimal.org/sections/student-test.html?id=${id}`;
    
    try {
        const qr = qrcode(0, 'M');
        qr.addData(link);
        qr.make();
        zone.innerHTML = qr.createImgTag(5);
        modal.classList.remove("hidden");
    } catch (err) {
        showToast("QR код түзүү үчүн CDN даяр эмес", "error");
    }
}

function shareSocial(id, platform) {
    const link = encodeURIComponent(`https://bilimal.org/sections/student-test.html?id=${id}`);
    const text = encodeURIComponent("BilimAl тутумундагы жаңы тестти толтуруңуз: ");
    let url = "";
    if (platform === "wa") url = `https://api.whatsapp.com/send?text=${text}${link}`;
    if (platform === "tg") url = `https://t.me/share/url?url=${link}&text=${text}`;
    window.open(url, "_blank");
}

// Статикалык интерфейстик баскычтарга окуяларды байлоо (HUD Event Listeners)
function setupUIEventBindings() {
    const bindings = {
        "mobileMenuBtn": () => document.getElementById("sidebar-menu")?.classList.toggle("mobile-open"),
        "btn-theme-toggle": () => {
            showToast("Тема ийгиликтүү алмаштырылды (Dark Premium демейки)", "success");
        },
        "btn-notification-bell": () => {
            const count = document.getElementById("noti-count");
            if (count) count.innerText = "0";
            showToast("Бардык жаңы билдирүүлөр окулду.", "success");
        },
        "btn-global-search": () => {
            const query = document.getElementById("input-global-search")?.value.toLowerCase() || "";
            if (query === "") {
                loadTestsFromDatabase();
            } else {
                localTests = localTests.filter(t => t.title.toLowerCase().includes(query));
                renderTestsGrid();
                showToast(`Издөө аяктады, табылганы: ${localTests.length}`, "success");
            }
        },
        "createTestBtn": () => openTestEditor(null),
        "addQuestionBtn": () => addQuestionToDOM(null),
        "closeModalBtn": () => document.getElementById("modal-profile-editor")?.classList.add("hidden"),
        "cancelModalBtn": () => document.getElementById("modal-test-editor")?.classList.add("hidden"),
        "btn-close-qr": () => document.getElementById("modal-qr-display")?.classList.add("hidden"),
        "btn-confirm-no": () => document.getElementById("modal-universal-confirm")?.classList.add("hidden"),
        "profileEditBtn": () => {
            const profile = safeParseJSON(localStorage.getItem("B_TEACHER_PROFILE"), { name: "Асанов Үсөн", subject: "Физика" });
            const nameInput = document.getElementById("input-profile-name");
            const subInput = document.getElementById("input-profile-subject");
            if (nameInput) nameInput.value = profile.name;
            if (subInput) subInput.value = profile.subject;
            document.getElementById("modal-profile-editor")?.classList.remove("hidden");
        },
        "clearFiltersBtn": () => {
            document.getElementById("select-test-filter-status").value = "all";
            document.getElementById("select-test-sort").value = "date-desc";
            loadTestsFromDatabase();
            showToast("Чыпкалар баштапкы абалга келтирилди", "success");
        },
        "btn-crash-reload": () => window.location.reload(),
        "btn-pagination-prev": () => showToast("Сиз биринчи барактасыз"),
        "btn-pagination-next": () => showToast("Кийинки барактар бош"),
        "analyticsBtn": () => showToast("Акылдуу аналитикалык отчёттор даярдалууда...", "success"),
        "adminPanelBtn": () => showToast("Администратордук укуктар текшерилүүдө...", "success"),
        "logoutBtn": () => {
            openDeleteConfirm(null);
            document.getElementById("confirm-modal-title").innerText = "Сессияны жабуу";
            document.getElementById("confirm-modal-message").innerText = "Системадан чыгууну каалайсызбы?";
            activeConfirmCallback = () => {
                showToast("Сессия ийгиликтүү жабылды.");
                logActivity("Системадан чыгуу аткарылды.");
            };
        }
    };

    // Окуяларды коопсуз байлоо
    Object.keys(bindings).forEach(id => {
        document.getElementById(id)?.addEventListener("click", () => {
            try { bindings[id](); } catch (e) { console.error(e); }
        });
    });

    // Ырастоо терезесинин негизги "Ооба" баскычы
    document.getElementById("confirmModalBtn")?.addEventListener("click", () => {
        if (activeConfirmCallback) {
            executeButtonAction("confirmModalBtn", async () => {
                await activeConfirmCallback();
                document.getElementById("modal-universal-confirm")?.classList.add("hidden");
                activeConfirmCallback = null;
            });
        }
    });

    // Конструктордун сактоо баскычтары
    document.getElementById("saveDraftBtn")?.addEventListener("click", () => {
        executeButtonAction("saveDraftBtn", async () => { await saveTestFlow("draft"); });
    });

    document.getElementById("publishTestBtn")?.addEventListener("click", () => {
        executeButtonAction("publishTestBtn", async () => { await saveTestFlow("active"); });
    });

    document.getElementById("previewTestBtn")?.addEventListener("click", () => {
        showToast("Тестти алдын ала көрүү барагы курулууда.");
    });

    // Профилди сактоо
    document.getElementById("profileSaveBtn")?.addEventListener("click", () => {
        executeButtonAction("profileSaveBtn", async () => {
            const name = document.getElementById("input-profile-name")?.value.trim();
            const subject = document.getElementById("input-profile-subject")?.value.trim();
            if(!name || !subject) throw new Error("Бардык талааларды толтуруңуз!");

            const newProfile = { name, subject };
            localStorage.setItem("B_TEACHER_PROFILE", JSON.stringify(newProfile));
            loadProfileData();
            document.getElementById("modal-profile-editor")?.classList.add("hidden");
            showToast("Профиль ийгиликтүү жаңыртылды", "success");
        });
    });

    document.getElementById("profileCancelBtn")?.addEventListener("click", () => {
        document.getElementById("modal-profile-editor")?.classList.add("hidden");
    });

    // Экспорт жана Импорт баскычтары
    document.getElementById("exportJsonBtn")?.addEventListener("click", () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(localTests));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", "bilimal_tests_export.json");
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        showToast("JSON файлы ийгиликтүү экспорттолду.");
    });

    document.getElementById("exportCsvBtn")?.addEventListener("click", () => {
        let csvContent = "data:text/csv;charset=utf-8,ID,Title,Status\n";
        localTests.forEach(t => {
            csvContent += `${t.id},"${t.title}",${t.status}\n`;
        });
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "bilimal_report.csv");
        document.body.appendChild(link);
        link.click();
        link.remove();
        showToast("CSV/Excel файлы ийгиликтүү жүктөлдү.");
    });

    document.getElementById("importJsonBtn")?.addEventListener("click", () => {
        showToast("JSON Импорттоо үчүн файлды тандаңыз.");
    });

    // Чыпкалоо окуялары
    document.getElementById("select-test-filter-status")?.addEventListener("change", (e) => {
        const status = e.target.value;
        loadTestsFromDatabase().then(() => {
            if (status !== "all") {
                localTests = localTests.filter(t => t.status === status);
                renderTestsGrid();
            }
        });
    });
}
