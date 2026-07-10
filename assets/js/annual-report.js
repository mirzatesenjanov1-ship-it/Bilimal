/**
 * Билимал системасы үчүн Жылдык Жалпы Отчетту куруу жана CSV форматында жүктөө модулу.
 * Excel программасында кыргыз тамгалары (Ө, Ү, Ң) бузулбашы үчүн UTF-8 BOM колдонулат.
 */

export function downloadYearlyReportCSV(results) {
    if (!results || results.length === 0) {
        alert("Жүктөө үчүн отчеттук маалыматтар табылган жок!");
        return;
    }

    // CSV Таблицасынын башы (Headers)
    const headers = [
        "Окуучунун аты-жонү",
        "Классы",
        "Тесттин аталышы",
        "Тапшырылган убакыт",
        "Сарпталган убакыт (мүнөт)",
        "Автоматтык балл",
        "Мугалимдин кошумча упайы",
        "Жалпы пайыздык көрсөткүч",
        "Корутунду Баа",
        "Античит коопсуздугу",
        "Мугалимдин пикири"
    ];

    // Маалымат саптарын куруу
    const rows = results.map(r => [
        r.studentName || "Белгисиз Окуучу",
        r.classGroup || "—",
        r.testTitle || "Талдоосуз тест",
        r.endTime ? new Date(r.endTime).toLocaleDateString() : "—",
        r.durationUsed || "0",
        r.score || "0",
        r.manualPoints || "0",
        `${r.finalPercentage || 0}%`,
        r.grade || "3",
        r.hasCheatWarning ? "Шектүү аракеттер катталган" : "Таза/Тартиптүү",
        (r.teacherComment || "Жок").replace(/,/g, " ") // үтүрлөр CSV бузбаш үчүн алмаштырылат
    ]);

    // CSV Тексттик мазмунун түзүү
    let csvContent = headers.join(",") + "\n";
    rows.forEach(rowArray => {
        const row = rowArray.join(",");
        csvContent += row + "\n";
    });

    // UTF-8 BOM файлын куруу (Excel туура таануусу үчүн эң маанилүү кадам)
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
    
    // Жүктөө механизмин ишке киргизүү
    const link = document.createElement("a");
    if (link.download !== undefined) {
        const currentYear = "2026-2027";
        const sampleClass = results[0].classGroup || "Жалпы";
        
        link.href = URL.createObjectURL(blob);
        link.setAttribute("download", `Bilimal_Жылдык_Отчет_${currentYear}_${sampleClass}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}
