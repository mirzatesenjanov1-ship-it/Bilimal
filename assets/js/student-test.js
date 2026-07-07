// Master Application Execution Engines logic framework for the Students test execution runtimes
import { 
    db, ref, set, push, update, get, onValue
} from "./firebase-config.js";

// Active Runtime Storage Memory State Matrix Configurations
let evaluationActiveTestId = null;
let currentLoadedTestStructure = null;
let compiledStudentAnswersBuffer = {};
let trackingActiveQuestionIndex = 0;
let computedTimeRemainingSeconds = 0;
let securityViolationCounters = 0;
let localTimerIntervalReference = null;

// Registry structures data details
let metaStudentName = "";
let metaStudentClass = "";

// Workspace Core System Lifecycle Trigger entry pointers execution bounds
document.addEventListener("DOMContentLoaded", () => {
    extractTestContextParametersFromUrl();
    initializeAntiCheatSecurityGuards();
});

function extractTestContextParametersFromUrl() {
    const urlQuerySearchParameters = new URLSearchParams(window.location.search);
    evaluationActiveTestId = urlQuerySearchParameters.get("test");

    if (!evaluationActiveTestId) {
        renderFatalErrorWorkspaceState("Тесттин уникалдуу идентификатору шилтемеде табылбады. Ссылканы текшериңиз.");
        return;
    }

    fetchTestPayloadFromDatabase(evaluationActiveTestId);
}

// Fetch Payload structures parameters properties bindings configurations asynchronously handles
async function fetchTestPayloadFromDatabase(testId) {
    try {
        const testSnapshot = await get(ref(db, `publicTests/${testId}`));
        if (!testSnapshot.exists()) {
            renderFatalErrorWorkspaceState("Суралган тест системалык базадан табылган жок же мугалим тарабынан тазаланган.");
            return;
        }

        currentLoadedTestStructure = testSnapshot.val();
        renderGateAuthScreenMetaInfo();
        registerStudentRegistrationFormHandler();
        trackGoogleAnalyticsEvent("student_test_opened");

    } catch (err) {
        renderFatalErrorWorkspaceState("Маалыматтар базасынан ката катталды: " + err.message);
    }
}

function renderGateAuthScreenMetaInfo() {
    const titleNode = document.getElementById("gateTestTitle");
    const metaNode = document.getElementById("gateTestMeta");
    if (titleNode) titleNode.innerText = currentLoadedTestStructure.title;
    if (metaNode) {
        metaNode.innerHTML = `Сабак: <strong>${currentLoadedTestStructure.subject}</strong> | Класс: <strong>${currentLoadedTestStructure.class}</strong><br>Мугалим: ${currentLoadedTestStructure.teacherName}`;
    }
    
    // Evaluate if PIN security protocol fields requirements is enforced configuration structure
    if (currentLoadedTestStructure.pinCode) {
        const wrapper = document.getElementById("gatePinWrapper");
        if (wrapper) wrapper.classList.remove("hidden");
    }
}

function registerStudentRegistrationFormHandler() {
    const form = document.getElementById("studentRegistrationForm");
    if (!form) return;

    form.addEventListener("submit", (e) => {
        e.preventDefault();
        
        metaStudentName = document.getElementById("studentInputName").value.trim();
        metaStudentClass = document.getElementById("studentInputClass").value.trim();

        if (currentLoadedTestStructure.pinCode) {
            const enteredPin = document.getElementById("studentInputPin").value.trim();
            if (enteredPin !== currentLoadedTestStructure.pinCode) {
                showStudentToastMessage("Тестке кирүү үчүн туура эмес PIN-код жаздыңыз!", "error");
                return;
            }
        }

        // Initialize Workspace configuration fields execution sequences transitions states rules
        transitionWorkspaceToActiveTestMode();
    });
}

