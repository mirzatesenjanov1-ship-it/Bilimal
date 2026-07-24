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

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const database = firebase.database();

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

document.addEventListener("DOMContentLoaded", function () {
    toggleElementVisibility("studentAuthBlock", true);
    toggleElementVisibility("studentTestingBlock", false);
    toggleElementVisibility("studentResultsBlock", false);

    extractTestContextParametersFromUrl();
});

function extractTestContextParametersFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    evaluationActiveTestId = urlParams.get("test");
    activeTeacherUid = urlParams.get("teacher");

    if (!evaluationActiveTestId) {
        renderFatalErrorWorkspaceState("Тесттин уникалдуу идентификатору шилтемеде табылбады. Ссылканы текшериңиз.");
        return;
    }

    fetchTestPayloadFromDatabase();
}

function fetchTestPayloadFromDatabase() {
    if (!activeTeacherUid) {
        database.ref(`global_test_lookup/${evaluationActiveTestId}`).once('value')
            .then(function(lookupSnap) {
                if (lookupSnap.exists()) {
                    activeTeacherUid = lookupSnap.val().teacherUid;
                }
                loadMainTestData();
            })
            .catch(function(err) {
                renderFatalErrorWorkspaceState("Маалымат алууда ката: " + err.message);
            });
    } else {
        loadMainTestData();
    }
}

