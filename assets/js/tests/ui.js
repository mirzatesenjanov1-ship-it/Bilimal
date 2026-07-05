import { safeText } from './utils.js';

/**
 * Динамикалык Toast билдирүү көрсөтүү системасы
 */
export function showToast(message, type = 'success') {
    let container = document.getElementById('bilimai-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'bilimai-toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `bilimai-toast ${type}`;
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `
        <span class="toast-msg">${safeText(message)}</span>
        <button class="toast-close" type="button" aria-label="Жабуу">&times;</button>
    `;

    container.appendChild(toast);

    // Анимация менен чыгаруу
    setTimeout(() => toast.classList.add('visible'), 10);

    const closeToast = () => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 300);
    };

    toast.querySelector('.toast-close').addEventListener('click', closeToast);
    setTimeout(closeToast, 4000);
}

/**
 * Бардык кооптуу аракеттер үчүн Ырастоо (Modal Confirm) терезеси
 */
export function showConfirmModal({ title, message, onConfirm, onCancel }) {
    const overlay = document.createElement('div');
    overlay.className = 'bilimai-confirm-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    overlay.innerHTML = `
        <div class="bilimai-confirm-box">
            <h3>${safeText(title)}</h3>
            <p>${safeText(message)}</p>
            <div class="confirm-actions">
                <button id="confirmCancelBtn" class="btn btn-secondary" type="button">Жокко чыгаруу</button>
                <button id="confirmApproveBtn" class="btn btn-danger" type="button">Ооба, ырастайм</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    
    // Фокусту башкаруу
    const approveBtn = overlay.querySelector('#confirmApproveBtn');
    const cancelBtn = overlay.querySelector('#confirmCancelBtn');
    approveBtn.focus();

    const destroy = () => {
        overlay.remove();
    };

    approveBtn.addEventListener('click', () => {
        destroy();
        if (onConfirm) onConfirm();
    });

    cancelBtn.addEventListener('click', () => {
        destroy();
        if (onCancel) onCancel();
    });

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            destroy();
            if (onCancel) onCancel();
        }
    });
}

/**
 * Профиль жөндөөлөрүнүн Модалдык кутусунун HTML түзүмүн динамикалык генерациялоо
 */
