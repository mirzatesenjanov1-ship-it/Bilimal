import { getCurrentUser, saveProfile, saveDraft, getDraft, clearDraft, resetProfileToDefault } from './storage.js';
import { safeText, getInitials, validateEmail, validatePhone } from './utils.js';
import { validateImageFile, compressImage } from './avatar.js';
import { createModalHTML, showToast, showConfirmModal } from './ui.js';

let previousFocusedElement = null;

/**
 * Sidebar профиль карточкасын реалдуу убакытта жаңылоо
 */
export function renderSidebarProfile() {
    const user = getCurrentUser();
    
    const nameEl = document.getElementById('sidebarTeacherName');
    const roleEl = document.getElementById('sidebarTeacherRole');
    const imgEl = document.getElementById('sidebarAvatarImage');
    const initialsEl = document.getElementById('sidebarAvatarInitials');
    const headerNameEl = document.querySelector('.user-header-name'); // Бар болсо жаңыртуу үчүн

    if (nameEl) nameEl.textContent = safeText(user.fullName, "Мугалим");
    if (roleEl) roleEl.textContent = safeText(user.role, "Мугалим");
    if (headerNameEl) headerNameEl.textContent = safeText(user.firstName, "Мугалим");

    // Ички глобалдык матадаталарды жаңыртуу (Жаңы түзүлө турган тесттер үчүн)
    window.bilimai_current_teacher_id = user.id;
    window.bilimai_current_teacher_name = user.fullName;

    // Аватарды жөндөө
    if (user.avatar && user.avatarType === 'image') {
        imgEl.src = user.avatar;
        imgEl.hidden = false;
        initialsEl.style.display = 'none';

        imgEl.onerror = () => {
            imgEl.hidden = true;
            initialsEl.style.display = 'flex';
            initialsEl.textContent = getInitials(user.fullName);
        };
    } else {
        imgEl.hidden = true;
        initialsEl.style.display = 'flex';
        initialsEl.textContent = getInitials(user.fullName);
    }
}

/**
 * Модалдын ичиндеги Табдарды алмаштыруу логикасы
 */
function initTabSystem(modal) {
    const tabs = modal.querySelectorAll('.tab-btn');
    const contents = modal.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => {
                t.classList.remove('active');
                t.setAttribute('aria-selected', 'false');
            });
            contents.forEach(c => c.classList.remove('active-content'));

            tab.classList.add('active');
            tab.setAttribute('aria-selected', 'true');
            const target = tab.getAttribute('data-tab');
            modal.querySelector(`#${target}`).classList.add('active-content');

            if (target === 'tab-preview') {
                updateLivePreviewCard(modal);
            }
        });
    });
}

/**
 * Модал ичиндеги жандуу баракчаны (Preview) жаңыртуу
 */
function updateLivePreviewCard(modal) {
    const fName = modal.querySelector('#inp-firstName').value.trim();
    const lName = modal.querySelector('#inp-lastName').value.trim();
    const full = (fName + " " + lName).trim() || "Аты-жөнү бош";
    
    modal.querySelector('#livePreviewName').textContent = full;
    modal.querySelector('#livePreviewRole').textContent = modal.querySelector('#inp-role').value;
    modal.querySelector('#livePreviewSubject').textContent = modal.querySelector('#inp-subject').value.trim() || "-";
    modal.querySelector('#livePreviewSchool').textContent = modal.querySelector('#inp-schoolName').value.trim() || "-";
    modal.querySelector('#livePreviewCity').textContent = modal.querySelector('#inp-city').value.trim() || "-";
    modal.querySelector('#livePreviewBio').textContent = modal.querySelector('#inp-bio').value.trim() || "Өзү жөнүндө маалымат жазыла элек.";

    const previewAvatar = modal.querySelector('#livePreviewAvatar');
    const localDraft = getDraft() || getCurrentUser();

    if (localDraft.avatar && localDraft.avatarType === 'image') {
        previewAvatar.style.backgroundImage = `url('${localDraft.avatar}')`;
        previewAvatar.textContent = "";
    } else {
        previewAvatar.style.backgroundImage = 'none';
        previewAvatar.textContent = getInitials(full);
    }
}

/**
 * Профиль Оңдоо Модалын Ачуу
 */
