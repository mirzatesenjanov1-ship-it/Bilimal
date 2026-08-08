async function viewResults(testId, title) {
    const modal = document.getElementById('resultsModal');
    const titleEl = document.getElementById('modalTitle');
    const tableBody = document.getElementById('resultsTableBody');

    titleEl.innerText = `Жыйынтыктар: ${title}`;
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> Жүктөлүүдө...</td></tr>';
    modal.style.display = 'flex';

    try {
        const dbRef = ref(db);
        let foundResults = [];

        // 1. test_results/TEST_ID текшерүү
        let snap = await get(child(dbRef, `test_results/${testId}`));
        if (snap.exists()) {
            foundResults = Object.values(snap.val());
        } else {
            // 2. results/TEST_ID текшерүү (эски жолу)
            snap = await get(child(dbRef, `results/${testId}`));
            if (snap.exists()) {
                foundResults = Object.values(snap.val());
            } else {
                // 3. Эгер катардагы массив болсо же testId менен фильтрациялоо керек болсо
                snap = await get(child(dbRef, `test_results`));
                if (snap.exists()) {
                    const allData = snap.val();
                    Object.values(allData).forEach(item => {
                        if (item.testId === testId) {
                            foundResults.push(item);
                        }
                    });
                }
            }
        }

        if (foundResults.length > 0) {
            tableBody.innerHTML = '';

            foundResults.forEach(r => {
                const cheatedCount = r.cheatedCount || 0;
                let cheatedBadge = `<span style="color:#10b981;">Таза (0)</span>`;

                if (cheatedCount > 0) {
                    cheatedBadge = `<span style="color:#ff0055; font-weight:bold;"><i class="fa-solid fa-triangle-exclamation"></i> ${cheatedCount} жолу</span>`;
                }

                if (r.cheatingAttempt) {
                    cheatedBadge += ` <small style="color:#ff0055;">(Бөгөттөлгөн)</small>`;
                }

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${r.studentName || '-'}</td>
                    <td>${r.studentClass || '-'}</td>
                    <td><strong>${r.score || 0}</strong> / ${r.totalQuestions || '-'}</td>
                    <td><strong>${r.percent || 0}%</strong></td>
                    <td>${cheatedBadge}</td>
                    <td>${r.date ? new Date(r.date).toLocaleString('ky-KG') : '-'}</td>
                `;
                tableBody.appendChild(tr);
            });
        } else {
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#94a3b8;">Бул тестти азырынча эч ким тапшыра элек.</td></tr>';
        }
    } catch (err) {
        console.error("Жыйынтыктарды жүктөөдө ката:", err);
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#ff0055;">Ката чыкты: ${err.message}</td></tr>`;
    }
}
