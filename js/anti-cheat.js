// Anti-Cheat (BiliMal Test System) — киргизүү коргоосу гана.
//
// Бузууларды эсептөө, эскертүү экраны жана тестти аяктоо логикасы public-test.js ичинде
// бир гана жерде жүргүзүлөт (эки тутум бири-бирине тоскоол болбойт, жалган "чыгарып жиберүү" жок).
(function () {
    'use strict';

    if (window.__biliAntiCheatLoaded) return;
    window.__biliAntiCheatLoaded = true;

    // эски код менен шайкештик: public-test.js бул маанини жаңыртат
    window.userViolationCount = 0;

    const registered = [];
    function on(target, type, fn, opts) {
        target.addEventListener(type, fn, opts);
        registered.push([target, type, fn, opts]);
    }
    function inField(e) {
        const t = e.target;
        return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable === true);
    }

    // 1. Контексттик меню, көчүрүү, кесүү, сүйрөө, белгилөө
    on(document, 'contextmenu', e => e.preventDefault(), false);
    on(document, 'copy', e => {
        if (inField(e)) return;
        try { e.clipboardData.setData('text/plain', 'Тесттен көчүрүүгө тыюу салынган!'); } catch (_) { /* ignore */ }
        e.preventDefault();
    }, false);
    on(document, 'cut', e => { if (!inField(e)) e.preventDefault(); }, false);
    on(document, 'paste', e => { if (!inField(e)) e.preventDefault(); }, false);
    on(document, 'selectstart', e => { if (!inField(e)) e.preventDefault(); }, false);
    on(document, 'dragstart', e => e.preventDefault(), false);

    // 2. Ысык баскычтар
    on(document, 'keydown', function (e) {
        const mod = e.ctrlKey || e.metaKey;
        const key = e.key ? e.key.toLowerCase() : '';

        if (e.keyCode === 123 || key === 'f12') { e.preventDefault(); return false; }
        if (e.ctrlKey && e.shiftKey && (key === 'i' || key === 'j' || key === 'c')) { e.preventDefault(); return false; }
        if (mod && (key === 'u' || key === 's' || key === 'p')) { e.preventDefault(); return false; }
        if (mod && (key === 'c' || key === 'a' || key === 'x' || key === 'v') && !inField(e)) {
            e.preventDefault();
            return false;
        }
        if (key === 'printscreen') { e.preventDefault(); clearClipboard(); }
    }, false);
    on(document, 'keyup', function (e) {
        if (e.key && e.key.toLowerCase() === 'printscreen') clearClipboard();
    }, false);

    function clearClipboard() {
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                const p = navigator.clipboard.writeText('');
                if (p && typeof p.catch === 'function') p.catch(() => { /* уруксат жок, маанилүү эмес */ });
            }
        } catch (_) { /* ignore */ }
    }

    // 3. Токтотуу API (public-test.js жана HTML чакырат): бардык listener'лер алынат
    window.stopAntiCheat = function () {
        while (registered.length) {
            const r = registered.pop();
            try { r[0].removeEventListener(r[1], r[2], r[3]); } catch (_) { /* ignore */ }
        }
    };
})();
