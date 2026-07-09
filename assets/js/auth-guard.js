import { auth, onAuthStateChanged, isFirebaseAvailable } from "./firebase-config.js";
import { getCurrentTeacherId, setCurrentTeacherId, showToast, getLocalData, setLocalData } from "./storage-fallback.js";

export let currentTeacher = {
  uid: "demo-teacher-001",
  name: "Асан Бакиров",
  subject: "Физика жана Астрономия",
  classes: ["10-А", "10-Б", "11-А", "11-Б"],
  role: "teacher"
};

export function checkAuthentication(callback) {
  if (isFirebaseAvailable && auth) {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        currentTeacher.uid = user.uid;
        setCurrentTeacherId(user.uid);
        fetchTeacherProfile(user.uid, callback);
      } else {
        handleFallbackOrDemo(callback);
      }
    });
  } else {
    handleFallbackOrDemo(callback);
  }
}

function handleFallbackOrDemo(callback) {
  const storedId = getCurrentTeacherId();
  currentTeacher.uid = storedId;
  
  const localProfile = getLocalData(`profile_${storedId}`);
  if (localProfile) {
    currentTeacher = { ...currentTeacher, ...localProfile };
  } else {
    if (storedId === "demo-teacher-001") {
      currentTeacher.role = "admin"; // Enable dashboard exploration
    }
    setLocalData(`profile_${storedId}`, currentTeacher);
  }
  
  updateUIElements();
  if (typeof callback === "function") callback(currentTeacher);
}

function fetchTeacherProfile(uid, callback) {
  import("./firebase-config.js").then(({ db, ref, get }) => {
    if (!db) {
      handleFallbackOrDemo(callback);
      return;
    }
    get(ref(db, `teachers/${uid}/profile`))
      .then((snapshot) => {
        if (snapshot.exists()) {
          currentTeacher = { ...currentTeacher, ...snapshot.val(), uid: uid };
        } else {
          if (uid === "admin-master-uid-2026") {
            currentTeacher.role = "admin";
          }
          setLocalData(`profile_${uid}`, currentTeacher);
        }
        updateUIElements();
        if (typeof callback === "function") callback(currentTeacher);
      })
      .catch((err) => {
        console.error("Profile fetch error:", err);
        handleFallbackOrDemo(callback);
      });
  });
}

export function updateUIElements() {
  const nameEl = document.getElementById("teacher-name-display");
  const subEl = document.getElementById("teacher-subject-display");
  const avatarEl = document.getElementById("teacher-avatar");
  const adminPanelBtn = document.getElementById("admin-panel-link");

  if (nameEl) nameEl.innerText = currentTeacher.name;
  if (subEl) subEl.innerText = currentTeacher.subject;
  if (avatarEl) avatarEl.src = currentTeacher.avatarUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80";
  
  if (adminPanelBtn) {
    adminPanelBtn.style.display = currentTeacher.role === "admin" ? "block" : "none";
  }
}

export function logoutTeacher() {
  if (isFirebaseAvailable && auth) {
    import("./firebase-config.js").then(({ signOut }) => {
      signOut(auth)
        .then(() => {
          clearSessionAndRedirect();
        })
        .catch((err) => {
          showToast("Чыгууда ката кетти: " + err.message, "error");
          clearSessionAndRedirect();
        });
    });
  } else {
    clearSessionAndRedirect();
  }
}

function clearSessionAndRedirect() {
  localStorage.removeItem("bilimal_current_teacher_id");
  showToast("Системадан коопсуз чыктыңыз", "success");
  setTimeout(() => {
    window.location.reload();
  }, 1000);
}

// Global Event Binder for Sign Out Button
document.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = document.getElementById("logout-action-button");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      logoutTeacher();
    });
  }
});
