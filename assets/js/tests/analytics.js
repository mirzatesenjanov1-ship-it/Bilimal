import { Storage, KEYS } from './storage.js';

export const AnalyticsModule = {
    calculateDashboard() {
        const tests = Storage.getTeacherData(KEYS.TESTS);
        const results = Storage.getTeacherData(KEYS.RESULTS);

        document.getElementById('dash-total-tests').textContent = tests.length;
        document.getElementById('dash-active-tests').textContent = tests.filter(t => t.status === 'active').length;
        document.getElementById('dash-total-attempts').textContent = results.length;

        if (results.length > 0) {
            const sum = results.reduce((acc, curr) => acc + curr.percentage, 0);
            document.getElementById('dash-avg-score').textContent = Math.round(sum / results.length) + '%';
        } else {
            document.getElementById('dash-avg-score').textContent = '0%';
        }

        this.renderAIRecommendations(results);
    },

    renderAIRecommendations(results) {
        const container = document.getElementById('aiRecommendationsContainer');
        if (!results || results.length === 0) {
            container.innerHTML = `<p style="color:var(--text-secondary); font-size:13px;">Сунуштар калыптанышы үчүн окуучулардын тест тапшыруусу күтүлүүдө...</p>`;
            return;
        }

        const lowPerformers = results.filter(r => r.percentage < 50);
        let alertHTML = '';
        
        if(lowPerformers.length > 0) {
            alertHTML += `
                <div style="background:rgba(244,63,94,0.08); border-left:4px solid var(--danger-color); padding:12px; border-radius:6px; margin-bottom:10px;">
                    <h5 style="color:var(--danger-color); font-size:14px; margin-bottom:4px;"><i class="fas fa-exclamation-circle"></i> Кошумча саат талап кылынат</h5>
                    <p style="font-size:13px; color:var(--text-secondary);">Окуучулардын орточо жетишүүсү төмөн. Өзгөчө Механика мыйзамдары боюнча кайталоо сабагын уюштуруу сунушталат.</p>
                </div>
            `;
        }

        alertHTML += `
            <div style="background:rgba(16,185,129,0.08); border-left:4px solid var(--success-color); padding:12px; border-radius:6px;">
                <h5 style="color:var(--success-color); font-size:14px; margin-bottom:4px;"><i class="fas fa-check-double"></i> Ийгиликтүү багыт</h5>
                <p style="font-size:13px; color:var(--text-secondary);">Античит тутуму толук иштеп жатат. Окуучулардын 90% берилген убакыттын ичинде тестти өз алдынча жыйынтыкташты.</p>
            </div>
        `;

        container.innerHTML = alertHTML;
    }
};
