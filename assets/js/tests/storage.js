import { generateUUID } from './utils.js';

const STORAGE_KEY = 'bilimai_current_user_v1';
const DRAFT_KEY = 'bilimai_profile_draft_v1';

/**
 * Демейки маалыматтар менен таза профиль түзүү
 */
export function createDefaultProfile() {
    return {
        id: generateUUID(),
        fullName: "Эркин Салиев",
        firstName: "Эркин",
        lastName: "Салиев",
        email: "teacher@example.com",
        phone: "",
        role: "Мугалим",
        subject: "Физика",
        schoolName: "БилимАй Мектеби",
        city: "Бишкек",
        bio: "Физика предметинин мугалими. Санариптик технологиялар боюнча адис.",
        avatar: "",
        avatarType: "initials",
        initials: "ЭС",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
}

/**
 * Учурдагы колдонуучуну localStorage'дан алуу
 */
export function getCurrentUser() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) {
            const defaultUser = createDefaultProfile();
            saveProfile(defaultUser);
            return defaultUser;
        }
        return JSON.parse(data);
    } catch (e) {
        console.error("localStorage'дан маалымат окууда ката кетти:", e);
        return createDefaultProfile();
    }
}

/**
 * Профилди толук сактоо
 */
export function saveProfile(profileData) {
    try {
        profileData.updatedAt = new Date().toISOString();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(profileData));
        // Сакталгандан кийин черновикти тазалайбыз
        localStorage.removeItem(DRAFT_KEY);
        return true;
    } catch (e) {
        console.error("localStorage'га жазууда ката кетти (Мүмкүн эс толгон):", e);
        throw new Error("Сактоо ишке ашкан жок. Сүрөттүн өлчөмү өтө чоң болушу мүмкүн!");
    }
}

/**
 * Черновикти (Draft) убактылуу сактоо
 */
export function saveDraft(draftData) {
    try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draftData));
    } catch (e) {
        console.warn("Draft сактоодо ката:", e);
    }
}

/**
 * Убактылуу черновикти алуу
 */
export function getDraft() {
    try {
        const data = localStorage.getItem(DRAFT_KEY);
        return data ? JSON.parse(data) : null;
    } catch (e) {
        return null;
    }
}

/**
 * Черновикти толугу менен өчүрүү
 */
export function clearDraft() {
    localStorage.removeItem(DRAFT_KEY);
}

/**
 * Профилди баштапкы демейки абалга кайтаруу
 */
export function resetProfileToDefault() {
    const defaultUser = createDefaultProfile();
    saveProfile(defaultUser);
    return defaultUser;
}