export function openProfileModal() {
    previousFocusedElement = document.activeElement;
    createModalHTML();

    const modal = document.getElementById('profileSettingsModal');
    const form = modal.getElementById('profileSettingsForm');
    const currentUser = getCurrentUser();

    // Draft же негизгини жүктөө
    const initialData = getDraft() || currentUser;

    // Форманы толтуруу
    modal.querySelector('#inp-firstName').value = safeText(initialData.firstName);
    modal.querySelector('#inp-lastName').value = safeText(initialData.lastName);
    modal.querySelector('#inp-fullName').value = safeText(initialData.fullName);
    modal.querySelector('#inp-email').value = safeText(initialData.email);
    modal.querySelector('#inp-phone').value = safeText(initialData.phone);
    modal.querySelector('#inp-role').value = safeText(initialData.role, "Мугалим");
    modal.querySelector('#inp-subject').value = safeText(initialData.subject);
    modal.querySelector('#inp-schoolName').value = safeText(initialData.schoolName);
    modal.querySelector('#inp-city').value = safeText(initialData.city);
    modal.querySelector('#inp-bio').value = safeText(initialData.bio);

    // Аватар превьюну орнотуу
    const modalPreview = modal.querySelector('#modalAvatarPreview');
    if (initialData.avatar && initialData.avatarType === 'image') {
        modalPreview.style.backgroundImage = `url('${initialData.avatar}')`;
        modalPreview.textContent = "";
    } else {
        modalPreview.style.backgroundImage = 'none';
        modalPreview.textContent = getInitials(initialData.fullName);
    }

    // Ички окуяларды тазалап кайра байлоо (Event listener duplication коргоо)
    initTabSystem(modal);
    setupModalEventHandlers(modal, form, currentUser);

    // Ачуу эффекти жана Accessibility Фокус
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('open'), 10);
    modal.querySelector('#inp-firstName').focus();
    
    // Focus Trap кошуу
    document.addEventListener('keydown', handleFocusTrap);
}

/**
 * Модалды жабуу
 */
export function closeProfileModal() {
    const modal = document.getElementById('profileSettingsModal');
    if (!modal) return;

    modal.classList.remove('open');
    setTimeout(() => {
        modal.style.display = 'none';
        clearDraft();
        document.removeEventListener('keydown', handleFocusTrap);
        if (previousFocusedElement) previousFocusedElement.focus();
    }, 250);
}

/**
 * Focus Trap башкаруу (Акссессибилити)
 */
function handleFocusTrap(e) {
    const modal = document.getElementById('profileSettingsModal');
    if (!modal || modal.style.display === 'none') return;

    if (e.key === 'Escape') {
        triggerCancelAction();
        return;
    }

    if (e.key === 'Tab') {
        const focusableElements = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex="0"]');
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
            if (document.activeElement === firstElement) {
                lastElement.focus();
                e.preventDefault();
            }
        } else {
            if (document.activeElement === lastElement) {
                firstElement.focus();
                e.preventDefault();
            }
        }
    }
}

/**
 * Жокко чыгаруу баскычы басылгандагы текшерүү
 */
function triggerCancelAction() {
    const draft = getDraft();
    if (draft) {
        showConfirmModal({
            title: "Өзгөртүүлөрдү жокко чыгаруу",
            message: "Сиз киргизген маалыматтар сакталбайт. Модалды жабасызбы?",
            onConfirm: () => closeProfileModal()
        });
    } else {
        closeProfileModal();
    }
}

/**
 * Бардык ички интерактивдүү окуяларды угуучулар (Event Handlers)
 */