function loadMainTestData() {
    if (!activeTeacherUid) activeTeacherUid = "demo_teacher_001";

    database.ref(`teachers_data/${activeTeacherUid}/tests/${evaluationActiveTestId}`).once('value')
        .then(function(testSnap) {
            if (!testSnap.exists()) {
                renderFatalErrorWorkspaceState("Суралган тест базадан табылган жок же өчүрүлгөн.");
                return;
            }

            currentLoadedTestStructure = testSnap.val();

            if (currentLoadedTestStructure.questions) {
                if (!Array.isArray(currentLoadedTestStructure.questions)) {
                    currentLoadedTestStructure.questions = Object.keys(currentLoadedTestStructure.questions).map(function(k) {
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
        .catch(function(err) {
            renderFatalErrorWorkspaceState("База менен байланышуу катасы: " + err.message);
        });
}

function renderGateAuthScreenMetaInfo() {
    safeUpdateInnerText("gateTestTitle", currentLoadedTestStructure.title || "Тест");
    
    const metaNode = document.getElementById("gateTestMeta");
    if (metaNode) {
        metaNode.innerHTML = `Сабак: <strong>${currentLoadedTestStructure.subject || 'Жалпы'}</strong> | Класс: <strong>${currentLoadedTestStructure.classGroup || 'Бардыгы'}</strong>`;
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

        if (currentLoadedTestStructure.pinCode) {
            const enteredPin = getInputValue("studentInputPin").trim();
            if (enteredPin !== currentLoadedTestStructure.pinCode) {
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

    computedTimeRemainingSeconds = (currentLoadedTestStructure.duration || 45) * 60;
    startTestingSessionCountdownTimer();

    generateQuestionsMatrixHUDNodes();
    displayTargetQuestionContentPane();
    registerWorkspaceNavigationControls();
}

function startTestingSessionCountdownTimer() {
    const displayNode = document.getElementById("runtimeCountdown");
    if (!displayNode) return;

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
    if (textContainer) textContainer.innerText = qData.text || "";

    const optionsContainer = document.getElementById("questionOptionsContainer");
    if (optionsContainer) {
        optionsContainer.innerHTML = "";
        
        const opts = qData.options || [];
        opts.forEach(function (opt, oIdx) {
            const currentSavedAnswer = compiledStudentAnswersBuffer[trackingActiveQuestionIndex];
            let isSelected = false;

            if (qData.type === 'multiple') {
                isSelected = Array.isArray(currentSavedAnswer) && currentSavedAnswer.includes(oIdx);
            } else {
                isSelected = currentSavedAnswer === oIdx;
            }

            const optionRow = document.createElement("div");
            optionRow.className = `option-variant-row ${isSelected ? 'selected' : ''}`;
            optionRow.style.cssText = "padding:10px; margin-bottom:8px; border:1px solid rgba(255,255,255,0.2); border-radius:6px; cursor:pointer; display:flex; align-items:center; gap:10px;";
            
            optionRow.innerHTML = `
                <div class="variant-indicator" style="width:18px; height:18px; border:1px solid #00f2fe; border-radius:50%; display:flex; align-items:center; justify-content:center; background:${isSelected ? '#00f2fe' : 'transparent'};">
                    ${isSelected ? '<i class="fa-solid fa-check" style="font-size:10px; color:#000;"></i>' : ''}
                </div>
                <div class="variant-text-string">${opt}</div>
            `;

            optionRow.onclick = function () {
                if (qData.type === 'multiple') {
                    if (!Array.isArray(compiledStudentAnswersBuffer[trackingActiveQuestionIndex])) {
                        compiledStudentAnswersBuffer[trackingActiveQuestionIndex] = [];
                    }
                    const arr = compiledStudentAnswersBuffer[trackingActiveQuestionIndex];
                    const pos = arr.indexOf(oIdx);
                    if (pos > -1) arr.splice(pos, 1);
                    else arr.push(oIdx);
                } else {
                    compiledStudentAnswersBuffer[trackingActiveQuestionIndex] = oIdx;
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
    clearInterval(localTimerIntervalReference);
    if (document.fullscreenElement) {
        document.exitFullscreen().catch(function () {});
    }

    let accumulatedPointsEarned = 0;
    let maximumPointsPossible = 0;
    let totalCorrectAnswersCount = 0;
    const responsesDetailedMap = {};

    currentLoadedTestStructure.questions.forEach(function (q, idx) {
        const points = q.points || 5;
        maximumPointsPossible += points;
        const studentAns = compiledStudentAnswersBuffer[idx];

        let isCorrect = false;

        if (q.type === 'multiple') {
            const correctArr = q.correctOptionIndices || [q.correctOptionIndex || 0];
            if (Array.isArray(studentAns) && studentAns.length === correctArr.length && studentAns.every(function (v) { return correctArr.includes(v); })) {
                isCorrect = true;
            }
        } else {
            if (studentAns !== undefined && studentAns === q.correctOptionIndex) {
                isCorrect = true;
            }
        }

        if (isCorrect) {
            accumulatedPointsEarned += points;
            totalCorrectAnswersCount++;
        }

        responsesDetailedMap[`q_${idx}`] = {
            questionText: q.text,
            studentAnswer: Array.isArray(studentAns) ? studentAns.map(function (i) { return q.options[i]; }).join(", ") : (q.options ? q.options[studentAns] : studentAns),
            correctAnswer: q.type === 'multiple' 
                ? (q.correctOptionIndices || []).map(function (i) { return q.options[i]; }).join(", ") 
                : (q.options ? q.options[q.correctOptionIndex] : ""),
            isCorrect: isCorrect
        };
    });

    const overallPercentage = maximumPointsPossible > 0 ? Math.round((accumulatedPointsEarned / maximumPointsPossible) * 100) : 0;
    const durationUsed = Math.ceil(((currentLoadedTestStructure.duration * 60) - computedTimeRemainingSeconds) / 60);

    const resultRecord = {
        studentName: metaStudentName,
        studentClass: metaStudentClass,
        testTitle: currentLoadedTestStructure.title || "Тест",
        score: accumulatedPointsEarned,
        totalPoints: maximumPointsPossible,
        percentage: overallPercentage,
        durationUsed: durationUsed,
        antiCheatViolations: securityViolationCounters,
        reviewStatus: "pending",
        responses: responsesDetailedMap,
        timestamp: Date.now()
    };

    const resultsRef = database.ref(`teachers_data/${activeTeacherUid}/tests/${evaluationActiveTestId}/results`);
    const newResRef = resultsRef.push();
    newResRef.set(resultRecord)
        .then(function () {
            renderPostTestResultsDashboard(resultRecord, totalCorrectAnswersCount);
        })
        .catch(function (err) {
            showStudentToastMessage("Жыйынтыкты сактоодо ката: " + err.message, "error");
        });
}

function renderPostTestResultsDashboard(resultRecord, totalCorrectAnswersCount) {
    toggleElementVisibility("studentTestingBlock", false);
    toggleElementVisibility("studentAuthBlock", false);
    toggleElementVisibility("studentResultsBlock", true);

    safeUpdateInnerText("resultPercentValue", `${resultRecord.percentage}%`);
    safeUpdateInnerText("resultCorrectCount", `${totalCorrectAnswersCount}/${currentLoadedTestStructure.questions.length}`);
    safeUpdateInnerText("resultPointsEarned", `${resultRecord.score} / ${resultRecord.totalPoints}`);
    safeUpdateInnerText("resultTimeSpent", `${resultRecord.durationUsed} мүнөт`);
}

function initializeAntiCheatSecurityGuards() {
    const security = currentLoadedTestStructure.security || {};

    document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "hidden" && security.windowSwitchTrack) {
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
}

function requestFullscreenWindowViewportMode() {
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(function () {});
}

function renderFatalErrorWorkspaceState(errorMessage) {
    const container = document.querySelector(".student-container") || document.body;
    container.innerHTML = `
        <div style="text-align:center; padding: 50px; color: #ff4757;">
            <h2>Системалык ката</h2>
            <p style="color:#fff; margin-top:15px;">${errorMessage}</p>
            <button onclick="window.location.reload()" style="padding:10px 20px; margin-top:20px; cursor:pointer;">Кайра жүктөө</button>
        </div>
    `;
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
    toast.innerHTML = `<span>${messageTextContent}</span>`;
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
