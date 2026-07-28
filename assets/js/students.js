// =============================================================
// STUDENTS.JS - Окуучулардын рейтинги жана аналитикасы
// =============================================================

let rawResultsData = [];
let processedStudents = [];

// Скрипт жүктөлгөндө маалыматтарды тартып алуу
document.addEventListener('DOMContentLoaded', () => {
    loadStudentData();
});

function loadStudentData() {
    const tbody = document.getElementById('studentsTableBody');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #94a3b8; padding: 30px;"><i class="fa-solid fa-spinner fa-spin"></i> Маалыматтар жүктөлүүдө...</td></tr>';
    }

    // Бардык потенциалдуу даректерди (түзүмдөрдү) камтуу
    const promises = [
        db.ref('teachers_data').once('value'),
        db.ref('global_test_lookup/results').once('value'),
        db.ref('results').once('value'),
        db.ref('test_results').once('value')
    ];

    Promise.allSettled(promises).then(results => {
        let extractedItems = [];

        // 1. teachers_data ичинен бардык тесттердин жыйынтыктарын жыйноо
        if (results[0].status === 'fulfilled' && results[0].value.exists()) {
            const teachersData = results[0].value.val();
            Object.keys(teachersData).forEach(tUid => {
                const teacher = teachersData[tUid];
                if (teacher && teacher.tests) {
                    Object.keys(teacher.tests).forEach(testId => {
                        const testObj = teacher.tests[testId];
                        if (testObj && testObj.results) {
                            Object.keys(testObj.results).forEach(resKey => {
                                const res = testObj.results[resKey];
                                if (res && typeof res === 'object') {
                                    extractedItems.push({
                                        ...res,
                                        testTitle: res.testTitle || testObj.title || testObj.testTitle || 'Тест'
                                    });
                                }
                            });
                        }
                    });
                }
            });
        }

        // 2. Башка түзүмдөрдү текшерүү жана кошуу
        for (let i = 1; i < results.length; i++) {
            if (results[i].status === 'fulfilled' && results[i].value.exists()) {
                const val = results[i].value.val();
                if (val && typeof val === 'object') {
                    Object.keys(val).forEach(k => {
                        if (val[k] && typeof val[k] === 'object') {
                            extractedItems.push(val[k]);
                        }
                    });
                }
            }
        }

        parseAndProcess(extractedItems);
    }).catch(err => {
        console.error("Firebase маалымат алуу катасы:", err);
        renderEmptyTable();
    });
}

function parseAndProcess(items) {
    if (!items || items.length === 0) {
        renderEmptyTable();
        return;
    }

    rawResultsData = items;
    processData();
}

function processData() {
    const studentMap = {};

    rawResultsData.forEach(item => {
        const sName = item.studentName || item.name || item.fio || item.fullName;
        const sClass = item.studentClass || item.className || item.class || item.grade;

        if (!sName || !sClass) return;

        // Бирдей окуучуну аныктоо үчүн уникалдуу ачкыч (ФИО + Класс)
        const cleanName = sName.toString().trim();
        const cleanClass = sClass.toString().trim().toUpperCase();
        const uniqueKey = `${cleanName.toLowerCase()}_${cleanClass.toLowerCase()}`;

        if (!studentMap[uniqueKey]) {
            studentMap[uniqueKey] = {
                name: cleanName,
                studentClass: cleanClass,
                tests: []
            };
        }

        let score = parseFloat(item.score || item.userScore || 0);
        let maxScore = parseFloat(item.maxScore || item.totalQuestions || 0);
        let percent = parseFloat(item.percent || item.percentage || 0);

        if (!percent && maxScore > 0) {
            percent = Math.round((score / maxScore) * 100);
        }

        studentMap[uniqueKey].tests.push({
            testTitle: item.testTitle || item.title || 'Тест',
            score: score,
            maxScore: maxScore,
            percent: isNaN(percent) ? 0 : percent,
            date: item.date || item.timestamp || item.submittedAt || 'Көрсөтүлгөн эмес'
        });
    });

    processedStudents = Object.values(studentMap).map(std => {
        const totalPercent = std.tests.reduce((sum, t) => sum + t.percent, 0);
        const avgPercent = std.tests.length > 0 ? Math.round(totalPercent / std.tests.length) : 0;
        
        return {
            ...std,
            avgPercent: avgPercent,
            testCount: std.tests.length
        };
    });

    if (processedStudents.length === 0) {
        renderEmptyTable();
        return;
    }

    populateClassFilter();
    applyFilters();
}

function populateClassFilter() {
    const select = document.getElementById('classFilterSelect');
    if (!select) return;

    const classes = [...new Set(processedStudents.map(s => s.studentClass))].sort();

    select.innerHTML = '<option value="ALL">Бардык класстар</option>';
    classes.forEach(cls => {
        const opt = document.createElement('option');
        opt.value = cls;
        opt.innerText = `${cls} классы`;
        select.appendChild(opt);
    });
}

