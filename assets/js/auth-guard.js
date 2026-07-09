// Bilimal-AI Project - Authentication Guard & Role Verification
(function () {
    const BF = window.BilimalFirebase;

    function checkTeacherAccess() {
        const teacherId = localStorage.getItem('bilimal_current_teacher_id');
        if (!teacherId) {
            localStorage.setItem('bilimal_current_teacher_id', 'demo-teacher-001');
            localStorage.setItem('bilimal_user_role', 'teacher');
            BF.showToast("Демо режим иштеп жатат", "info");
        }
        loadTeacherProfile();
    }

    function redirectToLogin() {
        BF.showToast("Кирүү барагына багытталууда...", "warning");
        setTimeout(() => {
            window.location.href = "/login.html";
        }, 1500);
    }

    function getTeacherProfile() {
        return BF.safeJsonParse(localStorage.getItem('bilimal_teacher_profile'), {
            id: BF.getCurrentTeacherId(),
            name: "Белгисиз Мугалим",
            subject: "Физика",
            role: getCurrentUserRole()
        });
    }

    function loadTeacherProfile() {
        const profile = getTeacherProfile();
        const profileContainer = document.getElementById('teacher-profile-box');
        if (profileContainer) {
            profileContainer.innerHTML = `
                <div class="user-card">
                    <h4>${BF.sanitizeData(profile.name)}</h4>
                    <p>${BF.sanitizeData(profile.subject)} | Роль: ${BF.sanitizeData(profile.role)}</p>
                </div>
            `;
        }
    }

    function updateTeacherProfile(updatedData) {
        const current = getTeacherProfile();
        const merged = { ...current, ...updatedData };
        localStorage.setItem('bilimal_teacher_profile', JSON.stringify(merged));
        
        if (BF.isFirebaseAvailable()) {
            BF.getDatabaseInstance().ref(BF.paths.settings(BF.getCurrentTeacherId())).set(merged)
                .then(() => BF.showToast("Профиль жаңыртылды", "success"))
                .catch(() => BF.showToast("Профиль локалдык түрдө сакталды", "warning"));
        }
        loadTeacherProfile();
    }

    function logoutTeacher() {
        localStorage.removeItem('bilimal_current_teacher_id');
        localStorage.removeItem('bilimal_user_role');
        localStorage.removeItem('bilimal_teacher_profile');
        BF.showToast("Кабинеттен чыктыңыз", "info");
        setTimeout(() => window.location.reload(), 1000);
    }

    function isAdmin() {
        return localStorage.getItem('bilimal_user_role') === 'admin';
    }

    function isTeacher() {
        return localStorage.getItem('bilimal_user_role') === 'teacher' || isAdmin();
    }

    function canViewTeacherData(targetTeacherId) {
        if (isAdmin()) return true;
        return BF.getCurrentTeacherId() === targetTeacherId;
    }

    function canEditTeacherData(targetTeacherId) {
        if (isAdmin()) return true;
        return BF.getCurrentTeacherId() === targetTeacherId;
    }

    document.addEventListener("DOMContentLoaded", () => {
        checkTeacherAccess();
        
        const logoutBtn = document.getElementById('logout-action-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                logoutTeacher();
            });
        }

        if (isAdmin()) {
            const adminPanelBtn = document.getElementById('admin-activity-monitor-btn');
            if (adminPanelBtn) {
                adminPanelBtn.style.display = 'block';
                BF.showToast("Администратордун башкаруу панели активдүү", "success");
            }
        }
    });

    window.BilimalAuth = {
        checkTeacherAccess,
        redirectToLogin,
        getTeacherProfile,
        loadTeacherProfile,
        updateTeacherProfile,
        logoutTeacher,
        isAdmin,
        isTeacher,
        canViewTeacherData,
        canEditTeacherData
    };
})();
