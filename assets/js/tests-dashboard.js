// Master Application Logic for Teacher's HUD Panel Commands Center
import { 
    auth, db, storage, onAuthStateChanged, signOut,
    ref, set, push, update, get, onValue, query, orderByChild, equalTo,
    storageRef, uploadBytes, getDownloadURL
} from "./firebase-config.js";

// Application Runtime Reactive State Machine
let currentUser = null;
let teacherProfileData = {};
let loadedTestsMap = {};
let loadedResultsList = [];
let chartInstances = { classChart: null, questionChart: null };

// Question Wizard Buffer Struct
let wizardQuestionsList = [];
let activeWizardQuestionIndex = null;
let currentWizardStep = 1;
let localEditingTestId = null; // null represents fresh creation mode

// Execution Context Core Initialization
document.addEventListener("DOMContentLoaded", () => {
    verifyAuthenticationState();
    registerGlobalDOMEventListeners();
});

// Security Authentication Guard Gate
function verifyAuthenticationState() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            updateStatusIndicator("Системага кирди: " + user.uid);
            await fetchTeacherProfileAndAuthorize();
            loadTeacherDashboardData();
            triggerAnalyticsEngine();
            trackGoogleAnalyticsEvent("teacher_dashboard_open");
        } else {
            updateStatusIndicator("Авторизация жок. Башкы бетке өтүү...");
            // Non-destructive routing redirection fallback protection
            setTimeout(() => {
                window.location.href = "../login.html";
            }, 1500);
        }
    });
}

// Global Event Binding Matrix Initialization
function registerGlobalDOMEventListeners() {
    // Sidebar Section Swapper Engine Connect
    document.querySelectorAll(".menu-item").forEach(button => {
        button.addEventListener("click", (e) => {
            const targetPaneId = button.getAttribute("data-target");
            switchActiveDashboardPane(targetPaneId, button);
        });
    });

    // Profile Trigger shortcuts
    const triggerProfileNav = document.getElementById("triggerProfileNav");
    if (triggerProfileNav) {
        triggerProfileNav.addEventListener("click", () => {
            const profBtn = document.querySelector('[data-target="profile-section"]');
            if (profBtn) switchActiveDashboardPane("profile-section", profBtn);
        });
    }

    // Wizard Controls Bindings
    safeBindClickEvent("quickNewTestBtn", () => openTestWizardModal());
    safeBindClickEvent("createNewTestMainBtn", () => openTestWizardModal());
    safeBindClickEvent("closeWizardModalBtn", () => closeTestWizardModalWindow());
    safeBindClickEvent("wizardNextBtn", () => processWizardStepForward());
    safeBindClickEvent("wizardBackBtn", () => processWizardStepBackward());
    safeBindClickEvent("wizardSaveBtn", () => finalizeAndSaveWizardTest());
    safeBindClickEvent("addQuestionBtn", () => appendBlankQuestionToWizardBuffer());

    // Analytics Inputs Events handlers
    const analyticsTestSelector = document.getElementById("analyticsTestSelector");
    if (analyticsTestSelector) {
        analyticsTestSelector.addEventListener("change", (e) => {
            renderFilteredAnalyticsTableAndCharts(e.target.value);
        });
    }

    // Export operations connections
    safeBindClickEvent("exportCsvBtn", () => exportMetricsToCSV());
    safeBindClickEvent("exportJsonBtn", () => exportMetricsToJSONBackup());
    safeBindClickEvent("quickExportAllBtn", () => exportMetricsToCSV());
    safeBindClickEvent("printReportBtn", () => window.print());

    // Profile Management Handlers
    const profileEditForm = document.getElementById("profileEditForm");
    if (profileEditForm) {
        profileEditForm.addEventListener("submit", (e) => {
            e.preventDefault();
            commitTeacherProfileUpdates();
        });
    }

    const avatarFileInput = document.getElementById("avatarFileInput");
    if (avatarFileInput) {
        avatarFileInput.addEventListener("change", (e) => {
            if (e.target.files.length > 0) processAvatarFileUpload(e.target.files[0]);
        });
    }

    // Modal Global Confirmation system click dismissals
    safeBindClickEvent("confirmModalCancelBtn", () => {
        document.getElementById("confirmModal").classList.remove("active");
    });

    // Filtering inputs catalog searches
    const testSearchInput = document.getElementById("testSearchInput");
    if (testSearchInput) {
        testSearchInput.addEventListener("input", () => triggerCatalogFilteringSearch());
    }
    const testFilterDifficulty = document.getElementById("testFilterDifficulty");
    if (testFilterDifficulty) {
        testFilterDifficulty.addEventListener("change", () => triggerCatalogFilteringSearch());
    }

    // Disconnect Authentication Exit Button
    safeBindClickEvent("logoutBtn", () => triggerAccountSignOut());
}

