/**
 * BilimAl Educational Platform - Student Testing Engine
 * Security Level: Production Grade Architecture
 * Standard: Event-Driven Vanilla JavaScript
 */

(function () {
    "use strict";

    // Firebase Инициализациясы (Compat варианты)
    const firebaseConfig = {
        apiKey: "AIzaSyAsRjj_5VoQwZA7hSBWhkQ58UvUnct-b28",
        authDomain: "bilimal-org.firebaseapp.com",
        databaseURL: "https://bilimal-org-default-rtdb.europe-west1.firebasedatabase.app",
        projectId: "bilimal-org",
        storageBucket: "bilimal-org.firebasestorage.app",
        messagingSenderId: "241750360816",
        appId: "1:241750360816:web:a991434eb5afbc470d7835",
        measurementId: "G-9GSQV60QV0"
    };

    if (typeof firebase !== "undefined" && (!firebase.apps || !firebase.apps.length)) {
        firebase.initializeApp(firebaseConfig);
    }

    const database = (typeof firebase !== "undefined") ? firebase.database() : null;

    // Глобалдык жумушчу абалынын өзгөрмөлөрү
    let evaluationActiveTestId = null;
    let activeTeacherUid = null;
    let currentLoadedTestStructure = null;
    let compiledStudentAnswersBuffer = {};
    let trackingActiveQuestionIndex = 0;
    let computedTimeRemainingSeconds = 0;
    let securityViolationCounters = 0;
    let localTimerIntervalReference = null;

    let metaStudentName = "";
    let metaStudentClass = "";

    /**
     * XSS чабуулдарынан коргоо үчүн тексттерди коопсуз формага келтирүү
     */
    function escapeHTML(str) {
        if (str === null || str === undefined) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    /**
     * Тармактык асылууларды (Infinite Loading) алдын алуучу Таймаут-контейнер
     */
    function fetchWithTimeout(promise, ms = 10000) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error("Серверден жооп алуу убактысы аяктады. Интернет байланышыңызды текшерип, кайра аракет кылыңыз."));
            }, ms);

            promise.then(
                (res) => {
                    clearTimeout(timer);
                    resolve(res);
                },
                (err) => {
                    clearTimeout(timer);
                    reject(err);
                }
            );
        });
    }

    document.addEventListener("DOMContentLoaded", function () {
        toggleElementVisibility("studentAuthBlock", true);
        toggleElementVisibility("studentTestingBlock", false);
        toggleElementVisibility("studentResultsBlock", false);

        if (!database) {
            renderFatalErrorWorkspaceState("Firebase SDK жүктөлгөн жок. Баракчаны кайра жүктөңүз же HTML китепканаларын текшериңиз.");
            return;
        }

        extractTestContextParametersFromUrl();
    });

    function extractTestContextParametersFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        evaluationActiveTestId = urlParams.get("test");
        activeTeacherUid = urlParams.get("teacher");

        if (!evaluationActiveTestId) {
            renderFatalErrorWorkspaceState("Тесттин уникалдуу идентификатору шилтемеде табылбады. Шилтеменин тууралыгын текшериңиз (URL ичинде ?test= ID болушу керек).");
            return;
        }

        fetchTestPayloadFromDatabase();
    }

    function fetchTestPayloadFromDatabase() {
        if (!activeTeacherUid) {
            const lookupPromise = database.ref(`global_test_lookup/${evaluationActiveTestId}`).once('value');
            fetchWithTimeout(lookupPromise, 10000)
                .then(function (lookupSnap) {
                    if (lookupSnap.exists()) {
                        activeTeacherUid = lookupSnap.val().teacherUid;
                    }
                    loadMainTestData();
                })
                .catch(function (err) {
                    renderFatalErrorWorkspaceState("Маалымат алууда ката же интернет байланышы начар: " + err.message);
                });
        } else {
            loadMainTestData();
        }
    }

    function loadMainTestData() {
        if (!activeTeacherUid) activeTeacherUid = "demo_teacher_001";

        const testDataPromise = database.ref(`teachers_data/${activeTeacherUid}/tests/${evaluationActiveTestId}`).once('value');

        fetchWithTimeout(testDataPromise, 10000)
            .then(function (testSnap) {
                if (!testSnap.exists()) {
                    renderFatalErrorWorkspaceState("Суралган тест базадан табылган жок же өчүрүлгөн.");
                    return;
                }

                currentLoadedTestStructure = testSnap.val();

                if (currentLoadedTestStructure.questions) {
                    if (!Array.isArray(currentLoadedTestStructure.questions)) {
                        currentLoadedTestStructure.questions = Object.keys(currentLoadedTestStructure.questions).map(function (k) {
                            return currentLoadedTestStructure.questions[k];
                        });
                    }
                } else {
                    currentLoadedTestStructure.questions = [];
                }

                renderGateAuthScreenMetaInfo();
                registerStudentRegistrationFormHandler();
                initializeAntiCheatSecurityGuards();
            })
            .catch(function (err) {
                renderFatalErrorWorkspaceState("База менен байланышуу катасы: " + err.message);
            });
    }

    function renderGateAuthScreenMetaInfo() {
        safeUpdateInnerText("gateTestTitle", currentLoadedTestStructure.title || "Тестке кирүү");

        const metaNode = document.getElementById("gateTestMeta");
        if (metaNode) {
            metaNode.innerHTML = `Сабак: <strong>${escapeHTML(currentLoadedTestStructure.subject || 'Жалпы')}</strong> | Класс: <strong>${escapeHTML(currentLoadedTestStructure.classGroup || 'Бардыгы')}</strong>`;
        }

        if (currentLoadedTestStructure.pinCode) {
            toggleElementVisibility("gatePinWrapper", true);
        } else {
            toggleElementVisibility("gatePinWrapper", false);
        }
    }

    function registerStudentRegistrationFormHandler() {
        const form = document.getElementById("studentRegistrationForm");
        if (!form) return;

        form.onsubmit = function (e) {
            e.preventDefault();

            metaStudentName = getInputValue("studentInputName").trim();
            metaStudentClass = getInputValue("studentInputClass").trim();

            if (!metaStudentName || !metaStudentClass) {
                showStudentToastMessage("Сураныч, аты-жөнүңүздү жана классыңызды толук киргизиңиз!", "warning");
                return;
            }

            if (currentLoadedTestStructure.pinCode) {
                const enteredPin = getInputValue("studentInputPin").trim();
                if (enteredPin !== String(currentLoadedTestStructure.pinCode).trim()) {
                    showStudentToastMessage("Тестке кирүү үчүн туура эмес PIN-код жаздыңыз!", "error");
                    return;
                }
            }

            transitionWorkspaceToActiveTestMode();
        };
    }

    function getInputValue(id) {
        const el = document.getElementById(id);
        return el ? el.value : "";
    }

    function transitionWorkspaceToActiveTestMode() {
        toggleElementVisibility("studentAuthBlock", false);
        toggleElementVisibility("studentTestingBlock", true);
        toggleElementVisibility("studentResultsBlock", false);

        safeUpdateInnerText("runtimeStudentInfo", `Окуучу: ${metaStudentName} (${metaStudentClass})`);
        safeUpdateInnerText("runtimeTestTitle", currentLoadedTestStructure.title || "Тест");

        if (currentLoadedTestStructure.security && currentLoadedTestStructure.security.fullscreen) {
            requestFullscreenWindowViewportMode();
        }

        const durationMin = parseInt(currentLoadedTestStructure.duration || currentLoadedTestStructure.timeLimit || 45, 10);
        computedTimeRemainingSeconds = durationMin * 60;
        startTestingSessionCountdownTimer();

        generateQuestionsMatrixHUDNodes();
        displayTargetQuestionContentPane();
        registerWorkspaceNavigationControls();
    }

    function startTestingSessionCountdownTimer() {
        const displayNode = document.getElementById("runtimeCountdown");
        if (!displayNode) return;

        if (localTimerIntervalReference) clearInterval(localTimerIntervalReference);

        localTimerIntervalReference = setInterval(function () {
            if (computedTimeRemainingSeconds <= 0) {
                clearInterval(localTimerIntervalReference);
                processAutomatedTestSubmissionWorkflow();
                showStudentToastMessage("Убакыт аяктады! Тест автоматтык түрдө тапшырылды.", "warning");
                return;
            }

            computedTimeRemainingSeconds--;
            const mins = Math.floor(computedTimeRemainingSeconds / 60);
            const secs = computedTimeRemainingSeconds % 60;
            displayNode.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

            if (computedTimeRemainingSeconds < 60) {
                const hud = document.getElementById("hudTimerWidget");
                if (hud) hud.style.borderColor = "#ff1744";
            }
        }, 1000);
    }

    function generateQuestionsMatrixHUDNodes() {
        const container = document.getElementById("studentQuestionsMatrix");
        if (!container) return;
        container.innerHTML = "";

        currentLoadedTestStructure.questions.forEach(function (q, idx) {
            const node = document.createElement("button");
            node.type = "button";
            node.className = `matrix-node n-idx-${idx}`;
            node.innerText = idx + 1;

            if (compiledStudentAnswersBuffer[idx] !== undefined) {
                node.classList.add("answered");
            }

            node.onclick = function () {
                trackingActiveQuestionIndex = idx;
                displayTargetQuestionContentPane();
            };

            container.appendChild(node);
        });
    }

    function displayTargetQuestionContentPane() {
        if (!currentLoadedTestStructure || !currentLoadedTestStructure.questions[trackingActiveQuestionIndex]) return;
        const qData = currentLoadedTestStructure.questions[trackingActiveQuestionIndex];

        document.querySelectorAll(".matrix-node").forEach(function (n, idx) {
            n.classList.remove("active");
            if (idx === trackingActiveQuestionIndex) n.classList.add("active");
        });

        safeUpdateInnerText("currentQuestionNumberLabel", `Суроо #${trackingActiveQuestionIndex + 1}`);
        safeUpdateInnerText("currentQuestionPointsLabel", `${qData.points || 5} балл`);

        const textContainer = document.getElementById("currentQuestionTextContainer");
        if (textContainer) {
            textContainer.innerText = qData.text || qData.question || qData.title || "";
        }

        const optionsContainer = document.getElementById("questionOptionsContainer");
        if (!optionsContainer) return;
        optionsContainer.innerHTML = "";

        const qType = (qData.type || 'single').toLowerCase();
        const opts = qData.options || qData.answers || [];

        if (qType === 'text' || qType === 'short' || opts.length === 0) {
            const currentAnswerText = compiledStudentAnswersBuffer[trackingActiveQuestionIndex] || "";
            const textarea = document.createElement("textarea");
            textarea.className = "student-open-input";
            textarea.placeholder = "Жообуңузду ушул жерге жазыңыз...";
            textarea.value = currentAnswerText;
            textarea.style.cssText = "width:100%; min-height:100px; padding:12px; border-radius:8px; background:rgba(255,255,255,0.05); color:#fff; border:1px solid rgba(255,255,255,0.2); font-size:15px; outline:none; resize:vertical;";

            textarea.oninput = function () {
                const val = textarea.value.trim();
                if (val.length > 0) {
                    compiledStudentAnswersBuffer[trackingActiveQuestionIndex] = val;
                } else {
                    delete compiledStudentAnswersBuffer[trackingActiveQuestionIndex];
                }

                const matrixNode = document.querySelector(`.matrix-node.n-idx-${trackingActiveQuestionIndex}`);
                if (matrixNode) {
                    if (val.length > 0) matrixNode.classList.add("answered");
                    else matrixNode.classList.remove("answered");
                }
            };

            optionsContainer.appendChild(textarea);
        } else {
            opts.forEach(function (opt, oIdx) {
                const currentSavedAnswer = compiledStudentAnswersBuffer[trackingActiveQuestionIndex];
                let isSelected = false;

                if (qType === 'multiple') {
                    isSelected = Array.isArray(currentSavedAnswer) && currentSavedAnswer.map(Number).includes(oIdx);
                } else {
                    isSelected = currentSavedAnswer !== undefined && Number(currentSavedAnswer) === oIdx;
                }

                const optionRow = document.createElement("div");
                optionRow.className = `option-variant-row ${isSelected ? 'selected' : ''}`;
                optionRow.style.cssText = `padding:12px; margin-bottom:8px; border:1px solid ${isSelected ? '#00f2fe' : 'rgba(255,255,255,0.15)'}; border-radius:8px; cursor:pointer; display:flex; align-items:center; gap:12px; background:${isSelected ? 'rgba(0,242,254,0.1)' : 'rgba(255,255,255,0.03)'}; transition:all 0.2s ease;`;

                optionRow.innerHTML = `
                    <div class="variant-indicator" style="width:20px; height:20px; border:1px solid #00f2fe; border-radius:${qType === 'multiple' ? '4px' : '50%'}; display:flex; align-items:center; justify-content:center; background:${isSelected ? '#00f2fe' : 'transparent'};">
                        ${isSelected ? '<i class="fa-solid fa-check" style="font-size:11px; color:#000;"></i>' : ''}
                    </div>
                    <div class="variant-text-string" style="font-size:15px; color:#fff;">${escapeHTML(opt)}</div>
                `;

                optionRow.onclick = function () {
                    if (qType === 'multiple') {
                        if (!Array.isArray(compiledStudentAnswersBuffer[trackingActiveQuestionIndex])) {
                            compiledStudentAnswersBuffer[trackingActiveQuestionIndex] = [];
                        }
                        const arr = compiledStudentAnswersBuffer[trackingActiveQuestionIndex];
                        const pos = arr.indexOf(oIdx);
                        if (pos > -1) arr.splice(pos, 1);
                        else arr.push(oIdx);

                        if (arr.length === 0) delete compiledStudentAnswersBuffer[trackingActiveQuestionIndex];
                    } else {
                        compiledStudentAnswersBuffer[trackingActiveQuestionIndex] = Number(oIdx);
                    }

                    const matrixNode = document.querySelector(`.matrix-node.n-idx-${trackingActiveQuestionIndex}`);
                    if (matrixNode) matrixNode.classList.add("answered");

                    displayTargetQuestionContentPane();
                };

                optionsContainer.appendChild(optionRow);
            });
        }

        const totalQCount = currentLoadedTestStructure.questions.length;
        const btnPrev = document.getElementById("studentPrevQuestionBtn");
        if (btnPrev) btnPrev.disabled = trackingActiveQuestionIndex === 0;

        toggleElementVisibility("studentNextQuestionBtn", trackingActiveQuestionIndex < totalQCount - 1);
        toggleElementVisibility("studentSubmitTestBtn", trackingActiveQuestionIndex === totalQCount - 1);
    }

    function registerWorkspaceNavigationControls() {
        safeBindClickEvent("studentPrevQuestionBtn", function () {
            if (trackingActiveQuestionIndex > 0) {
                trackingActiveQuestionIndex--;
                displayTargetQuestionContentPane();
            }
        });

        safeBindClickEvent("studentNextQuestionBtn", function () {
            if (trackingActiveQuestionIndex < currentLoadedTestStructure.questions.length - 1) {
                trackingActiveQuestionIndex++;
                displayTargetQuestionContentPane();
            }
        });

        safeBindClickEvent("studentSubmitTestBtn", function () {
            if (confirm("Тестти аяктоону каалайсызбы?")) {
                processAutomatedTestSubmissionWorkflow();
            }
        });
    }

    function processAutomatedTestSubmissionWorkflow() {
        if (localTimerIntervalReference) clearInterval(localTimerIntervalReference);
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(function () {});
        }

        let accumulatedPointsEarned = 0;
        let maximumPointsPossible = 0;
        let totalCorrectAnswersCount = 0;
        let totalIncorrectAnswersCount = 0;
        const responsesDetailedMap = {};

        currentLoadedTestStructure.questions.forEach(function (q, idx) {
            const points = Number(q.points || 5);
            maximumPointsPossible += points;
            const studentAns = compiledStudentAnswersBuffer[idx];
            const opts = q.options || q.answers || [];
            const qType = (q.type || 'single').toLowerCase();

            let isCorrect = false;
            let correctAnswerText = "";

            if (qType === 'multiple') {
                let correctArr = [];
                if (Array.isArray(q.correctOptionIndices)) correctArr = q.correctOptionIndices;
                else if (Array.isArray(q.correctOption)) correctArr = q.correctOption;
                else if (Array.isArray(q.correct)) correctArr = q.correct;
                else if (q.correctOptionIndex !== undefined) correctArr = [q.correctOptionIndex];
                else if (q.correct !== undefined) correctArr = [q.correct];

                const normStudent = (Array.isArray(studentAns) ? studentAns : []).map(Number).sort((a, b) => a - b);
                const normCorrect = correctArr.map(Number).sort((a, b) => a - b);

                if (normStudent.length > 0 && normStudent.length === normCorrect.length && normStudent.every((val, i) => val === normCorrect[i])) {
                    isCorrect = true;
                }
                correctAnswerText = normCorrect.map(i => opts[i] !== undefined ? opts[i] : i).join(", ");
            } else if (qType === 'text' || qType === 'short' || opts.length === 0) {
                const rawCorrect = String(q.correct || q.correctAnswer || q.answer || "").trim().toLowerCase();
                const rawStudent = String(studentAns || "").trim().toLowerCase();

                if (rawStudent.length > 0 && rawStudent === rawCorrect) {
                    isCorrect = true;
                }
                correctAnswerText = q.correct || q.correctAnswer || q.answer || "";
            } else {
                let rawCorrectVal = undefined;
                if (q.correctOptionIndex !== undefined && q.correctOptionIndex !== null) rawCorrectVal = q.correctOptionIndex;
                else if (q.correctOption !== undefined && q.correctOption !== null) rawCorrectVal = q.correctOption;
                else if (q.correct !== undefined && q.correct !== null) rawCorrectVal = q.correct;
                else if (q.correctAnswer !== undefined && q.correctAnswer !== null) rawCorrectVal = q.correctAnswer;

                let studentIdx = (studentAns !== undefined && studentAns !== null) ? Number(studentAns) : null;

                if (rawCorrectVal !== undefined && !isNaN(rawCorrectVal) && String(rawCorrectVal).trim() !== "") {
                    const targetIdx = Number(rawCorrectVal);
                    if (studentIdx !== null && studentIdx === targetIdx) {
                        isCorrect = true;
                    }
                    correctAnswerText = opts[targetIdx] !== undefined ? opts[targetIdx] : targetIdx;
                } else {
                    const targetText = String(rawCorrectVal || "").trim().toLowerCase();
                    const studentSelectedText = (studentIdx !== null && opts[studentIdx] !== undefined)
                        ? String(opts[studentIdx]).trim().toLowerCase()
                        : String(studentAns || "").trim().toLowerCase();

                    if (studentSelectedText.length > 0 && studentSelectedText === targetText) {
                        isCorrect = true;
                    }
                    correctAnswerText = rawCorrectVal || "";
                }
            }

            if (isCorrect) {
                accumulatedPointsEarned += points;
                totalCorrectAnswersCount++;
            } else {
                totalIncorrectAnswersCount++;
            }

            let studentAnswerDisplay = "Жооп берилген эмес";
            if (Array.isArray(studentAns)) {
                studentAnswerDisplay = studentAns.length > 0 ? studentAns.map(i => opts[i] !== undefined ? opts[i] : i).join(", ") : "Жооп берилген эмес";
            } else if (studentAns !== undefined && studentAns !== null && String(studentAns).trim() !== "") {
                studentAnswerDisplay = opts[studentAns] !== undefined ? opts[studentAns] : String(studentAns);
            }

            responsesDetailedMap[`q_${idx}`] = {
                questionText: q.text || q.question || q.title || `Суроо №${idx + 1}`,
                studentAnswer: studentAnswerDisplay,
                correctAnswer: correctAnswerText,
                isCorrect: isCorrect
            };
        });

        const totalQuestions = currentLoadedTestStructure.questions.length;
        const overallPercentage = maximumPointsPossible > 0 ? Math.round((accumulatedPointsEarned / maximumPointsPossible) * 100) : 0;
        const totalDuration = parseInt(currentLoadedTestStructure.duration || currentLoadedTestStructure.timeLimit || 45, 10) * 60;
        const durationUsed = Math.max(1, Math.ceil((totalDuration - computedTimeRemainingSeconds) / 60));

        const resultRecord = {
            studentName: metaStudentName,
            studentClass: metaStudentClass,
            classGroup: metaStudentClass,
            testTitle: currentLoadedTestStructure.title || "Тест",
            score: accumulatedPointsEarned,
            totalPoints: maximumPointsPossible,
            totalQuestions: totalQuestions,
            correctCount: totalCorrectAnswersCount,
            incorrectCount: totalIncorrectAnswersCount,
            percentage: overallPercentage,
            finalPercentage: overallPercentage,
            durationUsed: durationUsed,
            antiCheatViolations: securityViolationCounters,
            violations: securityViolationCounters,
            reviewStatus: "checked",
            responses: responsesDetailedMap,
            timestamp: Date.now()
        };

        const resultsRef = database.ref(`teachers_data/${activeTeacherUid}/tests/${evaluationActiveTestId}/results`);
        const newResRef = resultsRef.push();
        newResRef.set(resultRecord)
            .then(function () {
                renderPostTestResultsDashboard(resultRecord);
            })
            .catch(function (err) {
                showStudentToastMessage("Жыйынтыкты сактоодо ката: " + err.message, "error");
            });
    }

    function renderPostTestResultsDashboard(resultRecord) {
        toggleElementVisibility("studentTestingBlock", false);
        toggleElementVisibility("studentAuthBlock", false);
        toggleElementVisibility("studentResultsBlock", true);

        safeUpdateInnerText("resultPercentValue", `${resultRecord.percentage}%`);
        safeUpdateInnerText("resultCorrectCount", `${resultRecord.correctCount} / ${resultRecord.totalQuestions}`);
        safeUpdateInnerText("resultIncorrectCount", `${resultRecord.incorrectCount} / ${resultRecord.totalQuestions}`);
        safeUpdateInnerText("resultPointsEarned", `${resultRecord.score} / ${resultRecord.totalPoints}`);
        safeUpdateInnerText("resultTimeSpent", `${resultRecord.durationUsed} мүнөт`);
    }

    function initializeAntiCheatSecurityGuards() {
        const security = currentLoadedTestStructure.security || {};

        document.addEventListener("visibilitychange", function () {
            if (document.visibilityState === "hidden" && (security.windowSwitchTrack !== false)) {
                securityViolationCounters++;
                showStudentToastMessage(`Эскертүү! Башка терезеге өтүүгө тыюу салынат! Жалпы бузуулар: ${securityViolationCounters}`, "warning");
            }
        });

        document.addEventListener("copy", function (e) {
            if (security.preventCopy) {
                e.preventDefault();
                showStudentToastMessage("Текстти көчүрүүгө бөгөт коюлган!", "error");
            }
        });

        document.addEventListener("paste", function (e) {
            if (security.preventPaste) {
                e.preventDefault();
                showStudentToastMessage("Текст кошууга бөгөт коюлган!", "error");
            }
        });

        document.addEventListener("contextmenu", function (e) {
            if (security.preventCopy || security.preventPaste) {
                e.preventDefault();
            }
        });
    }

    function requestFullscreenWindowViewportMode() {
        const el = document.documentElement;
        if (el.requestFullscreen) {
            el.requestFullscreen().catch(function () {});
        }
    }

    function renderFatalErrorWorkspaceState(errorMessage) {
        const authCard = document.getElementById("gateTestTitle");
        if (authCard) {
            authCard.innerText = "Тест табылган жок";
        }

        const mainContainer = document.getElementById("studentAuthBlock");
        if (mainContainer) {
            mainContainer.innerHTML = `
                <div style="text-align:center; padding: 30px 20px; color: #ff4757;">
                    <i class="fa-solid fa-triangle-exclamation" style="font-size: 48px; margin-bottom: 15px;"></i>
                    <h3 style="margin-bottom: 10px; color: #fff;">Тестти жүктөө мүмкүн эмес</h3>
                    <p style="color:#a4b0be; font-size: 14px; margin-bottom: 20px;">${escapeHTML(errorMessage)}</p>
                    <button onclick="window.location.reload()" style="padding:10px 20px; background:#00f2fe; color:#000; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">Кайра жүктөө</button>
                </div>
            `;
            toggleElementVisibility("studentAuthBlock", true);
            toggleElementVisibility("studentTestingBlock", false);
            toggleElementVisibility("studentResultsBlock", false);
        }
    }

    function showStudentToastMessage(messageTextContent, typeCategoryClass) {
        const container = document.getElementById("studentToastContainer");
        if (!container) {
            alert(messageTextContent);
            return;
        }
        const toast = document.createElement("div");
        toast.className = `hud-toast ${typeCategoryClass || 'success'}`;
        toast.style.cssText = "padding:10px 15px; margin-bottom:10px; border-radius:4px; background:#333; color:#fff;";
        toast.innerHTML = `<span>${escapeHTML(messageTextContent)}</span>`;
        container.appendChild(toast);
        setTimeout(function () { toast.remove(); }, 4000);
    }

    function safeBindClickEvent(id, callback) {
        const targetNode = document.getElementById(id);
        if (targetNode) targetNode.onclick = callback;
    }

    function safeUpdateInnerText(id, outputText) {
        const node = document.getElementById(id);
        if (node) node.innerText = outputText;
    }

    function toggleElementVisibility(id, shouldBeVisible) {
        const node = document.getElementById(id);
        if (node) {
            if (shouldBeVisible) {
                node.style.setProperty("display", "block", "important");
                node.classList.remove("hidden");
            } else {
                node.style.setProperty("display", "none", "important");
                node.classList.add("hidden");
            }
        }
    }
})();
