import { isFirebaseAvailable, db, ref, set, get, remove, push } from "./firebase-config.js";
import { currentTeacher } from "./auth-guard.js";
import { getTeacherTestsFromLocal, saveTeacherTestsToLocal, saveTestToLocal, deleteTestFromLocal, showToast, generateId, escapeHtml, formatDateTime } from "./storage-fallback.js";
import { createQuestionBlock, getQuestionsFromEditor, renderQuestionEditor } from "./test-editor.js";
import { exportResultsToCSV, exportAnnualReportToCSV, loadTeacherResults } from "./results-manager.js";

export let activeTeacherTests = {};
export let editingTestId = null;

export function initTestsDashboard() {
  loadAllDashboardTests();
  setupDashboardEventListeners();
  injectFloatingActionButton();
  injectAdBlocks();
}

export function loadAllDashboardTests() {
  const tid = currentTeacher.uid;
  activeTeacherTests = getTeacherTestsFromLocal(tid);
  renderTestsList();

  if (isFirebaseAvailable && db) {
    get(ref(db, `teachers/${tid}/tests`))
      .then((snapshot) => {
        if (snapshot.exists()) {
          activeTeacherTests = snapshot.val();
          saveTeacherTestsToLocal(tid, activeTeacherTests);
          renderTestsList();
        }
      })
      .catch((err) => {
        console.error("Firebase real-time fetch failed:", err);
        showToast("Маалыматтар локалдык сактагычтан жүктөлдү", "info");
      });
  }
}

function setupDashboardEventListeners() {
  const newTestBtn = document.getElementById("create-new-test-btn");
  const modalCloseBtn = document.getElementById("test-editor-modal-close");
  const modalWrapper = document.getElementById("test-editor-modal");
  const saveTestBtn = document.getElementById("save-complete-test-btn");
  const importJsonInput = document.getElementById("import-json-file-input");

  if (newTestBtn) {
    newTestBtn.addEventListener("click", () => openTestModal(null));
  }
  if (modalCloseBtn) {
    modalCloseBtn.addEventListener("click", closeTestModal);
  }
  if (modalWrapper) {
    modalWrapper.addEventListener("click", (e) => {
      if (e.target === modalWrapper) closeTestModal();
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modalWrapper && modalWrapper.classList.contains("active")) {
      closeTestModal();
    }
  });

  if (saveTestBtn) {
    saveTestBtn.addEventListener("click", handleSaveTestForm);
  }

  if (importJsonInput) {
    importJsonInput.addEventListener("change", handleJsonImport);
  }

  // Dashboard Searching and Filtering Controls
  ["search-test-input", "filter-subject-select", "filter-class-select", "filter-status-select", "sort-tests-select"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", renderTestsList);
  });
}

function openTestModal(testId = null) {
  editingTestId = testId;
  const modal = document.getElementById("test-editor-modal");
  if (!modal) return;

  modal.classList.add("active");
  modal.style.display = "flex";

  const container = document.getElementById("questions-constructor-container");
  if (container) container.innerHTML = "";

  if (testId && activeTeacherTests[testId]) {
    const test = activeTeacherTests[testId];
    document.getElementById("test-title-input").value = test.title || "";
    document.getElementById("test-subject-input").value = test.subject || "";
    document.getElementById("test-class-input").value = test.className || "";
    document.getElementById("test-duration-input").value = test.duration || "";
    document.getElementById("test-status-select").value = test.status || "draft";
    document.getElementById("test-password-input").value = test.password || "";
    document.getElementById("test-anti-cheat-toggle").checked = !!test.antiCheat;
    
    if (test.questions && test.questions.length > 0) {
      test.questions.forEach(q => renderQuestionEditor(q));
    }
  } else {
    document.getElementById("test-meta-form")?.reset();
    document.getElementById("test-status-select").value = "draft";
    document.getElementById("test-anti-cheat-toggle").checked = false;
    renderQuestionEditor({ id: generateId("q"), type: "single", questionText: "", points: 5, options: ["", ""] });
  }
}

function closeTestModal() {
  const modal = document.getElementById("test-editor-modal");
  if (modal) {
    modal.classList.remove("active");
    modal.style.display = "none";
  }
  editingTestId = null;
}

function handleSaveTestForm() {
  const title = document.getElementById("test-title-input")?.value.trim();
  if (!title) {
    showToast("Тесттин аталышын жазыңыз!", "warning");
    return;
  }

  const questions = getQuestionsFromEditor();
  if (questions.length === 0) {
    showToast("Жок дегенде бир суроо кошуңуз!", "warning");
    return;
  }

  const id = editingTestId || generateId("test");
  const testObject = {
    id: id,
    title: title,
    subject: document.getElementById("test-subject-input")?.value || "Башка",
    className: document.getElementById("test-class-input")?.value || "Жалпы",
    duration: parseInt(document.getElementById("test-duration-input")?.value) || 0,
    status: document.getElementById("test-status-select")?.value || "draft",
    password: document.getElementById("test-password-input")?.value || "",
    antiCheat: document.getElementById("test-anti-cheat-toggle")?.checked || false,
    questions: questions,
    updatedAt: Date.now(),
    createdAt: activeTeacherTests[id]?.createdAt || Date.now()
  };

  const tid = currentTeacher.uid;
  activeTeacherTests[id] = testObject;
  saveTestToLocal(tid, testObject);

  if (isFirebaseAvailable && db) {
    set(ref(db, `teachers/${tid}/tests/${id}`), testObject)
      .then(() => showToast("Тест булутка ийгиликтүү сакталды", "success"))
      .catch((e) => {
        console.error(e);
        showToast("Тест локалдык сакталды (Сервер оффлайн)", "warning");
      });
  } else {
    showToast("Тест локалдык сакталды", "success");
  }

  closeTestModal();
  renderTestsList();
}