export function createModalHTML() {
    if (document.getElementById('profileSettingsModal')) return;

    const modal = document.createElement('div');
    modal.id = 'profileSettingsModal';
    modal.className = 'bilimai-modal-overlay';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'modalTitle');
    modal.style.display = 'none';

    modal.innerHTML = `
        <div class="bilimai-modal-container">
            <header class="modal-header">
                <h2 id="modalTitle">Жеке профиль жана жөндөөлөр</h2>
                <button id="closeProfileModalBtn" class="modal-close-x" type="button" aria-label="Жабуу">&times;</button>
            </header>
            
            <div class="modal-tabs" role="tablist">
                <button class="tab-btn active" role="tab" aria-selected="true" data-tab="tab-main">Негизги маалымат</button>
                <button class="tab-btn" role="tab" aria-selected="false" data-tab="tab-avatar">Профилдик сүрөт</button>
                <button class="tab-btn" role="tab" aria-selected="false" data-tab="tab-security">Коопсуздук жана маалымат</button>
                <button class="tab-btn" role="tab" aria-selected="false" data-tab="tab-preview">Алдын ала көрүү</button>
            </div>

            <form id="profileSettingsForm" autocomplete="off" novalidate>
                <div class="modal-body-content">
                    
                    <div id="tab-main" class="tab-content active-content">
                        <div class="form-grid">
                            <div class="form-group">
                                <label for="inp-firstName">Аты <span class="required">*</span></label>
                                <input type="text" id="inp-firstName" name="firstName" required>
                                <span class="error-msg" id="err-firstName"></span>
                            </div>
                            <div class="form-group">
                                <label for="inp-lastName">Фамилиясы</label>
                                <input type="text" id="inp-lastName" name="lastName">
                            </div>
                            <div class="form-group full-width">
                                <label for="inp-fullName">Толук аты-жөнү (Автоматтык түзүлөт)</label>
                                <input type="text" id="inp-fullName" readonly style="opacity: 0.6; background: #0f172a;">
                            </div>
                            <div class="form-group">
                                <label for="inp-email">Электрондук почта (Email)</label>
                                <input type="email" id="inp-email" name="email">
                                <span class="error-msg" id="err-email"></span>
                            </div>
                            <div class="form-group">
                                <label for="inp-phone">Телефон номери</label>
                                <input type="text" id="inp-phone" name="phone" placeholder="+996 XXX XX XX XX">
                                <span class="error-msg" id="err-phone"></span>
                            </div>
                            <div class="form-group">
                                <label for="inp-role">Ролу</label>
                                <select id="inp-role" name="role">
                                    <option value="Мугалим">Мугалим</option>
                                    <option value="Администратор">Администратор</option>
                                    <option value="Директор">Директор</option>
                                    <option value="Түзүүчү">Түзүүчү</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="inp-subject">Окуткан сабагы</label>
                                <input type="text" id="inp-subject" name="subject">
                            </div>
                            <div class="form-group">
                                <label for="inp-schoolName">Мектептин же окуу жайдын аталышы</label>
                                <input type="text" id="inp-schoolName" name="schoolName">
                            </div>
                            <div class="form-group">
                                <label for="inp-city">Шаар / Район</label>
                                <input type="text" id="inp-city" name="city">
                            </div>
                            <div class="form-group full-width">
                                <label for="inp-bio">Өзүңүз жөнүндө кыскача маалымат</label>
                                <textarea id="inp-bio" name="bio" rows="3" maxlength="300"></textarea>
                            </div>
                        </div>
                    </div>

                    <div id="tab-avatar" class="tab-content">
                        <div class="avatar-settings-layout">
                            <div class="avatar-crop-zone">
                                <div class="circle-preview-area">
                                    <div id="modalAvatarPreview" class="modal-avatar-preview-element"></div>
                                </div>
                            </div>
                            <div class="avatar-control-buttons">
                                <button type="button" id="uploadAvatarActionBtn" class="btn btn-cyan">Сүрөт жүктөө</button>
                                <input type="file" id="modalHiddenFileInput" accept="image/jpeg,image/png,image/jpg,image/webp" style="display:none;">
                                <button type="button" id="btnUseInitials" class="btn btn-secondary">Баш тамгалар менен колдонуу</button>
                                <button type="button" id="btnUseDefaultAvatar" class="btn btn-secondary">Демейки аватарды колдонуу</button>
                                <button type="button" id="btnRemoveAvatarImg" class="btn btn-danger">Сүрөттү алып салуу</button>
                            </div>
                        </div>
                    </div>

                    <div id="tab-security" class="tab-content">
                        <div class="security-options-list">
                            <div class="security-card">
                                <div>
                                    <h4>Маалыматтарды резервдик көчүрүү</h4>
                                    <p>Бардык профиль маалыматтарыңызды локалдык компьютерге JSON форматында жүктөп алыңыз.</p>
                                </div>
                                <button type="button" id="btnExportJSON" class="btn btn-secondary">Маалыматтарды экспорттоо</button>
                            </div>
                            <div class="security-card">
                                <div>
                                    <h4>JSON файлдан калыбына келтирүү</h4>
                                    <p>Экспорттолгон JSON файлын тандап, профилиңизди кайра жүктөңүз.</p>
                                </div>
                                <button type="button" id="btnTriggerImport" class="btn btn-secondary">Профилди импорттоо</button>
                                <input type="file" id="jsonFileInput" accept=".json" style="display:none;">
                            </div>
                            <div class="security-card danger-zone">
                                <div>
                                    <h4>Профилди баштапкы абалга келтирүү</h4>
                                    <p>Бардык өзгөртүүлөрдү өчүрүп, системаны баштапкы демейки демо маалыматтарга кайтарат.</p>
                                </div>
                                <button type="button" id="btnResetProfile" class="btn btn-danger">Профилди өчүрүү/Кайтаруу</button>
                            </div>
                            <div class="security-card danger-zone">
                                <div>
                                    <h4>Системадан коопсуз чыгуу</h4>
                                    <p>Учурдагы сессияңызды жыйынтыктайт. Түзүлгөн тесттер жана ички маалыматтар өчүрүлбөйт.</p>
                                </div>
                                <button type="button" id="btnLogoutSystem" class="btn btn-danger">Аккаунттан чыгуу</button>
                            </div>
                        </div>
                    </div>

                    <div id="tab-preview" class="tab-content">
                        <div class="live-preview-card-wrapper">
                            <div class="preview-badge-card">
                                <div class="preview-card-header-bg"></div>
                                <div class="preview-card-avatar-row">
                                    <div id="livePreviewAvatar" class="live-card-avatar"></div>
                                </div>
                                <div class="preview-card-body">
                                    <h3 id="livePreviewName">Эркин Салиев</h3>
                                    <div id="livePreviewRole" class="badge-role">Мугалим</div>
                                    <div class="preview-meta-details">
                                        <p><strong>Предмет:</strong> <span id="livePreviewSubject">-</span></p>
                                        <p><strong>Мектеп:</strong> <span id="livePreviewSchool">-</span></p>
                                        <p><strong>Дарек:</strong> <span id="livePreviewCity">-</span></p>
                                    </div>
                                    <div class="preview-card-bio">
                                        <h5>Өзү жөнүндө:</h5>
                                        <p id="livePreviewBio">Маалымат киргизилген эмес.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

                <footer class="modal-footer-actions">
                    <button type="button" id="btnCancelProfileModal" class="btn btn-secondary">Жокко чыгаруу</button>
                    <button type="submit" id="btnSaveProfileModal" class="btn btn-cyan">Өзгөртүүлөрдү сактоо</button>
                </footer>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
}
