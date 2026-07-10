import { Toast } from "./toast.js";

const AntiCheatMonitor = {
    alertsCount: 0,
    config: { tabSwitch: true, fullscreen: false, noCopy: true, noRightClick: true },
    
    init(config = {}) {
        this.config = { ...this.config, ...config };
        this.bindSecurityListeners();
    },
    bindSecurityListeners() {
        if (this.config.tabSwitch) {
            document.addEventListener("visibilitychange", () => {
                if (document.hidden) {
                    this.alertsCount++;
                    Toast.warning("Эскертүү! Башка вкладкага өтүүгө тыюу салынган!");
                    this.triggerCallback({ type: "tab_switch", count: this.alertsCount });
                }
            });
        }
        if (this.config.noCopy) {
            document.addEventListener("copy", (e) => { e.preventDefault(); Toast.danger("Текстти көчүрүүгө бөгөт коюлган!"); });
            document.addEventListener("paste", (e) => { e.preventDefault(); Toast.danger("Текст чаптоого бөгөт коюлган!"); });
        }
        if (this.config.noRightClick) {
            document.addEventListener("contextmenu", (e) => { e.preventDefault(); });
        }
    },
    triggerCallback(eventData) {
        if (typeof window.onAntiCheatTrigger === "function") {
            window.onAntiCheatTrigger(eventData);
        }
    }
};
window.AntiCheatMonitor = AntiCheatMonitor;
export { AntiCheatMonitor };
