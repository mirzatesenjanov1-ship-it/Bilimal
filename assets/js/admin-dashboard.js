import { checkAuth } from "./auth-guard.js";
import { safeFirebaseGet, db, ref, onValue } from "./firebase-config.js";
import { Toast } from "./toast.js";

const AdminDashboard = {
    init() {
        checkAuth((user) => {
            // Basic role simulation protection or verification path if needed
            this.loadSystemData();
        });
    },
    loadSystemData() {
        if (!navigator.onLine) {
            Toast.warning("Админ панель оффлайн режимде иштей албайт.");
            return;
        }

        onValue(ref(db, "teachers"), (snapshot) => {
            const data = snapshot.val() || {};
            this.renderTeachers(data);
            document.getElementById("adminStatTeachers").innerText = Object.keys(data).length;
        });

        onValue(ref(db, "teacherActivity"), (snapshot) => {
            const logsData = snapshot.val() || {};
            this.renderGlobalLogs(logsData);
        });
    },
    renderTeachers(teachersMap) {
        const tbody = document.getElementById("adminTeachersTableBody");
        if (!tbody) return;
        tbody.innerHTML = "";

        Object.entries(teachersMap).forEach(([id, t]) => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><strong>${t.presence?.page ? '🟢 ' : '⚫ '}${id.substr(0, 6)}... (Мугалим)</strong></td>
                <td>Физика жана Астрономия</td>
                <td><span class="badge-success">${t.presence?.status || "offline"}</span></td>
                <td>
                    <button class="btn-primary-glow btn-sm inspect-teacher" data-id="${id}">Кароо режими</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        document.querySelectorAll(".inspect-teacher").forEach(b => {
            b.addEventListener("click", (e) => {
                const targetId = e.target.getAttribute("data-id");
                Toast.info(`Мугалимдин [${targetId.substr(0,6)}] маалыматтарын кароо режими иштетилди.`);
            });
        });
    },
    renderGlobalLogs(logsMap) {
        const container = document.getElementById("adminActivityLog");
        if (!container) return;
        container.innerHTML = "";

        const allLogs = [];
        Object.entries(logsMap).forEach(([teacherId, userLogs]) => {
            Object.values(userLogs).forEach(l => {
                allLogs.push({ teacherId, ...l });
            });
        });

        // Sort by timestamp descending
        allLogs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        if (allLogs.length === 0) {
            container.innerHTML = `<p class="empty-state-text">Активдүүлүк катталган жок.</p>`;
            return;
        }

        allLogs.slice(0, 20).forEach(l => {
            const p = document.createElement("p");
            p.style.fontSize = "13px";
            p.style.borderBottom = "1px solid rgba(255,255,255,0.05)";
            p.style.paddingBottom = "5px";
            p.innerHTML = `⏱ <code>${l.createdAtISO ? l.createdAtISO.substr(11, 8) : ''}</code> - <strong>${l.teacherId.substr(0,5)}</strong>: ${l.action} (${JSON.stringify(l.details)})`;
            container.appendChild(p);
        });
    }
};

document.addEventListener("DOMContentLoaded", () => AdminDashboard.init());
export { AdminDashboard };
