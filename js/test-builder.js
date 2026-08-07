import { auth, db } from '../firebase/firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { ref, push, set } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

let currentUser = null;
let questionCount = 0;

onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "../dashboard.html";
        return;
    }
    currentUser = user;
    addQuestion(); 
});

function addQuestion() {
    questionCount++;
    const container = document.getElementById('questionsContainer');
    const qDiv = document.createElement('div');
    qDiv.className = 'q-box';
    qDiv.id = `q_${questionCount}`;
    qDiv.innerHTML = `
        <div class="q-header">
            <strong>Суроо #${questionCount}</strong>
            <button type="button" class="btn btn-danger" onclick="removeQ('q_${questionCount}')">✕</button>
        </div>
        <input type="text" class="q-text" placeholder="Суроонун тексти" style="width:100%; margin-bottom:10px;" required>
        <div class="opt-list">
            <div class="opt-item"><input type="radio" name="correct_${questionCount}" value="0" checked><input type="text" class="opt-text" placeholder="Вариант 1" required></div>
            <div class="opt-item"><input type="radio" name="correct_${questionCount}" value="1"><input type="text" class="opt-text" placeholder="Вариант 2" required></div>
            <div class="opt-item"><input type="radio" name="correct_${questionCount}" value="2"><input type="text" class="opt-text" placeholder="Вариант 3" required></div>
        </div>
    `;
    container.appendChild(qDiv);
}

document.getElementById('addQuestionBtn').onclick = addQuestion;

window.removeQ = (id) => {
    document.getElementById(id).remove();
};

document.getElementById('builderForm').onsubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    const questions = {};
    const qBoxes = document.querySelectorAll('.q-box');
    
    qBoxes.forEach((box, idx) => {
        const qText = box.querySelector('.q-text').value;
        const optInputs = box.querySelectorAll('.opt-text');
        const correctIdx = box.querySelector(`input[type="radio"]:checked`).value;
        
        const options = [];
        optInputs.forEach(opt => options.push(opt.value));

        questions[`q_${idx}`] = {
            text: qText,
            options: options,
            correct: parseInt(correctIdx)
        };
    });

    const newTestRef = push(ref(db, 'tests'));
    await set(newTestRef, {
        ownerUid: currentUser.uid,
        title: document.getElementById('testTitle').value,
        subject: document.getElementById('testSubject').value,
        grade: document.getElementById('testGrade').value,
        topic: document.getElementById('testTopic').value,
        duration: parseInt(document.getElementById('testDuration').value),
        published: true,
        createdAt: Date.now(),
        questions: questions
    });

    alert('Тест ийгиликтүү түзүлдү!');
    window.location.href = 'tests.html';
};
