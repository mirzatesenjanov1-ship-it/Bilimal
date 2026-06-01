/* ==========================================
   BiliMal.org — Anti-Cheat v3 Глобалдык Скрипт
   ========================================== */

// 1. Чычкандын оң баскычын бөгөттөө (Context Menu)
document.addEventListener('contextmenu', function(event) {
    event.preventDefault();
});

// 2. Клавиатурадагы кооптуу айкалыштарды бөгөттөө (F12, Ctrl+C, Ctrl+U, Ctrl+S, Inspect Element)
document.addEventListener('keydown', function(event) {
    // F12 баскычы
    if (event.keyCode === 123) {
        event.preventDefault();
        return false;
    }
    // Ctrl + Shift + I (Инспект) же Ctrl + Shift + C
    if (event.ctrlKey && event.shiftKey && (event.keyCode === 73 || event.keyCode === 67)) {
        event.preventDefault();
        return false;
    }
    // Ctrl + U (Кодду көрүү)
    if (event.ctrlKey && event.keyCode === 85) {
        event.preventDefault();
        return false;
    }
    // Ctrl + C (Көчүрүү) жана Ctrl + S (Сайтты сактоо)
    if (event.ctrlKey && (event.keyCode === 67 || event.keyCode === 83)) {
        event.preventDefault();
        return false;
    }
});

// 3. Текстти бөлүп көрсөтүүнү (Selection) программалык түрдө өчүрүү
document.addEventListener('selectstart', function(e) {
    e.preventDefault();
});
