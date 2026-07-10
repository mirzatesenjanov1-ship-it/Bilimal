import { saveTeacherActivity, syncQueuedActivities } from "./firebase-config.js";
import { Toast } from "./toast.js";

const TeacherActivityLogger = {
    async log(action, details = {}) {
        try {
            await saveTeacherActivity(action, details);
        } catch (e) {
            console.warn("Activity logger silent error handled", e.message);
        }
    },
    async forceSync() {
        if (navigator.onLine) {
            await syncQueuedActivities();
            Toast.info("Жергиликтүү аракеттер база менен синхрондолду.");
        }
    }
};
window.TeacherActivityLogger = TeacherActivityLogger;
export { TeacherActivityLogger };