function applyFilters() {
    const classSelect = document.getElementById('classFilterSelect');
    const sortSelect = document.getElementById('sortSelect');
    const searchInput = document.getElementById('searchInput');

    const selectedClass = classSelect ? classSelect.value : 'ALL';
    const sortType = sortSelect ? sortSelect.value : 'NAME_ASC';
    const searchText = searchInput ? searchInput.value.toLowerCase().trim() : '';

    let filtered = processedStudents.filter(std => {
        const matchClass = selectedClass === 'ALL' || std.studentClass === selectedClass;
        const matchSearch = std.name.toLowerCase().includes(searchText);
        return matchClass && matchSearch;
    });

    if (sortType === 'NAME_ASC') {
        filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortType === 'RANK_DESC') {
        filtered.sort((a, b) => b.avgPercent - a.avgPercent);
    }

    renderTable(filtered);
    updateSummaryStats(filtered);
}

function renderTable(data) {
    const tbody = document.getElementById('studentsTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #94a3b8; padding: 20px;">Издөө боюнча маалымат табылган жок.</td></tr>';
        return;
    }

    data.forEach((std, index) => {
        let levelBadge = '';
        if (std.avgPercent >= 85) {
            levelBadge = '<span class="badge badge-high">Жогорку</span>';
        } else if (std.avgPercent >= 60) {
            levelBadge = '<span class="badge badge-mid">Орто</span>';
        } else {
            levelBadge = '<span class="badge badge-low">Төмөнкү</span>';
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td><strong>${escapeHtml(std.name)}</strong></td>
            <td>${escapeHtml(std.studentClass)}</td>
            <td>${std.testCount} тест</td>
            <td><strong style="color: #38bdf8;">${std.avgPercent}%</strong></td>
            <td>${levelBadge}</td>
            <td>
                <button class="btn-view" onclick='openModal(${JSON.stringify(std).replace(/'/g, "&apos;")})'>
                    <i class="fa-solid fa-eye"></i> Толугураак
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function updateSummaryStats(data) {
    const elTotal = document.getElementById('statTotalStudents');
    const elHigh = document.getElementById('statHighLevel');
    const elMid = document.getElementById('statMidLevel');
    const elLow = document.getElementById('statLowLevel');

    if (elTotal) elTotal.innerText = data.length;
    if (elHigh) elHigh.innerText = data.filter(s => s.avgPercent >= 85).length;
    if (elMid) elMid.innerText = data.filter(s => s.avgPercent >= 60 && s.avgPercent < 85).length;
    if (elLow) elLow.innerText = data.filter(s => s.avgPercent < 60).length;
}

function renderEmptyTable() {
    const tbody = document.getElementById('studentsTableBody');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #94a3b8; padding: 30px;">Базада азырынча окуучулардын тест жыйынтыктары жок.</td></tr>';
    }
}

function openModal(student) {
    document.getElementById('modalStudentName').innerText = `${student.name} (${student.studentClass})`;
    const container = document.getElementById('modalHistoryContent');
    
    let html = `
        <p style="color: #cbd5e1; margin-bottom: 12px; font-size: 14px;">Жылдык орточо көрсөткүчү: <strong style="color:#38bdf8">${student.avgPercent}%</strong></p>
        <div style="display:flex; flex-direction:column; gap:10px;">
    `;

    student.tests.forEach((t, i) => {
        html += `
            <div style="background:#0f172a; padding:12px; border-radius:8px; border:1px solid #334155; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <div style="font-weight:600; color:#e2e8f0;">${i+1}. ${escapeHtml(t.testTitle)}</div>
                    <small style="color:#64748b;">Дата: ${escapeHtml(t.date)}</small>
                </div>
                <div style="text-align:right;">
                    <span style="color:#10b981; font-weight:700;">${t.percent}%</span>
                    <div style="font-size:12px; color:#94a3b8;">${t.score} / ${t.maxScore} балл</div>
                </div>
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;
    document.getElementById('detailsModal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('detailsModal').classList.add('hidden');
}

function exportToCSV() {
    if (processedStudents.length === 0) {
        alert("Экспорттоо үчүн маалымат жок!");
        return;
    }

    let csv = '\uFEFF';
    csv += '№,ФИО,Классы,Тесттердин саны,Жылдык Орточо %,Деңгээли\n';

    processedStudents.forEach((std, i) => {
        let lvl = std.avgPercent >= 85 ? 'Жогорку' : (std.avgPercent >= 60 ? 'Орто' : 'Төмөнкү');
        csv += `"${i+1}","${std.name}","${std.studentClass}","${std.testCount}","${std.avgPercent}%","${lvl}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `Окуучулардын_рейтинги_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function resetAcademicYear() {
    const confirm1 = confirm("КӨҢҮЛ БУРУҢУЗ!\nОкуу жылын тазалоо бардык окуучулардын мурунку тест жыйынтыктарын базадан биротоло өчүрөт.\n\nУлантууну каалайсызбы?");
    if (!confirm1) return;

    const pwd = prompt("Коопсуздук үчүн паролду жазыңыз (Пароль: admin):");
    if (pwd === "admin") {
        // Бардык даректерди тазалоо
        Promise.all([
            db.ref('global_test_lookup/results').remove(),
            db.ref('results').remove(),
            db.ref('test_results').remove()
        ]).then(() => {
            alert("Жаңы окуу жылы үчүн база ийгиликтүү тазаланды!");
            location.reload();
        }).catch(err => {
            alert("Ката чыкты же айрым маалыматтар өчпөй калды: " + err.message);
        });
    } else {
        alert("Пароль туура эмес! Тазалоо токтотулду.");
    }
}

function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