// Section Panes Navigation Swapper Runtime
function switchActiveDashboardPane(sectionId, menuButtonElement) {
    document.querySelectorAll(".hud-section").forEach(section => section.classList.remove("active"));
    document.querySelectorAll(".menu-item").forEach(btn => btn.classList.remove("active"));

    const targetSectionNode = document.getElementById(sectionId);
    if (targetSectionNode) targetSectionNode.classList.add("active");
    if (menuButtonElement) menuButtonElement.classList.add("active");

    // Contextual Headers updates text
    const pageTitle = document.getElementById("pageTitle");
    const pageSubtitle = document.getElementById("pageSubtitle");
    if (pageTitle && pageSubtitle) {
        if (sectionId === "dashboard-section") {
            pageTitle.innerText = "Command Center";
            pageSubtitle.innerText = "Реалдуу убакыттагы билим берүү аналитикасы";
        } else if (sectionId === "tests-section") {
            pageTitle.innerText = "Тесттер модулу";
            pageSubtitle.innerText = "Суроолорду түзүү, өзгөртүү жана бөлүшүү куралдары";
        } else if (sectionId === "analytics-section") {
            pageTitle.innerText = "Баалоо терминалы";
            pageSubtitle.innerText = "Студенттердин жетишкендиктери жана статистикалык отчёттор";
        } else if (sectionId === "profile-section") {
            pageTitle.innerText = "Системалык конфигурациялар";
            pageSubtitle.innerText = "Жеке профилди өзгөртүү жана сактоо папкасы";
        } else if (sectionId === "admin-section") {
            pageTitle.innerText = "Admin Control Center";
            pageSubtitle.innerText = "Глобалдык коопсуздук журналы жана мониторинг";
        }
    }
}

// Fetch Identity Profiles Database Nodes
async function fetchTeacherProfileAndAuthorize() {
    try {
        const profileSnapshot = await get(ref(db, `teachers/${currentUser.uid}`));
        if (profileSnapshot.exists()) {
            teacherProfileData = profileSnapshot.val();
            renderTeacherProfileDOMElements();
        } else {
            // Provision empty structure for first time initialization
            teacherProfileData = {
                fullName: "Жаңы мугалим",
                subject: "Тандалган жок",
                school: "Маалымат жок",
                role: "teacher"
            };
            await set(ref(db, `teachers/${currentUser.uid}`), teacherProfileData);
            renderTeacherProfileDOMElements();
        }

        // Evaluate Admin privilege parameters
        if (teacherProfileData.role === "admin") {
            const adminBtn = document.getElementById("adminPanelMenuBtn");
            if (adminBtn) adminBtn.classList.remove("hidden");
            initializeAdminPanelTerminal();
        }
    } catch (err) {
        showSystemToastNotification("Профиль жүктөлгөн жок: " + err.message, "error");
    }
}

function renderTeacherProfileDOMElements() {
    const avatarUrl = teacherProfileData.avatarUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80";
    
    // Header Injectors
    safeUpdateInnerText("headerTeacherName", teacherProfileData.fullName);
    safeUpdateInnerText("headerTeacherSubject", teacherProfileData.subject);
    const headerAvatar = document.getElementById("headerTeacherAvatar");
    if (headerAvatar) headerAvatar.src = avatarUrl;

    // Profile Card UI injectors
    safeUpdateInnerText("profileCardName", teacherProfileData.fullName);
    safeUpdateInnerText("profileCardSubject", teacherProfileData.subject);
    safeUpdateInnerText("profileCardSchool", teacherProfileData.school);
    safeUpdateInnerText("profileCardUid", currentUser.uid);
    const cardAvatar = document.getElementById("profileCardAvatar");
    if (cardAvatar) cardAvatar.src = avatarUrl;

    // Edit Inputs Form values mapping
    safeAssignInputValue("profileInputName", teacherProfileData.fullName);
    safeAssignInputValue("profileInputSubject", teacherProfileData.subject);
    safeAssignInputValue("profileInputSchool", teacherProfileData.school);
}

// Teacher Core Dashboard Loader Data Engines
function loadTeacherDashboardData() {
    const teacherTestsRef = ref(db, `tests/${currentUser.uid}`);
    onValue(teacherTestsRef, (snapshot) => {
        loadertestsMap = snapshot.exists() ? snapshot.val() : {};
        renderTeacherCatalogGrid(loadertestsMap);
        calculateDashboardMetrics();
    });

    // Sync Operational logs entries
    const logRef = ref(db, `teacherActivity/${currentUser.uid}`);
    onValue(query(logRef, orderByChild("timestamp")), (snapshot) => {
        const targetListElement = document.getElementById("dashboardActivityLog");
        if (!targetListElement) return;
        targetListElement.innerHTML = "";

        if (snapshot.exists()) {
            let logsArr = [];
            snapshot.forEach(child => { logsArr.unshift(child.val()); });
            logsArr.slice(0, 8).forEach(logItem => {
                const li = document.createElement("li");
                li.className = "log-item";
                li.innerHTML = `<span class="log-timestamp">${new Date(logItem.timestamp).toLocaleString()}</span> ${logItem.message}`;
                targetListElement.appendChild(li);
            });
        } else {
            targetListElement.innerHTML = '<li class="empty-log-msg">Аракеттер катталган жок</li>';
        }
    });
}

