import { Storage, KEYS } from './storage.js';
import { Utils } from './utils.js';
import { UI } from './ui.js';

export const ResultsModule = {
    render() {
        const tbody = document.getElementById('resultsTableBody');
        const results = Storage.getTeacherData(KEYS.RESULTS);
        const search = document.getElementById('resultsSearchInput').value.toLowerCase();

        tbody.innerHTML = '';
        const filtered = results.filter(r => r.studentName.toLowerCase().includes(search));

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-secondary);">Жыйынтыктар бош.</td></tr>`;
            return;
        }

        filtered.forEach(r => {
            const hasCheat = r.antiCheatEvents && r.antiCheatEvents.length > 0;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${Utils.safeText(r.studentName)}</strong> (${Utils.safeText(r.className)})</td>
                <td>${Utils.safeText(r.testTitle)}</td>
                <td><span style="font-weight:700; color:var(--cyan-accent);">${r.score} / ${r.totalPoints}</span></td>
                <td>${r.percentage}%</td>
                <td><small>${new Date(r.submittedAt).toLocaleDateString()}</small></td>
                <td><span style="color:${hasCheat ? 'var(--danger-color)' : 'var(--success-color)'}">${hasCheat ? 'Катталды ('+r.antiCheatEvents.length+')' : 'Таза'}</span></td>
                <td><button class="btn btn-secondary" style="padding:4px 8px; font-size:12px;" onclick="window.viewResultDetail('${r.id}')"><i class="fas fa-expand"></i> Көрүү</button></td>
            `;
            tbody.appendChild(tr);
        });
    },

    init() {
        document.getElementById('resultsSearchInput').oninput = () => this.render();
        document.getElementById('btnExportResultsExcel').onclick = () => this.exportCSV();
    },

    exportCSV() {
        const results = Storage.getTeacherData(KEYS.RESULTS);
        let csv = "\uFEFFОкуучу,Класс,Тест,Упай,Пайыз,Античит\n";
        results.forEach(r => {
            csv += `"${r.studentName}","${r.className}","${r.testTitle}",${r.score}/${r.totalPoints},${r.percentage}%,${r.antiCheatEvents?.length || 0}\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.setAttribute("download", "BilimAl_Results.csv");
        link.click();
        UI.showToast("CSV/Excel файлы ийгиликтүү экспорттолду.");
    }
};

window.viewResultDetail = (id) => {
    const results = Storage.getTeacherData(KEYS.RESULTS);
    const r = results.find(res => res.id === id);
    if (!r) return;

    UI.openModal(`
        <h3><i class="fas fa-poll-h"></i> Окуучунун жеке картасы</h3>
        <div style="margin:15px 0; font-size:14px; display:flex; flex-direction:column; gap:6px;">
            <p><strong>Окуучу:</strong> ${Utils.safeText(r.studentName)}</p>
            <p><strong>Класс:</strong> ${Utils.safeText(r.className)} (Коду: ${r.studentCode})</p>
            <p><strong>Тест:</strong> ${Utils.safeText(r.testTitle)}</p>
            <p><strong>Жалпы Баа:</strong> <span style="color:var(--cyan-accent); font-weight:700;">${r.score} / ${r.totalPoints} (${r.percentage}%)</span></p>
        </div>
        <div style="background:var(--bg-dark-main); padding:12px; border-radius:var(--radius-md); max-height:200px; overflow-y:auto;">
            <h5>Античит окуяларынын журналы:</h5>
            ${r.antiCheatEvents && r.antiCheatEvents.length > 0 
                ? r.antiCheatEvents.map(e => `<p style="color:var(--danger-color); font-size:12px; margin-top:4px;"><i class="fas fa-shield-alt"></i> ${Utils.escapeHTML(e)}</p>`).join('')
                : '<p style="color:var(--success-color); font-size:12px; margin-top:4px;">Эч кандай шектүү аракет катталган жок.</p>'
            }
        </div>
        <button class="btn btn-primary" style="margin-top:20px; width:100%;" onclick="appUI.closeModal()">Жабуу</button>
    `);
};
