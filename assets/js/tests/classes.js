import { Storage, KEYS } from './storage.js';
import { Utils } from './utils.js';
import { UI } from './ui.js';

export const ClassesModule = {
    render() {
        const container = document.getElementById('classesGridContainer');
        const classes = Storage.getTeacherData(KEYS.CLASSES);
        const students = Storage.getTeacherData(KEYS.STUDENTS);

        container.innerHTML = '';
        if (classes.length === 0) {
            container.innerHTML = `<div class="empty-state" style="grid-column: 1/-1; text-align:center; color:var(--text-secondary);">Бир дагы класс түзүлө элек.</div>`;
            return;
        }

        classes.forEach(c => {
            const classStudents = students.filter(s => s.classId === c.id);
            const card = document.createElement('div');
            card.className = 'card test-card';
            card.innerHTML = `
                <h3 style="font-size:20px; color:var(--cyan-accent);">${Utils.safeText(c.name)}</h3>
                <p style="font-size:13px; color:var(--text-secondary); margin: 6px 0 14px 0;"><i class="fas fa-book"></i> Предмет: ${Utils.safeText(c.subject)}</p>
                <div style="font-size:12px; display:flex; flex-direction:column; gap:6px; margin-bottom:15px;">
                    <span><i class="fas fa-user-graduate"></i> Окуучулар саны: <strong>${classStudents.length}</strong></span>
                    <span><i class="fas fa-calendar-alt"></i> Окуу жылы: ${Utils.safeText(c.academicYear)}</span>
                </div>
                <div style="display:flex; gap:8px; border-top:1px solid var(--border-color); padding-top:12px;">
                    <button class="btn btn-secondary" style="padding:6px 12px; font-size:12px;" onclick="window.deleteClass('${c.id}')"><i class="fas fa-trash-alt"></i> Өчүрүү</button>
                </div>
            `;
            container.appendChild(card);
        });
    },

    initModal() {
        document.getElementById('btnOpenCreateClassModal').onclick = () => {
            UI.openModal(`
                <h3><i class="fas fa-plus"></i> Жаңы класс түзүү</h3>
                <div class="form-group" style="margin-top:15px;">
                    <label>Класс аты *</label>
                    <input type="text" id="modalClassName" class="form-control" placeholder="Мисалы: 10-А">
                </div>
                <div class="form-group" style="margin-top:12px;">
                    <label>Предмет *</label>
                    <input type="text" id="modalClassSubject" class="form-control" placeholder="Физика">
                </div>
                <div class="form-group" style="margin-top:12px; margin-bottom:20px;">
                    <label>Окуу жылы</label>
                    <input type="text" id="modalClassYear" class="form-control" value="2026-2027">
                </div>
                <div style="display:flex; justify-content:flex-end; gap:10px;">
                    <button class="btn btn-secondary" onclick="appUI.closeModal()">Жокко чыгаруу</button>
                    <button class="btn btn-primary" id="btnSubmitClassModal">Түзүү</button>
                </div>
            `);

            document.getElementById('btnSubmitClassModal').onclick = () => {
                const name = document.getElementById('modalClassName').value.trim();
                const subject = document.getElementById('modalClassSubject').value.trim();
                const year = document.getElementById('modalClassYear').value.trim();

                if (!name || !subject) {
                    UI.showToast("Сураныч, жылдызчалуу талааларды толтуруңуз!", "danger");
                    return;
                }

                const newClass = {
                    id: Utils.generateUUID(),
                    name, subject, academicYear: year,
                    studentIds: [], status: "active", createdAt: new Date().toISOString()
                };

                Storage.saveTeacherData(KEYS.CLASSES, newClass);
                UI.showToast("Класс ийгиликтүү кошулду!");
                UI.closeModal();
                this.render();
                // Синхрондуу түрдө Түзүүчү табындагы селектти жаңыртуу
                window.refreshGlobalSelectors();
            };
        };
    }
};

window.deleteClass = (id) => {
    if (confirm("Бул классты өчүрүүнү каалайсызбы? Ичиндеги окуучулар өчпөйт.")) {
        Storage.deleteTeacherData(KEYS.CLASSES, id);
        UI.showToast("Класс өчүрүлдү.");
        ClassesModule.render();
        window.refreshGlobalSelectors();
    }
};
