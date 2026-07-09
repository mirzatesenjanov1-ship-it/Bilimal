import { generateId, escapeHtml } from "./storage-fallback.js";

export function renderQuestionEditor(qData) {
  const container = document.getElementById("questions-constructor-container");
  if (!container) return;

  const qId = qData.id || generateId("q");
  const block = document.createElement("div");
  block.className = "question-editor-card-block";
  block.setAttribute("data-id", qId);
  block.style.cssText = "background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:16px; margin-bottom:16px; position:relative;";

  block.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; gap:10px;">
      <span class="question-number-badge" style="font-weight:bold; color:#1e293b;">Суроо</span>
      <div style="display:flex; gap:6px; align-items:center;">
        <select class="q-type-selector" style="padding:4px 8px; border-radius:4px; font-size:13px;">
          <option value="single" ${qData.type === "single" ? "selected" : ""}>Бир туура жооп</option>
          <option value="multiple" ${qData.type === "multiple" ? "selected" : ""}>Бир нече туура жооп</option>
          <option value="boolean" ${qData.type === "boolean" ? "selected" : ""}>Туура/Туура эмес</option>
          <option value="short" ${qData.type === "short" ? "selected" : ""}>Кыска жооп</option>
          <option value="essay" ${qData.type === "essay" ? "selected" : ""}>Эссе (Кол менен)</option>
        </select>
        <input type="number" class="q-points-input" value="${qData.points || 5}" style="width:60px; padding:4px; text-align:center;" title="Упай">
        <button type="button" class="q-action-up" style="cursor:pointer; padding:2px 6px;">↑</button>
        <button type="button" class="q-action-down" style="cursor:pointer; padding:2px 6px;">↓</button>
        <button type="button" class="q-action-delete" style="cursor:pointer; padding:2px 6px; background:#ef4444; color:white; border:none; border-radius:4px;">X</button>
      </div>
    </div>

    <!-- Rich Text Toolbar Sim -->
    <div class="rich-toolbar" style="background:#e2e8f0; padding:4px; border-radius:4px 4px 0 0; display:flex; gap:4px; flex-wrap:wrap;">
      <button type="button" class="tool-bold" style="font-weight:bold; padding:2px 6px; font-size:12px;">B</button>
      <button type="button" class="tool-italic" style="font-style:italic; padding:2px 6px; font-size:12px;">I</button>
      <button type="button" class="tool-formula" style="padding:2px 4px; font-size:11px;">Formula</button>
      <button type="button" class="tool-table" style="padding:2px 4px; font-size:11px;">+Table</button>
    </div>
    <textarea class="q-text-textarea" style="width:100%; height:70px; border:1px solid #cbd5e1; border-top:none; border-radius:0 0 4px 4px; padding:8px; font-family:inherit; box-sizing:border-box;" placeholder="Суроонун текстин жазыңыз...">${qData.questionText || ""}</textarea>

    <div class="options-container-space" style="margin-top:12px; display:flex; flex-direction:column; gap:6px;">
      <!-- Options will load dynamically -->
    </div>
    
    <div class="explanation-container" style="margin-top:10px;">
      <input type="text" class="q-explanation-input" value="${qData.explanation || ""}" placeholder="Түшүндүрмө (милдеттүү эмес)" style="width:100%; padding:6px; font-size:12px; border:1px solid #e2e8f0; border-radius:4px;">
    </div>
  `;

  container.appendChild(block);
  renderOptionsSpace(block, qData.type || "single", qData.options || ["", ""], qData.correctAnswer);
  attachQuestionBlockEvents(block);
  updateQuestionNumbers();
}

function renderOptionsSpace(block, type, options, correctAnswer) {
  const space = block.querySelector(".options-container-space");
  if (!space) return;
  space.innerHTML = "";

  if (type === "single" || type === "multiple") {
    options.forEach((opt, idx) => {
      const isChecked = Array.isArray(correctAnswer) ? correctAnswer.includes(idx) : correctAnswer == idx;
      const optRow = document.createElement("div");
      optRow.style.cssText = "display:flex; align-items:center; gap:8px;";
      optRow.innerHTML = `
        <input type="${type === 'single' ? 'radio' : 'checkbox'}" name="correct_ans_${block.getAttribute("data-id")}" class="opt-check-input" ${isChecked ? "checked" : ""}>
        <input type="text" class="opt-text-input" value="${escapeHtml(opt)}" style="flex:1; padding:6px; border:1px solid #cbd5e1; border-radius:4px; font-size:14px;" placeholder="Вариант ${idx + 1}">
        <button type="button" class="opt-delete-btn" style="color:#ef4444; background:none; border:none; cursor:pointer; font-weight:bold;">×</button>
      `;
      space.appendChild(optRow);
    });

    const addOptBtn = document.createElement("button");
    addOptBtn.type = "button";
    addOptBtn.innerText = "+ Вариант кошуу";
    addOptBtn.style.cssText = "align-self:flex-start; font-size:12px; color:#2563eb; background:none; border:none; cursor:pointer; padding:4px 0;";
    addOptBtn.addEventListener("click", () => {
      const rows = space.querySelectorAll(".opt-text-input");
      if (rows.length >= 8) return;
      const optRow = document.createElement("div");
      optRow.style.cssText = "display:flex; align-items:center; gap:8px;";
      optRow.innerHTML = `
        <input type="${type === 'single' ? 'radio' : 'checkbox'}" name="correct_ans_${block.getAttribute("data-id")}" class="opt-check-input">
        <input type="text" class="opt-text-input" value="" style="flex:1; padding:6px; border:1px solid #cbd5e1; border-radius:4px; font-size:14px;" placeholder="Вариант ${rows.length + 1}">
        <button type="button" class="opt-delete-btn" style="color:#ef4444; background:none; border:none; cursor:pointer; font-weight:bold;">×</button>
      `;
      space.insertBefore(optRow, addOptBtn);
      bindOptionDeleteEvents(block);
    });
    space.appendChild(addOptBtn);
    bindOptionDeleteEvents(block);

  } else if (type === "boolean") {
    const isTrue = correctAnswer === "true" || correctAnswer === true;
    space.innerHTML = `
      <label style="display:flex; align-items:center; gap:6px; font-size:14px; cursor:pointer;">
        <input type="radio" name="boolean_ans_${block.getAttribute("data-id")}" class="bool-radio-input" value="true" ${isTrue ? "checked" : ""}> Туура (True)
      </label>
      <label style="display:flex; align-items:center; gap:6px; font-size:14px; cursor:pointer;">
        <input type="radio" name="boolean_ans_${block.getAttribute("data-id")}" class="bool-radio-input" value="false" ${(!isTrue && correctAnswer !== undefined) ? "checked" : ""}> Туура эмес (False)
      </label>
    `;
  } else if (type === "short") {
    space.innerHTML = `
      <input type="text" class="short-answer-input" value="${escapeHtml(correctAnswer || '')}" placeholder="Туура жооптун сөзүн же санын жазыңыз..." style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:4px;">
    `;
  } else if (type === "essay") {
    space.innerHTML = `
      <div style="font-size:12px; color:#64748b; font-style:italic;">Бул суроону окуучу тапшыргандан кийин мугалим кол менен текшерип упай коёт.</div>
    `;
  }
}

function bindOptionDeleteEvents(block) {
  block.querySelectorAll(".opt-delete-btn").forEach(btn => {
    btn.onclick = function() {
      const row = btn.parentElement;
      if (row && row.parentElement.querySelectorAll(".opt-text-input").length > 2) {
        row.remove();
      }
    };
  });
}

function attachQuestionBlockEvents(block) {
  const typeSelector = block.querySelector(".q-type-selector");
  if (typeSelector) {
    typeSelector.addEventListener("change", (e) => {
      renderOptionsSpace(block, e.target.value, ["", ""], null);
    });
  }

  block.querySelector(".q-action-delete").onclick = function() {
    block.remove();
    updateQuestionNumbers();
  };

  block.querySelector(".q-action-up").onclick = function() {
    const prev = block.previousElementSibling;
    if (prev && prev.classList.contains("question-editor-card-block")) {
      block.parentElement.insertBefore(block, prev);
      updateQuestionNumbers();
    }
  };

  block.querySelector(".q-action-down").onclick = function() {
    const next = block.nextElementSibling;
    if (next && next.classList.contains("question-editor-card-block")) {
      block.parentElement.insertBefore(next, block);
      updateQuestionNumbers();
    }
  };

  // Rich toolbar mock feature injection
  block.querySelector(".tool-bold").onclick = () => insertAtTextareaCursor(block.querySelector(".q-text-textarea"), "**", "**");
  block.querySelector(".tool-italic").onclick = () => insertAtTextareaCursor(block.querySelector(".q-text-textarea"), "*", "*");
  block.querySelector(".tool-formula").onclick = () => insertAtTextareaCursor(block.querySelector(".q-text-textarea"), "$$", "$$");
  block.querySelector(".tool-table").onclick = () => insertAtTextareaCursor(block.querySelector(".q-text-textarea"), "\n| Башы 1 | Башы 2 |\n|---|---|\n| Маалымат 1 | Маалымат 2 |\n", "");
}

function insertAtTextareaCursor(textarea, front, back) {
  if (!textarea) return;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  textarea.value = text.substring(0, start) + front + text.substring(start, end) + back + text.substring(end);
  textarea.focus();
}

function updateQuestionNumbers() {
  document.querySelectorAll(".question-editor-card-block").forEach((b, index) => {
    const badge = b.querySelector(".question-number-badge");
    if (badge) badge.innerText = `Суроо №${index + 1}`;
  });
}

export function getQuestionsFromEditor() {
  const blocks = document.querySelectorAll(".question-editor-card-block");
  const arr = [];

  blocks.forEach(block => {
    const id = block.getAttribute("data-id");
    const type = block.querySelector(".q-type-selector").value;
    const txt = block.querySelector(".q-text-textarea").value.trim();
    const pts = parseInt(block.querySelector(".q-points-input").value) || 0;
    const exp = block.querySelector(".q-explanation-input")?.value.trim() || "";

    let options = [];
    let correct = null;

    if (type === "single" || type === "multiple") {
      const optRows = block.querySelectorAll(".opt-text-input");
      const checks = block.querySelectorAll(".opt-check-input");
      
      if (type === "single") {
        correct = 0;
        optRows.forEach((row, rIdx) => {
          options.push(row.value.trim());
          if (checks[rIdx] && checks[rIdx].checked) correct = rIdx;
        });
      } else {
        correct = [];
        optRows.forEach((row, rIdx) => {
          options.push(row.value.trim());
          if (checks[rIdx] && checks[rIdx].checked) correct.push(rIdx);
        });
      }
    } else if (type === "boolean") {
      const selectedRadio = block.querySelector(".bool-radio-input:checked");
      correct = selectedRadio ? selectedRadio.value === "true" : true;
    } else if (type === "short") {
      correct = block.querySelector(".short-answer-input")?.value.trim() || "";
    }

    arr.push({
      id: id,
      type: type,
      questionText: txt,
      points: pts,
      options: options,
      correctAnswer: correct,
      explanation: exp
    });
  });

  return arr;
}
