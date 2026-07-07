/**
 * Bilimal.org - Жарнама тармактарын башкаруу жана CLS коргоо модулу
 */

const AdManager = {
    isExamMode() {
        return window.location.pathname.includes('student-test.html') || 
               document.getElementById('active-test-container') !== null && 
               !document.getElementById('active-test-container').classList.contains('hidden');
    },

    renderAdSense(containerId) {
        if (this.isExamMode()) return;
        const container = document.getElementById(containerId);
        if (!container) return;

        container.className = "bilimal-adsense-wrapper clsholder-90";
        container.innerHTML = `
            <ins class="adsbygoogle"
                 style="display:block"
                 data-ad-client="ca-pub-1495571814896964"
                 data-ad-slot="1574613769"
                 data-ad-format="auto"
                 data-full-width-responsive="true"></ins>
        `;
        try {
            (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch (e) {
            console.warn("AdSense инициализация катасы, жарнама бөгөттөлгөн болушу мүмкүн.");
        }
    },

    renderAdsterraBanner(containerId) {
        if (this.isExamMode()) return;
        const container = document.getElementById(containerId);
        if (!container) return;

        container.className = "bilimal-adsterra-wrapper clsholder-90";
        window.atOptions = {
            'key' : '230e338703bb44150336cce1f0832fe3',
            'format' : 'iframe',
            'height' : 90,
            'width' : 728,
            'params' : {}
        };
        
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = 'https://www.highperformanceformat.com/230e338703bb44150336cce1f0832fe3/invoke.js';
        container.appendChild(script);
    },

    injectSocialBar() {
        if (this.isExamMode()) return;
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = 'https://pl30202824.effectivecpmnetwork.com/2a/5b/af/2a5bafdd419add82a1af8ec0def99355.js';
        document.body.appendChild(script);
    }
};
