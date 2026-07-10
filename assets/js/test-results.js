import { checkAuth } from "./auth-guard.js";
import { safeFirebaseGet, safeFirebaseSet, db, ref, onValue } from "./firebase-config.js";
import { Toast } from "./toast.js";
import { TeacherActivityLogger } from "./teacher-activity.js";

let currentUid = null;
const TestResults = {
    init() {
        checkAuth((user) => {
            currentUid = user.uid;
            this.bindEvents();
            this.loadResultsStructure();
        });
    },
    bindEvents() {
        document.getElementById("resFilterClass")?.addEventListener("change", () => this.filterResultsDisplay());
        document.getElementById("resFilterSubject")?.addEventListener("change", () => this.filterResultsDisplay());
        document.getElementById("resFilterTest")?.addEventListener("change", () => this.filterResultsDisplay());
        document.getElementById("btnDownloadReports")?.addEventListener("click", () => {
            if (typeof window.AnnualReportExporter !== "undefined") {
                window.AnnualReportExporter.exportToCSV(this.cachedResults || {});
            } else {
                Toast.warning("Экспорттук модуль табылган жок.");
            }
        });
    },
    loadResultsStructure() {
        if (!currentUid) return;
        const path = `testResults/${currentUid}`;
        if (navigator.onLine) {
            onValue(ref(db, path), (snapshot) => {
                this.cachedResults = snapshot.val() || {};
                this.buildFilterDropdowns();
                this.renderResultsTables();
            });
        } else {
            Toast.warning("Оффлайн режимде жыйынтыктарды жүктөө мүмкүн эмес.");
        }
    },
    buildFilterDropdowns() {
        const classSelect = document.getElementById("resFilterClass");
        const testSelect = document.getElementById("resFilterTest");
        if (!classSelect) return;

        const classes = new Set();
        const tests = new Set();

        Object.entries(this.cachedResults).forEach(([testId, studentsMap]) => {
            tests.add(testId);
            Object.values(studentsMap).forEach(res => {
                if (res.studentClass) classes.add(res.studentClass);
            });
        });

        classSelect.innerHTML = '<option value="all">Бардык класстар</option>';
        classes.forEach(c => { classSelect.innerHTML += `<option value="${c}">${c}</option>`; });

        testSelect.innerHTML = '<option value="all">Бардык тесттер</option>';
        tests.forEach(t => { testSelect.innerHTML += `<option value="${t}">${t}</option>`; });
    },
    renderResultsTables() {
        const container = document.getElementById("classesResultsContainer");
        if (!container) return;
        container.innerHTML = "";

        const classFilter = document.getElementById("resFilterClass")?.value || "all";
        const testFilter = document.getElementById("resFilterTest")?.value || "all";

        // Aggregate by classes safely
        const recordsByClass = {};

        Object.entries(this.cachedResults).forEach(([testId, studentsMap]) => {
            if (testFilter !== "all" && testId !== testFilter) return;
            Object.entries(studentsMap).forEach(([studentId, r]) => {
                const sClass = r.studentClass || "Аныкталбаган";
                if (classFilter !== "all" && sClass !== classFilter) return;
                
                if (!recordsByClass[sClass]) recordsByClass[sClass] = [];
                recordsByClass[sClass].push({ testId, studentId, ...r });
            });
        });

        if (Object.keys(recordsByClass).length === 0) {
            container.innerHTML = `<div class="data-glass-panel empty-state-text">Жыйынтыктар катталган жок.</div>`;
            return;
        }

        Object.entries(recordsByClass).forEach(([className, list]) => {
            // Alphabetical Sorting by Student Name
            list.sort((a, b) => (a.studentName || "").localeCompare(b.studentName || ""));

            const div = document.createElement("div");
            div.className = "data-glass-panel";
            div.style.marginBottom = "25px";
            div.innerHTML = `
                <h3>Класс Таблицасы: ${className}</h3>
                <div class="responsive-table-wrapper">
                    <table class="futuristic-table">
                        <thead>
                            <tr>
                                <th>Окуучунун аты-жөнү</th>
                                <th>Упай / Пайыз</th>
                                <th>Баа</th>
                                <th>Античит эскертүүлөрү</th>
                                <th>Статус</th>
                                <th>Аракеттер</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${list.map(item => `
                                <tr>
                                    <td><strong>${item.studentName || "Аноним"}</strong></td>
                                    <td>${item.score || 0} (${item.percent || 0}%)</td>
                                    <td><span class="badge-success">${item.gradeMark || "Жок"}</span></td>
                                    <td class="${item.antiCheatAlerts > 0 ? 'text-danger' : ''}">${item.antiCheatAlerts || 0} жолу</td>
                                    <td><span class="badge-warning">${item.status || "күтүүдө"}</span></td>
                                    <td>
                                        <button class="btn-primary-glow btn-sm view-submission" data-testid="${item.testId}" data-studentid="${item.studentId}">Кароо</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
            container.appendChild(div);
        });

        this.bindTableReviewButtons();
    },
    bindTableReviewButtons() {
        document.querySelectorAll(".view-submission").forEach(b => {
            b.addEventListener("click", (e) => {
                const tId = e.target.getAttribute("data-testid");
                const sId = e.target.getAttribute("data-studentid");
                this.openReviewModal(tId, sId);
            });
        });
    },
    openReviewModal(testId, studentId) {
        const modal = document.getElementById("globalModalContainer");
        const body = document.getElementById("globalModalBody");
        document.getElementById("globalModalTitle").innerText = "Окуучунун жоопторун карап чыгуу";
        
        const record = this.cachedResults[testId]?.[studentId];
        if (!record) return;

        body.innerHTML = `
            <div style="max-height:400px; overflow-y:auto; color:white;">
                <p><strong>Окуучу:</strong> ${record.studentName}</p>
                <p><strong>Упай баалоо шкаласы боюнча:</strong> ${record.score}</p>
                <div class="form-group-glass" style="margin-top:15px;">
                    <label>Мугалимдин чечими / Комментарий</label>
                    <textarea id="reviewComment" style="width:100%; min-height:60px; background:rgba(0,0,0,0.5); color:white; border-radius:6px; padding:8px;">${record.comment || ""}</textarea>
                </div>
                <div class="form-group-glass" style="margin-top:10px;">
                    <label>Статусту жаңыртуу</label>
                    <select id="reviewStatus" style="width:100%; padding:8px; background:#111; color:white; border-radius:6px;">
                        <option value="текшерилди" ${record.status === 'текшерилди' ? 'selected' : ''}>Текшерилди</option>
                        <option value="кайра текшерүү керек" ${record.status === 'кайра текшерүү керек' ? 'selected' : ''}>Кайра текшерүү керек</option>
                        <option value="күтүүдө" ${record.status === 'күтүүдө' ? 'selected' : ''}>Күтүүдө</option>
                    </select>
                </div>
            </div>
            <div class="modal-footer" style="text-align:right; margin-top:20px;">
                <button id="btnCancelReview" class="btn-secondary-glow" style="margin-right:10px;">Жабуу</button>
                <button id="btnSaveReview" class="btn-primary-glow">Сактоо</button>
            </div>
        `;

        modal.style.display = "flex";
        document.getElementById("btnCancelReview").addEventListener("click", () => { modal.style.display = "none"; });
        document.getElementById("btnSaveReview").addEventListener("click", async () => {
            const comment = document.getElementById("reviewComment").value;
            const status = document.getElementById("reviewStatus").value;
            
            if (navigator.onLine) {
                await safeFirebaseSet(`testResults/${currentUid}/${testId}/${studentId}/comment`, comment);
                await safeFirebaseSet(`testResults/${currentUid}/${testId}/${studentId}/status`, status);
                Toast.success("Өзгөртүүлөр сакталды.");
                TeacherActivityLogger.log("result_review", { testId, studentId, status });
            } else {
                Toast.warning("Оффлайн режимде жыйынтык баалоо жеткиликсиз.");
            }
            modal.style.display = "none";
            this.loadResultsStructure();
        });
    },
    filterResultsDisplay() {
        this.renderResultsTables();
    }
};

document.addEventListener("DOMContentLoaded", () => TestResults.init());
export { TestResults };