// Master Analytics Aggregate Data Processing Engines
function triggerAnalyticsEngine() {
    const resultsQueryRef = ref(db, `testResults`);
    onValue(resultsQueryRef, (snapshot) => {
        loadedResultsList = [];
        const selectorNode = document.getElementById("analyticsTestSelector");
        if (!selectorNode) return;

        // Reserve base defaults values selection option
        selectorNode.innerHTML = '<option value="all">Жалпы статистиканы көрүү</option>';

        if (snapshot.exists()) {
            snapshot.forEach(testNode => {
                const testId = testNode.key;
                testNode.forEach(resultNode => {
                    const resData = resultNode.val();
                    // Intersection conditional evaluation filter validation security check
                    if (resData.teacherId === currentUser.uid) {
                        loadedResultsList.push({ resultId: resultNode.key, testId, ...resData });
                    }
                });
            });
        }
        
        // Populate specific dropdown filter selections options options metrics
        Object.keys(loadertestsMap).forEach(tId => {
            const option = document.createElement("option");
            option.value = tId;
            option.innerText = loadertestsMap[tId].title;
            selectorNode.appendChild(option);
        });

        renderFilteredAnalyticsTableAndCharts("all");
        calculateDashboardMetrics();
    });
}

// Filters Analytics Table Output and Chart Redraw Cycles triggers safely
function renderFilteredAnalyticsTableAndCharts(filterScopeValue) {
    const tableBody = document.getElementById("studentResultsTableBody");
    if (!tableBody) return;
    tableBody.innerHTML = "";

    const activeResults = filterScopeValue === "all" ? 
        loadedResultsList : loadedResultsList.filter(r => r.testId === filterScopeValue);

    if (activeResults.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="8" class="text-center text-muted">Жыйынтыктар табылган жок</td></tr>`;
        destroyChartInstance("classPerformanceChart");
        destroyChartInstance("questionDifficultyChart");
        return;
    }

    // Populate Results HTML Elements Tables rows data mapping
    activeResults.forEach(res => {
        const tr = document.createElement("tr");
        const antiCheatStatusText = res.antiCheatViolations > 0 ? 
            `<span class="text-danger font-weight-700"><i class="fa-solid fa-triangle-exclamation"></i> ${res.antiCheatViolations} жолу</span>` : 
            `<span class="text-success">Таза</span>`;

        tr.innerHTML = `
            <td><strong>${res.studentName}</strong></td>
            <td><span class="text-cyan text-monospace">${res.studentClass}</span></td>
            <td>${res.testTitle}</td>
            <td>${res.score}/${res.totalPoints}</td>
            <td><strong>${res.percentage}%</strong></td>
            <td>${antiCheatStatusText}</td>
            <td>${new Date(res.timestamp).toLocaleString()}</td>
            <td>
                <button class="hud-btn btn-secondary py-1 px-2 btn-delete-res" data-test="${res.testId}" data-id="${res.resultId}">
                    <i class="fa-solid fa-trash text-danger"></i>
                </button>
            </td>
        `;
        tableBody.appendChild(tr);
    });

    // Bind item deletion row dynamics
    tableBody.querySelectorAll(".btn-delete-res").forEach(btn => {
        btn.addEventListener("click", () => {
            const tId = btn.getAttribute("data-test");
            const rId = btn.getAttribute("data-id");
            promptActionConfirmationModal("Бул жыйынтыкты биротоло өчүрүүнү каалайсызбы?", async () => {
                await set(ref(db, `testResults/${tId}/${rId}`), null);
                showSystemToastNotification("Окуучунун жыйынтыгы өчүрүлдү", "warning");
                logSystemTeacherActivity(`Студенттин жыйынтыгы базадан тазаланды. ID: ${rId}`);
            });
        });
    });

    // Chart processing aggregation datasets metrics mapping configurations
    generateChartsVisualizations(activeResults);
}

// Chart.js Object Visual Generation safely managing destructions cycles
function generateChartsVisualizations(resultsArray) {
    // Dataset 1 Aggregations: Class Performances distributions
    const classMap = {};
    resultsArray.forEach(r => {
        if (!classMap[r.studentClass]) classMap[r.studentClass] = { sum: 0, count: 0 };
        classMap[r.studentClass].sum += r.percentage;
        classMap[r.studentClass].count++;
    });
    const classLabels = Object.keys(classMap);
    const classAverages = classLabels.map(l => Math.round(classMap[l].sum / classMap[l].count));

    // Canvas 1 Initialization
    const ctxClass = document.getElementById("classPerformanceChart");
    if (ctxClass) {
        if (chartInstances.classChart) chartInstances.classChart.destroy();
        chartInstances.classChart = new Chart(ctxClass.getContext('2d'), {
            type: 'bar',
            data: {
                labels: classLabels,
                datasets: [{
                    label: 'Орточо пайыз %',
                    data: classAverages,
                    backgroundColor: 'rgba(0, 242, 254, 0.4)',
                    borderColor: '#00f2fe',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { y: { min: 0, max: 100, grid: { color: 'rgba(255,255,255,0.05)' } } }
            }
        });
    }

    // Dataset 2 Aggregations: Itemized performance overview summaries metrics mockup mapping
    const ctxQuestion = document.getElementById("questionDifficultyChart");
    if (ctxQuestion) {
        if (chartInstances.questionChart) chartInstances.questionChart.destroy();
        chartInstances.questionChart = new Chart(ctxQuestion.getContext('2d'), {
            type: 'line',
            data: {
                labels: ['Суроо 1', 'Суроо 2', 'Суроо 3', 'Суроо 4', 'Суроо 5'],
                datasets: [{
                    label: 'Туура жооп берүү көрсөткүчү %',
                    data: [85, 62, 40, 92, 71],
                    borderColor: '#9b51e0',
                    backgroundColor: 'rgba(155, 81, 224, 0.1)',
                    borderWidth: 3,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { y: { min: 0, max: 100, grid: { color: 'rgba(255,255,255,0.05)' } } }
            }
        });
    }
}

// Aggregate Analytics Dashboard Numbers Displays configurations dynamically
function calculateDashboardMetrics() {
    const totalTests = Object.keys(loadertestsMap).length;
    safeUpdateInnerText("statTotalTests", totalTests);

    let activeCount = 0;
    Object.keys(loadertestsMap).forEach(k => {
        if (loadertestsMap[k].status === "published") activeCount++;
    });
    safeUpdateInnerText("statActiveTests", activeCount);

    // Compute metrics distributions ranges safely
    safeUpdateInnerText("statTodayResults", loadedResultsList.length);

    if (loadedResultsList.length > 0) {
        let sum = 0;
        loadedResultsList.forEach(r => sum += r.percentage);
        safeUpdateInnerText("statAvgPerformance", Math.round(sum / loadedResultsList.length) + "%");
    } else {
        safeUpdateInnerText("statAvgPerformance", "0%");
    }

    // Provision intelligence insights texts boxes panels fields strings layouts
    safeUpdateInnerText("lowPerformanceTopics", "Электр каршылыгы, Тизмектей туташтыруу");
    safeUpdateInnerText("recommendedRevision", "Электр тизмектеринин параметрлерин визуалдык лабораторияда кайталоо сунушталат.");
}

// Render dynamic elements collections catalog layouts items boxes displays rows
function renderTeacherCatalogGrid(testsObject) {
    const container = document.getElementById("testsGridContainer");
    if (!container) return;
    container.innerHTML = "";

    const keys = Object.keys(testsObject);
    if (keys.length === 0) {
        container.innerHTML = `<div class="p-5 hud-card text-center text-muted w-100">Сизде азырынча тесттер курала элек. Жаңы тест түзүү баскычын басыңыз.</div>`;
        return;
    }

    keys.forEach(id => {
        const test = testsObject[id];
        const card = document.createElement("div");
        card.className = "hud-card test-catalog-card";
        
        const badgeClass = test.status === "published" ? "badge-active" : "badge-draft";
        const badgeText = test.status === "published" ? "Активдүү" : "Черновик";

        card.innerHTML = `
            <span class="card-badge ${badgeClass}">${badgeText}</span>
            <h3 class="cyan-glow">${test.title}</h3>
            <p class="text-muted mt-2">Сабак: <strong>${test.subject}</strong> | Класс: <strong>${test.class}</strong></p>
            <p class="text-muted">Суроолор саны: ${test.questions ? test.questions.length : 0} | Убакыт: ${test.timeLimit} мүнөт</p>
            <div class="test-card-actions">
                <button class="hud-btn btn-secondary btn-edit-test" data-id="${id}"><i class="fa-solid fa-pen-to-square"></i></button>
                <button class="hud-btn btn-secondary btn-copy-link" data-id="${id}"><i class="fa-solid fa-link"></i></button>
                <button class="hud-btn btn-danger btn-delete-test" data-id="${id}"><i class="fa-solid fa-trash-can"></i></button>
            </div>
        `;
        container.appendChild(card);
    });

    // Dynamic bindings interface loops elements events listeners attachments handles
    container.querySelectorAll(".btn-edit-test").forEach(btn => {
        btn.addEventListener("click", () => triggerLoadExistingTestToWizard(btn.getAttribute("data-id")));
    });

    container.querySelectorAll(".btn-copy-link").forEach(btn => {
        btn.addEventListener("click", () => copyTestAbsoluteLinkToClipboard(btn.getAttribute("data-id")));
    });

    container.querySelectorAll(".btn-delete-test").forEach(btn => {
        btn.addEventListener("click", () => triggerRemoveTestFromDatabase(btn.getAttribute("data-id")));
    });
}

// Copy Links Execution Flow Engine Wrapper
function copyTestAbsoluteLinkToClipboard(testId) {
    const path = `${window.location.origin}/sections/student-test.html?test=${testId}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(path).then(() => {
            showSystemToastNotification("Тест ссылкасы көчүрүлдү!", "success");
            trackGoogleAnalyticsEvent("test_link_copied");
        }).catch(() => fallbackCopyImplementationTextarea(path));
    } else {
        fallbackCopyImplementationTextarea(path);
    }
}

