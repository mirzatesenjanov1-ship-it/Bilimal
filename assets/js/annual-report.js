import { Toast } from "./toast.js";

const AnnualReportExporter = {
    exportToCSV(cachedResults) {
        try {
            if (!cachedResults || Object.keys(cachedResults).length === 0) {
                Toast.warning("Экспорттоо үчүн эч кандай маалымат табылган жок.");
                return;
            }

            let csvContent = "\uFEFF"; // UTF-8 BOM for Microsoft Excel Kyrgyz rendering support
            csvContent += "Тесттин ID,Окуучунун аты-жөнү,Класс,Упай,Пайыз,Баа,Античит Эскертүүлөрү,Статус\r\n";

            Object.entries(cachedResults).forEach(([testId, studentsMap]) => {
                Object.entries(studentsMap).forEach(([studentId, r]) => {
                    const line = [
                        testId,
                        r.studentName || "Аноним",
                        r.studentClass || "Жок",
                        r.score || 0,
                        (r.percent || 0) + "%",
                        r.gradeMark || "Жок",
                        r.antiCheatAlerts || 0,
                        r.status || "күтүүдө"
                    ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(",");
                    csvContent += line + "\r\n";
                });
            });

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", `Bilimal_Жылдык_Отчет_${new Date().getFullYear()}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            Toast.success("Жылдык отчет Microsoft Excel CSV форматында ийгиликтүү жүктөлдү.");
        } catch (e) {
            Toast.danger("CSV Экспорт учурунда ката келип чыкты.");
        }
    }
};
window.AnnualReportExporter = AnnualReportExporter;
export { AnnualReportExporter };
