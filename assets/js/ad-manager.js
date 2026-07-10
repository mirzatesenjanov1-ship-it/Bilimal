const AdManager = {
    renderBanners() {
        if (typeof window === "undefined") return;
        // Verify we are not in safe anti-cheat or student quiz view before executing native injectors
        const path = window.location.pathname;
        if (path.includes("student-test") || path.includes("quiz") || path.includes("anti-cheat")) {
            return; 
        }

        try {
            // Initialize AdSense push trigger securely
            (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch (e) {}

        const slot = document.getElementById("adsterraBanner728x90");
        if (slot) {
            slot.innerHTML = `<div style='background:rgba(255,255,255,0.02); padding:10px; color:#666; font-size:11px;'>Рекламалык байланыш борбору</div>`;
        }
    }
};
document.addEventListener("DOMContentLoaded", () => AdManager.renderBanners());
export { AdManager };