function fallbackCopyImplementationTextarea(textValue) {
    const ta = document.createElement("textarea");
    ta.value = textValue;
    ta.style.position = "fixed";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
        document.execCommand('copy');
        showSystemToastNotification("Тест ссылкасы көчүрүлдү (fallback)!", "success");
    } catch (err) {
        showSystemToastNotification("Көчүрүү катасы", "error");
    }
    document.body.removeChild(ta);
}

// Prompt Removal Database Sync actions handles
function triggerRemoveTestFromDatabase(testId) {
    promptActionConfirmationModal("Бул тестти биротоло өчүрүүнү каалайсызбы? Бардык байланышкан окуучу жыйынтыктары өчүрүлүшү мүмкүн.", async () => {
        await set(ref(db, `tests/${currentUser.uid}/${testId}`), null);
        await set(ref(db, `publicTests/${testId}`), null);
        showSystemToastNotification("Тест ийгиликтүү базадан тазаланды", "warning");
        logSystemTeacherActivity(`Тест өчүрүлдү. ID: ${testId}`);
    });
}

// Wizard Modal Windows Configurations Sub-routines
function openTestWizardModal() {
    localEditingTestId = null;
    wizardQuestionsList = [];
    activeWizardQuestionIndex = null;
    currentWizardStep = 1;
    
    // Clear Input parameters
    safeAssignInputValue("wizardTestTitle", "");
    safeAssignInputValue("wizardTestSubject", "");
    safeAssignInputValue("wizardTestClass", "");
    safeAssignInputValue("wizardTestTimeLimit", "20");
    document.getElementById("wizardPublishOutput").classList.add("hidden");
    
    evaluateWizardStepDisplayState();
    document.getElementById("testWizardModal").classList.add("active");
}

