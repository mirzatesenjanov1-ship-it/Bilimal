/**
 * Bilimal.org - Маалыматтарды сактоо жана башкаруу борбору (Storage Engine)
 * Архитектуралык коопсуздук: Бардык маалыматтар teacherId/ownerId менен бөлүнөт.
 */

const BilimalStorage = {
    // Негизги ачкычтар
    KEYS: {
        USERS: 'bilimal_users',
        CURRENT_USER: 'bilimal_current_user',
        TESTS: 'bilimal_tests',
        RESULTS: 'bilimal_results',
        CLASSES: 'bilimal_classes',
        STUDENTS: 'bilimal_students',
        ACTIVITY_LOG: 'bilimal_activity_log',
        SETTINGS: 'bilimal_settings',
        COOKIE_CONSENT: 'bilimal_cookie_consent'
    },

    // Базадан маалыматты коопсуз окуу
    get(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error(`Бул ачкычты окууда ката кетти: ${key}`, error);
            return [];
        }
    },

    // Базага маалыматты коопсуз жазуу
    set(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error(`Бул ачкычка жазууда ката кетти: ${key}`, error);
            return false;
        }
    },

    // Жалгыз объектти сактоо (мисалы, учурдагы колдонуучу же жөндөөлөр)
    setObject(key, obj) {
        try {
            localStorage.setItem(key, JSON.stringify(obj));
            return true;
        } catch (error) {
            console.error(`Объектти жазууда ката кетти: ${key}`, error);
            return false;
        }
    },

    getObject(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error(`Объектти окууда ката кетти: ${key}`, error);
            return null;
        }
    },

    // Мугалимдин аракеттер журналына (Activity Log) жазуу
    logActivity(userId, action, details = "") {
        try {
            const logs = this.get(this.KEYS.ACTIVITY_LOG);
            const newLog = {
                id: 'LOG-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
                userId: userId,
                action: action,
                details: details,
                timestamp: new Date().toISOString()
            };
            logs.unshift(newLog); // Жаңы аракеттер дайыма башында турат
            this.set(this.KEYS.ACTIVITY_LOG, logs);
            
            // Google Analytics окуясын чакыруу (эгер жарнама менеджери кошулган болсо)
            if (typeof window.trackEvent === 'function') {
                window.trackEvent('activity_logged', { action: action, user_id: userId });
            }
            return true;
        } catch (e) {
            console.error("Аракеттер журналы жазылган жок:", e);
            return false;
        }
    },

    // Мугалимдин өзүнө тиешелүү маалыматтарды гана чыпкалоо
    getTeacherData(key, teacherId) {
        const allData = this.get(key);
        if (!teacherId) return [];
        // Эгер маалымат массив болсо, анда чыпкалайбыз
        if (Array.isArray(allData)) {
            return allData.filter(item => item.teacherId === teacherId || item.ownerId === teacherId);
        }
        return [];
    },

    // Маалымат кошуу же жаңыртуу (ID боюнча)
    saveItem(key, item, teacherId) {
        try {
            const allData = this.get(key);
            if (!item.id) {
                item.id = 'ID-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
            }
            // Ар дайым коопсуздук үчүн мугалимдин ID'син байлайбыз
            item.teacherId = teacherId;
            item.ownerId = teacherId;
            item.updatedAt = new Date().toISOString();

            const index = allData.findIndex(d => d.id === item.id);
            if (index > -1) {
                allData[index] = item;
            } else {
                item.createdAt = new Date().toISOString();
                allData.push(item);
            }
            
            this.set(key, allData);
            return item;
        } catch (error) {
            console.error(`Маалыматты сактоодо ката: ${key}`, error);
            return null;
        }
    },

    // Маалыматты өчүрүү (Коопсуздук текшерүүсү менен)
    deleteItem(key, id, teacherId) {
        try {
            const allData = this.get(key);
            const index = allData.findIndex(d => d.id === id);
            if (index > -1) {
                // Коопсуздук: башка мугалимдин маалыматын өчүрүүгө бөгөт коюу
                if (allData[index].teacherId === teacherId || allData[index].ownerId === teacherId || teacherId === 'ADMIN') {
                    allData.splice(index, 1);
                    this.set(key, allData);
                    return true;
                }
            }
            return false;
        } catch (error) {
            console.error(`Маалыматты өчүрүүдө ката: ${key}`, error);
            return false;
        }
    }
};

// Экспорттоо
window.BilimalStorage = BilimalStorage;
