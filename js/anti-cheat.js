(function () {
    'use strict';

    // 1. Контексттик менюну (оң баскыч) бөгөттөө (AI Extension / Google Lens / Copy колдонууга жол бербейт)
    document.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        alert('Эскертүү: Контексттик менюну жана AI куралдарын колдонууга тыюу салынган!');
    });

    // 2. Клавиатуралык баскычтарды бөгөттөө (Ctrl+C, Ctrl+A, Ctrl+U, F12, PrintScreen)
    document.addEventListener('keydown', function (e) {
        // Ctrl/Cmd + C (Көчүрүү)
        // Ctrl/Cmd + A (Баарын белгилөө)
        // Ctrl/Cmd + U (Кодду көрүү)
        // Ctrl/Cmd + Shift + I / J / C (DevTools)
        // Ctrl/Cmd + P (Басып чыгаруу же PDF)
        if (
            (e.ctrlKey || e.metaKey) && 
            ['c', 'a', 'u', 'p', 'i', 'j', 'c'].includes(e.key.toLowerCase())
        ) {
            e.preventDefault();
            e.stopPropagation();
            alert('Эскертүү: Бул комбинацияны же AI куралдарын колдонууга тыюу салынган!');
            return false;
        }

        // F12 баскычы (DevTools)
        if (e.key === 'F12') {
            e.preventDefault();
            alert('Эскертүү: Иштеп чыгуучу куралдарын ачууга болбойт!');
            return false;
        }

        // PrintScreen (Экранды сүрөткө тартуу)
        if (e.key === 'PrintScreen') {
            e.preventDefault();
            navigator.clipboard.writeText(''); // Клипбордду тазалоо
            alert('Экранды сүрөткө тартууга тыюу салынган!');
        }
    });

    // 3. Текстти бөлүп алууну жана каалагандай көчүрүүнү бөгөттөө
    document.addEventListener('selectstart', function (e) {
        // Эгерде киргизүү талаалары (input, textarea) болбосо, белгилөөгө уруксат берилбейт
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
            e.preventDefault();
        }
    });

    // 4. Drag & Drop (Текстти суйроп барып AI чатка таштоо) коргоосу
    document.addEventListener('dragstart', function (e) {
        e.preventDefault();
    });

    // 5. Иштеп чыгуучу терезеси (DevTools) ачылганын аныктоо
    const detectDevTools = () => {
        const threshold = 160;
        const widthThreshold = window.outerWidth - window.innerWidth > threshold;
        const heightThreshold = window.outerHeight - window.innerHeight > threshold;

        if (widthThreshold || heightThreshold) {
            console.warn('DevTools байкалды!');
        }
    };

    window.addEventListener('resize', detectDevTools);
})();