function closeTestWizardModalWindow() {
    document.getElementById("testWizardModal").classList.remove("active");
}

function processWizardStepForward() {
    if (currentWizardStep === 1) {
        // Enforce validations bounds inputs values
        const title = document.getElementById("wizardTestTitle").value.trim();
        const sub = document.getElementById("wizardTestSubject").value.trim();
        if (!title || !sub) {
            showSystemToastNotification("Сураныч, милдеттүү талааларды толтуруңуз", "warning");
            return;
        }
    }
    if (currentWizardStep < 4) {
        currentWizardStep++;
        evaluateWizardStepDisplayState();
    }
}

function processWizardStepBackward() {
    if (currentWizardStep > 1) {
        currentWizardStep--;
        evaluateWizardStepDisplayState();
    }
}

// Wizard Visual Display States synchronization rules
function evaluateWizardStepDisplayState() {
    document.querySelectorAll(".wizard-step-content").forEach(c => c.classList.remove("active"));
    document.querySelectorAll(".step-indicator").forEach(s => s.classList.remove("active"));

    const activeContentPane = document.getElementById(`wizardStep${currentWizardStep}`);
    if (activeContentPane) activeContentPane.classList.add("active");

    const activeIndicator = document.querySelector(`.step-indicator[data-step="${currentWizardStep}"]`);
    if (activeIndicator) activeIndicator.classList.add("active");

    // Footers buttons visibility conditions matrices configuration rules
    toggleElementVisibility("wizardBackBtn", currentWizardStep > 1);
    toggleElementVisibility("wizardNextBtn", currentWizardStep < 4);
    toggleElementVisibility("wizardSaveBtn", currentWizardStep === 4);

    if (currentWizardStep === 2) {
        syncWizardQuestionsSidebarNavigation();
    }
}

// Wizard Questions buffer management systems
function appendBlankQuestionToWizardBuffer() {
    const nextIndex = wizardQuestionsList.length;
    wizardQuestionsList.push({
        text: `Жаңы суроо #${nextIndex + 1}`,
        type: "single",
        points: 1,
        options: ["Вариант А", "Вариант Б", "Вариант В", "Вариант Г"],
        correctAnswer: 0
    });
    activeWizardQuestionIndex = nextIndex;
    syncWizardQuestionsSidebarNavigation();
}

function syncWizardQuestionsSidebarNavigation() {
    const container = document.getElementById("wizardQuestionsNavList");
    if (!container) return;
    container.innerHTML = "";

    wizardQuestionsList.forEach((q, idx) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `q-nav-item ${idx === activeWizardQuestionIndex ? 'active' : ''}`;
        btn.innerHTML = `<span>#${idx + 1} Суроо</span> <i class="fa-solid fa-trash text-muted remove-q-trigger" data-idx="${idx}"></i>`;
        
        btn.addEventListener("click", (e) => {
            if (e.target.classList.contains("remove-q-trigger")) {
                e.stopPropagation();
                wizardQuestionsList.splice(idx, 1);
                activeWizardQuestionIndex = wizardQuestionsList.length > 0 ? 0 : null;
                syncWizardQuestionsSidebarNavigation();
                return;
            }
            activeWizardQuestionIndex = idx;
            syncWizardQuestionsSidebarNavigation();
        });
        container.appendChild(btn);
    });

    renderActiveQuestionEditorPane();
}

