// Bilimal-AI Project - Offline Storage Fallback Engine
(function () {
    const BF = window.BilimalFirebase;

    function getLocalData(key, fallback) {
        return BF.safeJsonParse(localStorage.getItem(key), fallback);
    }

    function setLocalData(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    function removeLocalData(key) {
        localStorage.removeItem(key);
    }

    function saveOfflineQueue(action) {
        const queue = getLocalData('bilimal_offline_queue', []);
        queue.push({
            ...action,
            timestamp: Date.now()
        });
        setLocalData('bilimal_offline_queue', queue);
        BF.showToast("Өзгөрүү локалдык түрдө сакталды (Оффлайн)", "warning");
    }

    function getOfflineQueue() {
        return getLocalData('bilimal_offline_queue', []);
    }

    function clearOfflineQueue() {
        setLocalData('bilimal_offline_queue', []);
    }

    function syncOfflineQueue() {
        if (BF.isFirebaseAvailable()) {
            BF.syncPendingData();
        }
    }

    function saveTestLocal(test) {
        const tests = getLocalData('bilimal_teacher_tests', {});
        tests[test.id] = test;
        setLocalData('bilimal_teacher_tests', tests);

        if (!BF.isFirebaseAvailable()) {
            saveOfflineQueue({
                path: BF.paths.test(BF.getCurrentTeacherId(), test.id),
                data: test
            });
        } else {
            BF.getDatabaseInstance().ref(BF.paths.test(BF.getCurrentTeacherId(), test.id)).set(test)
                .then(() => BF.showToast("Тест ийгиликтүү серверге сакталды", "success"))
                .catch(() => saveOfflineQueue({ path: BF.paths.test(BF.getCurrentTeacherId(), test.id), data: test }));
        }
    }

    function getTestsLocal() {
        return getLocalData('bilimal_teacher_tests', {});
    }

    function deleteTestLocal(testId) {
        const tests = getLocalData('bilimal_teacher_tests', {});
        if (tests[testId]) {
            delete tests[testId];
            setLocalData('bilimal_teacher_tests', tests);
        }

        if (!BF.isFirebaseAvailable()) {
            saveOfflineQueue({
                path: BF.paths.test(BF.getCurrentTeacherId(), testId),
                data: null
            });
        } else {
            BF.getDatabaseInstance().ref(BF.paths.test(BF.getCurrentTeacherId(), testId)).remove()
                .then(() => BF.showToast("Тест өчүрүлдү", "success"))
                .catch(() => saveOfflineQueue({ path: BF.paths.test(BF.getCurrentTeacherId(), testId), data: null }));
        }
    }

    function saveResultLocal(result) {
        const results = getLocalData('bilimal_teacher_results', {});
        results[result.id] = result;
        setLocalData('bilimal_teacher_results', results);

        if (!BF.isFirebaseAvailable()) {
            saveOfflineQueue({
                path: BF.paths.result(BF.getCurrentTeacherId(), result.id),
                data: result
            });
        } else {
            BF.getDatabaseInstance().ref(BF.paths.result(BF.getCurrentTeacherId(), result.id)).set(result);
        }
    }

    function getResultsLocal() {
        return getLocalData('bilimal_teacher_results', {});
    }

    function saveClassLocal(classData) {
        const classes = getLocalData('bilimal_teacher_classes', {});
        classes[classData.id] = classData;
        setLocalData('bilimal_teacher_classes', classes);

        if (!BF.isFirebaseAvailable()) {
            saveOfflineQueue({
                path: BF.paths.class(BF.getCurrentTeacherId(), classData.id),
                data: classData
            });
        } else {
            BF.getDatabaseInstance().ref(BF.paths.class(BF.getCurrentTeacherId(), classData.id)).set(classData);
        }
    }

    function getClassesLocal() {
        return getLocalData('bilimal_teacher_classes', {});
    }

    function exportAllTeacherData() {
        const exportData = {
            tests: getTestsLocal(),
            results: getResultsLocal(),
            classes: getClassesLocal(),
            settings: getLocalData('bilimal_teacher_settings', {}),
            exportedAt: Date.now()
        };

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `Bilimal_Teacher_Backup_${Date.now()}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        BF.showToast("Бардык маалыматтар ийгиликтүү экспорттолду", "success");
    }

    function importTeacherData(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function (e) {
            const parsed = BF.safeJsonParse(e.target.result, null);
            if (parsed) {
                if (parsed.tests) setLocalData('bilimal_teacher_tests', parsed.tests);
                if (parsed.results) setLocalData('bilimal_teacher_results', parsed.results);
                if (parsed.classes) setLocalData('bilimal_teacher_classes', parsed.classes);
                if (parsed.settings) setLocalData('bilimal_teacher_settings', parsed.settings);
                
                setLocalData('bilimal_last_backup', Date.now());
                BF.showToast("Маалыматтар ийгиликтүү импорттолду!", "success");
                
                if (window.BilimalDashboard && typeof window.BilimalDashboard.refreshDashboard === 'function') {
                    window.BilimalDashboard.refreshDashboard();
                }
            } else {
                BF.showToast("Ката файл форматы", "error");
            }
        };
        reader.readAsText(file);
    }

    function createBackup() {
        const backupData = {
            tests: getTestsLocal(),
            results: getResultsLocal()
        };
        setLocalData('bilimal_last_backup', backupData);
        setLocalData('bilimal_last_backup_time', Date.now());
        BF.showToast("Резервдик көчүрмө локалдык сакталды", "success");
    }

    function restoreBackup() {
        const backup = getLocalData('bilimal_last_backup', null);
        if (backup) {
            if (backup.tests) setLocalData('bilimal_teacher_tests', backup.tests);
            if (backup.results) setLocalData('bilimal_teacher_results', backup.results);
            BF.showToast("Калыбына келтирүү аяктады", "success");
            if (window.BilimalDashboard && typeof window.BilimalDashboard.refreshDashboard === 'function') {
                window.BilimalDashboard.refreshDashboard();
            }
        } else {
            BF.showToast("Резервдик көчүрмө табылган жок", "error");
        }
    }

    window.BilimalStorage = {
        getLocalData,
        setLocalData,
        removeLocalData,
        saveOfflineQueue,
        getOfflineQueue,
        clearOfflineQueue,
        syncOfflineQueue,
        saveTestLocal,
        getTestsLocal,
        deleteTestLocal,
        saveResultLocal,
        getResultsLocal,
        saveClassLocal,
        getClassesLocal,
        exportAllTeacherData,
        importTeacherData,
        createBackup,
        restoreBackup
    };
})();
