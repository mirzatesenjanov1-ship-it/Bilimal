// Bilimal-AI Project - Safe & Controlled Advertising Dynamic Allocation Engine
(function () {
    // RULE DEFINITION: Never render advertisements inside runtime student dynamic quiz testing layout screens.
    function shouldLoadAds() {
        const path = window.location.pathname;
        // Restrict loading if inside standalone quiz execution frame or active student viewport
        if (path.includes('/quiz/') || path.includes('/take-test/') || localStorage.getItem('bilimal_active_student_exam') === 'true') {
            return false;
        }
        return true;
    }

    function initializeGoogleAdSense() {
        if (!shouldLoadAds()) return;
        try {
            const script = document.createElement('script');
            script.async = true;
            script.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1495571814896964";
            script.crossOrigin = "anonymous";
            document.head.appendChild(script);

            (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch (e) {
            console.error("AdSense катасы:", e);
        }
    }

    function injectDashboardBannerAds() {
        if (!shouldLoadAds()) return;

        const placementSlot = document.getElementById('dashboard-ad-banner-placement');
        if (!placementSlot) return;

        // Secure continuous integration min-height standard parameters to eliminate Layout Shifts
        const adWrapper = document.createElement('div');
        adWrapper.className = 'bilimal-safe-ad-wrapper';
        adWrapper.style.minHeight = '90px';
        adWrapper.style.margin = '20px 0';
        adWrapper.style.display = 'flex';
        adWrapper.style.justifyContent = 'center';
        adWrapper.style.alignItems = 'center';
        adWrapper.style.background = '#fafafa';
        adWrapper.style.border = '1px solid #eaeaea';

        // Initialize Adsterra Frame Config Structure safely inside non-student spaces
        window.atOptions = {
            'key' : '230e338703bb44150336cce1f0832fe3',
            'format' : 'iframe',
            'height' : 90,
            'width' : 728,
            'params' : {}
        };

        const adScript = document.createElement('script');
        adScript.src = "https://www.highperformanceformat.com/230e338703bb44150336cce1f0832fe3/invoke.js";
        
        adWrapper.appendChild(adScript);
        placementSlot.appendChild(adWrapper);
    }

    function injectSocialBarAdNetwork() {
        // Strict isolation guardrail check preventing Social Bars inside exam sessions
        if (!shouldLoadAds()) return;

        const script = document.createElement('script');
        script.src = "https://pl30202824.effectivecpmnetwork.com/2a/5b/af/2a5bafdd419add82a1af8ec0def99355.js";
        document.body.appendChild(script);
    }

    document.addEventListener("DOMContentLoaded", () => {
        if (shouldLoadAds()) {
            initializeGoogleAdSense();
            injectDashboardBannerAds();
            // Load social bar safely in background admin control templates
            injectSocialBarAdNetwork();
        }
    });

    window.BilimalAds = {
        shouldLoadAds,
        refreshAdsLayout: injectDashboardBannerAds
    };
})();
