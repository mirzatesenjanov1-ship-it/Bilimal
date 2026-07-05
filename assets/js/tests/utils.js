export const Utils = {
    generateUUID() {
        return 'uuid-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now().toString(36);
    },

    generateTestCode() {
        return 'TEST-' + Math.floor(1000 + Math.random() * 9000);
    },

    generateStudentCode() {
        return 'STU-' + Math.floor(1000 + Math.random() * 9000);
    },

    safeText(value, fallback = 'Киргизилген эмес') {
        if (value === undefined || value === null || String(value).trim() === '') return fallback;
        return this.escapeHTML(String(value));
    },

    safeNumber(value, fallback = 0) {
        const num = Number(value);
        return isNaN(num) ? fallback : num;
    },

    safeArray(value) {
        return Array.isArray(value) ? value : [];
    },

    escapeHTML(str) {
        return str.replace(/[&<>'"]/g, 
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
        );
    },

    formatDuration(minutes) {
        const mins = this.safeNumber(minutes);
        if (mins <= 0) return "Чектөөсүз";
        if (mins === 1) return "1 мүнөт";
        return `${mins} мүнөт`;
    }
};
