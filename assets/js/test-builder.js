import { checkAuth } from "./auth-guard.js";
import { safeFirebaseSet, safeFirebaseGet } from "./firebase-config.js";
import { Toast } from "./toast.js";
import { TeacherActivityLogger } from "./teacher-activity.js";
import { StorageFallback } from "./storage-fallback.js";

let currentUid = null;
let editingTestId = null;
let currentQuestions = [];

const TestBuilder = {
    init() {
        checkAuth((user) => {
            currentUid = user.uid;
            this.detectEditMode();
            this.bindEvents();
            this.renderQuestions();
        });
    },
    detectEditMode() {
        const params = new URLSearchParams(window.location.search);
        if (params.has("edit")) {
            editingTestId = params.get("edit");
            this.loadExistingTest(editingTestId);
        } else {
            editingTestId = "test_" + Date.now();
        }
    },
    async loadExistingTest(id) {
        let test = null;
        if (navigator.onLine) {
            test = await safeFirebaseGet(`tests/${currentUid}/${id}`);
        } else {
            test = StorageFallback.getFallbackTests()[id];
        }
        if (test) {
            document.getElementById("builderTestTitle").value = test.title || "";
            document.getElementById("builderTestSubject").value = test.subject || "";
            document.getElementById("builderTestGrades").value = test.grade || "";
            document.getElementById("builderTimeLimit").value = test.timeLimit || 40;
            document.getElementById("builderAttemptLimit").value = test.attempts || 1;
            
            if (test.antiCheat) {
                document.getElementById("acFullscreen").checked = !!test.antiCheat.fullscreen;
                document.getElementById("acTabSwitch").checked = !!test.antiCheat.tabSwitch;
                document.getElementById("acBlockTab").checked = !!test.antiCheat.blockTab;
                document.getElementById("acNoCopyPaste").checked = !!test.antiCheat.noCopy;
                document.getElementById("acNoRightClick").checked = !!test.antiCheat.noRightClick;
            }
            currentQuestions = test.questions ? Object.values(test.questions) : [];
            this.renderQuestions();
        }
    },
    bindEvents() {
        document.getElementById("testConfigForm")?.addEventListener("submit", (e) => {
            e.preventDefault();
            this.saveTestProcess("active");
        });
        document.getElementById("btnSaveDraft")?.addEventListener("click", () => {
            this.saveTestProcess("draft");
        });
        
        const blockGridButtons = document.querySelectorAll(".block-type-card");
        blockGridButtons.forEach(btn => {
            btn.addEventListener("click", (e) => {
                const type = e.currentTarget.getAttribute("data-type");
                this.addQuestionBlock(type);
                document.getElementById("blockSelectorModal").style.display = "none";
            });
        });

        // Trigger global block selector opening safely
        window.uiComponents = {
            openBlockSelector: (target) => {
                document.getElementById("blockSelectorModal").style.display = "flex";
            },
            closeModal: () => {
                document.getElementById("globalModalContainer").style.display = "none";
            }
        };

        window.addEventListener("keydown", (e) => {
            if (e.key === "Escape") document.getElementById("blockSelectorModal").style.display = "none";
        });
    },
    addQuestionBlock(type) {
        const block = {
            id: "q_" + Date.now() + Math.random().toString(36).substr(2, 5),
            type: type,
            text: "",
            options: type === "question" ? ["", ""] : [],
            correctAnswers: [],
            points: 1
        };
        currentQuestions.push(block);
        this.renderQuestions();
        Toast.info("Жаңы суроо топтому кошулду.");
    },
    renderQuestions() {
        const c = document.getElementById("builderBlocksContainer");
        if (!c) return;
        c.innerHTML = "";

        if (currentQuestions.length === 0) {
            c.innerHTML = `<div class="empty-state-text" style="padding:40px; border:2px dashed rgba(255,255,255,0.1); border-radius:12px;">Конструктор бош. Төмөнкү баскычтан блок кошуңуз.</div>`;
            return;
        }

        currentQuestions.forEach((q, idx) => {
            const div = document.createElement("div");
            div.className = "question-editor-card data-glass-panel";
            div.style.position = "relative";
            div.style.marginBottom = "20px";
            div.style.padding = "20px";
            div.style.borderLeft = "4px solid var(--neon-cyan)";

            div.innerHTML = `
                <div class="card-controls" style="position:absolute; right:15px; top:15px;">
                    <button class="btn-action move-up" data-idx="${idx}"><i class="fa-solid fa-arrow-up"></i></button>
                    <button class="btn-action move-down" data-idx="${idx}"><i class="fa-solid fa-arrow-down"></i></button>
                    <button class="btn-action del-q" data-idx="${idx}"><i class="fa-solid fa-trash" style="color:var(--neon-red);"></i></button>
                </div>
                <h4>#${idx + 1} Блок: ${q.type.toUpperCase()}</h4>
                <div class="form-group-glass" style="margin-top:10px;">
                    <label>Суроо тексти же мазмундун сыпаттамасы *</label>
                    <textarea class="q-text-input" data-idx="${idx}" required style="width:100%; min-height:60px; background:rgba(0,0,0,0.3); color:white; border:1px solid rgba(255,255,255,0.2); border-radius:6px; padding:10px;">${q.text || ""}</textarea>
                </div>
                ${this.renderTypeOptions(q, idx)}
            `;
            c.appendChild(div);
        });

        this.bindDynamicBlockFields();
    },
    renderTypeOptions(q, idx) {
        if (q.type !== "question") return "";
        let html = `<div class="options-zone" style="margin-top:15px;"><h5>Жооп варианттары</h5>`;
        const opts = q.options || [];
        opts.forEach((o, oIdx) => {
            html += `
                <div style="display:flex; align-items:center; margin-bottom:8px;">
                    <input type="checkbox" class="q-correct-check" data-qidx="${idx}" data-oidx="${oIdx}" ${q.correctAnswers.includes(oIdx) ? 'checked' : ''} style="margin-right:10px;">
                    <input type="text" class="q-opt-txt" data-qidx="${idx}" data-oidx="${oIdx}" value="${o}" placeholder="Вариант ${oIdx + 1}" required style="flex:1; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); color:white; padding:6px; border-radius:4px;">
                </div>
            `;
        });
        html += `<button type="button" class="btn-secondary-glow btn-sm add-opt-btn" data-idx="${idx}" style="padding:4px 10px; font-size:12px; margin-top:5px;"><i class="fa-solid fa-plus"></i> Вариант кош</button></div>`;
        return html;
    },
    bindDynamicBlockFields() {
        document.querySelectorAll(".q-text-input").forEach(el => {
            el.addEventListener("input", (e) => {
                const idx = e.target.getAttribute("data-idx");
                currentQuestions[idx].text = e.target.value;
            });
        });
        document.querySelectorAll(".q-opt-txt").forEach(el => {
            el.addEventListener("input", (e) => {
                const qidx = e.target.getAttribute("data-qidx");
                const oidx = e.target.getAttribute("data-oidx");
                currentQuestions[qidx].options[oidx] = e.target.value;
            });
        });
        document.querySelectorAll(".q-correct-check").forEach(el => {
            el.addEventListener("change", (e) => {
                const qidx = parseInt(e.target.getAttribute("data-qidx"));
                const oidx = parseInt(e.target.getAttribute("data-oidx"));
                let arr = currentQuestions[qidx].correctAnswers || [];
                if (e.target.checked) {
                    if (!arr.includes(oidx)) arr.push(oidx);
                } else {
                    arr = arr.filter(v => v !== oidx);
                }
                currentQuestions[qidx].correctAnswers = arr;
            });
        });
        document.querySelectorAll(".add-opt-btn").forEach(el => {
            el.addEventListener("click", (e) => {
                const idx = e.currentTarget.getAttribute("data-idx");
                currentQuestions[idx].options.push("");
                this.renderQuestions();
            });
        });
        document.querySelectorAll(".btn-action.del-q").forEach(el => {
            el.addEventListener("click", (e) => {
                const idx = e.currentTarget.getAttribute("data-idx");
                currentQuestions.splice(idx, 1);
                this.renderQuestions();
            });
        });
        document.querySelectorAll(".btn-action.move-up").forEach(el => {
            el.addEventListener("click", (e) => {
                const idx = parseInt(e.currentTarget.getAttribute("data-idx"));
                if (idx > 0) {
                    const temp = currentQuestions[idx];
                    currentQuestions[idx] = currentQuestions[idx - 1];
                    currentQuestions[idx - 1] = temp;
                    this.renderQuestions();
                }
            });
        });
        document.querySelectorAll(".btn-action.move-down").forEach(el => {
            el.addEventListener("click", (e) => {
                const idx = parseInt(e.currentTarget.getAttribute("data-idx"));
                if (idx < currentQuestions.length - 1) {
                    const temp = currentQuestions[idx];
                    currentQuestions[idx] = currentQuestions[idx + 1];
                    currentQuestions[idx + 1] = temp;
                    this.renderQuestions();
                }
            });
        });
    },
    async saveTestProcess(status) {
        const title = document.getElementById("builderTestTitle").value.trim();
        const subject = document.getElementById("builderTestSubject").value.trim();
        const grade = document.getElementById("builderTestGrades").value.trim();
        
        if (!title || !subject) {
            Toast.warning("Тесттин аталышы жана предмети толтурулушу керек.");
            return;
        }
        if (currentQuestions.length === 0) {
            Toast.warning("Бош тестти сактоого мүмкүн эмес. Суроолорду кошуңуз.");
            return;
        }

        // Validate individual blocks
        for (let i = 0; i < currentQuestions.length; i++) {
            if (!currentQuestions[i].text.trim()) {
                Toast.warning(`#${i + 1} Блоктун тексти бош калтырылган.`);
                return;
            }
        }

        const testPayload = {
            id: editingTestId,
            title, subject, grade,
            timeLimit: parseInt(document.getElementById("builderTimeLimit").value) || 40,
            attempts: parseInt(document.getElementById("builderAttemptLimit").value) || 1,
            status: status,
            createdAt: Date.now(),
            antiCheat: {
                fullscreen: document.getElementById("acFullscreen").checked,
                tabSwitch: document.getElementById("acTabSwitch").checked,
                blockTab: document.getElementById("acBlockTab").checked,
                noCopy: document.getElementById("acNoCopyPaste").checked,
                noRightClick: document.getElementById("acNoRightClick").checked
            },
            questions: { ...currentQuestions }
        };

        let success = false;
        if (navigator.onLine) {
            success = await safeFirebaseSet(`tests/${currentUid}/${editingTestId}`, testPayload);
        } else {
            success = StorageFallback.saveFallbackTest(editingTestId, testPayload);
        }

        if (success) {
            Toast.success("Тест ийгиликтүү базага сакталды!");
            TeacherActivityLogger.log("test_save", { testId: editingTestId, status });
            setTimeout(() => { window.location.href = "/sections/tests.html"; }, 1000);
        } else {
            Toast.danger("Сактоо үзгүлтүккө учурады.");
        }
    }
};

document.addEventListener("DOMContentLoaded", () => TestBuilder.init());
export { TestBuilder };
