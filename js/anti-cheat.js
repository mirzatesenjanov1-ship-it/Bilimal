// Anti-Cheat Коргоо Механизми (BiliMal Test System)
(function () {
    'use strict';

    let warningCount = 0;
    const MAX_WARNINGS = 3;
    let hideTimer = null;

    function isInputElement(element) {
        if (!element) return false;
        const tagName = element.tagName ? element.tagName.toLowerCase() : '';
        return tagName === 'input' || tagName === 'textarea' || element.isContentEditable;
    }

    // Контексттик менюну бөгөттөө
    document.addEventListener('contextmenu', function (e) {
        if (!isInputElement(e.target)) {
            e.preventDefault();
        }
    }, false);

    // Текстти тандоо жана сүйрөөнү бөгөттөө
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

    // Көчүрүү жана кесип алууну бөгөттөө
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

    // Баскычтарды (DevTools, F12, Ctrl+C ж.б.) бөгөттөө
    document.addEventListener('keydown', function (e) {
        const isInput = isInputElement(e.target);
        const isCmdOrCtrl = e.ctrlKey || e.metaKey;
        const keyCode = e.keyCode || e.which;
        const key = e.key ? e.key.toLowerCase() : '';

        if (keyCode === 123 || key === 'f12') {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }

        if (e.ctrlKey && e.shiftKey && (key === 'i' || key === 'j' || key === 'c')) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }

        if (isCmdOrCtrl && (key === 'u' || key === 's' || key === 'p')) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }

        if (!isInput && isCmdOrCtrl && (key === 'c' || key === 'x' || key === 'a')) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    }, false);

    // Башка өтмөккө өтүү эскертүүсү
    function triggerWarning() {
        const runningScreen = document.getElementById('runningScreen');
        if (runningScreen && runningScreen.style.display !== 'none') {
            warningCount++;
            if (warningCount < MAX_WARNINGS) {
                alert(`ЭСКЕРТҮҮ (${warningCount}/${MAX_WARNINGS}): Тест учурунда башка терезеге же өтмөккө өтүүгө болбойт!`);
            } else {
                alert("Сиз эрежелерди бир нече ирет бузгандыгыңыз үчүн тест автоматтык түрдө аякталат!");
                const nextBtn = document.getElementById('nextBtn');
                if (nextBtn) {
                    nextBtn.click();
                }
            }
        }
    }

    // Вкладка толугу менен жашырылганда 10 секунд күтүп анан эскертүү берүү
    document.addEventListener('visibilitychange', function () {
        if (document.hidden) {
            hideTimer = setTimeout(() => {
                triggerWarning();
            }, 10000); // 10 секунддук коргоо
        } else {
            if (hideTimer) {
                clearTimeout(hideTimer);
                hideTimer = null;
            }
        }
    });

})();
