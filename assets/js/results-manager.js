import { isFirebaseAvailable, db, ref, get, set } from "./firebase-config.js";
import { currentTeacher } from "./auth-guard.js";
import { getResultsFromLocal, saveResultsToLocal, showToast, safeJsonParse } from "./storage-fallback.js";

export let cachedResults = {};

export function generateYearKey() {
  return "2026-2027";
}

export function loadTeacherResults(callback) {
  const tid = currentTeacher.uid;
  cachedResults = getResultsFromLocal(tid);
  
  if (typeof callback === "function") callback(cachedResults);

  if (isFirebaseAvailable && db) {
    get(ref(db, `teachers/${tid}/results`))
      .then((snapshot) => {
        if (snapshot.exists()) {
          cachedResults = snapshot.val();
          saveResultsToLocal(tid, cachedResults);
          if (typeof callback === "function") callback(cachedResults);
        }
      })
      .catch(err => console.error("Error reading quiz results real-time database path:", err));
  }
}

export function calculateAutomaticScore(studentAnswers, testQuestions) {
  let earnedPoints = 0;
  let totalPoints = 0;
  let requiresManualReview = false;

  testQuestions.forEach(q => {
    totalPoints += (q.points || 0);
    const ans = studentAnswers[q.id];

    if (q.type === "essay") {
      requiresManualReview = true;
      return; 
    }

    if (ans === undefined || ans === null) return;

    if (q.type === "single") {
      if (String(ans) === String(q.correctAnswer)) earnedPoints += q.points;
    } else if (q.type === "boolean") {
      if (Boolean(ans) === Boolean(q.correctAnswer)) earnedPoints += q.points;
    } else if (q.type === "short") {
      if (String(ans).trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase()) {
        earnedPoints += q.points;
      }
    } else if (q.type === "multiple") {
      if (Array.isArray(ans) && Array.isArray(q.correctAnswer)) {
        const match = ans.length === q.correctAnswer.length && ans.every(v => q.correctAnswer.includes(parseInt(v)));
        if (match) earnedPoints += q.points;
      }
    }
  });

  const percent = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
  return { earnedPoints, totalPoints, percent, requiresManualReview };
}

export function calculateGrade(percent, scale) {
  const s = scale || { five: 90, four: 70, three: 50, two: 0 };
  if (percent >= s.five) return 5;
  if (percent >= s.four) return 4;
  if (percent >= s.three) return 3;
  return 2;
}

export function markResultAsReviewed(resultId, updatedPoints, comment) {
  const tid = currentTeacher.uid;
  if (!cachedResults[resultId]) return;

  const res = cachedResults[resultId];
  res.earnedPoints = updatedPoints;
  res.percent = res.totalPoints > 0 ? Math.round((res.earnedPoints / res.totalPoints) * 100) : 0;
  res.grade = calculateGrade(res.percent, null);
  res.status = "reviewed";
  res.teacherComment = comment;

  cachedResults[resultId] = res;
  saveResultsToLocal(tid, cachedResults);

  if (isFirebaseAvailable && db) {
    set(ref(db, `teachers/${tid}/results/${resultId}`), res)
      .then(() => showToast("Жыйынтык ийгиликтүү жаңыртылып сакталды", "success"))
      .catch(() => showToast("Локалдык өзгөртүлдү", "info"));
  } else {
    showToast("Локалдык өзгөртүлдү", "success");
  }
}

export function exportResultsToCSV(testId, testTitle) {
  const records = Object.values(cachedResults).filter(r => r.testId === testId);
  if (records.length === 0) {
    showToast("Бул тест үчүн жыйынтыктар жок", "warning");
    return;
  }

  records.sort((a, b) => (a.studentName || "").localeCompare(b.studentName || ""));

  let csvContent = "\uFEFF"; // UTF-8 BOM
  csvContent += "Окуучунун аты,Классы,Упай,Жалпы упай,Пайыз,Баа,Статус,Тапшырган убактысы\n";

  records.forEach(r => {
    csvContent += `"${r.studentName || ''}","${r.studentClass || ''}",${r.earnedPoints},${r.totalPoints},${r.percent}%,${r.grade},"${r.status}","${new Date(r.timestamp).toLocaleString()}\"\n`;
  });

  triggerCsvDownload(csvContent, `Жыйынтык_${testTitle.replace(/\s+/g, "_")}.csv`);
}

export function exportAnnualReportToCSV() {
  const records = Object.values(cachedResults);
  if (records.length === 0) {
    showToast("Архивде эч кандай жыйынтык табылбады", "warning");
    return;
  }

  let csvContent = "\uFEFF"; // UTF-8 BOM
  csvContent += "Окуу жылы,Тест аталышы,Окуучу,Класс,Упай,Пайыз,Баа\n";

  const year = generateYearKey();
  records.forEach(r => {
    csvContent += `"${year}","${r.testTitle || ''}","${r.studentName || ''}","${r.studentClass || ''}",${r.earnedPoints}/${r.totalPoints},${r.percent}%,${r.grade}\n`;
  });

  triggerCsvDownload(csvContent, `Жылдык_Отчет_${year}.csv`);
}

function triggerCsvDownload(content, filename) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}
