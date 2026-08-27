// Anti-Cheat Коргоо Механизми (BiliMal Test System)
(function () {
    'use strict';

    let warningCount = 0;
    const MAX_WARNINGS = 3;

    // 1. Киргизүү талаасы экенин текшерүү (Input талааларында жазууга уруксат берүү үчүн)
    function isInputElement(element) {
        if (!element) return false;
        const tagName = element.tagName ? element.tagName.toLowerCase() : '';
        return tagName === 'input' || tagName === 'textarea' || element.isContentEditable;
    }

    // 2. Контексттик менюну бөгөттөө (Оң баскыч)
    document.addEventListener('contextmenu', function (e) {
        if (!isInputElement(e.target)) {
            e.preventDefault();
        }
    }, false);

    // 3. Текстти тандоону (Highlight) жана Сүйрөөнү (Drag-and-Drop) бөгөттөө
    document.addEventListener('selectstart', function (e) {
        if (!isInputElement(e.target)) {
            e.preventDefault();
        }
    }, false);

    document.addEventListener('dragstart', function (e) {
        if (!isInputElement(e.target)) {
            e.preventDefault();
        }
    }, false);

    // 4. Текстти көчүрүү жана кесип алууну бөгөттөө (Copy & Cut)
    document.addEventListener('copy', function (e) {
        if (!isInputElement(e.target)) {
            e.preventDefault();
        }
    }, false);

    document.addEventListener('cut', function (e) {
        if (!isInputElement(e.target)) {
            e.preventDefault();
        }
    }, false);

    // 5. Дебюггер, DevTools жана Көчүрүү баскычтарын бөгөттөө (Windows & macOS)
    document.addEventListener('keydown', function (e) {
        const isInput = isInputElement(e.target);
        const isCmdOrCtrl = e.ctrlKey || e.metaKey;
        const keyCode = e.keyCode || e.which;
        const key = e.key ? e.key.toLowerCase() : '';

        // F12 баскычы
        if (keyCode === 123 || key === 'f12') {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }

        // Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C (DevTools)
        if (e.ctrlKey && e.shiftKey && (key === 'i' || key === 'j' || key === 'c')) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }

        // Ctrl/Cmd + U (Исходный код), S (Сактоо), P (Басып чыгаруу)
        if (isCmdOrCtrl && (key === 'u' || key === 's' || key === 'p')) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }

        // Input эмес элементтерде Ctrl/Cmd + C (Көчүрүү), X (Кесүү), A (Баарын тандоо)
        if (!isInput && isCmdOrCtrl && (key === 'c' || key === 'x' || key === 'a')) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    }, false);

    // 6. Башка өтмөккө же терезеге өтүүдө эскертүү жана жазалоо логикасы
    function handleFocusLoss() {
        const runningScreen = document.getElementById('runningScreen');
        // Тест активдүү жүрүп жаткан бөлөк калкып чыкканда гана иштейт
        if (runningScreen && runningScreen.style.display !== 'none') {
            warningCount++;
            if (warningCount < MAX_WARNINGS) {
                alert(`ЭС КӨРТҮҮ (${warningCount}/${MAX_WARNINGS}): Тест учурунда башка терезеге же өтмөккө өтүүгө болбойт!`);
            } else {
                alert("Сиз эрежелерди бир нече ирет бузгандыгыңыз үчүн тест автоматтык түрдө аякталат!");
                const nextBtn = document.getElementById('nextBtn');
                if (nextBtn) {
                    // Тестти токтотуу же кийинки кадамга өткөрүү чакырыгы
                    nextBtn.click();
                }
            }
        }
    }

    // Вкладка же терезе активсиз болгондо (blur жана visibilitychange)
    window.addEventListener('blur', handleFocusLoss);
    document.addEventListener('visibilitychange', function () {
        if (document.hidden) {
            handleFocusLoss();
        }
    });

})();
