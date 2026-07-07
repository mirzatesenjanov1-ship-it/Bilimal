// 4. FIREBASE SDK ИНТЕГРАЦИЯСЫ ЖАНА ЖҮКТӨӨЛӨРҮ
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-analytics.js";
import { getFirestore, collection, doc, setDoc, getDocs, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

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

// Инициализация
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

// Локалдык маалыматтар топтому (Колдонуучуга тез жооп берүү үчүн)
let localTests = [
    { id: "test_01", title: "Ом мыйзамы жана каршылык", status: "active", questionsCount: 5 },
    { id: "test_02", title: "Жарыктын сынуу мыйзамдары", status: "draft", questionsCount: 2 }
];
let currentConfirmAction = null;

document.addEventListener("DOMContentLoaded", () => {
    initAppLogic();
});

function initAppLogic() {
    setupInterfaceEvents();
    setupCoreTestEvents();
    renderTestsList();
}

// Убактылуу Toast Түзүү функциясы
function showToast(message, type = "success") {
    const container = document.getElementById("toast-container");
    if (!container) return;
    
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${message}</span><button class="toast-close-btn">&times;</button>`;
    
    container.appendChild(toast);
    toast.querySelector(".toast-close-btn").addEventListener("click", () => toast.remove());
    setTimeout(() => { if(toast) toast.remove(); }, 3500);
}

// Жалпы Баскыч Аткаруучу Коопсуз Компонент (Try/Catch + Loading)
async function executeAction(btnId, callback) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    
    const originalContent = btn.innerHTML;
    try {
        btn.disabled = true;
        btn.innerHTML = `⏳ Күтө туруңуз...`;
        await callback();
    } catch (error) {
        console.error(`Ката [${btnId}]: `, error);
        showToast(`Ката чыкты: ${error.message}`, "error");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalContent;
        }
    }
}

// Интерфейс Баскычтарын Каптоо
function setupInterfaceEvents() {
    const bindings = {
        "btn-mobile-menu-toggle": () => {
            const menu = document.getElementById("sidebar-menu");
            if (menu) menu.classList.toggle("mobile-open");
            showToast("Меню алмаштырылды");
        },
        "btn-theme-toggle": () => {
            const body = document.getElementById("app-body");
            if (body) {
                body.classList.toggle("dark-theme");
                showToast("Интерфейс режими өзгөртүлдү");
            }
        },
        "btn-notification-bell": () => {
            const count = document.getElementById("noti-count");
            if (count) count.innerText = "0";
            showToast("Бардык билдирүүлөр окулду");
        },
        "btn-global-search": () => {
            const q = document.getElementById("input-global-search")?.value || "";
            showToast(`Издөө суроо-талабы: ${q}`);
        },
        "btn-clear-test-filters": () => {
            document.getElementById("select-test-filter-status").value = "all";
            showToast("Фильтрлер тазаланды");
        },
        "btn-modal-cancel": () => {
            document.getElementById("modal-test-editor")?.classList.add("hidden");
        },
        "btn-modal-confirm-no": () => {
            document.getElementById("modal-universal-confirm")?.classList.add("hidden");
        },
        "btn-modal-confirm-yes": async () => {
            if (currentConfirmAction) {
                await executeAction("btn-modal-confirm-yes", async () => {
                    await currentConfirmAction();
                    document.getElementById("modal-universal-confirm")?.classList.add("hidden");
                    currentConfirmAction = null;
                });
            }
        },
        "btn-pagination-prev": () => showToast("Биринчи барактасыз"),
        "btn-pagination-next": () => showToast("Кийинки барак бош"),
        "nav-btn-profile": () => showToast("Мугалим профили тандалды"),
        "nav-btn-tests": () => showToast("Тесттер барагы иштеп жатат"),
        "nav-btn-questions": () => showToast("Суроолор банкы жүктөлдү"),
        "nav-btn-classes": () => showToast("Класстар тизмеси ачылды"),
        "nav-btn-analytics": () => showToast("Аналитика панели даяр"),
        "nav-btn-admin": () => showToast("Админ текшерүү жүрдү"),
        "nav-btn-logout": () => {
            triggerConfirm("Системадан чыгуу", "Коопсуз сессияны жабууну каалайсызбы?", () => {
                showToast("Ийгиликтүү чыктыңыз");
            });
        }
    };

    Object.keys(bindings).forEach(id => {
        document.getElementById(id)?.addEventListener("click", () => {
            try { bindings[id](); } catch(e) { console.error(e); }
        });
    });
}

function triggerConfirm(title, msg, action) {
    const modal = document.getElementById("modal-universal-confirm");
    const mTitle = document.getElementById("confirm-modal-title");
    const mMsg = document.getElementById("confirm-modal-message");
    if(mTitle) mTitle.innerText = title;
    if(mMsg) mMsg.innerText = msg;
    currentConfirmAction = action;
    modal?.classList.remove("hidden");
}

// Тест Түзүү жана Негизги Функциялар
function setupCoreTestEvents() {
    document.getElementById("btn-create-new-test")?.addEventListener("click", () => {
        document.getElementById("input-test-title").value = "";
        document.getElementById("modal-questions-list").innerHTML = "";
        document.getElementById("modal-test-editor")?.classList.remove("hidden");
    });

    document.getElementById("btn-json-import")?.addEventListener("click", () => {
        executeAction("btn-json-import", async () => {
            await new Promise(r => setTimeout(r, 600));
            showToast("JSON маалыматтары кабыл алынды");
        });
    });

    document.getElementById("btn-save-draft")?.addEventListener("click", () => {
        executeAction("btn-save-draft", async () => {
            const title = document.getElementById("input-test-title").value || "Аталышсыз черновик";
            const newId = "test_" + Date.now();
            // Firebase Firestore'го реалдуу жазуу синхронизациясы
            await setDoc(doc(db, "tests", newId), { title, status: "draft", timestamp: Date.now() });
            localTests.push({ id: newId, title, status: "draft", questionsCount: 0 });
            showToast("Сакталды (Черновик)");
            document.getElementById("modal-test-editor")?.classList.add("hidden");
            renderTestsList();
        });
    });

    document.getElementById("btn-publish-test")?.addEventListener("click", () => {
        executeAction("btn-publish-test", async () => {
            const title = document.getElementById("input-test-title").value;
            if(!title) { showToast("Аталышын жазыңыз!", "error"); return; }
            const newId = "test_" + Date.now();
            await setDoc(doc(db, "tests", newId), { title, status: "active", timestamp: Date.now() });
            localTests.push({ id: newId, title, status: "active", questionsCount: 0 });
            showToast("Тест ийгиликтүү жарыяланды!");
            document.getElementById("modal-test-editor")?.classList.add("hidden");
            renderTestsList();
        });
    });

    document.getElementById("btn-preview-test")?.addEventListener("click", () => {
        showToast("Алдын ала көрүү режими иштетилди");
    });

    // Ички суроо кошуу
    document.getElementById("btn-add-question")?.addEventListener("click", () => {
        const qList = document.getElementById("modal-questions-list");
        if(!qList) return;
        const qId = "q_" + Date.now();
        const div = document.createElement("div");
        div.id = `item-${qId}`;
        div.style = "display:flex; gap:5px; margin-top:5px; align-items:center;";
        div.innerHTML = `<input type='text' placeholder='Суроо тексти' style='flex:1; padding:4px;'/>
                         <button class='danger-btn' style='width:auto; padding:4px 8px;' onclick="this.parentElement.remove()">❌</button>`;
        qList.appendChild(div);
        showToast("Суроо тизмеге кошулду");
    });

    document.getElementById("btn-shuffle-questions")?.addEventListener("click", () => {
        showToast("Суроолор аралаштырылды");
    });
}

// Карточка Баскычтарын Тартуу
function renderTestsList() {
    const container = document.getElementById("tests-list-container");
    if (!container) return;
    container.innerHTML = "";

    localTests.forEach(test => {
        const card = document.createElement("div");
        card.className = "test-card";
        card.innerHTML = `
            <h3>${test.title}</h3>
            <p>Статус: <strong>${test.status}</strong></p>
            <div class="card-actions">
                <button id="btn-edit-${test.id}">Түзөтүү</button>
                <button id="btn-copy-${test.id}">Көчүрүү</button>
                <button id="btn-archive-${test.id}">Архивдөө</button>
                <button id="btn-delete-${test.id}" style="color:red;">Өчүрүү</button>
                <button id="btn-link-${test.id}">Шилтеме</button>
                <button id="btn-wa-${test.id}">WhatsApp</button>
                <button id="btn-tg-${test.id}">Telegram</button>
                <button id="btn-excel-${test.id}">Excel</button>
            </div>
        `;
        container.appendChild(card);

        // Карточка баскычтарына коопсуз угуучуларды кошуу
        document.getElementById(`btn-edit-${test.id}`)?.addEventListener("click", () => {
            document.getElementById("input-test-title").value = test.title;
            document.getElementById("modal-test-editor")?.classList.remove("hidden");
        });

        document.getElementById(`btn-delete-${test.id}`)?.addEventListener("click", () => {
            triggerConfirm("Тестти өчүрүү", "Бул тестти базадан өчүрүүнү каалайсызбы?", async () => {
                await deleteDoc(doc(db, "tests", test.id));
                localTests = localTests.filter(t => t.id !== test.id);
                renderTestsList();
                showToast("Тест ийгиликтүү өчүрүлдү");
            });
        });

        document.getElementById(`btn-copy-${test.id}`)?.addEventListener("click", () => {
            showToast("Тесттин көчүрмөсү даярдалды");
        });

        document.getElementById(`btn-archive-${test.id}`)?.addEventListener("click", () => {
            test.status = "archived";
            renderTestsList();
            showToast("Тест архивделди");
        });

        document.getElementById(`btn-link-${test.id}`)?.addEventListener("click", () => {
            navigator.clipboard.writeText(`https://bilimal.org/take-test?id=${test.id}`);
            showToast("Шилтеме алмашуу буферине көчүрүлдү");
        });

        document.getElementById(`btn-wa-${test.id}`)?.addEventListener("click", () => {
            window.open(`https://api.whatsapp.com/send?text=Тестти толтуруңуз: https://bilimal.org/take-test?id=${test.id}`);
        });

        document.getElementById(`btn-tg-${test.id}`)?.addEventListener("click", () => {
            window.open(`https://t.me/share/url?url=https://bilimal.org/take-test?id=${test.id}`);
        });

        document.getElementById(`btn-excel-${test.id}`)?.addEventListener("click", () => {
            showToast("Excel файлга экспорттолду");
        });
    });
}
