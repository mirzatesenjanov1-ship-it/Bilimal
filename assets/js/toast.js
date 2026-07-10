const Toast = {
    init() {
        let container = document.getElementById("toastNotificationStack");
        if (!container) {
            container = document.createElement("div");
            container.id = "toastNotificationStack";
            container.className = "toast-stack-container";
            document.body.appendChild(container);
        }
        this.container = container;
    },
    show(message, type = "info", duration = 4000) {
        if (!this.container) this.init();
        const toast = document.createElement("div");
        toast.className = `toast-message toast-${type}`;
        
        let icon = "fa-info-circle";
        if (type === "success") icon = "fa-check-circle";
        if (type === "warning") icon = "fa-exclamation-triangle";
        if (type === "danger") icon = "fa-times-circle";

        toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span class="toast-txt">${message}</span>`;
        this.container.appendChild(toast);
        
        setTimeout(() => { toast.classList.add("toast-show"); }, 50);
        setTimeout(() => {
            toast.classList.remove("toast-show");
            setTimeout(() => { toast.remove(); }, 400);
        }, duration);
    },
    success(msg) { this.show(msg, "success"); },
    warning(msg) { this.show(msg, "warning"); },
    danger(msg) { this.show(msg, "danger"); },
    info(msg) { this.show(msg, "info"); }
};
if (typeof window !== "undefined") { window.Toast = Toast; }
export { Toast };
