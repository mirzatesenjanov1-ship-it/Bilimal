/**
 * Bilimal.org - Куки жана Купуялуулук Келишими (Cookie & Privacy Consent Management)
 */

// Глобалдык Google Analytics окуяларды жиберүүчү коопсуз жардамчы функция
window.trackEvent = function(eventName, params = {}) {
    try {
        if (typeof window.gtag === 'function') {
            // Коопсуздук үчүн жеке маалыматтарды тазалайбыз
            const safeParams = { ...params };
            delete safeParams.email;
            delete safeParams.password;
            delete safeParams.studentName;
            delete safeParams.phone;
            
            window.gtag('event', eventName, safeParams);
        }
    } catch (e) {
        console.warn("Analytics окуясын жиберүүдө ката келип чыкты, бирок сайт ишин улантат:", e);
    }
};

const BilimalCookieConsent = {
    init() {
        const consent = BilimalStorage.getObject(BilimalStorage.KEYS.COOKIE_CONSENT);
        if (!consent) {
            this.renderBanner();
        } else if (consent.analytics === true) {
            this.activateAnalytics();
        }
    },

    renderBanner() {
        // Эгер мурда түзүлгөн болсо кайталабоо
        if (document.getElementById('bilimal-cookie-banner')) return;

        const banner = document.createElement('div');
        banner.id = 'bilimal-cookie-banner';
        banner.className = 'cookie-consent-banner';
        banner.setAttribute('role', 'dialog');
        banner.setAttribute('aria-label', 'Куки келишими');

        banner.innerHTML = `
            <div class="cookie-content">
                <h3>Купуялуулук жана Cookie файлдары</h3>
                <p>Биз сайттын иштешин жакшыртуу, статистиканы талдоо жана кызыгууңузга ылайык жарнама көрсөтүү үчүн cookie файлдарын колдонобуз. "Баарына макулмун" баскычын басуу менен сиз купуялуулук саясатына макулдугуңузду билдиресиз.</p>
                <div class="cookie-options" id="cookie-advanced-options" style="display:none; margin: 15px 0;">
                    <label class="cookie-checkbox">
                        <input type="checkbox" id="cookie-essential" checked disabled>
                        <span>Милдеттүү кукилер (Сайттын иштеши үчүн)</span>
                    </label>
                    <label class="cookie-checkbox">
                        <input type="checkbox" id="cookie-analytics" checked>
                        <span>Google Analytics (Статистика жана анализ)</span>
                    </label>
                    <label class="cookie-checkbox">
                        <input type="checkbox" id="cookie-ads" checked>
                        <span>Персоналдаштырылган жарнамалар</span>
                    </label>
                </div>
                <div class="cookie-buttons">
                    <button id="btn-cookie-accept-all" class="cookie-btn cookie-btn-primary">Баарына макулмун</button>
                    <button id="btn-cookie-settings" class="cookie-btn cookie-btn-secondary">Ыңгайына келтирүү</button>
                    <button id="btn-cookie-save" class="cookie-btn cookie-btn-save" style="display:none;">Тандоону сактоо</button>
                </div>
            </div>
        `;

        document.body.appendChild(banner);
        this.bindEvents();
    },

    bindEvents() {
        const btnAcceptAll = document.getElementById('btn-cookie-accept-all');
        const btnSettings = document.getElementById('btn-cookie-settings');
        const btnSave = document.getElementById('btn-cookie-save');
        const advancedOptions = document.getElementById('cookie-advanced-options');

        if (btnAcceptAll) {
            btnAcceptAll.addEventListener('click', () => {
                this.saveConsent(true, true);
            });
        }

        if (btnSettings) {
            btnSettings.addEventListener('click', () => {
                advancedOptions.style.display = 'block';
                btnAcceptAll.style.display = 'none';
                btnSettings.style.display = 'none';
                btnSave.style.display = 'inline-block';
            });
        }

        if (btnSave) {
            btnSave.addEventListener('click', () => {
                const anaCheck = document.getElementById('cookie-analytics').checked;
                const adsCheck = document.getElementById('cookie-ads').checked;
                this.saveConsent(anaCheck, adsCheck);
            });
        }
    },

    saveConsent(analyticsAllowed, adsAllowed) {
        const consentData = {
            essential: true,
            analytics: analyticsAllowed,
            personalizedAds: adsAllowed,
            date: new Date().toISOString()
        };

        BilimalStorage.setObject(BilimalStorage.KEYS.COOKIE_CONSENT, consentData);

        const banner = document.getElementById('bilimal-cookie-banner');
        if (banner) {
            banner.style.opacity = '0';
            setTimeout(() => banner.remove(), 400);
        }

        if (analyticsAllowed) {
            this.activateAnalytics();
        }

        // Баракты коопсуз жаңылоо, жарнамалар жана аналитика жаңы режимде иштеши үчүн
        window.location.reload();
    },

    activateAnalytics() {
        try {
            // Google Analytics динамикалык иштетүү (Эгер кошулбаган болсо)
            if (!window.gtag) {
                const scriptTag = document.createElement('script');
                scriptTag.src = "https://www.googletagmanager.com/gtag/js?id=G-9GSQV60QV0";
                scriptTag.async = true;
                document.head.appendChild(scriptTag);

                window.dataLayer = window.dataLayer || [];
                window.gtag = function() { dataLayer.push(arguments); };
                window.gtag('js', new Date());
                window.gtag('config', 'G-9GSQV60QV0', { 'anonymize_ip': true });
            }
        } catch (error) {
            console.error("Google Analytics активдештирүүдө ката:", error);
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    BilimalCookieConsent.init();
});

window.BilimalCookieConsent = BilimalCookieConsent;
