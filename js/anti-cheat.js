// Anti-Cheat + AI Sidebar Protection Mechanism (BiliMal Test System)
(function () {
    'use strict';

    let isTestActive = false;

    // Тест башталганын аныктоо
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

    // 3. AI Sidebar / Edge Copilot Коргоосу: Чычкан тесттен чыкканда же Blur болгондо экранды жабуу
    function showOverlay() {
        if (!isTestActive) return;
        
        let overlay = document.getElementById('ai-protection-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'ai-protection-overlay';
            overlay.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:#03030d; z-index:999999; display:flex; flex-direction:column; justify-content:center; align-items:center; color:#00f0ff; font-size:1.3rem; font-weight:bold; text-align:center; padding:20px; box-sizing:border-box;';
            overlay.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="font-size:3rem; color:#ff0055; margin-bottom:15px;"></i><div>ЭСКЕРТҮҮ: Башка терезеге же AI куралына өтүүгө болбойт!</div><div style="font-size:1rem; color:#a5b4fc; margin-top:10px;">Тестке кайтуу үчүн ушул экранды чыкылдатыңыз.</div>';
            
            overlay.addEventListener('click', function() {
                hideOverlay();
            });

            document.body.appendChild(overlay);
        }
        overlay.style.display = 'flex';
    }

    function hideOverlay() {
        let overlay = document.getElementById('ai-protection-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }

    // Фокусту жоготкондо (Edge Copilot, ChatGPT чатка басканда)
    window.addEventListener('blur', function () {
        showOverlay();
    });

    // Курсор баракчадан чыгып кеткенде (AI Sidebar тарапка өткөндө)
    document.addEventListener('mouseleave', function (e) {
        if (e.clientY <= 0 || e.clientX <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
            showOverlay();
        }
    });

    window.addEventListener('focus', function () {
        // Кайра тестти чыкылдатса ачылат
    });

})();
