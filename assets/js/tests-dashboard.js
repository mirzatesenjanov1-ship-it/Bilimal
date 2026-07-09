// Bilimal-AI Project - Teacher Tests Dashboard Control Module
(function () {
    const BF = window.BilimalFirebase;
    const BS = window.BilimalStorage;
    const BA = window.BilimalAuth;

    let currentTests = {};

    function loadDashboard() {
        if (!BA.isTeacher()) {
            BF.showToast("Бул баракка кирүүгө уруксатыңыз жок", "error");
            return;
        }
        loadTeacherTests();
    }

    function loadTeacherTests() {
        const teacherId = BF.getCurrentTeacherId();
        
        if (BF.isFirebaseAvailable() && BA.canViewTeacherData(teacherId)) {
            BF.getDatabaseInstance().ref(`/teachers/${teacherId}/tests`).once('value')
                .then((snapshot) => {
                    currentTests = snapshot.val() || {};
                    BS.setLocalData('bilimal_teacher_tests', currentTests);
                    renderDashboardAll();
                })
                .catch((err) => {
                    console.error(err);
                    currentTests = BS.getTestsLocal();
                    renderDashboardAll();
                });
        } else {
            currentTests = BS.getTestsLocal();
            renderDashboardAll();
        }
    }

    function renderDashboardAll() {
        renderTestsList();
        renderStats();
    }

    function renderTestsList(filteredData = null) {
        const container = document.getElementById('dashboard-tests-container');
        if (!container) return;

        const dataToRender = filteredData || Object.values(currentTests);
        container.innerHTML = "";

        if (dataToRender.length === 0) {
            container.innerHTML = `<div class="empty-state-notice"><p>Тесттер табылган жок. Жаңы тест түзүңүз.</p></div>`;
            return;
        }

        dataToRender.forEach(test => {
            const testRow = document.createElement('div');
            testRow.className = `test-item-card ${test.isArchived ? 'status-archived' : 'status-active'}`;
            testRow.style.borderLeft = `5px solid ${test.isPublished ? '#2ec4b6' : '#ff9f1c'}`;
            testRow.innerHTML = `
                <div class="test-meta-info">
                    ### ${BF.sanitizeData(test.title || 'Аталышсыз тест')}
                    <p>Предмет: **${BF.sanitizeData(test.subject || 'Жок')}** | Класс: **${BF.sanitizeData(test.classLevel || 'Жок')}**</p>
                    <p>Суроолор: ${test.questions ? Object.keys(test.questions).length : 0} | Өтүү упайы: ${test.passingScore || 0}</p>
                </div>
                <div class="test-action-buttons" style="margin-top: 10px;">
                    <button class="btn-dashboard-action btn-edit" data-id="${test.id}">Оңдоо</button>
                    <button class="btn-dashboard-action btn-duplicate" data-id="${test.id}">Көчүрүү</button>
                    <button class="btn-dashboard-action btn-results" data-id="${test.id}">Жыйынтыктар</button>
                    <button class="btn-dashboard-action ${test.isPublished ? 'btn-unpublish' : 'btn-publish'}" data-id="${test.id}">
                        ${test.isPublished ? 'Жарыядан ал' : 'Жарыяла'}
                    </button>
                    <button class="btn-dashboard-action ${test.isArchived ? 'btn-restore' : 'btn-archive'}" data-id="${test.id}">
                        ${test.isArchived ? 'Калыбына келтир' : 'Архивке'}
                    </button>
                    <button class="btn-dashboard-action btn-delete" data-id="${test.id}" style="background-color: #e71d36; color:#fff;">Өчүрүү</button>
                </div>
                <hr style="border: 0; border-top: 1px solid #eee; margin: 15px 0;">
            `;
            container.appendChild(testRow);
        });

        bindDynamicCardEvents();
    }

    function renderStats() {
        const testsArray = Object.values(currentTests);
        const results = BS.getResultsLocal();
        const resultsArray = Object.values(results);

        const totalTests = testsArray.length;
        const activeTests = testsArray.filter(t => !t.isArchived && t.isPublished).length;
        const archivedTests = testsArray.filter(t => t.isArchived).length;
        const totalSubmissions = resultsArray.length;

        let totalScoreSum = 0;
        resultsArray.forEach(r => totalScoreSum += (r.finalScore || 0));
        const avgScore = totalSubmissions > 0 ? (totalScoreSum / totalSubmissions).toFixed(1) : 0;

        const statMappings = {
            'stat-total-tests': totalTests,
            'stat-active-tests': activeTests,
            'stat-archived-tests': archivedTests,
            'stat-total-submissions': totalSubmissions,
            'stat-avg-score': avgScore,
            'stat-today-activity': resultsArray.filter(r => new Date(r.timestamp).toDateString() === new Date().toDateString()).length
        };

        for (const [id, val] of Object.entries(statMappings)) {
            const el = document.getElementById(id);
            if (el) el.innerText = val;
        }
    }

    function createNewTest() {
        const newId = BF.generateId('test');
        const defaultTest = {
            id: newId,
            title: "Жаңы Тест (" + new Date().toLocaleDateString() + ")",
            subject: "Физика",
            classLevel: "7-А",
            description: "",
            timeLimit: 45,
            passingScore: 60,
            maxScore: 100,
            isPublished: false,
            isArchived: false,
            questions: {},
            antiCheatSettings: { tabTracking: true, preventCopyPaste: true, forceFullscreen: false }
        };
        currentTests[newId] = defaultTest;
        BS.saveTestLocal(defaultTest);
        BF.logSystemEvent("test_created", { testId: newId });
        openTestEditor(newId);
    }

    function editTest(testId) {
        openTestEditor(testId);
    }

    function duplicateTest(testId) {
        if (!currentTests[testId]) return;
        const source = currentTests[testId];
        const copyId = BF.generateId('test');
        const duplicated = {
            ...source,
            id: copyId,
            title: `${source.title} (Көчүрмө)`,
            isPublished: false
        };
        currentTests[copyId] = duplicated;
        BS.saveTestLocal(duplicated);
        BF.showToast("Тест ийгиликтүү көчүрүлдү", "success");
        renderDashboardAll();
    }

    function deleteTest(testId) {
        if (confirm("Бул тестти биротоло өчүрүүнү каалайсызбы?")) {
            delete currentTests[testId];
            BS.deleteTestLocal(testId);
            renderDashboardAll();
        }
    }

    function archiveTest(testId) {
        if (currentTests[testId]) {
            currentTests[testId].isArchived = true;
            BS.saveTestLocal(currentTests[testId]);
            BF.showToast("Тест архивделди", "info");
            renderDashboardAll();
        }
    }

    function restoreTest(testId) {
        if (currentTests[testId]) {
            currentTests[testId].isArchived = false;
            BS.saveTestLocal(currentTests[testId]);
            BF.showToast("Тест архивден чыгарылды", "success");
            renderDashboardAll();
        }
    }

    function publishTest(testId) {
        if (currentTests[testId]) {
            currentTests[testId].isPublished = true;
            BS.saveTestLocal(currentTests[testId]);
            BF.showToast("Тест жарыяланды", "success");
            renderDashboardAll();
        }
    }

    function unpublishTest(testId) {
        if (currentTests[testId]) {
            currentTests[testId].isPublished = false;
            BS.saveTestLocal(currentTests[testId]);
            BF.showToast("Тест жарыядан чыгарылды", "info");
            renderDashboardAll();
        }
    }

    function searchTests() {
        const q = (document.getElementById('search-tests-input')?.value || '').toLowerCase();
        const filtered = Object.values(currentTests).filter(t => 
            (t.title || '').toLowerCase().includes(q) || (t.subject || '').toLowerCase().includes(q)
        );
        renderTestsList(filtered);
    }

    function filterAndSortTests() {
        let list = Object.values(currentTests);
        
        const subjectFilter = document.getElementById('filter-subject-select')?.value;
        const classFilter = document.getElementById('filter-class-select')?.value;
        const statusFilter = document.getElementById('filter-status-select')?.value;
        const sortBy = document.getElementById('sort-tests-select')?.value;

        if (subjectFilter && subjectFilter !== 'all') {
            list = list.filter(t => t.subject === subjectFilter);
        }
        if (classFilter && classFilter !== 'all') {
            list = list.filter(t => t.classLevel === classFilter);
        }
        if (statusFilter && statusFilter !== 'all') {
            if (statusFilter === 'published') list = list.filter(t => t.isPublished && !t.isArchived);
            if (statusFilter === 'draft') list = list.filter(t => !t.isPublished && !t.isArchived);
            if (statusFilter === 'archived') list = list.filter(t => t.isArchived);
        }

        if (sortBy === 'title') {
            list.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        } else if (sortBy === 'questions') {
            list.sort((a, b) => Object.keys(b.questions || {}).length - Object.keys(a.questions || {}).length);
        } else {
            list.sort((a, b) => b.id.localeCompare(a.id));
        }

        renderTestsList(list);
    }

    function openTestEditor(testId) {
        localStorage.setItem('bilimal_editing_test_id', testId);
        BF.showToast("Редактор ачылууда...", "info");
        const editorTab = document.getElementById('tab-test-editor-btn');
        if (editorTab) editorTab.click();
        if (window.BilimalEditor && typeof window.BilimalEditor.loadEditor === 'function') {
            window.BilimalEditor.loadEditor(testId);
        }
    }

    function openResults(testId) {
        localStorage.setItem('bilimal_viewing_result_test_id', testId);
        BF.showToast("Жыйынтыктар жүктөлүүдө...", "info");
        const resultsTab = document.getElementById('tab-results-btn');
        if (resultsTab) resultsTab.click();
        if (window.BilimalResults && typeof window.BilimalResults.loadTestResults === 'function') {
            window.BilimalResults.loadTestResults(testId);
        }
    }

    function exportTestsToJson() {
        BS.exportAllTeacherData();
    }

    function importTestsFromJson(file) {
        BS.importTeacherData(file);
    }

    function exportTestsToCsv() {
        let csvContent = "\uFEFFИД,Аталышы,Предмет,Класс,Суроолор Саны,Статус\n";
        Object.values(currentTests).forEach(t => {
            const status = t.isArchived ? "Архив" : (t.isPublished ? "Жарыяланган" : "Черновик");
            const qCount = t.questions ? Object.keys(t.questions).length : 0;
            csvContent += `"${t.id}","${t.title}","${t.subject}","${t.classLevel}",${qCount},"${status}"\n`;
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Bilimal_Tests_Export_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    }

    function downloadYearlyReport() {
        if (window.BilimalResults && typeof window.BilimalResults.exportYearlyResultsCsv === 'function') {
            window.BilimalResults.exportYearlyResultsCsv();
        } else {
            BF.showToast("Жыйынтыктар модулу табылган жок", "error");
        }
    }

    function refreshDashboard() {
        loadTeacherTests();
        BF.showToast("Башкаруу панели жаңыртылды", "success");
    }

    function bindDashboardEvents() {
        document.getElementById('btn-create-test')?.addEventListener('click', createNewTest);
        document.getElementById('btn-refresh-dashboard')?.addEventListener('click', refreshDashboard);
        document.getElementById('btn-export-json')?.addEventListener('click', exportTestsToJson);
        document.getElementById('btn-export-csv')?.addEventListener('click', exportTestsToCsv);
        document.getElementById('btn-yearly-report')?.addEventListener('click', downloadYearlyReport);
        
        document.getElementById('search-tests-input')?.addEventListener('input', searchTests);
        document.getElementById('filter-subject-select')?.addEventListener('change', filterAndSortTests);
        document.getElementById('filter-class-select')?.addEventListener('change', filterAndSortTests);
        document.getElementById('filter-status-select')?.addEventListener('change', filterAndSortTests);
        document.getElementById('sort-tests-select')?.addEventListener('change', filterAndSortTests);

        const fileInput = document.getElementById('import-json-file-input');
        fileInput?.addEventListener('change', (e) => {
            if (e.target.files.length > 0) importTestsFromJson(e.target.files[0]);
        });
    }

    function bindDynamicCardEvents() {
        document.querySelectorAll('.btn-edit').forEach(b => b.addEventListener('click', () => editTest(b.getAttribute('data-id'))));
        document.querySelectorAll('.btn-duplicate').forEach(b => b.addEventListener('click', () => duplicateTest(b.getAttribute('data-id'))));
        document.querySelectorAll('.btn-results').forEach(b => b.addEventListener('click', () => openResults(b.getAttribute('data-id'))));
        document.querySelectorAll('.btn-publish').forEach(b => b.addEventListener('click', () => publishTest(b.getAttribute('data-id'))));
        document.querySelectorAll('.btn-unpublish').forEach(b => b.addEventListener('click', () => unpublishTest(b.getAttribute('data-id'))));
        document.querySelectorAll('.btn-archive').forEach(b => b.addEventListener('click', () => archiveTest(b.getAttribute('data-id'))));
        document.querySelectorAll('.btn-restore').forEach(b => b.addEventListener('click', () => restoreTest(b.getAttribute('data-id'))));
        document.querySelectorAll('.btn-delete').forEach(b => b.addEventListener('click', () => deleteTest(b.getAttribute('data-id'))));
    }

    document.addEventListener("DOMContentLoaded", () => {
        bindDashboardEvents();
        loadDashboard();
    });

    window.BilimalDashboard = {
        loadDashboard,
        refreshDashboard,
        openTestEditor,
        openResults
    };
})();
