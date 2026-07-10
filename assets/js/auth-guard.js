import { auth, onAuthStateChanged, safeLocalStorageSet, safeLocalStorageRemove } from "./firebase-config.js";

function checkAuth(callback = null) {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            safeLocalStorageSet("bilimal_current_user", { uid: user.uid, email: user.email });
            if (callback) callback(user);
        } else {
            safeLocalStorageRemove("bilimal_current_user");
            if (!window.location.pathname.includes("login") && !window.location.pathname.includes("student-test")) {
                window.location.href = "/sections/login.html";
            }
        }
    }, (err) => {
        console.warn("Auth check error:", err.message);
    });
}
if (typeof window !== "undefined") { window.checkAuth = checkAuth; }
export { checkAuth };
