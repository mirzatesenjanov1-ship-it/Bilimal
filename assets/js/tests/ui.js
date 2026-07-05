export const UI = {
    showToast(message, type = 'success') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<i class="fas fa-info-circle"></i> <span>${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3500);
    },

    openModal(htmlContent) {
        const backdrop = document.getElementById('modalBackdrop');
        const windowEl = document.getElementById('modalWindow');
        windowEl.innerHTML = htmlContent;
        backdrop.style.display = 'flex';
    },

    closeModal() {
        document.getElementById('modalBackdrop').style.display = 'none';
    }
};

// Global closing bridge logic for modal
document.getElementById('modalBackdrop').addEventListener('click', (e) => {
    if (e.target.id === 'modalBackdrop') UI.closeModal();
});
