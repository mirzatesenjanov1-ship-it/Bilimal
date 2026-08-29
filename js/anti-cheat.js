// Anti-Cheat + Violation Counter (BiliMal Test System)
(function () {
    'use strict';

    let isTestActive = false;
    let violationCount = 0; // Бузуулардын эсеби
    const MAX_VIOLATIONS = 5; // Уруксат берилген максималдуу бузуу саны (кааласаңыз өзгөртсөңүз болот)

    // Тест башталганын текшерүү
    const checkTestStarted = () => {
        const runningScreen = document.getElementById('runningScreen');
        if (runningScreen && runningScreen.style.display !== 'none') {
            isTestActive = true;
        }
    };

    setInterval(checkTestStarted, 500);

    // 1. Контексттик меню, көчүрүү, кесүү, сүйрөөнү бөгөттөө
    document.addEventListener('contextmenu', function (e) {
        e.preventDefault();
    }, false);

    document.addEventListener('copy', function (e) {
        e.clipboardData.setData('text/plain', 'Тесттен көчүрүүгө тыюу салынган!');
        e.preventDefault();
    }, false);

    document.addEventListener('cut', function (e) {
        e.preventDefault();
    }, false);

    document.addEventListener('selectstart', function (e) {
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
            e.preventDefault();
        }
    }, false);

    document.addEventListener('dragstart', function (e) {
        e.preventDefault();
    }, false);

    // 2. Ысык баскычтарды бөгөттөө (F12, Ctrl+C, Ctrl+A, DevTools, PrintScreen)
    document.addEventListener('keydown', function (e) {
        const isCmdOrCtrl = e.ctrlKey || e.metaKey;
        const key = e.key ? e.key.toLowerCase() : '';

        if (e.keyCode === 123 || key === 'f12') {
            e.preventDefault();
            return false;
        }

        if (e.ctrlKey && e.shiftKey && (key === 'i' || key === 'j' || key === 'c')) {
            e.preventDefault();
            return false;
        }

        if (isCmdOrCtrl && (key === 'u' || key === 's' || key === 'p' || key === 'c' || key === 'a' || key === 'x')) {
            e.preventDefault();
            return false;
        }

        if (key === 'printscreen') {
            e.preventDefault();
            navigator.clipboard.writeText('');
            alert('Экранды сүрөткө тартууга болбойт!');
        }
    }, false);

    // 3. Бузууларды каттоо жана оверлейди (эскертүүнү) көрсөтүү
    function registerViolation() {
        if (!isTestActive) return;

        violationCount++;
        
        // Глобалдуу объектке сактоо (результат жөнөткөндө Firebase/серверге кошо кетиш үчүн)
        window.userViolationCount = violationCount;

        let overlay = document.getElementById('ai-protection-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'ai-protection-overlay';
            overlay.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:#03030d; z-index:999999; display:flex; flex-direction:column; justify-content:center; align-items:center; color:#00f0ff; font-size:1.3rem; font-weight:bold; text-align:center; padding:20px; box-sizing:border-box;';
            
            overlay.addEventListener('click', function() {
                if (violationCount <= MAX_VIOLATIONS) {
                    hideOverlay();
                }
            });

            document.body.appendChild(overlay);
        }

        // Эгерде уруксат берилген сан ашып кетсе
        if (violationCount > MAX_VIOLATIONS) {
            overlay.innerHTML = `
                <i class="fa-solid fa-ban" style="font-size:3.5rem; color:#ff0055; margin-bottom:15px;"></i>
                <div style="color:#ff0055; font-size:1.6rem; margin-bottom:10px;">ТЕСТ БӨГӨТТӨЛДҮ!</div>
                <div>Сиз башка терезеге өтүү эрежесин өтө көп буздуңуз (${violationCount - 1}/${MAX_VIOLATIONS}).</div>
                <div style="font-size:1rem; color:#a5b4fc; margin-top:15px;">Тестти улантууга уруксат берилбейт. Жыйынтыгыңыз мугалимге жөнөтүлдү.</div>
            `;
            // Тестти токтотуу чакыруусу (эгер public-test.js ичинде бүтүрүү функциясы болсо)
            if (typeof window.finishTestAuto === 'function') {
                window.finishTestAuto();
            }
        } else {
            overlay.innerHTML = `
                <i class="fa-solid fa-triangle-exclamation" style="font-size:3.5rem; color:#ffcc00; margin-bottom:15px;"></i>
                <div style="font-size:1.5rem; margin-bottom:10px;">ЭСКЕРТҮҮ: Башка терезеге өтүүгө болбойт!</div>
                <div style="background:rgba(255,0,85,0.2); border:1px solid #ff0055; color:#ff0055; padding:8px 16px; border-radius:20px; margin:15px 0; font-size:1.1rem;">
                    ⚠️ Тесттен чыгуу эрежесин бузуу: <span style="font-size:1.4rem; font-weight:bold; color:#fff;">${violationCount}</span> / ${MAX_VIOLATIONS}
                </div>
                <div style="font-size:1rem; color:#a5b4fc; margin-top:10px; cursor:pointer;">Тестке кайтуу үчүн ушул экранды чыкылдатыңыз.</div>
            `;
        }

        overlay.style.display = 'flex';
    }

    function hideOverlay() {
        let overlay = document.getElementById('ai-protection-overlay');
        if (overlay && violationCount <= MAX_VIOLATIONS) {
            overlay.style.display = 'none';
        }
    }

    // Фокусту жоготкондо (Edge Copilot, башка вкладка же колдонмого өткөндө)
    window.addEventListener('blur', function () {
        registerViolation();
    });

    // Чычкан экрандын чегинен чыгып кеткенде
    document.addEventListener('mouseleave', function (e) {
        if (e.clientY <= 0 || e.clientX <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
            registerViolation();
        }
    });

})();
