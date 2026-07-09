// Bilimal-AI Project - Security & Student Proctored Anti-Cheat Engine
(function () {
    const BF = window.BilimalFirebase;
    const BS = window.BilimalStorage;

    let activeSession = false;
    let currentSettings = {};
    let cheatLogs = [];
    let currentStudentData = {};

    function initializeAntiCheat(testSettings, studentInfo) {
        // Run only for test takers, do not block teacher admin views
        if (localStorage.getItem('bilimal_user_role') === 'admin' || window.location.pathname.includes('/sections/')) {
            return;
        }

        currentSettings = testSettings || { tabTracking: true, preventCopyPaste: true, forceFullscreen: false };
        currentStudentData = studentInfo || { name: "Окуучу", class: "Белгисиз" };
        cheatLogs = [];
        
        startAntiCheatSession();
    }

    function startAntiCheatSession() {
        if (activeSession) return;
        activeSession = true;

        if (currentSettings.tabTracking) {
            document.addEventListener('visibilitychange', handleVisibilityChange);
            window.addEventListener('blur', handleBlur);
            window.addEventListener('focus', handleFocus);
        }

        if (currentSettings.preventCopyPaste) {
            document.addEventListener('copy', handleCopy);
            document.addEventListener('paste', handlePaste);
            document.addEventListener('contextmenu', handleContextMenu);
        }

        if (currentSettings.forceFullscreen) {
            document.addEventListener('fullscreenchange', handleFullscreenChange);
        }

        BF.showToast("Античит коопсуздук системасы активдештирилди", "warning");
    }

    function stopAntiCheatSession() {
        activeSession = false;
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('blur', handleBlur);
        window.removeEventListener('focus', handleFocus);
        document.removeEventListener('copy', handleCopy);
        document.removeEventListener('paste', handlePaste);
        document.removeEventListener('contextmenu', handleContextMenu);
        document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }

    function logCheatEvent(type, details) {
        if (!activeSession) return;

        const event = {
            type: type,
            details: details,
            timestamp: Date.now()
        };

        cheatLogs.push(event);
        BF.showToast(`Эскертүү! Коопсуздук эрежесин бузуу аракеттери жазылды: ${type}`, "error");
        saveCheatLog(event);
    }

    function handleVisibilityChange() {
        if (document.hidden) {
            logCheatEvent("Терезе алмаштырылды", "Баракчаны жашырды же башка өтмөккө өттү");
        }
    }

    function handleBlur() {
        logCheatEvent("Терезеден чыкты", "Браузер фокусун жоготту");
    }

    function handleFocus() {
        BF.showToast("Кайра фокуста демилгеленди", "info");
    }

    function handleCopy(e) {
        logCheatEvent("Көчүрүүгө аракет жасалды", "Текст көчүрүү бөгөттөлдү");
        e.preventDefault();
    }

    function handlePaste(e) {
        logCheatEvent("Paste аракет жасалды", "Сырттан текст коюу бөгөттөлдү");
        e.preventDefault();
    }

    function handleContextMenu(e) {
        logCheatEvent("Оң баскыч колдонууга аракет жасалды", "Контексттик меню бөгөттөлдү");
        e.preventDefault();
    }

    function handleFullscreenChange() {
        if (!document.fullscreenElement) {
            logCheatEvent("Fullscreen режиминен чыкты", "Толук экран режими токтотулду");
        }
    }

    function requestFullscreenMode() {
        const docEl = document.documentElement;
        if (docEl.requestFullscreen) docEl.requestFullscreen();
    }

    function saveCheatLog(event) {
        const currentTeacherId = localStorage.getItem('bilimal_current_teacher_id') || 'demo-teacher-001';
        const logId = BF.generateId('cheat');
        
        const fullPayload = {
            student: currentStudentData,
            event: event,
            testId: localStorage.getItem('bilimal_current_taking_test_id') || 'unknown'
        };

        if (BF.isFirebaseAvailable()) {
            BF.getDatabaseInstance().ref(`/teachers/${currentTeacherId}/antiCheatLogs/${logId}`).set(fullPayload);
        } else {
            const localLogs = BS.getLocalData('bilimal_offline_cheat_logs', []);
            localLogs.push(fullPayload);
            BS.setLocalData('bilimal_offline_cheat_logs', localLogs);
        }
    }

    window.BilimalAntiCheat = {
        initializeAntiCheat,
        startAntiCheatSession,
        stopAntiCheatSession,
        requestFullscreenMode,
        getCheatLogs: () => cheatLogs
    };
})();
