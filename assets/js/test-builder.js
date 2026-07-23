async function saveTestToFirebase(status) {
    // Эгер жарыяланып жатса, draft сөзүн алып таштап таза ID түзөбүз
    let finalTestId = activeTestId;
    if (status === "active" && activeTestId.startsWith("builder_draft_")) {
        finalTestId = "test_" + Date.now();
    }

    const payload = assemblePayload(status);
    payload.id = finalTestId;

    try {
        // 1. Базага сактоо
        const teacherTestRef = ref(database, `teachers_data/${teacherId}/tests/${finalTestId}`);
        await set(teacherTestRef, payload);

        // 2. Глобалдык издөөгө каттоо
        const globalLookupRef = ref(database, `global_test_lookup/${finalTestId}`);
        await set(globalLookupRef, { teacherUid: teacherId });

        // Убактылуу черновикти өчүрүү
        localStorage.removeItem(`bilimal_builder_backup_${activeTestId}`);

        if (status === "active") {
            const shareUrl = `https://bilimal.org/sections/take-test.html?id=${finalTestId}`;
            prompt("Тест ийгиликтүү жарыяланды! Окуучуларга ушул шилтемени жөнөтүңүз:", shareUrl);
            window.location.href = "/sections/tests.html";
        } else {
            alert("Тест черновик катары сакталды!");
        }
    } catch (error) {
        console.error("Базага сактоодо ката чыкты:", error);
        alert("Базага туташууда ката кетти. Интернет байланышын текшериңиз.");
    }
}