export function renderTestsList() {
  const grid = document.getElementById("tests-cards-grid");
  if (!grid) return;

  grid.innerHTML = "";

  const search = document.getElementById("search-test-input")?.value.toLowerCase() || "";
  const subFilter = document.getElementById("filter-subject-select")?.value || "all";
  const classFilter = document.getElementById("filter-class-select")?.value || "all";
  const statusFilter = document.getElementById("filter-status-select")?.value || "all";
  const sortOption = document.getElementById("sort-tests-select")?.value || "newest";

  let list = Object.values(activeTeacherTests);

  list = list.filter(t => {
    const mSearch = t.title.toLowerCase().includes(search);
    const mSub = subFilter === "all" || t.subject === subFilter;
    const mClass = classFilter === "all" || t.className === classFilter;
    const mStatus = statusFilter === "all" || t.status === statusFilter;
    return mSearch && mSub && mClass && mStatus;
  });

  list.sort((a, b) => {
    if (sortOption === "newest") return b.updatedAt - a.updatedAt;
    if (sortOption === "oldest") return a.updatedAt - b.updatedAt;
    return a.title.localeCompare(b.title);
  });

  if (list.length === 0) {
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:40px; color:#64748b;">Тесттер табылган жок.</div>`;
    return;
  }

  list.forEach(test => {
    const card = document.createElement("div");
    card.className = `test-card status-${test.status}`;
    card.style.cssText = "background:white; border-radius:12px; padding:20px; box-shadow:0 4px 6px -1px rgba(0,0,0,0.1); position:relative; display:flex; flex-direction:column; gap:12px; border-left: 5px solid #3b82f6;";
    
    if (test.status === "active") card.style.borderColor = "#10b981";
    if (test.status === "archived") card.style.borderColor = "#94a3b8";

    const shareLink = `${window.location.origin}/quiz.html?id=${test.id}&tid=${currentTeacher.uid}`;

    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <span style="font-size:12px; background:#f1f5f9; padding:4px 8px; border-radius:4px; font-weight:600; color:#475569;">${escapeHtml(test.subject)} (${escapeHtml(test.className)})</span>
        <span style="font-size:11px; font-weight:bold; text-transform:uppercase;" class="badge-${test.status}">${test.status}</span>
      </div>
      <h3 style="font-size:18px; font-weight:700; color:#1e293b; margin:0;">${escapeHtml(test.title)}</h3>
      <p style="font-size:13px; color:#64748b; margin:0;">Суроолор: <b>${test.questions ? test.questions.length : 0}</b> | Убакыт: <b>${test.duration > 0 ? test.duration + ' мүнөт' : 'Чектөөсүз'}</b></p>
      <div style="font-size:11px; color:#94a3b8;">Өзгөртүлдү: ${formatDateTime(test.updatedAt)}</div>
      <hr style="border:none; border-top:1px solid #f1f5f9; margin:8px 0;">
      <div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:auto;">
        <button class="dash-btn-edit btn-primary" data-id="${test.id}" style="padding:6px 12px; font-size:13px; border-radius:6px; cursor:pointer;">Оңдоо</button>
        <button class="dash-btn-copy btn-secondary" data-id="${test.id}" style="padding:6px 12px; font-size:13px; border-radius:6px; cursor:pointer;">Көчүрүү</button>
        <button class="dash-btn-link btn-info" data-link="${shareLink}" style="padding:6px 12px; font-size:13px; border-radius:6px; cursor:pointer;">Шилтеме</button>
        <button class="dash-btn-export btn-success" data-id="${test.id}" style="padding:6px 12px; font-size:13px; border-radius:6px; cursor:pointer;">JSON Экспорт</button>
        <button class="dash-btn-delete btn-danger" data-id="${test.id}" style="padding:6px 12px; font-size:13px; border-radius:6px; background:#ef4444; color:white; border:none; border-radius:6px; cursor:pointer;">Өчүрүү</button>
      </div>
    `;
    grid.appendChild(card);
  });

  bindCardActionButtons();
}

function bindCardActionButtons() {
  document.querySelectorAll(".dash-btn-edit").forEach(b => {
    b.addEventListener("click", () => openTestModal(b.getAttribute("data-id")));
  });

  document.querySelectorAll(".dash-btn-copy").forEach(b => {
    b.addEventListener("click", () => {
      const originId = b.getAttribute("data-id");
      if (activeTeacherTests[originId]) {
        const copy = JSON.parse(JSON.stringify(activeTeacherTests[originId]));
        copy.id = generateId("test");
        copy.title += " (Көчүрмө)";
        copy.updatedAt = Date.now();
        activeTeacherTests[copy.id] = copy;
        saveTestToLocal(currentTeacher.uid, copy);
        showToast("Тест ийгиликтүү дубликатталды", "success");
        renderTestsList();
      }
    });
  });

  document.querySelectorAll(".dash-btn-link").forEach(b => {
    b.addEventListener("click", () => {
      const link = b.getAttribute("data-link");
      navigator.clipboard.writeText(link).then(() => {
        showToast("Окуучулар үчүн шилтеме көчүрүлдү!", "success");
      });
    });
  });

  document.querySelectorAll(".dash-btn-export").forEach(b => {
    b.addEventListener("click", () => {
      const id = b.getAttribute("data-id");
      const targetTest = activeTeacherTests[id];
      if (targetTest) {
        const blob = new Blob([JSON.stringify(targetTest, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `test_${targetTest.title.replace(/\s+/g, "_")}.json`;
        a.click();
        showToast("Тест JSON файлы жүктөлдү", "success");
      }
    });
  });

  document.querySelectorAll(".dash-btn-delete").forEach(b => {
    b.addEventListener("click", () => {
      if (confirm("Чын эле бул тестти өчүрөсүзбү?")) {
        const id = b.getAttribute("data-id");
        const tid = currentTeacher.uid;
        delete activeTeacherTests[id];
        deleteTestFromLocal(tid, id);

        if (isFirebaseAvailable && db) {
          remove(ref(db, `teachers/${tid}/tests/${id}`))
            .then(() => showToast("Тест базадан өчүрүлдү", "success"))
            .catch(() => showToast("Локалдык өчүрүлдү", "info"));
        } else {
          showToast("Локалдык өчүрүлдү", "success");
        }
        renderTestsList();
      }
    });
  });
}

function handleJsonImport(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      const parsed = JSON.parse(evt.target.result);
      if (!parsed.title) {
        showToast("Ката: Файлда тесттин аталышы жок!", "error");
        return;
      }
      const newId = generateId("test");
      parsed.id = newId;
      parsed.questions = parsed.questions || [];
      parsed.updatedAt = Date.now();

      activeTeacherTests[newId] = parsed;
      saveTestToLocal(currentTeacher.uid, parsed);
      
      showToast("Импорт ийгиликтүү аяктады", "success");
      renderTestsList();
    } catch (err) {
      showToast("JSON файлын окууда ката кетти. Файл бузулган болушу мүмкүн.", "error");
    }
  };
  reader.readAsText(file);
  e.target.value = ""; 
}

function injectFloatingActionButton() {
  if (document.getElementById("floating-action-add-btn")) return;
  const fab = document.createElement("button");
  fab.id = "floating-action-add-btn";
  fab.innerHTML = "+";
  fab.style.cssText = "position:fixed; bottom:30px; left:30px; width:60px; height:60px; border-radius:50%; background:#10b981; color:white; font-size:32px; border:none; box-shadow:0 4px 10px rgba(0,0,0,0.3); cursor:pointer; z-index:999; display:flex; align-items:center; justify-content:center; font-weight:bold; transition:transform 0.2s;";
  fab.addEventListener("mouseenter", () => fab.style.transform = "scale(1.1)");
  fab.addEventListener("mouseleave", () => fab.style.transform = "scale(1)");
  fab.addEventListener("click", () => {
    const modal = document.getElementById("test-editor-modal");
    if (modal && modal.classList.contains("active")) {
      renderQuestionEditor({ id: generateId("q"), type: "single", questionText: "", points: 5, options: ["", ""] });
      showToast("Жаңы бош суроо аягына кошулду", "info");
    } else {
      openTestModal(null);
    }
  });
  document.body.appendChild(fab);
}

function injectAdBlocks() {
  const wrapperAd = document.getElementById("dashboard-footer-advertisement-block");
  if (wrapperAd) {
    wrapperAd.style.minHeight = "90px";
    wrapperAd.innerHTML = `
      <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-1495571814896964" data-ad-slot="1574613769"></ins>
      <div id="adsterra-banner-space"></div>
    `;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {}

    const adOptionsScript = document.createElement("script");
    adOptionsScript.innerHTML = `
      atOptions = { 'key' : '230e338703bb44150336cce1f0832fe3', 'format' : 'iframe', 'height' : 90, 'width' : 728, 'params' : {} };
    `;
    const adInvokeScript = document.createElement("script");
    adInvokeScript.src = "https://www.highperformanceformat.com/230e338703bb44150336cce1f0832fe3/invoke.js";
    
    const bannerSpace = document.getElementById("adsterra-banner-space");
    if (bannerSpace) {
      bannerSpace.appendChild(adOptionsScript);
      bannerSpace.appendChild(adInvokeScript);
    }
  }
}
