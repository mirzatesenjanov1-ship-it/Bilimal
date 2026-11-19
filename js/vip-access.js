
/* =====================================================
   BILIMAL VIP ACCESS - CENTRAL CHECKER
   Used by:
   /sections/lab-works-vip.html
   /sections/unlimited-board.html

   Main database:
   applications/vip_users/{emailKey}
   ===================================================== */

(function () {
    "use strict";

    const ADMIN_EMAIL = "mirzatestebesov51@gmail.com";

    function normalizeEmail(email) {
        return String(email || "").trim().toLowerCase();
    }

    function sanitizeEmail(email) {
        return normalizeEmail(email)
            .replace(/\./g, "_dot_")
            .replace(/@/g, "_at_");
    }

    function ensureAuth() {
        const auth = firebase.auth();

        if (auth.currentUser) {
            return Promise.resolve(auth.currentUser);
        }

        return auth.signInAnonymously().then(result => result.user);
    }

    function parseExpiry(data) {
        if (!data) return NaN;

        if (typeof data.expiresAtMs === "number") {
            return data.expiresAtMs;
        }

        const value = data.expiresAt;

        if (typeof value === "number") {
            return value;
        }

        if (typeof value === "string") {
            const parsed = Date.parse(value);
            return Number.isFinite(parsed) ? parsed : NaN;
        }

        return NaN;
    }

    async function readVip(email) {
        await ensureAuth();

        const db = firebase.database();
        const emailKey = sanitizeEmail(email);

        // 1. Негизги VIP маалымат базасы
        const mainSnapshot = await db.ref(
            "applications/vip_users/" + emailKey
        ).once("value");

        if (mainSnapshot.exists()) {
            return {
                data: mainSnapshot.val(),
                path: "applications/vip_users/" + emailKey
            };
        }

        // 2. Мурунку версиялардагы root VIP маалыматтары
        const legacySnapshot = await db.ref(
            "vip_users/" + emailKey
        ).once("value");

        if (legacySnapshot.exists()) {
            return {
                data: legacySnapshot.val(),
                path: "vip_users/" + emailKey
            };
        }

        return null;
    }

    async function check(email) {
        email = normalizeEmail(email);

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return {
                active: false,
                reason: "invalid-email"
            };
        }

        if (email === ADMIN_EMAIL) {
            return {
                active: true,
                admin: true,
                expiresAt: null
            };
        }

        const result = await readVip(email);

        if (!result) {
            return {
                active: false,
                reason: "not-found"
            };
        }

        const data = result.data;
        const expiry = parseExpiry(data);

        const active =
            data.status === "active" &&
            Number.isFinite(expiry) &&
            expiry > Date.now();

        if (!active) {
            return {
                active: false,
                reason: "expired",
                data: data,
                path: result.path
            };
        }

        return {
            active: true,
            admin: false,
            expiresAt: expiry,
            data: data,
            path: result.path
        };
    }

    // Башка барактар колдонушу үчүн
    window.BilimalVIP = {
        check: check,
        sanitizeEmail: sanitizeEmail
    };

    // ==========================================
    // LAB WORKS VIP PAGE
    // ==========================================

    window.verifyVipAccess = async function () {

        const input = document.getElementById("userEmailInput");
        if (!input) return;

        const email = normalizeEmail(input.value);

        if (!email) {
            alert("E-mail дарегиңизди киргизиңиз.");
            return;
        }

        const errorBox = document.getElementById("vipAccessError");

        if (errorBox) {
            errorBox.remove();
        }

        input.value = email;

        const button = document.querySelector(".btn-check");

        if (button) {
            button.disabled = true;
            button.textContent = "Текшерилүүдө...";
        }

        try {
            const result = await check(email);

            if (result.active) {

                localStorage.setItem("bilimal_user_email", email);

                const modalEmail = document.getElementById("modalUserEmail");

                if (modalEmail) {
                    modalEmail.value = email;
                }

                if (typeof window.showVipContent === "function") {

                    if (result.admin) {
                        document.getElementById("vipContentSection").style.display = "block";
                        document.getElementById("pricingSection").style.display = "none";
                        document.getElementById("vipExpireText").textContent =
                            "Администратор — чектөөсүз мүмкүнчүлүк";
                    } else {
                        window.showVipContent(new Date(result.expiresAt));
                    }
                }

            } else if (result.reason === "not-found" ||
                       result.reason === "expired") {

                if (typeof window.showPricingSection === "function") {
                    window.showPricingSection();
                }

            } else {
                throw new Error("E-mail дареги туура эмес.");
            }

        } catch (error) {

            console.error("VIP текшерүү катасы:", error);

            let box = document.getElementById("vipAccessError");

            if (!box) {
                box = document.createElement("div");
                box.id = "vipAccessError";
                box.style.cssText =
                    "margin-top:15px;padding:12px;border-radius:8px;" +
                    "background:#451a1a;color:#fecaca;font-size:13px;";

                const parent = document.querySelector(".auth-check-box");

                if (parent) {
                    parent.appendChild(box);
                }
            }

            box.textContent =
                "VIP маалыматтарын текшерүү мүмкүн болгон жок: " +
                error.message +
                ". Интернетти жана Firebase Rules эрежелерин текшериңиз.";

        } finally {

            if (button) {
                button.disabled = false;
                button.innerHTML =
                    '<i class="fa-solid fa-magnifying-glass"></i> Текшерүү';
            }
        }
    };

    // ==========================================
    // UNLIMITED BOARD PAGE
    // ==========================================

    window.verifyAccess = async function () {

        const input = document.getElementById("emailInput");
        const message = document.getElementById("authMessage");

        if (!input || !message) return;

        const email = normalizeEmail(input.value);

        message.style.color = "#94a3b8";
        message.textContent = "VIP мүмкүнчүлүк текшерилүүдө...";

        try {

            const result = await check(email);

            if (!result.active) {

                message.style.color = "#fca5a5";

                if (result.reason === "not-found") {
                    message.textContent =
                        "Бул E-mail дарегине VIP уруксаты берилген эмес.";
                } else if (result.reason === "expired") {
                    message.textContent =
                        "VIP мөөнөтү аяктаган. Уруксатты жаңыртыңыз.";
                } else {
                    message.textContent =
                        "Туура E-mail дарегин киргизиңиз.";
                }

                return;
            }

            localStorage.setItem("bilimal_user_email", email);

            if (typeof currentEmail !== "undefined") {
                currentEmail = email;
            }

            const label = document.getElementById("userLabel");

            if (label) {
                label.textContent =
                    email + (result.admin ? " | ADMIN" : " | VIP");
            }

            document.getElementById("authScreen").style.display = "none";
            document.getElementById("app").style.display = "flex";

            if (typeof initializeBoard === "function") {
                initializeBoard();
            }

        } catch (error) {

            console.error("Чексиз такта VIP катасы:", error);

            message.style.color = "#fca5a5";
            message.textContent =
                "Firebase текшерүү катасы: " + error.message;
        }
    };

})();
