import { checkAuth } from "./auth-guard.js";
import { safeFirebaseGet, safeFirebaseRemove, safeFirebaseSet, buildTeacherPath, ref, db, onValue, safeJsonParse, safeLocalStorageGet } from "./firebase-config.js";
import { Toast } from "./toast.js";
import { TeacherActivityLogger } from "./teacher-activity.js";
import { StorageFallback } from "./storage-fallback.js";

let currentTeacherId = null;
const Dashboard = {
    init() {
        checkAuth((user) => {
            currentTeacherId = user.uid;
            this.bindEvents();
            this.loadDashboardData();
        });
    },
    bindEvents() {
        document.getElementById("btnCreateNewTest")?.addEventListener("click", () => {
            window.location.href = "/sections/test-builder.html";
        });
        document.getElementById("btnCheckResults")?.addEventListener("click", () => {
            const tabBtn = document.querySelector('[data-tab="results"]');
            if (tabBtn) tabBtn.click();
        });
        document.getElementById("filterSubject")?.addEventListener("change", () => this.renderTestsTable());
        document.getElementById("filterStatus")?.addEventListener("change", () => this.renderTestsTable());
        document.getElementById("globalSearch")?.addEventListener("input", (e) => this.searchTests(e.target.value));
        
        // Setup Modal Closures
        window.addEventListener("keydown", (e) => {
            if (e.key === "Escape") document.getElementById("globalModalContainer").style.display = "none";
        });
        document.getElementById("globalModalContainer")?.addEventListener("click", (e) => {
            if (e.target.id === "globalModalContainer") e.target.style.display = "none";
        });
    },
    async loadDashboardData() {
        if (!currentTeacherId) return;
        const path = `tests/${currentTeacherId}`;
        
        if (navigator.onLine) {
            onValue(ref(db, path), (snapshot) => {
                const data = snapshot.val() || {};
                this.cachedTests = data;
                this.renderTestsTable();
                this.updateStatsCard(data);
            }, (err) => {
                Toast.danger("Маалымат угуу үзгүлтүккө учурады. Offline режим иштеп жатат.");
                this.loadFromFallback();
            });
        } else {
            this.loadFromFallback();
        }
    },
    loadFromFallback() {
        this.cachedTests = StorageFallback.getFallbackTests();
        this.renderTestsTable();
        this.updateStatsCard(this.cachedTests);
    },
    updateStatsCard(tests) {
        const total = Object.keys(tests).length;
        document.getElementById("statTotalTests").innerText = total;
        let activeCount = 0;
        Object.values(tests).forEach(t => { if (t.status === "active") activeCount++; });
        document.getElementById("statActiveStudents").innerText = activeCount * 4; // Mock live scaling tracker safely
    },
    renderTestsTable() {
        const tbody = document.getElementById("testsTableBody");
        if (!tbody) return;
        tbody.innerHTML = "";
        
        const subFilter = document.getElementById("filterSubject")?.value || "all";
        const statFilter = document.getElementById("filterStatus")?.value || "all";
        
        const testsArr = Object.entries(this.cachedTests || {});
        if (testsArr.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="empty-state-text">Тесттер табылган жок. Жаңы тест түзүңүз!</td></tr>`;
            return;
        }

        testsArr.forEach(([id, test]) => {
            if (subFilter !== "all" && test.subject !== subFilter) return;
            if (statFilter !== "all" && test.status !== statFilter) return;

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><strong>${test.title || "Аталышсыз"}</strong></td>
                <td>${test.subject || "Жок"} / ${test.grade || "Бардыгы"}</td>
                <td>${test.questions ? Object.keys(test.questions).length : 0} суроо</td>
                <td>${test.timeLimit || 40} мүнөт</td>
                <td><span class="badge-${test.status === 'active' ? 'success' : 'warning'}">${test.status}</span></td>
                <td>
                    <button class="btn-action edit" data-id="${id}" title="Оңдоо"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn-action duplicate" data-id="${id}" title="Көчүрүү"><i class="fa-solid fa-copy"></i></button>
                    <button class="btn-action status-toggle" data-id="${id}" title="Статус алмаштыруу"><i class="fa-solid fa-eye-slash"></i></button>
                    <button class="btn-action delete" data-id="${id}" title="Өчүрүү"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        this.bindTableActionButtons();
    },
    bindTableActionButtons() {
        document.querySelectorAll(".btn-action.edit").forEach(b => {
            b.addEventListener("click", (e) => {
                const id = e.currentTarget.getAttribute("data-id");
                window.location.href = `/sections/test-builder.html?edit=${id}`;
            });
        });
        document.querySelectorAll(".btn-action.duplicate").forEach(b => {
            b.addEventListener("click", async (e) => {
                const id = e.currentTarget.getAttribute("data-id");
                const source = this.cachedTests[id];
                if (source) {
                    const cloned = { ...source, title: source.title + " (Көчүрмө)", createdAt: Date.now() };
                    const newId = "test_" + Date.now();
                    if (navigator.onLine) {
                        await safeFirebaseSet(`tests/${currentTeacherId}/${newId}`, cloned);
                    } else {
                        StorageFallback.saveFallbackTest(newId, cloned);
                    }
                    Toast.success("Тест ийгиликтүү көчүрүлдү!");
                    TeacherActivityLogger.log("test_duplicate", { testId: id, clonedTo: newId });
                    this.loadDashboardData();
                }
            });
        });
        document.querySelectorAll(".btn-action.status-toggle").forEach(b => {
            b.addEventListener("click", async (e) => {
                const id = e.currentTarget.getAttribute("data-id");
                const test = this.cachedTests[id];
                if (test) {
                    const nextStatus = test.status === "active" ? "draft" : "active";
                    if (navigator.onLine) {
                        await safeFirebaseSet(`tests/${currentTeacherId}/${id}/status`, nextStatus);
                    } else {
                        test.status = nextStatus; StorageFallback.saveFallbackTest(id, test);
                    }
                    Toast.success(`Тесттин статусу өзгөрдү: ${nextStatus}`);
                    this.loadDashboardData();
                }
            });
        });
        document.querySelectorAll(".btn-action.delete").forEach(b => {
            b.addEventListener("click", (e) => {
                const id = e.currentTarget.getAttribute("data-id");
                this.showDeleteConfirmModal(id);
            });
        });
    },
    showDeleteConfirmModal(id) {
        const modal = document.getElementById("globalModalContainer");
        const body = document.getElementById("globalModalBody");
        document.getElementById("globalModalTitle").innerText = "Тестти өчүрүү ырастоосу";
        
        body.innerHTML = `
            <p>Бул тестти өчүрүүнү каалайсызбы? Бул аракетти артка кайтаруу мүмкүн эмес.</p>
            <div class="modal-footer-btns" style="margin-top:20px; text-align:right;">
                <button id="modalCancelDelete" class="btn-secondary-glow" style="margin-right:10px;">Жок</button>
                <button id="modalConfirmDelete" class="btn-primary-glow" style="background:var(--neon-red);">Ооба, Өчүр</button>
            </div>
        `;
        modal.style.display = "flex";
        
        document.getElementById("modalCancelDelete").addEventListener("click", () => { modal.style.display = "none"; });
        document.getElementById("modalConfirmDelete").addEventListener("click", async () => {
            if (navigator.onLine) {
                await safeFirebaseRemove(`tests/${currentTeacherId}/${id}`);
            } else {
                StorageFallback.deleteFallbackTest(id);
            }
            modal.style.display = "none";
            Toast.success("Тест өчүрүлдү.");
            TeacherActivityLogger.log("test_delete", { testId: id });
            this.loadDashboardData();
        });
    },
    searchTests(query) {
        const q = query.toLowerCase();
        const rows = document.querySelectorAll("#testsTableBody tr");
        rows.forEach(r => {
            if (r.cells.length < 2) return;
            const match = r.cells[0].innerText.toLowerCase().includes(q) || r.cells[1].innerText.toLowerCase().includes(q);
            r.style.display = match ? "" : "none";
        });
    }
};

document.addEventListener("DOMContentLoaded", () => Dashboard.init());
export { Dashboard };
