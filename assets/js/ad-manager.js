// AdManager - Жарнамаларды жана эскертүүлөрдү башкаруу модулу
(function () {
    'use strict';

    window.AdManager = {
        init: function () {
            console.log("AdManager ийгиликтүү ишке түштү.");
            this.renderAdBanner();
        },

        renderAdBanner: function () {
            const adContainer = document.getElementById("adBannerContainer");
            if (!adContainer) return;

            // Жарнама же баннер блогун түзүү
            adContainer.innerHTML = `
                <div class="ad-box" style="background: #21262d; border: 1px solid #30363d; border-radius: 8px; padding: 15px; text-align: center; margin: 15px 0;">
                    <span style="color: #8b949e; font-size: 12px; display: block; margin-bottom: 5px;">ЖАРНАМА / АННОНС</span>
                    <h4 style="color: #58a6ff; margin: 5px 0;">БилимАл платформасына кош келиңиз!</h4>
                    <p style="color: #c9d1d9; font-size: 14px; margin: 0;">Онлайн тесттерди оңой жана коопсуз тапшырыңыз.</p>
                </div>
            `;
        },

        hideAds: function () {
            const adContainer = document.getElementById("adBannerContainer");
            if (adContainer) {
                adContainer.style.display = 'none';
            }
        }
    };

    // Баракча жүктөлгөндө автоматтык түрдө иштетүү
    document.addEventListener("DOMContentLoaded", function () {
        window.AdManager.init();
    });
})();
