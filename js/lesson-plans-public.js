import { db } from '/firebase/firebase-config.js';
import { ref, get } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

let allPlans = [];
let searchQuery = '';
let selectedSubject = 'all';
let selectedGrade = 'all';

const uiTranslations = {
    ky: {
        noPlans: "Азырынча жарыяланган сабак пландары же материалдар жок.",
        searchEmpty: "Сиздин сурооңуз боюнча материал табылган жок.",
        gradeSuffix: "-класс",
        viewBtn: "👁 Киришүүнү окуу",
        generalSubject: "Жалпы",
        typePlan: "Сабак планы",
        typePresentation: "Презентация",
        typeCalendar: "Календардык план",
        modalCabinetNote: "📌 Толук DOCX/PDF вариантты алуу үчүн Жеке Кабинеттеги VIP баракчага катталыңыз."
    },
    ru: {
        noPlans: "Пока нет опубликованных планов уроков или материалов.",
        searchEmpty: "По вашему запросу материалов не найдено.",
        gradeSuffix: " класс",
        viewBtn: "👁 Читать конспект",
        generalSubject: "Общий",
        typePlan: "План урока",
        typePresentation: "Презентация",
        typeCalendar: "Календарный план",
        modalCabinetNote: "📌 Для получения полной версии DOCX/PDF подпишитесь на VIP-страницу в Личном Кабинете."
    },
    en: {
        noPlans: "No published lesson plans or materials available yet.",
        searchEmpty: "No materials found matching your request.",
        gradeSuffix: " Grade",
        viewBtn: "👁 Read Summary",
        generalSubject: "General",
        typePlan: "Lesson Plan",
        typePresentation: "Presentation",
        typeCalendar: "Calendar Plan",
        modalCabinetNote: "📌 Subscribe to the VIP page in Personal Cabinet to get the full DOCX/PDF version."
    }
};

function getLang() {
    return localStorage.getItem('site_lang') || 'ky';
}

function getTranslation() {
    const lang = getLang();
    return uiTranslations[lang] || uiTranslations.ky;
}

document.addEventListener('DOMContentLoaded', () => {
    fetchLessonPlans();
    setupEvents();
});

window.addEventListener('languageChanged', () => {
    renderPlans();
});

async function fetchLessonPlans() {
    const container = document.getElementById('plansContainer');
    const t = getTranslation();

    try {
        const plansRef = ref(db, 'lesson_plans');
        const snapshot = await get(plansRef);

        if (!snapshot.exists()) {
            container.innerHTML = `<p style="color:#94a3b8; text-align:center; grid-column:1/-1;">${t.noPlans}</p>`;
            return;
        }

        const data = snapshot.val();
        allPlans = [];

        Object.entries(data).forEach(([id, plan]) => {
            if (plan.published !== false) {
                allPlans.push({ id, ...plan });
            }
        });

        if (allPlans.length === 0) {
            container.innerHTML = `<p style="color:#94a3b8; text-align:center; grid-column:1/-1;">${t.noPlans}</p>`;
            return;
        }

        allPlans.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        renderPlans();

    } catch (error) {
        console.error("Материалдарды жүктөөдө ката:", error);
        container.innerHTML = `<p style="color:#94a3b8; text-align:center; grid-column:1/-1;">${t.noPlans}</p>`;
    }
}

