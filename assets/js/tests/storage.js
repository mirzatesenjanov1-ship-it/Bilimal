import { Utils } from './utils.js';

const KEYS = {
    CURRENT_USER: 'bilimai_current_user_v1',
    TEACHERS: 'bilimai_teachers_v1',
    CLASSES: 'bilimai_classes_v1',
    STUDENTS: 'bilimai_students_v1',
    TESTS: 'bilimai_tests_v3',
    RESULTS: 'bilimai_results_v3',
    ACTIVITY_LOG: 'bilimai_activity_log_v1'
};

export const Storage = {
    get(key, fallback = []) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : fallback;
        } catch (e) {
            console.error(`localStorage катасы (${key}):`, e);
            return fallback;
        }
    },

    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.error(`localStorage сактоо катасы (${key}):`, e);
        }
    },

    initCurrentUser() {
        let user = this.get(KEYS.CURRENT_USER, null);
        if (!user) {
            user = {
                id: "teacher-demo-001",
                fullName: "Эркин Салиев",
                email: "erkin.teacher@bilimai.org",
                role: "teacher",
                schoolId: "school-77"
            };
            this.set(KEYS.CURRENT_USER, user);
        }
        return user;
    },

    getTeacherData(key) {
        const user = this.initCurrentUser();
        const rawData = this.get(key, []);
        return rawData.filter(item => item.teacherId === user.id);
    },

    saveTeacherData(key, newItem) {
        const user = this.initCurrentUser();
        const rawData = this.get(key, []);
        newItem.teacherId = user.id;
        
        const index = rawData.findIndex(item => item.id === newItem.id);
        if (index !== -1) {
            rawData[index] = newItem;
        } else {
            rawData.push(newItem);
        }
        this.set(key, rawData);
        this.logActivity(`Жаңыртуу/Кошуу аткарылды: ${newItem.title || newItem.name || newItem.fullName || ''}`);
    },

    deleteTeacherData(key, id) {
        const rawData = this.get(key, []);
        const filtered = rawData.filter(item => item.id !== id);
        this.set(key, filtered);
    },

    logActivity(actionText) {
        const user = this.initCurrentUser();
        const logs = this.get(KEYS.ACTIVITY_LOG, []);
        logs.unshift({
            id: Utils.generateUUID(),
            teacherId: user.id,
            text: actionText,
            timestamp: new Date().toISOString()
        });
        this.set(KEYS.ACTIVITY_LOG, logs.slice(0, 30)); // Максимум 30 аракет сакталат
    },

    seedDemoData() {
        const user = this.initCurrentUser();
        
        const demoClasses = [
            { id: "class-10a", teacherId: user.id, name: "10-А", subject: "Физика", academicYear: "2026-2027", studentIds: ["std-1", "std-2"], status: "active", createdAt: new Date().toISOString() },
            { id: "class-11b", teacherId: user.id, name: "11-Б", subject: "Физика", academicYear: "2026-2027", studentIds: [], status: "active", createdAt: new Date().toISOString() }
        ];

        const demoStudents = [
            { id: "std-1", teacherId: user.id, fullName: "Асан Үсөнбаев", classId: "class-10a", className: "10-А", studentCode: "STU-8821", status: "active", createdAt: new Date().toISOString() },
            { id: "std-2", teacherId: user.id, fullName: "Айгүл Садыкова", classId: "class-10a", className: "10-А", studentCode: "STU-4402", status: "active", createdAt: new Date().toISOString() }
        ];

        const demoTests = [
            {
                id: "test-m1",
                teacherId: user.id,
                title: "10-класс Механика Жөнөкөй Тест",
                subject: "Физика",
                className: "10-А",
                topic: "Механика",
                description: "Динамика бөлүмү боюнча текшерүү иш.",
                difficulty: "Орточо",
                language: "ky",
                status: "active",
                testCode: "TEST-7791",
                questions: [
                    { id: 1, type: "single", text: "Ньютондун 2-мыйзамынын формуласы?", options: ["F=ma", "E=mc2", "P=mv"], answer: "F=ma", points: 5 }
                ],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        ];

        const demoResults = [
            {
                id: "res-1",
                testId: "test-m1",
                teacherId: user.id,
                studentId: "std-1",
                studentName: "Асан Үсөнбаев",
                className: "10-А",
                studentCode: "STU-8821",
                score: 5,
                totalPoints: 5,
                percentage: 100,
                status: "completed",
                submittedAt: new Date().toISOString(),
                antiCheatEvents: []
            },
            {
                id: "res-2",
                testId: "test-m1",
                teacherId: user.id,
                studentId: "std-2",
                studentName: "Айгүл Садыкова",
                className: "10-А",
                studentCode: "STU-4402",
                score: 0,
                totalPoints: 5,
                percentage: 0,
                status: "completed",
                submittedAt: new Date().toISOString(),
                antiCheatEvents: ["Терезеден башка жакка которулду"]
            }
        ];

        this.set(KEYS.CLASSES, demoClasses);
        this.set(KEYS.STUDENTS, demoStudents);
        this.set(KEYS.TESTS, demoTests);
        this.set(KEYS.RESULTS, demoResults);
        this.logActivity("Демонстрациялык маалыматтар ийгиликтүү базага жазылды.");
    }
};

export { KEYS };
