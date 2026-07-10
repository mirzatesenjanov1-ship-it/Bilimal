import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";
import { 
    getDatabase, 
    ref, 
    set, 
    get, 
    update, 
    remove, 
    push, 
    onValue, 
    off, 
    serverTimestamp, 
    runTransaction, 
    onDisconnect 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Firebase Конфигурациясы
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

// Негизги сервистерди коопсуз демилгелөө
let app = null;
let analytics = null;
let db = null;
let auth = null;
let isNetworkListenerAdded = false;

try {
    app = initializeApp(firebaseConfig);
    db = getDatabase(app);
    auth = getAuth(app);
    
    if (typeof window !== "undefined" && typeof window.document !== "undefined") {
        analytics = getAnalytics(app);
    }
} catch (e) {
    if (typeof console !== "undefined") {
        console.warn("Firebase initialization failed:", e.message);
    }
}

// 15. Коопсуз JSON Парсер
function safeJsonParse(value, fallback = null) {
    if (value === null || value === undefined || value === "") return fallback;
    if (typeof value === "object") return value;
    try {
        if (typeof value === "string" && (value.trim() === "[object Object]" || value.includes("[object"))) {
            return fallback;
        }
        return JSON.parse(value);
    } catch (e) {
        return fallback;
    }
}

// 16. Коопсуз LocalStorage Окуу
function safeLocalStorageGet(key, fallback = null) {
    try {
        if (typeof window === "undefined" || !window.localStorage) return fallback;
        const value = localStorage.getItem(key);
        return value !== null ? value : fallback;
    } catch (e) {
        return fallback;
    }
}

// 17. Коопсуз LocalStorage Жазуу
function safeLocalStorageSet(key, value) {
    try {
        if (typeof window === "undefined" || !window.localStorage) return false;
        const stringValue = typeof value === "object" ? JSON.stringify(value) : String(value);
        localStorage.setItem(key, stringValue);
        return true;
    } catch (e) {
        return false;
    }
}

// 18. Коопсуз LocalStorage Өчүрүү
function safeLocalStorageRemove(key) {
    try {
        if (typeof window === "undefined" || !window.localStorage) return false;
        localStorage.removeItem(key);
        return true;
    } catch (e) {
        return false;
    }
}

// 1. Коопсуз Колдонуучуну Алуу
function getCurrentUserSafe() {
    try {
        return auth && auth.currentUser ? auth.currentUser : null;
    } catch (e) {
        return null;
    }
}

// 2. Колдонуучунун ID маанисин алуу
function getCurrentUserId() {
    try {
        if (auth && auth.currentUser && auth.currentUser.uid) {
            return auth.currentUser.uid;
        }
        const cached = safeLocalStorageGet("bilimal_current_user");
        if (cached) {
            const userObj = safeJsonParse(cached);
            if (userObj && userObj.uid) return userObj.uid;
        }
        return "guest";
    } catch (e) {
        return "guest";
    }
}

// 3. Мугалимдин негизги базалык жолун түзүү
function getTeacherRootPath() {
    const uid = getCurrentUserId();
    return `teachers/${uid}`;
}

// 4. Мугалимдин ички папкаларынын жолун куруу
function buildTeacherPath(childPath = "") {
    const root = getTeacherRootPath();
    if (!childPath || childPath.trim() === "") return root;
    const cleanChild = childPath.startsWith("/") ? childPath.substring(1) : childPath;
    return `${root}/${cleanChild}`;
}

// 5. Коопсуз Маалымат Окуу (Get)
async function safeFirebaseGet(path) {
    try {
        if (!db) return null;
        const snapshot = await get(ref(db, path));
        return snapshot.exists() ? snapshot.val() : null;
    } catch (e) {
        if (typeof console !== "undefined") {
            console.warn(`Firebase safeFirebaseGet failed at [${path}]:`, e.message);
        }
        return null;
    }
}

// 6. Коопсуз Маалымат Жазуу (Set)
async function safeFirebaseSet(path, value) {
    try {
        if (!db) return false;
        await set(ref(db, path), value);
        return true;
    } catch (e) {
        if (typeof console !== "undefined") {
            console.warn(`Firebase safeFirebaseSet failed at [${path}]:`, e.message);
        }
        return false;
    }
}

// 7. Коопсуз Маалымат Жаңыртуу (Update)
async function safeFirebaseUpdate(path, value) {
    try {
        if (!db) return false;
        await update(ref(db, path), value);
        return true;
    } catch (e) {
        if (typeof console !== "undefined") {
            console.warn(`Firebase safeFirebaseUpdate failed at [${path}]:`, e.message);
        }
        return false;
    }
}

// 8. Коопсуз Маалымат Өчүрүү (Remove)
async function safeFirebaseRemove(path) {
    try {
        if (!db) return false;
        await remove(ref(db, path));
        return true;
    } catch (e) {
        if (typeof console !== "undefined") {
            console.warn(`Firebase safeFirebaseRemove failed at [${path}]:`, e.message);
        }
        return false;
    }
}

// 9. Базанын Жеткиликтүүлүгүн Текшерүү
async function isFirebaseAvailable() {
    try {
        if (!db || !firebaseConfig.databaseURL) return false;
        if (typeof navigator !== "undefined" && !navigator.onLine) return false;
        const connectedRef = ref(db, ".info/connected");
        const snapshot = await get(connectedRef);
        return snapshot.exists() ? !!snapshot.val() : false;
    } catch (e) {
        return false;
    }
}

// 10. Мониторинг Жүргузүүчү Реалдуу Убакыт Угуучусу
function watchTeacherPath(childPath, callback) {
    try {
        if (!db) {
            callback(null, new Error("Database not available"));
            return () => {};
        }
        const targetPath = buildTeacherPath(childPath);
        const targetRef = ref(db, targetPath);
        
        onValue(targetRef, (snapshot) => {
            callback(snapshot.val());
        }, (error) => {
            callback(null, error);
        });

        return () => {
            try {
                off(targetRef);
            } catch (err) {
                if (typeof console !== "undefined") {
                    console.warn("Failed to detach listener via off():", err.message);
                }
            }
        };
    } catch (e) {
        callback(null, e);
        return () => {};
    }
}

// 11. Активдүүлүк Журналын Сактоо жана Кезекке Кошуу
async function saveTeacherActivity(action, details = {}) {
    const uid = getCurrentUserId();
    const now = new Date();
    
    const activityData = {
        action: action || "unknown_action",
        details: details || {},
        createdAt: serverTimestamp ? serverTimestamp() : now.getTime(),
        createdAtISO: now.toISOString(),
        userId: uid,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown_agent",
        page: typeof window !== "undefined" && window.location ? window.location.pathname : "unknown_page"
    };

    const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    
    if (db && isOnline) {
        try {
            const activityRef = ref(db, `teachers/${uid}/activityLogs`);
            const newLogRef = push(activityRef);
            if (activityData.createdAt && typeof activityData.createdAt === "function") {
                activityData.createdAt = now.getTime();
            }
            await set(newLogRef, activityData);
            return true;
        } catch (e) {
            if (typeof console !== "undefined") {
                console.warn("Failed online write for log, caching to offline queue:", e.message);
            }
        }
    }

    try {
        if (activityData.createdAt && typeof activityData.createdAt === "function") {
            activityData.createdAt = now.getTime();
        }
        const existingQueueStr = safeLocalStorageGet("bilimal_activity_queue", "[]");
        const queue = safeJsonParse(existingQueueStr, []);
        queue.push(activityData);
        safeLocalStorageSet("bilimal_activity_queue", queue);
    } catch (err) {
        if (typeof console !== "undefined") {
            console.warn("Failed local backup write for activity queue:", err.message);
        }
    }
    return false;
}

// 12. Кезектеги Оффлайн Аракеттерди Синхрондоо
async function syncQueuedActivities() {
    try {
        if (!db) return;
        if (typeof navigator !== "undefined" && !navigator.onLine) return;

        const rawQueue = safeLocalStorageGet("bilimal_activity_queue", "[]");
        const queue = safeJsonParse(rawQueue, []);
        if (!queue || queue.length === 0) return;

        const failedItems = [];

        for (const item of queue) {
            try {
                const uid = item.userId || getCurrentUserId();
                const activityRef = ref(db, `teachers/${uid}/activityLogs`);
                const newLogRef = push(activityRef);
                
                if (!item.createdAt || typeof item.createdAt === "object") {
                    item.createdAt = new Date(item.createdAtISO || Date.now()).getTime();
                }
                
                await set(newLogRef, item);
            } catch (e) {
                failedItems.push(item);
            }
        }

        if (failedItems.length > 0) {
            safeLocalStorageSet("bilimal_activity_queue", failedItems);
        } else {
            safeLocalStorageRemove("bilimal_activity_queue");
        }
    } catch (err) {
        if (typeof console !== "undefined") {
            console.warn("Error inside syncQueuedActivities:", err.message);
        }
    }
}

// 13. Мугалимдин Онлайн Статусун Орнотуу
async function setTeacherPresence(status = "online") {
    const uid = getCurrentUserId();
    if (uid === "guest") return;

    const now = new Date();
    const presenceData = {
        status: status,
        lastSeen: now.getTime(),
        lastSeenISO: now.toISOString(),
        page: typeof window !== "undefined" && window.location ? window.location.pathname : "unknown_page"
    };

    if (db && typeof navigator !== "undefined" && navigator.onLine) {
        try {
            const presenceRef = ref(db, `teachers/${uid}/presence`);
            
            if (status === "online") {
                const disconnectRef = onDisconnect(presenceRef);
                await disconnectRef.set({
                    status: "offline",
                    lastSeen: serverTimestamp ? serverTimestamp() : Date.now(),
                    lastSeenISO: new Date().toISOString(),
                    page: presenceData.page
                });
            }
            
            await set(presenceRef, presenceData);
            return;
        } catch (e) {
            if (typeof console !== "undefined") {
                console.warn("Failed tracking online presence status:", e.message);
            }
        }
    }

    safeLocalStorageSet("bilimal_presence_fallback", presenceData);
}

// 14. Firebase Кызматтарын Баштапкы Ишке Киргизүү
async function initFirebaseServices() {
    try {
        if (analytics && typeof analytics.logEvent === "function") {
            try {
                analytics.logEvent("app_initialized");
            } catch (ae) {
                if (typeof console !== "undefined") console.warn("Analytics blocked or failed:", ae.message);
            }
        }

        await setTeacherPresence("online");
        await syncQueuedActivities();

        if (typeof window !== "undefined" && window.addEventListener && !isNetworkListenerAdded) {
            window.addEventListener("online", () => {
                setTeacherPresence("online");
                syncQueuedActivities();
            });
            window.addEventListener("offline", () => {
                setTeacherPresence("offline");
            });
            isNetworkListenerAdded = true;
        }
    } catch (e) {
        if (typeof console !== "undefined") {
            console.warn("Error running global initFirebaseServices:", e.message);
        }
    }
}

export {
    app,
    analytics,
    db,
    auth,
    ref,
    set,
    get,
    update,
    remove,
    push,
    onValue,
    off,
    serverTimestamp,
    runTransaction,
    onDisconnect,
    onAuthStateChanged,
    signOut,
    firebaseConfig,
    getCurrentUserSafe,
    getCurrentUserId,
    getTeacherRootPath,
    buildTeacherPath,
    safeFirebaseGet,
    safeFirebaseSet,
    safeFirebaseUpdate,
    safeFirebaseRemove,
    isFirebaseAvailable,
    watchTeacherPath,
    saveTeacherActivity,
    syncQueuedActivities,
    setTeacherPresence,
    initFirebaseServices,
    safeJsonParse,
    safeLocalStorageGet,
    safeLocalStorageSet,
    safeLocalStorageRemove
};