function transitionWorkspaceToActiveTestMode() {
    document.getElementById("studentAuthBlock").classList.add("hidden");
    document.getElementById("studentTestingBlock").classList.remove("hidden");

    // Display identifiers items indicators titles
    const labelNode = document.getElementById("runtimeStudentInfo");
    if (labelNode) labelNode.innerText = `Окуучу: ${metaStudentName} (${metaStudentClass})`;
    const runtimeTitle = document.getElementById("runtimeTestTitle");
    if (runtimeTitle) runtimeTitle.innerText = currentLoadedTestStructure.title;

    // Evaluate configurations fields requirements boundaries for full screen operations triggers controls safely
    if (currentLoadedTestStructure.fullscreen) {
        requestFullscreenWindowViewportMode();
    }

    // Trigger Timers engine instances operations allocations definitions safely
    computedTimeRemainingSeconds = (currentLoadedTestStructure.timeLimit || 20) * 60;
    startTestingSessionCountdownTimer();

    // Map base allocations elements array fields arrays matrices components grids maps references objects variables
    generateQuestionsMatrixHUDNodes();
    displayTargetQuestionContentPane();
    registerWorkspaceNavigationControls();
}

function startTestingSessionCountdownTimer() {
    const displayNode = document.getElementById("runtimeCountdown");
    if (!displayNode) return;

    localTimerIntervalReference = setInterval(() => {
        if (computedTimeRemainingSeconds <= 0) {
            clearInterval(localTimerIntervalReference);
            processAutomatedTestSubmissionWorkflow();
            showStudentToastMessage("Убакыт лимити аяктады! Тест автоматтык түрдө тапшырылды.", "warning");
            return;
        }

        computedTimeRemainingSeconds--;
        const mins = Math.floor(computedTimeRemainingSeconds / 60);
        const secs = computedTimeRemainingSeconds % 60;
        displayNode.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

        // Color warnings thresholds alert zones triggers configurations safely
        if (computedTimeRemainingSeconds < 60) {
            document.getElementById("hudTimerWidget").style.borderColor = "#ff1744";
        }
    }, 1000);
}

function generateQuestionsMatrixHUDNodes() {
    const container = document.getElementById("studentQuestionsMatrix");
    if (!container) return;
    container.innerHTML = "";

    currentLoadedTestStructure.questions.forEach((q, idx) => {
        const node = document.createElement("button");
        node.type = "button";
        node.className = `matrix-node n-idx-${idx}`;
        node.innerText = idx + 1;

        node.addEventListener("click", () => {
            trackingActiveQuestionIndex = idx;
            displayTargetQuestionContentPane();
        });

        container.appendChild(node);
    });
}

function displayTargetQuestionContentPane() {
    if (!currentLoadedTestStructure || !currentLoadedTestStructure.questions[trackingActiveQuestionIndex]) return;
    const qData = currentLoadedTestStructure.questions[trackingActiveQuestionIndex];

    // Synchronize current matrix item selections visual styles states boundaries properties allocations configurations
    document.querySelectorAll(".matrix-node").forEach((n, idx) => {
        n.classList.remove("active");
        if (idx === trackingActiveQuestionIndex) n.classList.add("active");
    });

    safeUpdateInnerText("currentQuestionNumberLabel", `Суроо #${trackingActiveQuestionIndex + 1}`);
    safeUpdateInnerText("currentQuestionPointsLabel", `${qData.points || 1} балл`);
    
    const textContainer = document.getElementById("currentQuestionTextContainer");
    if (textContainer) textContainer.innerText = qData.text;

    // Render configuration fields arrays variants values parameters variables layouts blocks options entries
    const optionsContainer = document.getElementById("questionOptionsContainer");
    if (optionsContainer) {
        optionsContainer.innerHTML = "";
        
        qData.options.forEach((opt, oIdx) => {
            const isSelected = compiledStudentAnswersBuffer[trackingActiveQuestionIndex] === oIdx;
            const optionRow = document.createElement("div");
            optionRow.className = `option-variant-row ${isSelected ? 'selected' : ''}`;
            optionRow.innerHTML = `
                <div class="variant-indicator"><i class="fa-solid fa-check"></i></div>
                <div class="variant-text-string">${opt}</div>
            `;

            optionRow.addEventListener("click", () => {
                compiledStudentAnswersBuffer[trackingActiveQuestionIndex] = oIdx;
                
                // Track visually that answer has been populated elements matrices nodes classes parameters rules
                const node = document.querySelector(`.matrix-node.n-idx-${trackingActiveQuestionIndex}`);
                if (node) node.classList.add("answered");

                displayTargetQuestionContentPane();
            });

            optionsContainer.appendChild(optionRow);
        });
    }

    // Evaluate step edge visibility boundaries conditions properties settings structures fields values handles
    const totalQCount = currentLoadedTestStructure.questions.length;
    document.getElementById("studentPrevQuestionBtn").disabled = trackingActiveQuestionIndex === 0;
    
    toggleElementVisibility("studentNextQuestionBtn", trackingActiveQuestionIndex < totalQCount - 1);
    toggleElementVisibility("studentSubmitTestBtn", trackingActiveQuestionIndex === totalQCount - 1);
}

