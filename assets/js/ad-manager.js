/**
 * Bilimal.org - Жарнама жана Монетизация Интеграциялык Модулу (Ad Manager Engine)
 * Эреже: Тест учурунда жана жеке кабинетте агрессивдүү жарнамаларга катуу тыюу салынат!
 */

const BilimalAdManager = {
    // Жарнама тармактарынын жөндөөлөрү
    config: {
        adSensePublisherId: "ca-pub-1495571814896964",
        adSenseSlotId: "1574613769",
        adsterraBannerKey: "230e338703bb44150336cce1f0832fe3"
    },

    // Жарнама көрсөтүүгө уруксат барбы?
    shouldShowAds() {
        const path = window.location.pathname;
        
        // 1. Админ жана Мугалим кабинетинде көрсөтпөө
        if (path.includes('admin-dashboard.html') || path.includes('tests.html')) {
            return false;
        }
        // 2. Кирүү же купуялуулук беттеринде көрсөтпөө
        if (path.includes('privacy-policy.html') || path.includes('terms.html')) {
            return false;
        }
        // 3. Активдүү окуучунун тест барагын текшерүү
        if (this.isStudentTestActive()) {
            return false;
        }
        
        // 4. Куки макулдугун текшерүү
        const consent = BilimalStorage.getObject(BilimalStorage.KEYS.COOKIE_CONSENT);
        if (consent && consent.personalizedAds === false) {
            return false; // Колдонуучу баш тартса жарнама жабылат
        }

        return true;
    },

    // Окуучу азыр тест ичиндеби жана античит иштеп жатабы?
    isStudentTestActive() {
        const path = window.location.pathname;
        if (path.includes('student-test.html')) {
            const testContainer = document.getElementById('active-test-container');
            if (testContainer && testContainer.style.display !== 'none') {
                // Эгер античит иштеп жатса, толугу менен жарнама өчөт
                const antiCheatActive = sessionStorage.getItem('bilimal_anticheat_active');
                if (antiCheatActive === 'true') {
                    return true;
                }
                // Кадимки тест учуру болсо да текшерилет
                return true;
            }
        }
        return false;
    },

    // Модулду баштоо
    initAds() {
        if (!this.shouldShowAds()) {
            this.destroyAdsForExamMode();
            return;
        }
        this.loadAdsterraSocialBar();
    },

    // Google AdSense баннерин коопсуз жүктөө
    renderAdSense(containerId, format = 'auto') {
        if (!this.shouldShowAds()) return;
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = `
            <div class="ad-container adsense-container" aria-label="Жарнама">
                <div class="ad-label">Жарнама</div>
                <ins class="adsbygoogle"
                     style="display:block"
                     data-ad-client="${this.config.adSensePublisherId}"
                     data-ad-slot="${this.config.adSenseSlotId}"
                     data-ad-format="${format}"
                     data-full-width-responsive="true"></ins>
            </div>
        `;

        try {
            (window.adsbygoogle = window.adsbygoogle || []).push({});
            this.trackAdVisibility('AdSense-' + containerId);
        } catch (error) {
            console.warn('AdSense жүктөлгөн жок же бөгөттөлгөн:', error);
            this.handleAdBlock(container);
        }
    },

    // Adsterra 728x90 Banner жүктөө
    renderAdsterraBanner(containerId) {
        if (!this.shouldShowAds()) return;
        const container = document.getElementById(containerId);
        if (!container) return;

        // Экран өлчөмүнө жараша адаптациялоо (Мобилдик болсо өлчөмүн өзгөртүү)
        const isMobile = window.innerWidth < 768;
        const width = isMobile ? 320 : 728;
        const height = isMobile ? 100 : 90;

        container.innerHTML = `
            <div class="ad-container adsterra-container" aria-label="Жарнама">
                <div class="ad-label">Жарнама</div>
                <div id="adsterra-slot-${containerId}"></div>
            </div>
        `;

        try {
            const slot = document.getElementById(`adsterra-slot-${containerId}`);
            if (slot) {
                const scriptOpts = document.createElement('script');
                scriptOpts.text = `
                    atOptions = {
                        'key' : '${this.config.adsterraBannerKey}',
                        'format' : 'iframe',
                        'height' : ${height},
                        'width' : ${width},
                        'params' : {}
                    };
                `;
                slot.appendChild(scriptOpts);

                const scriptInvoke = document.createElement('script');
                scriptInvoke.src = `https://www.highperformanceformat.com/${this.config.adsterraBannerKey}/invoke.js`;
                slot.appendChild(scriptInvoke);
                
                this.trackAdVisibility('Adsterra-728x90');
            }
        } catch (error) {
            console.error('Adsterra баннер катасы:', error);
            this.handleAdBlock(container);
        }
    },

    // Adsterra Social Bar'ды коопсуз гана коомдук беттерге жүктөө
    loadAdsterraSocialBar() {
        const path = window.location.pathname;
        // Катуу тыюу салынган тизме
        const forbiddenPages = [
            'student-test.html', 'tests.html', 'admin-dashboard.html', 
            'privacy-policy.html', 'terms.html'
        ];
        
        const isForbidden = forbiddenPages.some(page => path.includes(page));
        if (isForbidden || this.isStudentTestActive()) {
            return; 
        }

        try {
            const script = document.createElement('script');
            script.src = "https://pl30202824.effectivecpmnetwork.com/2a/5b/af/2a5bafdd419add82a1af8ec0def99355.js";
            script.async = true;
            document.body.appendChild(script);
        } catch (e) {
            console.warn("Social Bar жүктөлгөн жок.");
        }
    },

    // Макалалардын же сабак пландарынын ичине интеллектуалдык түрдө жарнама жайгаштыруу
    injectAdsIntoArticle(articleElement) {
        if (!this.shouldShowAds() || !articleElement) return;

        const text = articleElement.innerText || "";
        const wordCount = text.split(/\s+/).length;
        const paragraphs = articleElement.querySelectorAll('p');

        if (paragraphs.length === 0) return;

        // Эреже 1: Текст 500 сөздөн аз болсо - бир гана төмөнкү жарнама
        if (wordCount < 500) {
            this.createDynamicAdWrapper(articleElement, 'append');
        } 
        // Эреже 2: Текст 500-1200 сөз болсо - башына жана аягына
        else if (wordCount >= 500 && wordCount <= 1200) {
            if (paragraphs.length > 1) {
                this.createDynamicAdWrapper(paragraphs[0], 'after');
            }
            this.createDynamicAdWrapper(articleElement, 'append');
        } 
        // Эреже 3: Текст 1200 сөздөн ашса - башына, ортосуна жана аягына
        else {
            if (paragraphs.length > 1) {
                this.createDynamicAdWrapper(paragraphs[0], 'after');
            }
            const middleIndex = Math.floor(paragraphs.length / 2);
            if (paragraphs[middleIndex]) {
                this.createDynamicAdWrapper(paragraphs[middleIndex], 'after');
            }
            this.createDynamicAdWrapper(articleElement, 'append');
        }
    },

    // Динамикалык жарнама блокторун түзүүчү жардамчы функция
    createDynamicAdWrapper(targetElement, position) {
        const adId = 'dynamic-ad-' + Math.floor(Math.random() * 100000);
        const wrapper = document.createElement('div');
        wrapper.id = adId;
        wrapper.className = 'dynamic-ad-wrapper';
        wrapper.style.margin = "25px 0";
        wrapper.style.minHeight = "90px";

        if (position === 'append') {
            targetElement.appendChild(wrapper);
        } else if (position === 'after') {
            targetElement.parentNode.insertBefore(wrapper, targetElement.nextSibling);
        }

        // Динамикалык түрдө AdSense же Adsterra чакыруу
        if (Math.random() > 0.5) {
            this.renderAdSense(adId);
        } else {
            this.renderAdsterraBanner(adId);
        }
    },

    // Жарнаманын көрүнүүсүн көзөмөлдөө (Layout Shift болтурбоо)
    trackAdVisibility(slotName) {
        if (typeof window.gtag === 'function') {
            window.gtag('event', 'ad_slot_visible', { 'ad_slot_name': slotName });
        }
    },

    // AdBlock колдонулуп жатса бош контейнерди 5 секунддан кийин жашыруу
    handleAdBlock(container) {
        setTimeout(() => {
            if (container) {
                container.style.transition = "all 0.5s ease";
                container.style.opacity = "0";
                container.style.height = "0px";
                container.style.minHeight = "0px";
                container.style.margin = "0px";
                container.style.padding = "0px";
                setTimeout(() => container.remove(), 500);
            }
        }, 5000);
    },

    // Экзамен режими иштегенде бардык жарнама элементтерин сайттан дароо жок кылуу
    destroyAdsForExamMode() {
        const elements = document.querySelectorAll('.ad-container, .dynamic-ad-wrapper');
        elements.forEach(el => el.remove());
    }
};

// Экзамен режими башталганда жарнаманы тазалоо окуясы
document.addEventListener('DOMContentLoaded', () => {
    BilimalAdManager.initAds();
});

window.BilimalAdManager = BilimalAdManager;
