// Anti-Cheat Коргоо Механизми
(function() {
    // Контексттик менюну бөгөттөө (Оң баскыч)
    document.addEventListener('contextmenu', function(e) {
        e.preventDefault();
    });

    // Дебюггер жана DevTools баскычтарын бөгөттөө
    document.addEventListener('keydown', function(e) {
        // F12
        if (e.key === "F12") {
            e.preventDefault();
            return false;
        }
        // Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C
        if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) {
            e.preventDefault();
            return false;
        }
        // Ctrl+U (Исходный код)
        if (e.ctrlKey && (e.key === 'u' || e.key === 'U')) {
            e.preventDefault();
            return false;
        }
        // Ctrl+C (Көчүрүү)
        if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) {
            e.preventDefault();
            return false;
        }
    });

    // Браузерден же Вкладкадан чыгып кеткенде эскертүү
    window.addEventListener('blur', function() {
        console.warn("Экрандан башка жака өтүүгө аракет жасалды!");
    });
})();