function renderPlans() {
    const container = document.getElementById('plansContainer');
    if (!container) return;

    const lang = getLang();
    const t = getTranslation();
    container.innerHTML = '';

    const filtered = allPlans.filter(plan => {
        const matchSubject = selectedSubject === 'all' || (plan.subject && plan.subject.toLowerCase() === selectedSubject.toLowerCase());
        const matchGrade = selectedGrade === 'all' || String(plan.grade) === String(selectedGrade);
        
        const q = searchQuery.toLowerCase();
        const matchSearch = !searchQuery || 
            (plan.title && plan.title.toLowerCase().includes(q)) ||
            (plan.topic && plan.topic.toLowerCase().includes(q)) ||
            (plan.subject && plan.subject.toLowerCase().includes(q));

        return matchSubject && matchGrade && matchSearch;
    });

    if (filtered.length === 0) {
        container.innerHTML = `<p style="color:#94a3b8; text-align:center; grid-column:1/-1;">${t.searchEmpty}</p>`;
        return;
    }

    filtered.forEach((plan, index) => {
        const card = document.createElement('div');
        card.className = 'plan-card';

        const gradeDisplay = plan.grade ? (lang === 'en' ? `Grade ${plan.grade}` : `${plan.grade}${t.gradeSuffix}`) : t.generalSubject;
        const shortDesc = plan.description || plan.previewText || plan.topic || 'Ачык сабак планынын кыскача киришүү мазмуну...';

        card.innerHTML = `
            <div>
                <div class="plan-badges">
                    <span class="plan-badge">${escapeHtml(plan.subject || t.generalSubject)}</span>
                    <span class="plan-badge">${escapeHtml(gradeDisplay)}</span>
                    <span class="plan-type-badge">${escapeHtml(plan.materialType || t.typePlan)}</span>
                </div>
                <h3 class="plan-title">${escapeHtml(plan.title || 'Материал')}</h3>
                <p class="plan-desc">${escapeHtml(shortDesc)}</p>
            </div>
            <div class="plan-actions">
                <button class="btn-action btn-view" data-id="${plan.id}">${t.viewBtn}</button>
            </div>
        `;

        card.querySelector('.btn-view').addEventListener('click', () => {
            openViewModal(plan);
        });

        container.appendChild(card);

        // AdSense жарнама блогу
        if ((index + 1) % 6 === 0) {
            const adCard = document.createElement('div');
            adCard.className = 'ad-card';
            adCard.innerHTML = `
                <ins class="adsbygoogle"
                     style="display:block"
                     data-ad-client="ca-pub-1495571814896964"
                     data-ad-slot="1574613769"
                     data-ad-format="auto"
                     data-full-width-responsive="true"></ins>
            `;
            container.appendChild(adCard);
            (window.adsbygoogle = window.adsbygoogle || []).push({});
        }
    });
}

function openViewModal(plan) {
    const modal = document.getElementById('viewModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    const t = getTranslation();

    modalTitle.innerText = plan.title || 'Сабак планы';
    
    let contentHtml = `
        <p><strong>Предмет:</strong> ${escapeHtml(plan.subject || 'Жалпы')} | <strong>Класс:</strong> ${escapeHtml(String(plan.grade || '-'))}</p>
        <p><strong>Тема:</strong> ${escapeHtml(plan.topic || '-')}</p>
        <hr style="border:0; border-top:1px solid rgba(255,255,255,0.1); margin:15px 0;">
        <div style="white-space: pre-wrap;">${escapeHtml(plan.content || plan.description || 'Киришүү мазмуну берилген.')}</div>
        <div style="margin-top:20px; padding:12px; background:rgba(0,240,255,0.05); border:1px dashed rgba(0,240,255,0.3); border-radius:8px; font-size:0.88rem; color:#a5b4fc;">
            ${t.modalCabinetNote}
        </div>
    `;

    modalBody.innerHTML = contentHtml;
    modal.style.display = 'flex';
}

function setupEvents() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.trim();
            renderPlans();
        });
    }

    const subjectFilter = document.getElementById('subjectFilter');
    if (subjectFilter) {
        subjectFilter.addEventListener('change', (e) => {
            selectedSubject = e.target.value;
            renderPlans();
        });
    }

    const gradeFilter = document.getElementById('gradeFilter');
    if (gradeFilter) {
        gradeFilter.addEventListener('change', (e) => {
            selectedGrade = e.target.value;
            renderPlans();
        });
    }

    const closeModalBtn = document.getElementById('closeModalBtn');
    const modal = document.getElementById('viewModal');
    if (closeModalBtn && modal) {
        closeModalBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.style.display = 'none';
        });
    }
}

function escapeHtml(str) {
    return String(str || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
