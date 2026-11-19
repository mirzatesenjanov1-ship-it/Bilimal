
/* =====================================================
   BILIMAL VIP GUARD
   Бирдиктүү VIP маалымат базасы:
   applications/vip_users/{emailKey}
   ===================================================== */

import {
    initializeApp,
    getApps,
    getApp
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";

import {
    getAuth,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

import {
    getDatabase,
    ref,
    get
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

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

const ADMIN_EMAIL = "mirzatestebesov51@gmail.com";

const app = getApps().length
    ? getApp()
    : initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getDatabase(app);

// Электрондук почтаны Firebase ачкычына айландыруу
function sanitizeEmail(email) {
    return email.trim()
        .toLowerCase()
        .replace(/\./g, "_dot_")
        .replace(/@/g, "_at_");
}

// VIP текшерилип бүткөндө баракты көрсөтүү
function showPage() {
    document.documentElement.classList.remove("vip-checking");
}

// VIP жок болсо башкы панелге кайтаруу
function denyAccess(reason) {
    window.location.replace(
        "/dashboard.html?vip=" + encodeURIComponent(reason)
    );
}

// VIP текшерүү
async function checkVipAccess(user) {

    if (!user) {
        denyAccess("login-required");
        return;
    }

    const email = (user.email || "").trim().toLowerCase();

    // Администраторго чектөөсүз мүмкүнчүлүк
    if (email === ADMIN_EMAIL.toLowerCase()) {
        showPage();
        return;
    }

    if (!email) {
        denyAccess("email-required");
        return;
    }

    try {

        // Админ берген VIP менен бирдей база
        const emailKey = sanitizeEmail(email);

        const snapshot = await get(
            ref(db, "applications/vip_users/" + emailKey)
        );

        if (!snapshot.exists()) {
            denyAccess("required");
            return;
        }

        const access = snapshot.val();

        const expiresAt = new Date(
            access.expiresAt
        ).getTime();

        const isActive =
            access.status === "active" &&
            Number.isFinite(expiresAt) &&
            expiresAt > Date.now();

        if (!isActive) {
            denyAccess("expired");
            return;
        }

        // VIP активдүү
        showPage();

        // Мөөнөтү бүткөндө автоматтык түрдө жабуу
        const expiryCheck = window.setInterval(() => {

            if (Date.now() >= expiresAt) {
                window.clearInterval(expiryCheck);
                denyAccess("expired");
            }

        }, 10000);

        // Баракка кайра келгенде да текшерүү
        document.addEventListener("visibilitychange", () => {

            if (
                document.visibilityState === "visible" &&
                Date.now() >= expiresAt
            ) {
                window.clearInterval(expiryCheck);
                denyAccess("expired");
            }

        });

    } catch (error) {

        console.error("Bilimal VIP катасы:", error);

        // Ката болсо коопсуздук үчүн киргизбөө
        denyAccess("check-error");
    }
}

// Firebase авторизациясы
onAuthStateChanged(auth, async (user) => {
    await checkVipAccess(user);
});
