/* =========================================================
   BILIMAL VIP ACCESS SYSTEM
   Central VIP verification for Bilimal.org
   ========================================================= */

(function () {
    "use strict";

    const ADMIN_EMAIL = "mirzatestebesjanov51@gmail.com";

    const MAIN_PATH = "applications/vip_users";
    const LEGACY_PATH = "vip_users";

    // -----------------------------------------------------
    // EMAIL NORMALIZATION
    // -----------------------------------------------------

    function normalizeEmail(email) {
        return String(email || "")
            .trim()
            .toLowerCase();
    }

    function sanitizeEmail(email) {
        return normalizeEmail(email)
            .replace(/\./g, "_dot_")
            .replace(/@/g, "_at_");
    }

    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
            normalizeEmail(email)
        );
    }

    // -----------------------------------------------------
    // FIREBASE AUTH
    // -----------------------------------------------------

    async function ensureAuth() {
        if (typeof firebase === "undefined") {
            throw new Error("Firebase жүктөлгөн эмес.");
        }

        if (!firebase.auth || !firebase.database) {
            throw new Error("Firebase Auth же Database жеткиликтүү эмес.");
        }

        if (firebase.auth().currentUser) {
            return firebase.auth().currentUser;
        }

        const result = await firebase.auth().signInAnonymously();

        return result.user;
    }

    // -----------------------------------------------------
    // EXPIRATION DATE
    // -----------------------------------------------------

    function parseExpiry(data) {
        if (!data) return 0;

        if (data.expiresAtMs) {
            const value = Number(data.expiresAtMs);

            if (Number.isFinite(value) && value > 0) {
                return value;
            }
        }

        if (data.expiresAt) {
            const value = Date.parse(data.expiresAt);

            if (!Number.isNaN(value)) {
                return value;
            }
        }

        return 0;
    }

    function formatDate(timestamp) {
        if (!timestamp) return "Белгисиз";

        return new Date(timestamp).toLocaleDateString("ru-RU", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        });
    }

    // -----------------------------------------------------
    // DATABASE VIP READ
    // -----------------------------------------------------

    async function readVip(email) {
        await ensureAuth();

        const emailKey = sanitizeEmail(email);

        const mainRef = firebase.database()
            .ref(MAIN_PATH + "/" + emailKey);

        const mainSnapshot = await mainRef.once("value");

        if (mainSnapshot.exists()) {
            return {
                data: mainSnapshot.val(),
                path: MAIN_PATH
            };
        }

        const legacyRef = firebase.database()
            .ref(LEGACY_PATH + "/" + emailKey);

        const legacySnapshot = await legacyRef.once("value");

        if (legacySnapshot.exists()) {
            return {
                data: legacySnapshot.val(),
                path: LEGACY_PATH
            };
        }

        return null;
    }

    // -----------------------------------------------------
    // CENTRAL VIP CHECK
    // -----------------------------------------------------

    async function check(email) {
        email = normalizeEmail(email);

        if (!isValidEmail(email)) {
            return {
                active: false,
                reason: "invalid_email",
                email: email
            };
        }

        // ADMIN HAS UNLIMITED ACCESS
        if (email === normalizeEmail(ADMIN_EMAIL)) {
            return {
                active: true,
                admin: true,
                unlimited: true,
                email: email,
                expiresAt: null
            };
        }

        try {
            const record = await readVip(email);

            if (!record || !record.data) {
                return {
                    active: false,
                    reason: "not_found",
                    email: email
                };
            }

            const data = record.data;

            if (data.status !== "active") {
                return {
                    active: false,
                    reason: "inactive",
                    email: email,
                    data: data
                };
            }

            const expiresAt = parseExpiry(data);

            if (!expiresAt || expiresAt <= Date.now()) {
                return {
                    active: false,
                    reason: "expired",
                    email: email,
                    expiresAt: expiresAt,
                    data: data
                };
            }

            return {
                active: true,
                admin: false,
                unlimited: false,
                email: email,
                expiresAt: expiresAt,
                expiresAtFormatted: formatDate(expiresAt),
                data: data,
                path: record.path
            };

        } catch (error) {
            console.error("VIP CHECK ERROR:", error);

            return {
                active: false,
                reason: "error",
                error: error.message,
                email: email
            };
        }
    }

    // -----------------------------------------------------
    // PUBLIC API
    // -----------------------------------------------------

    window.BilimalVIP = {
        check: check,
        sanitizeEmail: sanitizeEmail,
        normalizeEmail: normalizeEmail
    };

    // -----------------------------------------------------
    // LAB-WORKS-VIP.HTML
    // -----------------------------------------------------

    window.verifyVipAccess = async function () {
        const input = document.getElementById("userEmailInput");

        if (!input) {
            console.error("userEmailInput табылган жок.");
            return;
        }

        const email = normalizeEmail(input.value);

        if (!isValidEmail(email)) {
            alert("Электрондук почта туура эмес!");
            return;
        }

        const button = document.querySelector(
            'button[onclick*="verifyVipAccess"]'
        );

        let oldButtonText = "";

        if (button) {
            oldButtonText = button.innerHTML;
            button.disabled = true;
            button.innerHTML = "Текшерилүүдө...";
        }

        try {
            const result = await check(email);

            if (result.active) {

                if (typeof showVipContent === "function") {
                    showVipContent();
                }

                if (typeof showPricingSection === "function") {
                    showPricingSection(false);
                }

                if (result.admin) {
                    alert("Администратор. Чексиз VIP мүмкүнчүлүк!");
                } else {
                    alert(
                        "VIP мүмкүнчүлүк активдүү!\n" +
                        "Мөөнөтү: " +
                        result.expiresAtFormatted
                    );
                }

                return;
            }

            if (typeof showVipContent === "function") {
                showVipContent(false);
            }

            if (typeof showPricingSection === "function") {
                showPricingSection(true);
            }

            if (result.reason === "expired") {
                alert("VIP мөөнөтү бүткөн. Кайра сатып алыңыз.");
            } else if (result.reason === "not_found") {
                alert("VIP аккаунт табылган жок. Тариф тандаңыз.");
            } else if (result.reason === "inactive") {
                alert("VIP аккаунт активдүү эмес.");
            } else {
                alert("VIP текшерүү учурунда ката чыкты.");
            }

        } catch (error) {
            console.error(error);
            alert("Сервер менен байланышуу мүмкүн болгон жок.");
        } finally {
            if (button) {
                button.disabled = false;
                button.innerHTML = oldButtonText;
            }
        }
    };

    // -----------------------------------------------------
    // UNLIMITED-BOARD.HTML
    // -----------------------------------------------------

    window.verifyAccess = async function () {
        const input = document.getElementById("emailInput");
        const message = document.getElementById("authMessage");

        if (!input) {
            console.error("emailInput табылган жок.");
            return;
        }

        const email = normalizeEmail(input.value);

        if (!isValidEmail(email)) {
            if (message) {
                message.textContent =
                    "Электрондук почта туура эмес!";
                message.style.color = "#ef4444";
            }

            return;
        }

        if (message) {
            message.textContent = "VIP статус текшерилүүдө...";
            message.style.color = "#f59e0b";
        }

        try {
            const result = await check(email);

            if (!result.active) {
                if (message) {
                    message.textContent =
                        "VIP мүмкүнчүлүк жок же мөөнөтү бүткөн.";
                    message.style.color = "#ef4444";
                }

                return;
            }

            // VIP ACCESS GRANTED

            localStorage.setItem("bilimal_vip_email", email);
            localStorage.setItem("bilimal_vip_active", "true");

            if (typeof currentEmail !== "undefined") {
                currentEmail = email;
            }

            const authScreen = document.getElementById("authScreen");
            const app = document.getElementById("app");

            if (authScreen) {
                authScreen.style.display = "none";
            }

            if (app) {
                app.style.display = "block";
            }

            const userLabel = document.getElementById("userLabel");

            if (userLabel) {
                userLabel.textContent = email;
            }

            if (message) {
                message.textContent = "VIP мүмкүнчүлүк берилди!";
                message.style.color = "#22c55e";
            }

            if (typeof initializeBoard === "function") {
                initializeBoard();
            }

        } catch (error) {
            console.error("VIP ACCESS ERROR:", error);

            if (message) {
                message.textContent =
                    "Текшерүүдө ката кетти. Кайра аракет кылыңыз.";
                message.style.color = "#ef4444";
            }
        }
    };

    console.log("Bilimal VIP Access System loaded successfully.");

})();
