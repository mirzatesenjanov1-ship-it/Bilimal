// Bilimal-AI Project - Firebase Realtime Database Configuration & Core Utilities
(function () {
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

    let databaseInstance = null;
    let firebaseInitialized = false;

    // Load Firebase Core via dynamic module injection safely if not already present globally
    function initializeFirebase() {
        try {
            if (typeof window.firebase !== 'undefined') {
                window.firebase.initializeApp(firebaseConfig);
                databaseInstance = window.firebase.database();
                firebaseInitialized = true;
                showToast("Firebase ийгиликтүү туташты", "success");
                syncPendingData();
            } else {
                throw new Error("Firebase SDK missing");
            }
        } catch (error) {
            firebaseInitialized = false;
            databaseInstance = null;
            showToast("Firebase жеткиликсиз! Локалдык режим иштеп жатат.", "warning");
        }
    }

    function getDatabaseInstance() {
        return databaseInstance;
    }

    function isFirebaseAvailable() {
        return firebaseInitialized && databaseInstance !== null;
    }

    function safeJsonParse(value, fallbackValue) {
        if (!value) return fallbackValue;
        try {
            return JSON.parse(value);
        } catch (e) {
            console.error("JSON талдоо катасы:", e);
            return fallbackValue;
        }
    }

    function sanitizeData(value) {
        if (typeof value === 'string') {
            return value.replace(/[<>]/g, '');
        }
        return value;
    }

    function generateId(prefix) {
        return `${prefix || 'id'}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    function getCurrentTeacherId() {
        const storedId = localStorage.getItem('bilimal_current_teacher_id');
        if (storedId) return storedId;
        showToast("Демо режим иштеп жатат", "info");
        return "demo-teacher-001";
    }

    function getCurrentUserRole() {
        return localStorage.getItem('bilimal_user_role') || 'teacher';
    }

    function showToast(message, type = "info") {
        const container = document.getElementById('toast-container') || createToastContainer();
        const toast = document.createElement('div');
        toast.className = `toast-message toast-${type}`;
        toast.style.margin = "10px";
        toast.style.padding = "12px 20px";
        toast.style.borderRadius = "6px";
        toast.style.color = "#fff";
        toast.style.fontWeight = "500";
        toast.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
        toast.style.transition = "all 0.3s ease";
        
        const colors = {
            success: "#2ec4b6",
            error: "#e71d36",
            warning: "#ff9f1c",
            info: "#011627"
        };
        toast.style.backgroundColor = colors[type] || colors.info;
        toast.innerText = message;
        
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = "0";
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    function createToastContainer() {
        const container = document.createElement('div');
        container.id = 'toast-container';
        container.style.position = 'fixed';
        container.style.bottom = '20px';
        container.style.right = '20px';
        container.style.zIndex = '999999';
        document.body.appendChild(container);
        return container;
    }

    function logSystemEvent(eventType, details) {
        const logData = {
            timestamp: Date.now(),
            teacherId: getCurrentTeacherId(),
            eventType: sanitizeData(eventType),
            details: details
        };

        if (isFirebaseAvailable()) {
            const logId = generateId('log');
            databaseInstance.ref(`/admin/activityLogs/${logId}`).set(logData)
                .catch(err => console.error("Журнал жазуу катасы:", err));
        } else {
            const logs = safeJsonParse(localStorage.getItem('bilimal_offline_logs'), []);
            logs.push(logData);
            localStorage.setItem('bilimal_offline_logs', JSON.stringify(logs));
        }
    }

    function syncPendingData() {
        if (!isFirebaseAvailable()) return;
        const teacherId = getCurrentTeacherId();
        const pendingKey = `bilimal_offline_queue`;
        const queue = safeJsonParse(localStorage.getItem(pendingKey), []);
        
        if (queue.length === 0) return;

        showToast("Синхрондоштуруу башталды...", "info");
        
        const promises = queue.map(action => {
            if (action.path && action.data) {
                return databaseInstance.ref(action.path).set(action.data);
            }
            return Promise.resolve();
        });

        Promise.all(promises)
            .then(() => {
                localStorage.setItem(pendingKey, JSON.stringify([]));
                showToast("Бардык оффлайн маалыматтар серверге жүктөлдү!", "success");
                logSystemEvent("sync_success", { count: queue.length });
            })
            .catch(err => {
                console.error("Синхрондоштуруу катасы:", err);
                showToast("Айрым маалыматтар жүктөлбөй калды.", "error");
            });
    }

    // DomContentLoaded setup
    document.addEventListener("DOMContentLoaded", () => {
        initializeFirebase();
        window.addEventListener('online', syncPendingData);
    });

    // Namespace Export
    window.BilimalFirebase = {
        initializeFirebase,
        getDatabaseInstance,
        isFirebaseAvailable,
        safeJsonParse,
        sanitizeData,
        generateId,
        getCurrentTeacherId,
        getCurrentUserRole,
        showToast,
        logSystemEvent,
        syncPendingData,
        paths: {
            test: (teacherId, testId) => `/teachers/${teacherId}/tests/${testId}`,
            result: (teacherId, resultId) => `/teachers/${teacherId}/results/${resultId}`,
            class: (teacherId, classId) => `/teachers/${teacherId}/classes/${classId}`,
            settings: (teacherId) => `/teachers/${teacherId}/settings`,
            adminLog: (logId) => `/admin/activityLogs/${logId}`,
            adminTeacher: (teacherId) => `/admin/teachers/${teacherId}`,
            pending: (teacherId) => `/pendingSync/${teacherId}`
        }
    };
})();
