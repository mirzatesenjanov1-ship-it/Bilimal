/**
 * Bilimal.org - Борбордук коопсуз маалымат катмары (Production-ready Storage Layer)
 * Автордук укук корголгон © 2026. Бардык укуктар сакталган.
 */

window.BilimalStorageFallback = {};

const StorageKeys = {
    TEACHER_ID: 'BILIMAL_TEACHER_ID',
    TEACHERS_DATA: 'BILIMAL_TEACHERS_DATA',
    TESTS: 'BILIMAL_TESTS',
    RESULTS: 'BILIMAL_RESULTS',
    ACTIVITY_LOGS: 'BILIMAL_ACTIVITY_LOGS'
};

const BilimalStorage = {
    isAvailable() {
        try {
            const testKey = '__storage_test__';
            window.localStorage.setItem(testKey, testKey);
            window.localStorage.removeItem(testKey);
            return true;
        } catch (e) {
            console.warn("Браузердин коопсуздук саясаты localStorage колдонууга уруксат берген жок. Ички fallback иштетилди.");
            return false;
        }
    },

    get(key) {
        if (this.isAvailable()) {
            const data = window.localStorage.getItem(key);
            try {
                return data ? JSON.parse(data) : [];
            } catch (e) {
                console.error("Маалыматты JSON форматына айландыруу катасы:", e);
                return [];
            }
        } else {
            return window.BilimalStorageFallback[key] || [];
        }
    },

    save(key, data) {
        if (this.isAvailable()) {
            window.localStorage.setItem(key, JSON.stringify(data));
        } else {
            window.BilimalStorageFallback[key] = data;
        }
    },

    getTeacherId() {
        if (this.isAvailable()) {
            let id = window.localStorage.getItem(StorageKeys.TEACHER_ID);
            if (!id) {
                id = 'PROF-' + Math.floor(100000 + Math.random() * 900000);
                window.localStorage.setItem(StorageKeys.TEACHER_ID, id);
                this.initDefaultTeacher(id);
            }
            return id;
        } else {
            if (!window.BilimalStorageFallback[StorageKeys.TEACHER_ID]) {
                window.BilimalStorageFallback[StorageKeys.TEACHER_ID] = 'PROF-777888';
                this.initDefaultTeacher('PROF-777888');
            }
            return window.BilimalStorageFallback[StorageKeys.TEACHER_ID];
        }
    },

    initDefaultTeacher(id) {
        const teachers = this.get(StorageKeys.TEACHERS_DATA);
        const exists = teachers.find(t => t.id === id);
        if (!exists) {
            teachers.push({
                id: id,
                name: "Айбек Назаров",
                subject: "Физика жана Астрономия",
                school: "Т. Сатылганов атындагы лицей",
                bio: "Физика сабагы боюнча жогорку категориядагы мугалим. 12 жылдык тажрыйба.",
                avatar: "",
                email: "a.nazarov@bilimal.org"
            });
            this.save(StorageKeys.TEACHERS_DATA, teachers);
            this.logActivity(id, "ПРОФИЛЬ", "Жаңы мугалимдин аккаунту автоматтык түрдө ишке киргизилди.");
        }
    },

    getTeacherProfile() {
        const id = this.getTeacherId();
        const teachers = this.get(StorageKeys.TEACHERS_DATA);
        return teachers.find(t => t.id === id) || {
            id: id,
            name: "Аныкталбаган Мугалим",
            subject: "Маалымат жок",
            school: "Маалымат жок",
            bio: "",
            avatar: "",
            email: "hidden@bilimal.org"
        };
    },

    updateTeacherProfile(updatedProfile) {
        const id = this.getTeacherId();
        let teachers = this.get(StorageKeys.TEACHERS_DATA);
        const index = teachers.findIndex(t => t.id === id);
        if (index !== -1) {
            teachers[index] = { ...teachers[index], ...updatedProfile, id: id };
        } else {
            teachers.push({ ...updatedProfile, id: id });
        }
        this.save(StorageKeys.TEACHERS_DATA, teachers);
        this.logActivity(id, "ПРОФИЛЬ", "Мугалим жеке профилин жаңылады.");
    },

    logActivity(teacherId, actionType, details) {
        const logs = this.get(StorageKeys.ACTIVITY_LOGS);
        logs.push({
            id: 'LOG-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
            teacherId: teacherId,
            teacherName: this.getTeacherNameById(teacherId),
            actionType: actionType,
            details: details,
            timestamp: new Date().toISOString()
        });
        this.save(StorageKeys.ACTIVITY_LOGS, logs);
    },

    getTeacherNameById(id) {
        const teachers = this.get(StorageKeys.TEACHERS_DATA);
        const t = teachers.find(item => item.id === id);
        return t ? t.name : "Белгисиз Мугалим";
    }
};

// Алгачкы ишке киргизүү
BilimalStorage.getTeacherId();
