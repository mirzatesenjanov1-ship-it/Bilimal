/**
 * Bilimal.org - Локалдык Маалыматтар Базасы Жана Коопсуздук Журналы (Production JS)
 * Автордук укук корголгон © 2026. Бардык укуктар сакталган.
 */

const BilimalStorage = {
    PREFIX: "BILIMAL_v1_",

    // 1. Маалыматты коопсуз жазуу
    set: function(key, value) {
        try {
            const serializedValue = JSON.stringify(value);
            localStorage.setItem(this.PREFIX + key, serializedValue);
            return true;
        } catch (e) {
            console.error("BilimalStorage катасы (жазууда): ", e);
            return false;
        }
    },

    // 2. Маалыматты окуу
    get: function(key) {
        try {
            const value = localStorage.getItem(this.PREFIX + key);
            return value ? JSON.parse(value) : null;
        } catch (e) {
            console.error("BilimalStorage катасы (окууда): ", e);
            return null;
        }
    },

    // 3. ANTI-CHEAT АРАКЕТТЕРИН РЕАЛДУУ УБАҚЫТТА КАТТОО
    logActivity: function(module, type, description) {
        const timestamp = new Date().toISOString();
        const logs = this.get("security_logs") || [];
        
        const newLog = {
            id: "log_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
            timestamp: timestamp,
            module: module, // Мисалы: 'STUDENT-MONITOR'
            type: type,     // Мисалы: 'ANTI-CHEAT'
            description: description
        };

        logs.unshift(newLog);
        this.set("security_logs", logs);
        
        // Эгер өндүрүштүк чөйрөдө (Production) болсок, консолго да коопсуздук белгисин чыгаруу
        console.warn(`[КООПСУЗДУК СИГНАЛЫ] [${type}] - ${description} (${timestamp})`);
    },

    // 4. Бардык логдорду мугалим үчүн тазалап алуу
    getLogs: function() {
        return this.get("security_logs") || [];
    },

    // 5. Базаны баштапкы абалга келтирүү (Керек болсо)
    clearAll: function() {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(this.PREFIX)) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
    }
};

// Экспорттоо (Браузердик глобалдык объект катары жеткиликтүү кылуу)
window.BilimalStorage = BilimalStorage;
