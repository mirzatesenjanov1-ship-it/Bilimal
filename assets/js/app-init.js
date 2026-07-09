import { isFirebaseAvailable, firebaseError } from "./firebase-config.js";
import { checkAuthentication } from "./auth-guard.js";
import { initTestsDashboard, loadAllDashboardTests } from "./tests-dashboard.js";
import { loadTeacherResults } from "./results-manager.js";
import { initAdminTeacherMonitor } from "./admin-teacher-monitor.js";
import { showToast, getPendingSyncQueue, clearPendingSyncQueue } from "./storage-fallback.js";

document.addEventListener("DOMContentLoaded", () => {
  console.log("Bilimal application initializing process...");

  if (!isFirebaseAvailable) {
    console.warn("Firebase system not available initialization fallback. Reason:", firebaseError);
    showToast("Система автономдук режимде иштеп жатат (Локалдык сактагыч активдүү)", "warning");
  }

  // Chain authentication check before loading secured views logic
  checkAuthentication((teacherProfile) => {
    console.log("Profile authentication loop solved successfully:", teacherProfile.uid);
    
    // Core Modules Launch safely packaged
    try {
      initTestsDashboard();
    } catch (e) {
      console.error("Dashboard trigger failed initialization context:", e);
    }

    try {
      loadTeacherResults((res) => {
        console.log("Teacher application synced response points loaded records count:", Object.keys(res).length);
      });
    } catch (e) {
      console.error("Results layer integration crashed during hook call:", e);
    }

    if (teacherProfile.role === "admin") {
      try {
        initAdminTeacherMonitor();
      } catch (e) {
        console.error("Admin view interface runtime boot issue:", e);
      }
    }
  });

  // Handle Online & Synchronization Pipeline updates
  window.addEventListener("online", () => {
    showToast("Интернет байланышы калыбына келди! Маалыматтар синхрондоштурулууда...", "success");
    handlePendingSynchronizationQueue();
  });

  window.addEventListener("offline", () => {
    showToast("Интернет байланышы үзүлдү. Автономдук сактоо режими иштеп жатат.", "warning");
  });
});

function handlePendingSynchronizationQueue() {
  const queue = getPendingSyncQueue();
  if (!queue || queue.length === 0) return;

  if (!isFirebaseAvailable) return;

  import("./firebase-config.js").then(({ db, ref, set }) => {
    if (!db) return;

    const promises = queue.map(item => {
      if (item.action === "save-test") {
        return set(ref(db, `teachers/${item.teacherId}/tests/${item.test.id}`), item.test);
      }
      return Promise.resolve();
    });

    Promise.all(promises)
      .then(() => {
        clearPendingSyncQueue();
        showToast("Бардык автономдук өзгөрүүлөр сервер менен ийгиликтүү синхрондолду!", "success");
        loadAllDashboardTests();
      })
      .catch((err) => {
        console.error("Queue syncing operation failed:", err);
      });
  });
}
