(function() {
    // 1. Оң баскычты бөгөттө
    document.addEventListener('contextmenu', e => e.preventDefault());

    // 2. Көчүрүү жана чаптоону чектөө
    document.addEventListener('copy', e => e.preventDefault());
    document.addEventListener('paste', e => e.preventDefault());
    document.addEventListener('selectstart', e => e.preventDefault());

    // 3. Tab алмаштырууну көзөмөлдөө
    let switchCount = 0;
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            switchCount++;
            if (switchCount >= 2) {
                alert("Эскертүү! Экранды алмаштырганыңыз үчүн тест автоматтык түрдө тапшырылат.");
                const nextBtn = document.getElementById('nextBtn');
                if (nextBtn) nextBtn.click();
            } else {
                alert(`Эскертүү! Тест учурунда башка вкладкага өтүүгө болбойт! (${switchCount}/2)`);
            }
        }
    });
})();