// Sub-editor panels engine components mapping configuration structures
function renderActiveQuestionEditorPane() {
    const pane = document.getElementById("activeQuestionEditor");
    if (!pane) return;

    if (activeWizardQuestionIndex === null || !wizardQuestionsList[activeWizardQuestionIndex]) {
        pane.innerHTML = `<div class="text-center text-muted p-5">Сол тараптан суроо тандаңыз же Жаңы Суроо кошуңуз.</div>`;
        return;
    }

    const currentQuestionStruct = wizardQuestionsList[activeWizardQuestionIndex];
    pane.innerHTML = `
        <div class="form-group">
            <label>Суроонун тексти*</label>
            <textarea id="editQText" rows="2" required>${currentQuestionStruct.text}</textarea>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Суроонун түрү</label>
                <select id="editQType">
                    <option value="single" ${currentQuestionStruct.type === 'single' ? 'selected' : ''}>Бир туура жооптуу</option>
                    <option value="multiple" ${currentQuestionStruct.type === 'multiple' ? 'selected' : ''}>Бир нече жооптуу</option>
                </select>
            </div>
            <div class="form-group">
                <label>Балл суроого*</label>
                <input type="number" id="editQPoints" value="${currentQuestionStruct.points}" min="1">
            </div>
        </div>
        <div id="optionsEditorWrapper" class="mt-2">
            <label>Жооп варианттары</label>
            ${currentQuestionStruct.options.map((opt, oIdx) => `
                <div class="hud-input-wrapper mb-2">
                    <input type="text" class="question-opt-input-field" data-oidx="${oIdx}" value="${opt}">
                </div>
            `).join('')}
            <div class="form-group mt-2">
                <label>Туура варианттын индекси (0-ден баштап: 0=А, 1=Б...)</label>
                <input type="number" id="editQCorrectIndex" value="${currentQuestionStruct.correctAnswer}" min="0" max="3">
            </div>
        </div>
    `;

    // Bind real-time input fields reflection events handles backwards mapping to buffers
    const editQText = document.getElementById("editQText");
    if (editQText) {
        editQText.addEventListener("input", (e) => {
            wizardQuestionsList[activeWizardQuestionIndex].text = e.target.value;
        });
    }
    const editQType = document.getElementById("editQType");
    if (editQType) {
        editQType.addEventListener("change", (e) => {
            wizardQuestionsList[activeWizardQuestionIndex].type = e.target.value;
        });
    }
    const editQPoints = document.getElementById("editQPoints");
    if (editQPoints) {
        editQPoints.addEventListener("input", (e) => {
            wizardQuestionsList[activeWizardQuestionIndex].points = parseInt(e.target.value) || 1;
        });
    }
    const editQCorrectIndex = document.getElementById("editQCorrectIndex");
    if (editQCorrectIndex) {
        editQCorrectIndex.addEventListener("input", (e) => {
            wizardQuestionsList[activeWizardQuestionIndex].correctAnswer = parseInt(e.target.value) || 0;
        });
    }

    pane.querySelectorAll(".question-opt-input-field").forEach(optInput => {
        optInput.addEventListener("input", (e) => {
            const oIdx = parseInt(optInput.getAttribute("data-oidx"));
            wizardQuestionsList[activeWizardQuestionIndex].options[oIdx] = e.target.value;
        });
    });
}

