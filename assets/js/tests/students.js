import { Storage, KEYS } from './storage.js';
import { Utils } from './utils.js';
import { UI } from './ui.js';

export const StudentsModule = {
    render() {
        const tbody = document.getElementById('studentsTableBody');
        const students = Storage.getTeacherData(KEYS.STUDENTS);
        const search = document.getElementById('studentSearchInput').value.toLowerCase();
        
        tbody.innerHTML = '';
        const filtered = students.filter(s => s.fullName.toLowerCase().includes(search) || s.studentCode.toLowerCase().includes(search));

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-secondary);">Окуучулар табылган жок.</td></tr>`;
            return;
        }

        filtered.forEach(s => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${Utils.safeText(s.fullName)}</strong></td>
                <td><span class="badge badge-active">${Utils.safeText(s.className, 'Бейтааныш')}</span></td>
                <td><code>${Utils.safeText(s.studentCode)}</code></td>
                <td>
                    <button class="btn btn-danger" style="padding:4px 8px; font-size:12px;" onclick="window.deleteStudent('${s.id}')"><i class="fas fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    init() {
        document.getElementById('studentSearchInput').oninput = () => this.render();
        
        document.getElementById('btnOpenAddStudentModal').onclick = () => {
            const classes = Storage.getTeacherData(KEYS.CLASSES);
            let classOptions = classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
            
            UI.openModal(`
                <h3><i class="fas fa-user-plus"></i> Жаңы окуучу кошуу</h3>
                <div class="form-group" style="margin-top:15px;">
                    <label>Окуучунун аты-жөнү *</label>
                    <input type="text" id="mStudentName" class="form-control" placeholder="Мисалы: Болот Асанов">
                </div>
                <div class="form-group" style="margin-top:12px; margin-bottom:20px;">
                    <label>Класс тандоо *</label>
                    <select id="mStudentClassId" class="form-control">
                        <option value="">Тандаңыз...</option>
                        ${classOptions}
                    </select>
                </div>
                <div style="display:flex; justify-content:flex-end; gap:10px;">
                    <button class="btn btn-secondary" onclick="appUI.closeModal()">Жокко чыгаруу</button>
                    <button class="btn btn-primary" id="mStudentSubmit">Кошуу</button>
                </div>
            `);

            document.getElementById('mStudentSubmit').onclick = () => {
                const fullName = document.getElementById('mStudentName').value.trim();
                const classId = document.getElementById('mStudentClassId').value;
                const targetClass = classes.find(c => c.id === classId);

                if (!fullName || !classId) {
                    UI.showToast("Бардык талааларды толтуруңуз!", "danger");
                    return;
                }

                const newStudent = {
                    id: Utils.generateUUID(),
                    fullName, classId, className: targetClass.name,
                    studentCode: Utils.generateStudentCode(), status: "active", createdAt: new Date().toISOString()
                };

                Storage.saveTeacherData(KEYS.STUDENTS, newStudent);
                UI.showToast("Окуучу кошулду.");
                UI.closeModal();
                this.render();
            };
        };

        // CSV Import Trigger Bridge Logic
        document.getElementById('btnTriggerCSVImport').onclick = () => document.getElementById('csvFileInput').click();
        document.getElementById('csvFileInput').onchange = (e) => this.handleCSV(e);
    },

    handleCSV(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const text = evt.target.result;
            const lines = text.split('\n');
            let count = 0;
            
            const classes = Storage.getTeacherData(KEYS.CLASSES);
            if (classes.length === 0) {
                UI.showToast("Адегенде 'Класстарым' бөлүмүнө жок дегенде 1 класс түзүңүз!", "danger");
                return;
            }
            const defaultClass = classes[0];

            lines.forEach(line => {
                const name = line.trim();
                if (name.length > 2) {
                    const newStudent = {
                        id: Utils.generateUUID(),
                        fullName: name, classId: defaultClass.id, className: defaultClass.name,
                        studentCode: Utils.generateStudentCode(), status: "active", createdAt: new Date().toISOString()
                    };
                    Storage.saveTeacherData(KEYS.STUDENTS, newStudent);
                    count++;
                }
            });
            UI.showToast(`Ийгиликтүү импорттолду: ${count} окуучу. Класс: ${defaultClass.name}`);
            this.render();
        };
        reader.readAsText(file);
    }
};

window.deleteStudent = (id) => {
    if (confirm("Бул окуучуну тизмеден өчүрөсүзбү?")) {
        Storage.deleteTeacherData(KEYS.STUDENTS, id);
        UI.showToast("Окуучу өчүрүлдү.");
        StudentsModule.render();
    }
};
