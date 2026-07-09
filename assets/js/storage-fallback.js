// Safe JSON Parser to prevent parsing crashes
export function safeJsonParse(value, fallbackValue = null) {
  if (value === null || value === undefined || value === "") return fallbackValue;
  if (typeof value === "object") return value;
  try {
    const cleaned = String(value).trim();
    if (cleaned === "[object Object]") return fallbackValue;
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("Error parsing JSON safely:", e, "Value was:", value);
    return fallbackValue;
  }
}

export function safeJsonStringify(value, fallbackValue = "[]") {
  try {
    return JSON.stringify(value);
  } catch (e) {
    console.error("Error stringifying JSON safely:", e);
    return fallbackValue;
  }
}

export function getLocalData(key, fallbackValue = null) {
  try {
    const data = localStorage.getItem(key);
    return data ? safeJsonParse(data, fallbackValue) : fallbackValue;
  } catch (e) {
    console.error(`Error reading key ${key} from localStorage:`, e);
    return fallbackValue;
  }
}

export function setLocalData(key, value) {
  try {
    const dataStr = safeJsonStringify(value);
    localStorage.setItem(key, dataStr);
    return true;
  } catch (e) {
    console.error(`Error setting key ${key} to localStorage:`, e);
    return false;
  }
}

export function removeLocalData(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (e) {
    console.error(`Error removing key ${key} from localStorage:`, e);
    return false;
  }
}

export function generateId(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function getCurrentTeacherId() {
  return localStorage.getItem("bilimal_current_teacher_id") || "demo-teacher-001";
}

export function setCurrentTeacherId(teacherId) {
  localStorage.setItem("bilimal_current_teacher_id", teacherId);
}

export function getTeacherTestsFromLocal(teacherId) {
  return getLocalData(`tests_${teacherId}`, {});
}

export function saveTeacherTestsToLocal(teacherId, tests) {
  return setLocalData(`tests_${teacherId}`, tests);
}

export function getTestFromLocal(teacherId, testId) {
  const tests = getTeacherTestsFromLocal(teacherId);
  return tests[testId] || null;
}

export function saveTestToLocal(teacherId, test) {
  const tests = getTeacherTestsFromLocal(teacherId);
  tests[test.id] = test;
  return saveTeacherTestsToLocal(teacherId, tests);
}

export function deleteTestFromLocal(teacherId, testId) {
  const tests = getTeacherTestsFromLocal(teacherId);
  if (tests[testId]) {
    delete tests[testId];
    return saveTeacherTestsToLocal(teacherId, tests);
  }
  return false;
}

export function getResultsFromLocal(teacherId) {
  return getLocalData(`results_${teacherId}`, {});
}

export function saveResultsToLocal(teacherId, results) {
  return setLocalData(`results_${teacherId}`, results);
}

export function getTeacherSettingsFromLocal(teacherId) {
  const defaultSettings = {
    gradingScale: { five: 90, four: 70, three: 50, two: 0 }
  };
  return getLocalData(`settings_${teacherId}`, defaultSettings);
}

export function saveTeacherSettingsToLocal(teacherId, settings) {
  return setLocalData(`settings_${teacherId}`, settings);
}

export function getPendingSyncQueue() {
  return getLocalData("bilimal_sync_queue", []);
}

export function addToPendingSyncQueue(action) {
  const queue = getPendingSyncQueue();
  queue.push({ ...action, timestamp: Date.now() });
  setLocalData("bilimal_sync_queue", queue);
}

export function clearPendingSyncQueue() {
  removeLocalData("bilimal_sync_queue");
}

export function showToast(message, type = "info") {
  let container = document.getElementById("bilimal-toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "bilimal-toast-container";
    container.style.cssText = "position: fixed; bottom: 20px; right: 20px; z-index: 9999; display: flex; flex-direction: column; gap: 10px; max-width: 350px;";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  const colors = {
    success: "#10b981",
    error: "#ef4444",
    warning: "#f59e0b",
    info: "#3b82f6"
  };

  toast.style.cssText = `
    background: ${colors[type] || colors.info};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    opacity: 0;
    transform: translateY(20px);
    transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  `;
  
  toast.innerText = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
  }, 50);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-20px)";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

export function escapeHtml(value) {
  if (typeof value !== "string") return value;
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function formatDateTime(value) {
  if (!value) return "---";
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return value;
    return date.toLocaleString("ky-KG", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch (e) {
    return value;
  }
}

export function debounce(callback, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => callback(...args), delay);
  };
}
