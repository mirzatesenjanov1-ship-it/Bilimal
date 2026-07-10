import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";
import { 
    getDatabase, ref, set, get, update, remove, push, onValue, off, serverTimestamp, runTransaction, onDisconnect 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyAsRjj_5VoQwZA7hSBWhkQ58UvUnct-b28",
    authDomain: "bilimal-org.firebaseapp.com",
    databaseURL: "https://bilimal-org-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "bilimal-org",
    storageBucket: "bilimal-org.firebasestorage.app",
    messagingSenderId: "241750360816",
    appId: "1:241750360816:web:a991434eb5afbc470d7835",
    measurementId: "G-9GSQV60QV0"
};

let app = null; let analytics = null; let db = null; let auth = null;
try {
    app = initializeApp(firebaseConfig);
    db = getDatabase(app);
    auth = getAuth(app);
    if (typeof window !== "undefined") { analytics = getAnalytics(app); }
} catch (e) { console.warn("Firebase Init Error: ", e.message); }

function safeJsonParse(val, fallback = null) {
    if (val === null || val === undefined || val === "") return fallback;
    try {
        if (typeof val === "object") return val;
        const s = String(val).trim();
        if (s === "[object Object]" || s.startsWith("[object")) return fallback;
        return JSON.parse(s);
    } catch (e) { return fallback; }
}
function safeLocalStorageGet(k, fb = null) { try { return localStorage.getItem(k) !== null ? localStorage.getItem(k) : fb; } catch(e) { return fb; } }
function safeLocalStorageSet(k, v) { try { localStorage.setItem(k, typeof v === "object" ? JSON.stringify(v) : String(v)); return true; } catch(e) { return false; } }
function safeLocalStorageRemove(k) { try { localStorage.removeItem(k); return true; } catch(e) { return false; } }
function getCurrentUserSafe() { try { return auth?.currentUser || null; } catch(e) { return null; } }
function getCurrentUserId() {
    try {
        if (auth?.currentUser?.uid) return auth.currentUser.uid;
        const c = safeLocalStorageGet("bilimal_current_user");
        if (c) { const u = safeJsonParse(c); if (u?.uid) return u.uid; }
        return "guest";
    } catch(e) { return "guest"; }
}
function getTeacherRootPath() { return `teachers/${getCurrentUserId()}`; }
function buildTeacherPath(cp = "") {
    const r = getTeacherRootPath();
    if (!cp || cp.trim() === "") return r;
    return `${r}/${cp.startsWith("/") ? cp.substring(1) : cp}`;
}
async function safeFirebaseGet(p) { try { if (!db) return null; const s = await get(ref(db, p)); return s.exists() ? s.val() : null; } catch(e) { console.warn("Get Fail:", e.message); return null; } }
async function safeFirebaseSet(p, v) { try { if (!db) return false; await set(ref(db, p), v); return true; } catch(e) { console.warn("Set Fail:", e.message); return false; } }
async function safeFirebaseUpdate(p, v) { try { if (!db) return false; await update(ref(db, p), v); return true; } catch(e) { console.warn("Update Fail:", e.message); return false; } }
async function safeFirebaseRemove(p) { try { if (!db) return false; await remove(ref(db, p)); return true; } catch(e) { console.warn("Remove Fail:", e.message); return false; } }
async function isFirebaseAvailable() { try { if (!db) return false; const s = await get(ref(db, ".info/connected")); return s.exists() ? !!s.val() : false; } catch(e) { return false; } }
function watchTeacherPath(cp, cb) {
    try {
        if (!db) { cb(null, new Error("No DB")); return () => {}; }
        const r = ref(db, buildTeacherPath(cp));
        onValue(r, (s) => cb(s.val(), null), (err) => cb(null, err));
        return () => { try { off(r); } catch(e) {} };
    } catch(e) { cb(null, e); return () => {}; }
}
async function saveTeacherActivity(action, details = {}) {
    const uid = getCurrentUserId();
    const l = { action, details, createdAt: Date.now(), createdAtISO: new Date().toISOString(), userId: uid, userAgent: navigator.userAgent || "unknown", page: window.location.pathname };
    if (db && navigator.onLine) {
        try { await set(push(ref(db, `teacherActivity/${uid}`)), l); return true; } catch(e) { console.warn("Log offline cache added", e.message); }
    }
    const q = safeJsonParse(safeLocalStorageGet("bilimal_activity_queue", "[]"), []);
    q.push(l); safeLocalStorageSet("bilimal_activity_queue", q);
    return false;
}
async function syncQueuedActivities() {
    try {
        if (!db || !navigator.onLine) return;
        const q = safeJsonParse(safeLocalStorageGet("bilimal_activity_queue", "[]"), []);
        if (!q.length) return;
        const remains = [];
        for (const item of q) {
            try { await set(push(ref(db, `teacherActivity/${item.userId}`)), item); } catch(e) { remains.push(item); }
        }
        if (remains.length) safeLocalStorageSet("bilimal_activity_queue", remains);
        else safeLocalStorageRemove("bilimal_activity_queue");
    } catch(e) { console.warn("Sync queue fail", e.message); }
}
async function setTeacherPresence(status = "online") {
    const uid = getCurrentUserId(); if (uid === "guest") return;
    const p = { status, lastSeen: Date.now(), lastSeenISO: new Date().toISOString(), page: window.location.pathname };
    if (db && navigator.onLine) {
        try {
            const r = ref(db, `teachers/${uid}/presence`);
            if (status === "online") { await onDisconnect(r).set({ status: "offline", lastSeen: serverTimestamp(), lastSeenISO: new Date().toISOString(), page: window.location.pathname }); }
            await set(r, p); return;
        } catch(e) { console.warn("Presence err", e.message); }
    }
    safeLocalStorageSet("bilimal_presence_fallback", p);
}
async function initFirebaseServices() {
    try {
        await setTeacherPresence("online"); await syncQueuedActivities();
        window.addEventListener("online", () => { setTeacherPresence("online"); syncQueuedActivities(); });
        window.addEventListener("offline", () => { setTeacherPresence("offline"); });
    } catch(e) { console.warn("Init services failed", e.message); }
}

export {
    app, analytics, db, auth, ref, set, get, update, remove, push, onValue, off, serverTimestamp, runTransaction, onDisconnect, onAuthStateChanged, signOut, firebaseConfig,
    getCurrentUserSafe, getCurrentUserId, getTeacherRootPath, buildTeacherPath, safeFirebaseGet, safeFirebaseSet, safeFirebaseUpdate, safeFirebaseRemove, isFirebaseAvailable, watchTeacherPath, saveTeacherActivity, syncQueuedActivities, setTeacherPresence, initFirebaseServices, safeJsonParse, safeLocalStorageGet, safeLocalStorageSet, safeLocalStorageRemove
};
