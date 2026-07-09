import { isFirebaseAvailable, db, ref, get } from "./firebase-config.js";
import { currentTeacher } from "./auth-guard.js";
import { showToast } from "./storage-fallback.js";

export function initAdminTeacherMonitor() {
  if (currentTeacher.role !== "admin") {
    console.warn("Access denied to teacher monitor panel component.");
    return;
  }
  
  renderAdminMonitorSkeleton();
  fetchAdminMonitorData();
}

function renderAdminMonitorSkeleton() {
  const container = document.getElementById("admin-monitor-dashboard-section");
  if (!container) return;

  container.innerHTML = `
    <div style="background:white; padding:24px; border-radius:12px; box-shadow:0 1px 3px rgba(0,0,0,0.1); margin-bottom:20px;">
      <h2 style="color:#1e293b; margin-top:0;">Администратордук Мониторинг (БилимАл)</h2>
      <p style="color:#64748b; font-size:14px;">Платформадагы бардык мугалимдердин жана тесттердин активдүүлүгүн көзөмөлдөө панели.</p>
      <hr style="border:none; border-top:1px solid #e2e8f0; margin:16px 0;">
      <div id="admin-stats-summary-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:16px; margin-bottom:20px;">
        <div style="background:#f1f5f9; padding:16px; border-radius:8px;">Жалпы Мугалимдер: <b id="stat-total-teachers">...</b></div>
        <div style="background:#f1f5f9; padding:16px; border-radius:8px;">Жалпы Тесттер: <b id="stat-total-tests">...</b></div>
      </div>
      <div style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:14px; text-align:left;">
          <thead>
            <tr style="background:#f8fafc; border-bottom:2px solid #e2e8f0;">
              <th style="padding:10px;">Мугалим ID</th>
              <th style="padding:10px;">Түзүлгөн Тесттер</th>
              <th style="padding:10px;">Аракеттер</th>
            </tr>
          </thead>
          <tbody id="admin-teachers-activity-tbody">
            <tr><td colspan="3" style="padding:20px; text-align:center; color:#94a3b8;">Маалымат жүктөлүүдө...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function fetchAdminMonitorData() {
  if (!isFirebaseAvailable || !db) {
    const tbody = document.getElementById("admin-teachers-activity-tbody");
    if (tbody) tbody.innerHTML = `<tr><td colspan="3" style="padding:20px; text-align:center; color:#ef4444;">Ката: Firebase жеткиликсиз. Демо режимде администратордук база иштебейт.</td></tr>`;
    return;
  }

  get(ref(db, "teachers"))
    .then((snapshot) => {
      if (!snapshot.exists()) {
        document.getElementById("admin-teachers-activity-tbody").innerHTML = `<tr><td colspan="3" style="padding:20px; text-align:center;">Бир дагы мугалим табылган жок.</td></tr>`;
        return;
      }

      const teachersData = snapshot.val();
      const tbody = document.getElementById("admin-teachers-activity-tbody");
      if (!tbody) return;
      
      tbody.innerHTML = "";
      let teacherCount = 0;
      let globalTestCount = 0;

      Object.keys(teachersData).forEach(tKey => {
        teacherCount++;
        const tObj = teachersData[tKey];
        const testsCount = tObj.tests ? Object.keys(tObj.tests).length : 0;
        globalTestCount += testsCount;

        const row = document.createElement("tr");
        row.style.borderBottom = "1px solid #edf2f7";
        row.innerHTML = `
          <td style="padding:10px; font-weight:600; color:#4a5568;">${escapeHtml(tKey)}</td>
          <td style="padding:10px;"><span style="background:#e2e8f0; padding:2px 8px; border-radius:12px; font-weight:bold;">${testsCount}</span></td>
          <td style="padding:10px;"><button class="admin-view-t-btn" data-id="${tKey}" style="padding:4px 8px; background:#3b82f6; color:white; border:none; border-radius:4px; cursor:pointer; font-size:12px;">Тесттерин көрүү</button></td>
        `;
        tbody.appendChild(row);
      });

      document.getElementById("stat-total-teachers").innerText = teacherCount;
      document.getElementById("stat-total-tests").innerText = globalTestCount;

      document.querySelectorAll(".admin-view-t-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const targetId = btn.getAttribute("data-id");
          showToast(`Мугалим ${targetId} тесттери тандалды (Текшерүү режими)`, "info");
        });
      });
    })
    .catch((err) => {
      console.error(err);
      showToast("Админ мониторинг маалыматын алууда ката чыкты", "error");
    });
}
