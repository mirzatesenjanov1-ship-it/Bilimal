/**
 * Bilimal.org - Колдонуучуларды башкаруу жана коопсуздук модулу (Authentication Engine)
 */

const BilimalAuth = {
    // Учурдагы кирген колдонуучуну алуу
    getCurrentUser() {
        return BilimalStorage.getObject(BilimalStorage.KEYS.CURRENT_USER);
    },

    // Системага киргенин текшерүү жана багыттоо
    checkAuth() {
        const user = this.getCurrentUser();
        if (!user) {
            // Эгер коомдук бет эмес болсо жана жеке кабинет болсо, кирүү бетине жиберүү
            const path = window.location.pathname;
            if (path.includes('tests.html') || path.includes('admin-dashboard.html')) {
                window.location.href = '/'; 
            }
            return null;
        }
        return user;
    },

    // Жаңы мугалимди каттоо
    registerTeacher(fullName, email, password, schoolName, subject) {
        try {
            const users = BilimalStorage.get(BilimalStorage.KEYS.USERS);
            const exist = users.find(u => u.email.toLowerCase() === email.toLowerCase());
            
            if (exist) {
                return { success: false, message: "Бул электрондук почта мурда катталган!" };
            }

            const newTeacher = {
                id: 'TCH-' + Date.now(),
                fullName: fullName,
                email: email.toLowerCase(),
                password: btoa(password), // Сырсөздү базалык деңгээлде жашыруу (Админ да көрбөш керек)
                schoolName: schoolName,
                subject: subject,
                bio: "",
                avatar: "", // Кийин өзү жүктөйт же тамгадан жасалат
                role: 'teacher',
                createdAt: new Date().toISOString()
            };

            users.push(newTeacher);
            BilimalStorage.set(BilimalStorage.KEYS.USERS, users);
            BilimalStorage.logActivity(newTeacher.id, "Каттоо", "Жаңы мугалим системага катталды.");
            
            return { success: true, user: newTeacher };
        } catch (error) {
            return { success: false, message: "Каттоо учурунда техникалык ката кетти." };
        }
    },

    // Системага кирүү
    login(email, password) {
        try {
            // Башкы админдин атайын кирүүсү
            if (email === 'admin@bilimal.org' && password === 'bilimal_admin_2026') {
                const adminUser = {
                    id: 'ADMIN',
                    fullName: 'Башкы Администратор',
                    role: 'admin',
                    avatar: ''
                };
                BilimalStorage.setObject(BilimalStorage.KEYS.CURRENT_USER, adminUser);
                BilimalStorage.logActivity('ADMIN', 'Системага кирүү', 'Администратор башкаруу панелине кирди.');
                return { success: true, role: 'admin' };
            }

            const users = BilimalStorage.get(BilimalStorage.KEYS.USERS);
            const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === btoa(password));

            if (!user) {
                return { success: false, message: "Электрондук почта же сырсөз ката!" };
            }

            // Коопсуздук үчүн сессияга сырсөздү кошпойбуз
            const sessionUser = { ...user };
            delete sessionUser.password;

            BilimalStorage.setObject(BilimalStorage.KEYS.CURRENT_USER, sessionUser);
            BilimalStorage.logActivity(user.id, "Системага кирүү", "Мугалим өзүнүн кабинетине кирди.");
            
            if (typeof window.trackEvent === 'function') {
                window.trackEvent('teacher_dashboard_opened', { teacher_id: user.id });
            }

            return { success: true, role: 'teacher' };
        } catch (error) {
            return { success: false, message: "Кирүүдө техникалык ката кетти." };
        }
    },

    // Мугалимдин өз профилин жаңыртуусу (Аватарды кошо)
    updateProfile(updatedData) {
        try {
            const currentUser = this.getCurrentUser();
            if (!currentUser || currentUser.role === 'admin') return { success: false, message: "Уруксат жок!" };

            const users = BilimalStorage.get(BilimalStorage.KEYS.USERS);
            const index = users.findIndex(u => u.id === currentUser.id);

            if (index > -1) {
                // Маалыматтарды жаңылоо (Бирок коопсуздук үчүн ID, роль жана Email өзгөрбөйт)
                users[index].fullName = updatedData.fullName || users[index].fullName;
                users[index].schoolName = updatedData.schoolName || users[index].schoolName;
                users[index].subject = updatedData.subject || users[index].subject;
                users[index].bio = updatedData.bio || users[index].bio;
                users[index].avatar = updatedData.avatar || users[index].avatar;

                // Сессияны жаңылоо
                const sessionUser = { ...users[index] };
                delete sessionUser.password;
                BilimalStorage.setObject(BilimalStorage.KEYS.CURRENT_USER, sessionUser);
                
                // Базаны сактоо
                BilimalStorage.set(BilimalStorage.KEYS.USERS, users);
                BilimalStorage.logActivity(currentUser.id, "Профилди жаңылоо", "Жеке профилдин маалыматтары өзгөртүлдү.");
                
                if (typeof window.trackEvent === 'function') {
                    window.trackEvent('profile_updated', { teacher_id: currentUser.id });
                }

                return { success: true, user: sessionUser };
            }
            return { success: false, message: "Колдонуучу табылган жок!" };
        } catch (error) {
            return { success: false, message: "Профилди сактоодо ката келип чыкты." };
        }
    },

    // Системадан чыгуу
    logout() {
        const currentUser = this.getCurrentUser();
        if (currentUser) {
            BilimalStorage.logActivity(currentUser.id, "Системадан чыгуу", "Колдонуучу сессияны аяктады.");
            localStorage.removeItem(BilimalStorage.KEYS.CURRENT_USER);
        }
        window.location.href = '/';
    },

    // Автоматтык түрдө баш тамгалардан аватар түзүү (Сүрөт жок учурда)
    generateLetterAvatar(name) {
        if (!name) return 'BM';
        const parts = name.split(' ');
        if (parts.length > 1) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return parts[0][0].toUpperCase();
    }
};

window.BilimalAuth = BilimalAuth;