function registerWorkspaceNavigationControls() {
    safeBindClickEvent("studentPrevQuestionBtn", () => {
        if (trackingActiveQuestionIndex > 0) {
            trackingActiveQuestionIndex--;
            displayTargetQuestionContentPane();
        }
    });

    safeBindClickEvent("studentNextQuestionBtn", () => {
        if (trackingActiveQuestionIndex < currentLoadedTestStructure.questions.length - 1) {
            trackingActiveQuestionIndex++;
            displayTargetQuestionContentPane();
        }
    });

    safeBindClickEvent("studentSubmitTestBtn", () => {
        processAutomatedTestSubmissionWorkflow();
    });
}

// Compute metrics, evaluate metrics arrays grades and sync values datasets transactions objects updates
async function processAutomatedTestSubmissionWorkflow() {
    clearInterval(localTimerIntervalReference);
    if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
    }

    let accumulatedPointsEarned = 0;
    let maximumPointsPossible = 0;
    let totalCorrectAnswersCount = 0;

    currentLoadedTestStructure.questions.forEach((q, idx) => {
        maximumPointsPossible += (q.points || 1);
        const givenAnsIdx = compiledStudentAnswersBuffer[idx];
        if (givenAnsIdx !== undefined && givenAnsIdx === q.correctAnswer) {
            accumulatedPointsEarned += (q.points || 1);
            totalCorrectAnswersCount++;
        }
    });

    const overallPercentageGrade = maximumPointsPossible > 0 ? 
        Math.round((accumulatedPointsEarned / maximumPointsPossible) * 100) : 0;

    const runtimePayloadResultRecord = {
        studentName: metaStudentName,
        studentClass: metaStudentClass,
        testTitle: currentLoadedTestStructure.title,
        teacherId: currentLoadedTestStructure.teacherId,
        score: accumulatedPointsEarned,
        totalPoints: maximumPointsPossible,
        percentage: overallPercentageGrade,
        antiCheatViolations: securityViolationCounters,
        timestamp: Date.now()
    };

    try {
        const resultPushKeyId = push(ref(db, `testResults/${evaluationActiveTestId}`)).key;
        await set(ref(db, `testResults/${evaluationActiveTestId}/${resultPushKeyId}`), runtimePayloadResultRecord);
        
        // Render Final Results visual displays boards blocks configurations
        renderPostTestResultsDashboard(runtimePayloadResultRecord, totalCorrectAnswersCount);
        trackGoogleAnalyticsEvent("student_test_completed");

    } catch (err) {
        showStudentToastMessage("Жыйынтыкты сактоодо ката: " + err.message, "error");
    }
}

