// Bilimal-AI Project - Student Test Results Management Module
(function () {
    const BF = window.BilimalFirebase;
    const BS = window.BilimalStorage;

    let currentTestId = null;
    let currentResults = [];

    function loadTestResults(testId) {
        currentTestId = testId || localStorage.getItem('bilimal_viewing_result_test_id');
        if (!currentTestId) return;

        if (BF.isFirebaseAvailable()) {
            BF.getDatabaseInstance().ref(`/teachers/${BF.getCurrentTeacherId()}/results`)
                .once('value')
                .then(snapshot => {
                    const allResults = snapshot.val() || {};
                    currentResults = Object.values(allResults).filter(r => r.testId === currentTestId);
                    renderResultsTable();
                })
                .catch(() => {
                    fallbackToLocalResults();
                });
        } else {
            fallbackToLocalResults();
        }
    }

    function fallbackToLocalResults() {
        const local = BS.getResultsLocal();
        currentResults = Object.values(local).filter(r => r.testId === currentTestId);
        renderResultsTable();
    }

    function renderResultsTable() {
        const container = document.getElementById('results-table-view-container');
        if (!container) return;

        container.innerHTML = "";
        const grouped = groupResultsByClass();

        if (Object.keys(grouped).length === 0) {
            container.innerHTML = "<p>Бул тест боюнча азырынча жыйынтыктар жок.</p>";
            return;
        }

        for (const [className, studentsList] of Object.entries(grouped)) {
            const classSection = document.createElement('div');
            classSection.className = 'results-class-group-block';
            classSection.innerHTML = `<h3>Класс: ${BF.sanitizeData(className)}</h3>`;

            const table = document.createElement('table');
            table.style.width = "100%";
            table.style.borderCollapse = "collapse";
            table.innerHTML = `
                <thead>
                    <tr style="background:#f4f4f4; text-align:left;">
                        <th>Окуучу</th>
                        <th>Дата/Убакыт</th>
                        <th>Мүнөт</th>
                        <th>Упай</th>
                        <th>Баа</th>
                        <th>Античит бузуу</th>
                        <th>Аракеттер</th>
                    </tr>
                </thead>
                <tbody id="tbody-class-${className}"></tbody>
            `;

            classSection.appendChild(table);
            container.appendChild(classSection);

            const tbody = document.getElementById(`tbody-class-${className}`);
            sortStudentsAlphabetically(studentsList).forEach(res => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = "1px solid #ddd";
                tr.innerHTML = `
                    <td>**${BF.sanitizeData(res.studentName || 'Белгисиз')}**</td>
                    <td>${new Date(res.timestamp).toLocaleString()}</td>
                    <td>${res.durationMinutes || 0}</td>
                    <td>${res.finalScore || 0} / ${res.maxScore || 100}</td>
                    <td><span class="grade-badge" style="padding:4px 8px; background:#eee; borderRadius:4px;">${calculateGrade(res.finalScore, res.maxScore)}</span></td>
                    <td style="color:${res.cheatCount > 0 ? 'red' : 'green'}">${res.cheatCount || 0}</td>
                    <td>
                        <button class="btn-view-res-details" data-id="${res.id}">Көрүү</button>
                        <input type="checkbox" class="chk-mark-checked" data-id="${res.id}" ${res.isChecked ? 'checked' : ''}> Текшерилди
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }

        bindResultsActionEvents();
    }

    function groupResultsByClass() {
        const groups = {};
        currentResults.forEach(r => {
            const cls = r.studentClass || "Башкалар";
            if (!groups[cls]) groups[cls] = [];
            groups[cls].push(r);
        });
        return groups;
    }

    function sortStudentsAlphabetically(list) {
        return list.sort((a, b) => (a.studentName || '').localeCompare(b.studentName || ''));
    }

    function calculateGrade(score, maxScore) {
        const percent = (score / (maxScore || 100)) * 100;
        if (percent >= 85) return "5 (Эң жакшы)";
        if (percent >= 70) return "4 (Жакшы)";
        if (percent >= 50) return "3 (Канааттандырарлык)";
        return "2 (Канааттандырылбайт)";
    }

    function markAsChecked(resultId, isChecked) {
        const local = BS.getResultsLocal();
        if (local[resultId]) {
            local[resultId].isChecked = isChecked;
            BS.saveResultLocal(local[resultId]);
            BF.showToast("Статус жаңыртылды", "success");
        }
    }

    function exportYearlyResultsCsv() {
        let csvContent = "\uFEFFОкуучу,Класс,Тест,Жалпы Упай,Макс Упай,Баа,Дата\n";
        const allResults = Object.values(BS.getResultsLocal());

        allResults.forEach(r => {
            csvContent += `"${r.studentName}","${r.studentClass}","${r.testTitle}",${r.finalScore},${r.maxScore},"${calculateGrade(r.finalScore, r.maxScore)}","${new Date(r.timestamp).toLocaleDateString()}"\n`;
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "BilimAI_Жылдык_Отчет_2026_2027.csv");
        document.body.appendChild(link);
        link.click();
        link.remove();
    }

    function bindResultsActionEvents() {
        document.querySelectorAll('.chk-mark-checked').forEach(chk => {
            chk.addEventListener('change', (e) => {
                markAsChecked(e.target.getAttribute('data-id'), e.target.checked);
            });
        });

        document.querySelectorAll('.btn-view-res-details').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const resId = e.target.getAttribute('data-id');
                BF.showToast(`Жыйынтык ИД: ${resId}`, "info");
            });
        });
    }

    document.addEventListener("DOMContentLoaded", () => {
        document.getElementById('btn-export-yearly-csv')?.addEventListener('click', exportYearlyResultsCsv);
    });

    window.BilimalResults = {
        loadTestResults,
        exportYearlyResultsCsv,
        calculateGrade
    };
})();