// Master execution saving compilation workflow updates databases node values sync
async function finalizeAndSaveWizardTest() {
    try {
        const title = document.getElementById("wizardTestTitle").value.trim();
        const subject = document.getElementById("wizardTestSubject").value.trim();
        const testClass = document.getElementById("wizardTestClass").value.trim();
        const timeLimit = parseInt(document.getElementById("wizardTestTimeLimit").value) || 20;
        const difficulty = document.getElementById("wizardTestDifficulty").value;

        if (wizardQuestionsList.length === 0) {
            showSystemToastNotification("Тестте кеминде бир суроо болушу шарт!", "error");
            return;
        }

        const targetKeyId = localEditingTestId || push(ref(db, `tests/${currentUser.uid}`)).key;

        const payloadTestStructure = {
            title,
            subject,
            class: testClass,
            timeLimit,
            difficulty,
            status: "published", // Default publication deployment triggers
            teacherId: currentUser.uid,
            teacherName: teacherProfileData.fullName || "Мугалим",
            questions: wizardQuestionsList,
            shuffleQuestions: document.getElementById("securityShuffleQuestions").checked,
            shuffleOptions: document.getElementById("securityShuffleOptions").checked,
            antiCheat: document.getElementById("securityAntiCheatActive").checked,
            fullscreen: document.getElementById("securityFullscreenRequired).checked,
            timestamp: Date.now()
        };

        // Write atomic structure bundles to both root indexes nodes paths
        const transactionalUpdates = {};
        transactionalUpdates[`tests/${currentUser.uid}/${targetKeyId}`] = payloadTestStructure;
        transactionalUpdates[`publicTests/${targetKeyId}`] = payloadTestStructure;

        await update(ref(db), transactionalUpdates);

        showSystemToastNotification("Тест ийгиликтүү сакталды жана жарыяланды!", "success");
        logSystemTeacherActivity(`Жаңы тест жарыяланды: "${title}"`);
        trackGoogleAnalyticsEvent("test_created");

        // Display results absolute structures configurations nodes fields properties links
        const absoluteTargetUrl = `${window.location.origin}/sections/student-test.html?test=${targetKeyId}`;
        safeAssignInputValue("generatedTestUrl", absoluteTargetUrl);
        
        const qrContainer = document.getElementById("generatedTestQrContainer");
        if (qrContainer) {
            qrContainer.innerHTML = "";
            new QRCode(qrContainer, { text: absoluteTargetUrl, width: 140, height: 140 });
        }
        document.getElementById("wizardPublishOutput").classList.remove("hidden");

    } catch (err) {
        showSystemToastNotification("Сактоо катасы: " + err.message, "error");
    }
}

// Trigger Load Existing Node structures to parameters wizards configurations properties fields mapping
async function triggerLoadExistingTestToWizard(testId) {
    try {
        const testSnapshot = await get(ref(db, `tests/${currentUser.uid}/${testId}`));
        if (!testSnapshot.exists()) return;

        const targetDataStruct = testSnapshot.val();
        localEditingTestId = testId;
        wizardQuestionsList = targetDataStruct.questions || [];
        activeWizardQuestionIndex = wizardQuestionsList.length > 0 ? 0 : null;
        currentWizardStep = 1;

        safeAssignInputValue("wizardTestTitle", targetDataStruct.title);
        safeAssignInputValue("wizardTestSubject", targetDataStruct.subject);
        safeAssignInputValue("wizardTestClass", targetDataStruct.class);
        safeAssignInputValue("wizardTestTimeLimit", targetDataStruct.timeLimit);
        safeAssignInputValue("wizardTestDifficulty", targetDataStruct.difficulty);

        document.getElementById("securityShuffleQuestions").checked = !!targetDataStruct.shuffleQuestions;
        document.getElementById("securityShuffleOptions").checked = !!targetDataStruct.shuffleOptions;
        document.getElementById("securityAntiCheatActive").checked = !!targetDataStruct.antiCheat;
        document.getElementById("securityFullscreenRequired").checked = !!targetDataStruct.fullscreen;

        document.getElementById("wizardPublishOutput").classList.add("hidden");
        evaluateWizardStepDisplayState();
        document.getElementById("testWizardModal").classList.add("active");

    } catch (err) {
        showSystemToastNotification("Тест жүктөлүү катасы", "error");
    }
}

// Filtration search operations modules routines functions implementations bounds
function triggerCatalogFilteringSearch() {
    const queryTerm = document.getElementById("testSearchInput").value.toLowerCase();
    const diffTerm = document.getElementById("testFilterDifficulty").value;

    const matchedFilteredBuffer = {};
    Object.keys(loadertestsMap).forEach(key => {
        const t = loadertestsMap[key];
        const matchText = t.title.toLowerCase().includes(queryTerm) || t.subject.toLowerCase().includes(queryTerm);
        const matchDiff = diffTerm === "all" || t.difficulty === diffTerm;

        if (matchText && matchDiff) matchedFilteredBuffer[key] = t;
    });

    renderTeacherCatalogGrid(matchedFilteredBuffer);
}

// Commit operational fields descriptors records data sets structures payloads
async function commitTeacherProfileUpdates() {
    try {
        const name = document.getElementById("profileInputName").value.trim();
        const subject = document.getElementById("profileInputSubject").value.trim();
        const school = document.getElementById("profileInputSchool").value.trim();

        const updates = {
            fullName: name,
            subject: subject,
            school: school
        };

        await update(ref(db, `teachers/${currentUser.uid}`), updates);
        showSystemToastNotification("Профиль ийгиликтүү жаңыртылды!", "success");
        logSystemTeacherActivity("Профиль маалыматтары өзгөртүлдү");
        await fetchTeacherProfileAndAuthorize();
    } catch (err) {
        showSystemToastNotification("Ката катталды: " + err.message, "error");
    }
}

// Profile Images Upload Processor runtime execution structures logic handlers
async function processAvatarFileUpload(fileNodeReference) {
    try {
        showSystemToastNotification("Сүрөт жүктөлүп жатат...", "warning");
        const targetRefPath = storageRef(storage, `teachers/${currentUser.uid}/avatar_${Date.now()}`);
        const uploadSnapshot = await uploadBytes(targetRefPath, fileNodeReference);
        const externalDownloadUrl = await getDownloadURL(uploadSnapshot.ref);

        await update(ref(db, `teachers/${currentUser.uid}`), { avatarUrl: externalDownloadUrl });
        showSystemToastNotification("Профиль сүрөтү жаңыртылды", "success");
        await fetchTeacherProfileAndAuthorize();
    } catch (err) {
        showSystemToastNotification("Файл жүктөө катасы: " + err.message, "error");
    }
}

// Secret Administration Monitor Initializer modules functions structures bindings
function initializeAdminPanelTerminal() {
    onValue(ref(db, `teacherActivity`), (snapshot) => {
        const adminTableBody = document.getElementById("adminGlobalLogTableBody");
        if (!adminTableBody) return;
        adminTableBody.innerHTML = "";

        if (snapshot.exists()) {
            let globalLogsArray = [];
            snapshot.forEach(teacherNode => {
                const tUid = teacherNode.key;
                teacherNode.forEach(actNode => {
                    globalLogsArray.push({ tUid, ...actNode.val() });
                });
            });

            globalLogsArray.sort((a,b) => b.timestamp - a.timestamp);
            safeUpdateInnerText("adminTotalTeachers", Object.keys(snapshot.val()).length);

            globalLogsArray.forEach(log => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td><span class="text-muted">${new Date(log.timestamp).toLocaleString()}</span></td>
                    <td><span class="text-monospace text-cyan">${log.tUid}</span></td>
                    <td><span class="badge-active px-2 py-1 rounded">${log.type || 'SYSTEM'}</span></td>
                    <td>${log.message}</td>
                `;
                adminTableBody.appendChild(tr);
            });
        } else {
            adminTableBody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">Аракеттер журналы бош</td></tr>`;
        }
    });
}

// Global Core Infrastructure Utilities abstractions helpers functions metrics bindings
function logSystemTeacherActivity(messageStringText, typeDescriptor = "OPERATIONS") {
    if (!currentUser) return;
    const logNodeRef = ref(db, `teacherActivity/${currentUser.uid}`);
    push(logNodeRef, {
        message: messageStringText,
        type: typeDescriptor,
        timestamp: Date.now()
    });
}

function promptActionConfirmationModal(promptMessageTextText, actionCallbackHandlerFunction) {
    const modal = document.getElementById("confirmModal");
    const confirmBtn = document.getElementById("confirmModalConfirmBtn");
    const textNode = document.getElementById("confirmModalText");
    
    if (!modal || !confirmBtn || !textNode) return;
    textNode.innerText = promptMessageTextText;

    // Reset clean handlers execution structures instances references bindings allocations handles
    const clearActionClone = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(clearActionClone, confirmBtn);

    clearActionClone.addEventListener("click", () => {
        actionCallbackHandlerFunction();
        modal.classList.remove("active");
    });

    modal.classList.add("active");
}

function exportMetricsToCSV() {
    if (loadedResultsList.length === 0) return;
    let csvPayloadContentString = "Name,Class,Test Title,Score,Percentage,AntiCheat,Timestamp\n";
    loadedResultsList.forEach(r => {
        csvPayloadContentString += `"${r.studentName}","${r.studentClass}","${r.testTitle}",${r.score},${r.percentage},${r.antiCheatViolations},"${new Date(r.timestamp).toISOString()}"\n`;
    });
    triggerFileDownloadBlob(csvPayloadContentString, "Bilimal_Results_Export.csv", "text/csv;charset=utf-8;");
    trackGoogleAnalyticsEvent("result_exported");
}

function exportMetricsToJSONBackup() {
    if (loadedResultsList.length === 0) return;
    const dataStringJson = JSON.stringify(loadedResultsList, null, 2);
    triggerFileDownloadBlob(dataStringJson, "Bilimal_Backup_Data.json", "application/json");
}

function triggerFileDownloadBlob(contentPayloadString, filenameString, mimeTypeString) {
    const blobRef = new Blob([contentPayloadString], { type: mimeTypeString });
    const urlLink = URL.createObjectURL(blobRef);
    const hiddenAnchorElement = document.createElement("a");
    hiddenAnchorElement.href = urlLink;
    hiddenAnchorElement.setAttribute("download", filenameString);
    document.body.appendChild(hiddenAnchorElement);
    hiddenAnchorElement.click();
    document.body.removeChild(hiddenAnchorElement);
}

function showSystemToastNotification(messageContentText, categoryTypeClass = "success") {
    const container = document.getElementById("toastContainer");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = `hud-toast ${categoryTypeClass}`;
    toast.innerHTML = `<i class="fa-solid ${categoryTypeClass === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation'}"></i> <span>${messageContentText}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 4000);
}

function triggerAccountSignOut() {
    signOut(auth).then(() => {
        window.location.href = "../login.html";
    });
}

function safeBindClickEvent(elementIdString, callbackFunction) {
    const targetNode = document.getElementById(elementIdString);
    if (targetNode) targetNode.addEventListener("click", callbackFunction);
}

function safeUpdateInnerText(elementIdString, outputText) {
    const node = document.getElementById(elementIdString);
    if (node) node.innerText = outputText;
}

function safeAssignInputValue(elementIdString, targetValue) {
    const node = document.getElementById(elementIdString);
    if (node) node.value = targetValue;
}

function toggleElementVisibility(elementIdString, shouldBeVisibleConditionBoolean) {
    const node = document.getElementById(elementIdString);
    if (node) {
        if (shouldBeVisibleConditionBoolean) node.classList.remove("hidden");
        else node.classList.add("hidden");
    }
}

function updateStatusIndicator(statusStringText) {
    safeUpdateInnerText("userStatusText", statusStringText);
}

function destroyChartInstance(chartKeyIdKey) {
    if (chartInstances[chartKeyIdKey]) {
        chartInstances[chartKeyIdKey].destroy();
        chartInstances[chartKeyIdKey] = null;
    }
}

function trackGoogleAnalyticsEvent(eventNameString) {
    if (typeof gtag === 'function') {
        gtag('event', eventNameString);
    }
}