function renderPostTestResultsDashboard(resultRecord, totalCorrectAnswersCount) {
    document.getElementById("studentTestingBlock").classList.add("hidden");
    document.getElementById("studentResultsBlock").classList.remove("hidden");

    safeUpdateInnerText("resultPercentValue", `${resultRecord.percentage}%`);
    safeUpdateInnerText("resultCorrectCount", `${totalCorrectAnswersCount}/${currentLoadedTestStructure.questions.length}`);
    safeUpdateInnerText("resultPointsEarned", resultRecord.score);
    
    const timeSpentMins = Math.ceil(((currentLoadedTestStructure.timeLimit * 60) - computedTimeRemainingSeconds) / 60);
    safeUpdateInnerText("resultTimeSpent", `${timeSpentMins} мүнөт`);
}

// Integrated Anti-cheat Security Shield Engine parameters structures variables logic handles
function initializeAntiCheatSecurityGuards() {
    // Visibility Changes Triggers event handlers catch actions
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden" && currentLoadedTestStructure && currentLoadedTestStructure.antiCheat) {
            securityViolationCounters++;
            showStudentToastMessage(`Эскертүү! Башка терезеге өтүүгө тыюу салынат! Эскертүү саясаты: ${securityViolationCounters}`, "warning");
        }
    });

    // Copy Paste context boundaries blocks events prevention rules
    document.addEventListener("copy", (e) => {
        if (currentLoadedTestStructure && currentLoadedTestStructure.antiCheat) {
            e.preventDefault();
            showStudentToastMessage("Текстти көчүрүүгө бөгөт коюлган!", "error");
        }
    });

    document.addEventListener("paste", (e) => {
        if (currentLoadedTestStructure && currentLoadedTestStructure.antiCheat) {
            e.preventDefault();
            showStudentToastMessage("Текст кошууга бөгөт коюлган!", "error");
        }
    });
}

function requestFullscreenWindowViewportMode() {
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    else if (el.mozRequestFullScreen) el.mozRequestFullScreen().catch(() => {});
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen().catch(() => {});
}

// Application Interface Utilities Abstractions helpers functions elements variables bindings logic
function renderFatalErrorWorkspaceState(errorMessageContentStringText) {
    const container = document.querySelector(".student-container");
    if (!container) return;

    container.innerHTML = `
        <div class="hud-card text-center p-5 border-danger-glow">
            <i class="fa-solid fa-circle-exclamation text-danger fa-4x mb-3 animate-pulse"></i>
            <h2 class="text-danger">Системалык Ката Ката Катталды</h2>
            <p class="text-main mt-3">${errorMessageContentStringText}</p>
            <button class="hud-btn btn-secondary mt-4" onclick="window.location.reload()"><i class="fa-solid fa-rotate-right"></i> Кайра жүктөө</button>
        </div>
    `;
}

function showStudentToastMessage(messageTextContent, typeCategoryClass = "success") {
    const container = document.getElementById("studentToastContainer");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = `hud-toast ${typeCategoryClass}`;
    toast.innerHTML = `<i class="fa-solid ${typeCategoryClass === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation'}"></i> <span>${messageTextContent}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 4000);
}

function safeBindClickEvent(elementIdString, callbackFunction) {
    const targetNode = document.getElementById(elementIdString);
    if (targetNode) targetNode.addEventListener("click", callbackFunction);
}

function safeUpdateInnerText(elementIdString, outputText) {
    const node = document.getElementById(elementIdString);
    if (node) node.innerText = outputText;
}

function toggleElementVisibility(elementIdString, shouldBeVisibleConditionBoolean) {
    const node = document.getElementById(elementIdString);
    if (node) {
        if (shouldBeVisibleConditionBoolean) node.classList.remove("hidden");
        else node.classList.add("hidden");
    }
}

function trackGoogleAnalyticsEvent(eventNameString) {
    if (typeof gtag === 'function') {
        gtag('event', eventNameString);
    }
}
