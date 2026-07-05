import { Storage, KEYS } from './storage.js';
import { UI } from './ui.js';
import { ClassesModule } from './classes.js';
import { StudentsModule } from './students.js';
import { TestBuilderModule } from './test-builder.js';
import { ResultsModule } from './results.js';
import { AnalyticsModule } from './analytics.js';
import { Utils } from './utils.js';

class CoreApplication {
    constructor() {
        this.initSPA();
        this.bindGlobalEvents();
        
        // Экспорттоо үчүн терезеге шилтеме берүү
        window.appUI = UI;
        
        this.bootstrapData();
    }

    initSPA() {
        const handleRoute = () => {
            const hash = window.location.hash || '#dashboard';
            const viewId = 'view-' + hash.replace('#', '');
            
            document.querySelectorAll('.spa-view').forEach(view => {
                view.classList.toggle('active', view.id === viewId);
            });

            document.querySelectorAll('.menu-item').forEach(item => {
                item.classList.toggle('active', item.getAttribute('href') === hash);
            });

            const titleMap = {
                '#dashboard': 'Башкаруу панели',
                '#create': 'Жаңы тест түзүү сыйкырчысы',
                '#library': 'Тесттер китепканасы',
                '#classes': 'Класстарды башкаруу',
                '#students': 'Окуучулардын тизмеси',
                '#results': 'Баалоо & Аналитикалык отчёттор'
            };
            document.getElementById('viewTitle').textContent = titleMap[hash] || 'BilimAl Мугалим';
            
            // Диспетчердик рендер системасы
            this.refreshCurrentView(hash);
        };

        window.addEventListener('hashchange', handleRoute);
        window.addEventListener('load', handleRoute);
        
        // Мобилдик бургер меню логикасы
        document.getElementById('burgerToggle').onclick = () => {
            document.getElementById('mainSidebar').classList.toggle('open');
        };
    }

    refreshCurrentView(hash) {
        if(hash === '#dashboard') AnalyticsModule.calculateDashboard();
        if(hash === '#classes') ClassesModule.render();
        if(hash === '#students') StudentsModule.render();
        if(hash === '#results') ResultsModule.render();
        if(hash === '#library') this.renderLibraryView();
    }

    bootstrapData() {
        const user = Storage.initCurrentUser();
        document.getElementById('userFullName').textContent = user.fullName;
        document.getElementById('userAvatar').textContent = user.fullName.charAt(0).toUpperCase();
        
        ClassesModule.initModal();
        StudentsModule.init();
        TestBuilderModule.init();
        ResultsModule.init();
        
        this.refreshGlobalSelectors();
        AnalyticsModule.calculateDashboard();
    }

    refreshGlobalSelectors() {
        const classes = Storage.getTeacherData(KEYS.CLASSES);
        const testClassSelect = document.getElementById('testClassSelect');
        const studentClassFilter = document.getElementById('studentClassFilter');

        if(testClassSelect) {
            testClassSelect.innerHTML = '<option value="">Тандоо...</option>' + 
                classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        }
        if(studentClassFilter) {
            studentClassFilter.innerHTML = '<option value="all">Бардык класстар</option>' + 
                classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        }
    }

    renderLibraryView() {
        const container = document.getElementById('libraryGridContainer');
        const tests = Storage.getTeacherData(KEYS.TESTS);
        
        container.innerHTML = '';
        if(tests.length === 0) {
            container.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:var(--text-secondary);">Китепкана бош.</div>`;
            return;
        }

        tests.forEach(t => {
            const card = document.createElement('div');
            card.className = 'card test-card';
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span class="badge badge-active">${t.status}</span>
                    <code>${t.testCode}</code>
                </div>
                <h3 style="margin: 10px 0 6px 0; font-size:16px;">${Utils.escapeHTML(t.title)}</h3>
                <p style="font-size:12px; color:var(--text-secondary); margin-bottom:12px;">Предмет: ${Utils.escapeHTML(t.subject)} (Класс: ${t.className})</p>
                <div style="display:flex; gap:6px; border-top:1px solid var(--border-color); padding-top:10px;">
                    <button class="btn btn-danger" style="padding:4px 8px; font-size:12px;" onclick="window.deleteTest('${t.id}')"><i class="fas fa-trash-alt"></i></button>
                </div>
            `;
            container.appendChild(card);
        });
    }

    bindGlobalEvents() {
        document.getElementById('btnSeedDemo').onclick = (e) => {
            e.preventDefault();
            Storage.seedDemoData();
            UI.showToast("Демонстрациялык маалыматтар базага жазылды.");
            this.bootstrapData();
            this.refreshCurrentView(window.location.hash || '#dashboard');
        };

        document.getElementById('btnExportJSON').onclick = (e) => {
            e.preventDefault();
            const fullData = {
                tests: Storage.get(KEYS.TESTS),
                results: Storage.get(KEYS.RESULTS),
                students: Storage.get(KEYS.STUDENTS),
                classes: Storage.get(KEYS.CLASSES)
            };
            const blob = new Blob([JSON.stringify(fullData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `BilimAl_Full_Backup.json`;
            a.click();
            UI.showToast("Толук камдык көчүрмө жүктөлдү.");
        };

        document.getElementById('btnLogout').onclick = (e) => {
            e.preventDefault();
            if(confirm("Кабинеттен чыгууну каалайсызбы?")) {
                localStorage.removeItem(KEYS.CURRENT_USER);
                window.location.reload();
            }
        };

        // Глобалдык көпүрөлөр
        window.refreshGlobalSelectors = () => this.refreshGlobalSelectors();
        window.refreshAllViews = () => {
            this.refreshCurrentView(window.location.hash || '#dashboard');
            AnalyticsModule.calculateDashboard();
        };
    }
}

window.deleteTest = (id) => {
    if(confirm("Бул тестти китепканадан биротоло өчүрөсүзбү?")) {
        Storage.deleteTeacherData(KEYS.TESTS, id);
        UI.showToast("Тест өчүрүлдү.");
        window.refreshAllViews();
    }
};

const app = new CoreApplication();
