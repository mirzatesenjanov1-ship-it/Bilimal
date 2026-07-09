// Bilimal-AI Project - Global Administration Monitoring Toolkit
(function () {
    const BF = window.BilimalFirebase;
    const BA = window.BilimalAuth;

    function loadAdminMonitor() {
        if (!BA.isAdmin()) {
            const block = document.getElementById('admin-monitoring-section-wrapper');
            if (block) block.style.display = 'none';
            return;
        }

        loadAllTeachers();
    }

    function loadAllTeachers() {
        if (BF.isFirebaseAvailable()) {
            BF.getDatabaseInstance().ref('/admin/teachers').once('value')
                .then(snapshot => {
                    renderTeachersActivity(snapshot.val() || {});
                })
                .catch(() => renderTeachersActivity(getMockTeachers()));
        } else {
            renderTeachersActivity(getMockTeachers());
        }
    }

    function getMockTeachers() {
        return {
            "teacher_001": { name: "Айгүл Мугалим", subject: "Физика", testsCount: 12, submissions: 140, status: "active" },
            "teacher_002": { name: "Эркинбек Агай", subject: "Астрономия", testsCount: 5, submissions: 82, status: "active" }
        };
    }

    function renderTeachersActivity(teachersMap) {
        const container = document.getElementById('admin-teachers-activity-table-body');
        if (!container) return;

        container.innerHTML = "";
        
        for (const [id, t] of Object.entries(teachersMap)) {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>**${BF.sanitizeData(t.name)}**</td>
                <td>${BF.sanitizeData(t.subject)}</td>
                <td>${t.testsCount || 0}</td>
                <td>${t.submissions || 0}</td>
                <td><span style="color:${t.status === 'active' ? 'green' : 'red'}">${t.status}</span></td>
                <td>
                    <button class="btn-admin-view-workspace" data-id="${id}">Кабинетти Көрүү</button>
                    <button class="btn-admin-block" data-id="${id}" style="background-color:#e71d36; color:#fff;">
                        ${t.status === 'active' ? 'Бөгөттөө' : 'Ачуу'}
                    </button>
                </td>
            `;
            container.appendChild(tr);
        }

        bindAdminActions();
    }

    function bindAdminActions() {
        document.querySelectorAll('.btn-admin-view-workspace').forEach(b => {
            b.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                localStorage.setItem('bilimal_current_teacher_id', id);
                BF.showToast(`Мугалимдин иш мейкиндигине которулду: ${id}`, "success");
                window.location.reload();
            });
        });

        document.querySelectorAll('.btn-admin-block').forEach(b => {
            b.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                BF.showToast(`Мугалимдин статусу өзгөртүлдү ИД: ${id}`, "info");
            });
        });
    }

    document.addEventListener("DOMContentLoaded", () => {
        loadAdminMonitor();
    });

    window.BilimalAdmin = {
        loadAdminMonitor,
        loadAllTeachers
    };
})();
