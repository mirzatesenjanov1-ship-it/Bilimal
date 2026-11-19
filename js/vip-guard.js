
/* =====================================================
   BILIMAL VIP GUARD
   Файл: /js/vip-guard.js
   VIP бөлүмдөрүн коргоо жана мөөнөтүн текшерүү
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

/* Firebase конфигурациясы — dashboard.html файлыңыздагыдай */

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

/* Администратор */

const ADMIN_EMAIL = "mirzatestebesov51@gmail.com";

/* Firebase */

const app = getApps().length
    ? getApp()
    : initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getDatabase(app);

/* Баракты жашыруу */

function showPage() {
    document.documentElement.classList.remove("vip-checking");
}

/* VIP жок болсо dashboard'га кайтаруу */

function denyAccess(reason) {
    window.location.replace(
        "/dashboard.html?vip=" +
        encodeURIComponent(reason)
    );
}

/* VIP мөөнөтүн текшерүү */

async function checkVipAccess(user) {

    if (!user) {
        denyAccess("login-required");
        return;
    }

    // Администраторго VIP чектөөсү жок
    if (
        (user.email || "").toLowerCase() ===
        ADMIN_EMAIL.toLowerCase()
    ) {
        showPage();
        return;
    }

    try {

        const snapshot = await get(
            ref(db, "vipAccess/" + user.uid)
        );

        if (!snapshot.exists()) {
            denyAccess("required");
            return;
        }

        const access = snapshot.val();

        const expiresAt = Number(
            access.expiresAt || 0
        );

        const isActive =
            access.active === true &&
            Number.isFinite(expiresAt) &&
            expiresAt > Date.now();

        if (!isActive) {
            denyAccess("expired");
            return;
        }

        // VIP активдүү — баракты көрсөтүү
        showPage();

        // Мөөнөт бүткөнүн мезгил-мезгили менен текшерүү
        const expiryCheck = window.setInterval(() => {

            if (Date.now() >= expiresAt) {
                window.clearInterval(expiryCheck);
                denyAccess("expired");
            }

        }, 10000);

        // Колдонуучу баракка кайра келгенде да текшерүү
        document.addEventListener(
            "visibilitychange",
            () => {
                if (
                    document.visibilityState === "visible" &&
                    Date.now() >= expiresAt
                ) {
                    window.clearInterval(expiryCheck);
                    denyAccess("expired");
                }
            }
        );

    } catch (error) {

        console.error(
            "Bilimal VIP текшерүү катасы:",
            error
        );

        // Firebase катасы болсо, кирүүгө уруксат берилбейт
        denyAccess("check-error");
    }
}

/* Авторизацияны текшерүү */

onAuthStateChanged(auth, async (user) => {
    await checkVipAccess(user);
});
