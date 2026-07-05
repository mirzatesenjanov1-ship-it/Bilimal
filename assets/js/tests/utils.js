/**
 * Уникалдуу UUID генерациялоо
 */
export function generateUUID() {
    return 'user-' + 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * HTML коддорду зыянсыздандыруу (XSS Коргоо)
 */
export function escapeHTML(str) {
    if (!str || typeof str !== 'string') return '';
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * Текстти коопсуз чагылдыруу жана бош болсо демейки маанини берүү
 */
export function safeText(value, fallback = "") {
    if (value === undefined || value === null || Number.isNaN(value)) {
        return fallback;
    }
    const clean = String(value).trim();
    return clean === "" ? fallback : escapeHTML(clean);
}

/**
 * Ысымдан баш тамгаларды автоматтык түрдө кесип алуу
 */
export function getInitials(fullName) {
    const text = safeText(fullName).trim();
    if (!text) return "М";
    
    const parts = text.split(/\s+/).filter(p => p.length > 0);
    if (parts.length === 1) {
        return parts[0].charAt(0).toUpperCase();
    }
    if (parts.length >= 2) {
        return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    }
    return "М";
}

/**
 * Email формат валидациясы
 */
export function validateEmail(email) {
    if (!email) return true; // Милдеттүү эмес болсо бош калтырса болот
    const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return re.test(String(email).toLowerCase());
}

/**
 * Телефон формат валидациясы
 */
export function validatePhone(phone) {
    if (!phone) return true;
    // Кыргызстандын телефон форматтары үчүн жөнөкөй regex (+996 жана 9 орундуу сан)
    const re = /^(\+996|0)\s?([0-9]{3})\s?([0-9]{2}-?){3}$/;
    return re.test(String(phone).replace(/\s+/g, ''));
}