function setupModalEventHandlers(modal, form, currentUser) {
    const fNameInp = modal.querySelector('#inp-firstName');
    const lNameInp = modal.querySelector('#inp-lastName');
    const fullInp = modal.querySelector('#inp-fullName');
    const modalPreview = modal.querySelector('#modalAvatarPreview');

    // Автоматтык түрдө Толук Аты-жөнүн кураштыруу жана Draft сактоо
    const triggerAutosave = () => {
        const fullStr = (fNameInp.value.trim() + " " + lNameInp.value.trim()).trim();
        fullInp.value = fullStr;

        const currentDraft = getDraft() || { ...currentUser };
        currentDraft.firstName = fNameInp.value.trim();
        currentDraft.lastName = lNameInp.value.trim();
        currentDraft.fullName = fullStr;
        currentDraft.email = modal.querySelector('#inp-email').value.trim();
        currentDraft.phone = modal.querySelector('#inp-phone').value.trim();
        currentDraft.role = modal.querySelector('#inp-role').value;
        currentDraft.subject = modal.querySelector('#inp-subject').value.trim();
        currentDraft.schoolName = modal.querySelector('#inp-schoolName').value.trim();
        currentDraft.city = modal.querySelector('#inp-city').value.trim();
        currentDraft.bio = modal.querySelector('#inp-bio').value.trim();

        saveDraft(currentDraft);
        
        if (currentDraft.avatarType === 'initials') {
            modalPreview.style.backgroundImage = 'none';
            modalPreview.textContent = getInitials(fullStr);
        }
    };

    form.querySelectorAll('input, select, textarea').forEach(elem => {
        elem.addEventListener('input', triggerAutosave);
        elem.addEventListener('change', triggerAutosave);
    });

    // Жабуу жана Жокко чыгаруу кнопкалары
    modal.querySelector('#closeProfileModalBtn').onclick = triggerCancelAction;
    modal.querySelector('#btnCancelProfileModal').onclick = triggerCancelAction;

    // СҮРӨТ ЖҮКТӨӨ ЛОГИКАСЫ
    const fileInp = modal.querySelector('#modalHiddenFileInput');
    modal.querySelector('#uploadAvatarActionBtn').onclick = () => fileInp.click();

    fileInp.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const check = validateImageFile(file);
        if (!check.valid) {
            showToast(check.error, 'error');
            return;
        }

        try {
            showToast("Сүрөт иштетилүүдө...", "info");
            const compressedBase64 = await compressImage(file, 250, 0.75);
            
            const currentDraft = getDraft() || { ...currentUser };
            currentDraft.avatar = compressedBase64;
            currentDraft.avatarType = 'image';
            saveDraft(currentDraft);

            modalPreview.textContent = "";
            modalPreview.style.backgroundImage = `url('${compressedBase64}')`;
            showToast("Сүрөт даяр! Санариптик preview түзүлдү.", "success");
        } catch (err) {
            showToast("Сүрөттү жүктөөдө ката келип чыкты.", "error");
        }
    };

    // Баш тамгаларга өтүү
    modal.querySelector('#btnUseInitials').onclick = () => {
        const currentDraft = getDraft() || { ...currentUser };
        currentDraft.avatarType = 'initials';
        saveDraft(currentDraft);
        modalPreview.style.backgroundImage = 'none';
        modalPreview.textContent = getInitials(fullInp.value);
        showToast("Режим: Аватар баш тамгалар менен көрсөтүлөт.");
    };

    // Демейки Аватар (Баштапкы таза боштук)
    modal.querySelector('#btnUseDefaultAvatar').onclick = () => {
        const currentDraft = getDraft() || { ...currentUser };
        currentDraft.avatar = "";
        currentDraft.avatarType = 'initials';
        saveDraft(currentDraft);
        modalPreview.style.backgroundImage = 'none';
        modalPreview.textContent = getInitials(fullInp.value);
        showToast("Демейки системалык аватар коюлду.");
    };

    // Сүрөттү гана өчүрүү
    modal.querySelector('#btnRemoveAvatarImg').onclick = () => {
        const currentDraft = getDraft() || { ...currentUser };
        currentDraft.avatar = "";
        currentDraft.avatarType = 'initials';
        saveDraft(currentDraft);
        modalPreview.style.backgroundImage = 'none';
        modalPreview.textContent = getInitials(fullInp.value);
        showToast("Профилдик сүрөт өчүрүлдү.", "info");
    };

    // ЭКСПОРТ (JSON ТҮРҮНДӨ ЖҮКТӨӨ)
    modal.querySelector('#btnExportJSON').onclick = () => {
        const currentData = getDraft() || getCurrentUser();
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentData, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `bilimai_profile_${currentData.firstName || 'teacher'}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        showToast("Профиль JSON файлы ийгиликтүү жүктөлдү.");
    };

    // ИМПОРТ (JSON ФАЙЛДАН ЖҮКТӨӨ)
    const jsonInp = modal.querySelector('#jsonFileInput');
    modal.querySelector('#btnTriggerImport').onclick = () => jsonInp.click();
    jsonInp.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const parsed = JSON.parse(event.target.result);
                if (!parsed.firstName || !parsed.id) {
                    throw new Error("Структура туура эмес");
                }
                saveProfile(parsed);
                showToast("Профиль файлдан ийгиликтүү калыбына келтирилди!", "success");
                closeProfileModal();
                renderSidebarProfile();
            } catch (err) {
                showToast("Ката: Файл жараксыз же бузулган JSON форматында!", "error");
            }
        };
        reader.readAsText(file);
    };

    // ПРОФИЛДИ ДЕМЕЙКИ АБАЛГА КАЙТАРУУ (RESET)
    modal.querySelector('#btnResetProfile').onclick = () => {
        showConfirmModal({
            title: "Профилди баштапкы абалга келтирүү",
            message: "Сиз чын эле бардык маалыматтарды өчүрүп, баштапкы демо профилге кайткыңыз келеби? Мурунку сүрөттөр калыбына келбейт!",
            onConfirm: () => {
                resetProfileToDefault();
                showToast("Баштапкы профиль калыбына келтирилди.", "info");
                closeProfileModal();
                renderSidebarProfile();
            }
        });
    };

    // АККАУНТТАН ЧЫГУУ (LOGOUT)
    modal.querySelector('#btnLogoutSystem').onclick = () => {
        showConfirmModal({
            title: "Системадан чыгуу",
            message: "Чын эле коопсуз чыгууну каалайсызбы? Тесттериңиз өчүрүлбөйт.",
            onConfirm: () => {
                showToast("Сессия аяктады. Кайра кирүү терезеси ачылууда...", "info");
                setTimeout(() => {
                    location.reload(); // Же тиешелүү Login баракчасына багыттоо
                }, 1000);
            }
        });
    };

    // САКТОО ОКУЯСЫ (SUBMIT FORM)
    form.onsubmit = (e) => {
        e.preventDefault();

        // Валидациялоо
        const firstNameVal = fNameInp.value.trim();
        const emailVal = modal.querySelector('#inp-email').value.trim();
        const phoneVal = modal.querySelector('#inp-phone').value.trim();

        let hasError = false;

        // Аты милдеттүү
        if (!firstNameVal) {
            modal.querySelector('#err-firstName').textContent = "Мугалимдин аты милдеттүү түрдө жазылышы керек!";
            fNameInp.classList.add('invalid-input');
            hasError = true;
        } else {
            modal.querySelector('#err-firstName').textContent = "";
            fNameInp.classList.remove('invalid-input');
        }

        // Email валидация
        if (!validateEmail(emailVal)) {
            modal.querySelector('#err-email').textContent = "Электрондук почта форматы ката! (Мисалы: мисал@mail.ru)";
            modal.querySelector('#inp-email').classList.add('invalid-input');
            hasError = true;
        } else {
            modal.querySelector('#err-email').textContent = "";
            modal.querySelector('#inp-email').classList.remove('invalid-input');
        }

        if (hasError) {
            modal.querySelector('.tab-btn[data-tab="tab-main"]').click(); // Ката табга багыттоо
            showToast("Формада каталар бар, сураныч текшериңиз!", "error");
            return;
        }

        // Баарын акыркы сактоо
        const finalData = getDraft() || { ...currentUser };
        try {
            saveProfile(finalData);
            showToast("Профиль ийгиликтүү сакталды жана жаңыртылды!", "success");
            closeProfileModal();
            renderSidebarProfile();
        } catch (err) {
            showToast(err.message, "error");
        }
    };
}

// Баракча толук жүктөлгөндө автоматтык түрдө Sidebar чагылдыруу
document.addEventListener("DOMContentLoaded", () => {
    renderSidebarProfile();
    
    // Эгер баракта эски кнопкалар же карталар болсо, аларга окуяларды байлоо
    const sidebarTriggerCard = document.getElementById('sidebarProfileCard');
    const editBtn = document.getElementById('editProfileButton');

    if (sidebarTriggerCard) {
        sidebarTriggerCard.addEventListener('click', openProfileModal);
        sidebarTriggerCard.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openProfileModal();
            }
        });
    }
    if (editBtn) {
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Картанын өзү кошо иштеп кетпеши үчүн
            openProfileModal();
        });
    }
});
