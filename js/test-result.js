document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    
    const score = parseInt(urlParams.get('score')) || 0;
    const total = parseInt(urlParams.get('total')) || 0;
    const perc = parseInt(urlParams.get('perc')) || 0;
    const name = urlParams.get('name') || '';

    // Аты-жөнүн көрсөтүү
    const studentGreeting = document.getElementById('studentGreeting');
    if (name) {
        studentGreeting.innerText = `Азаматсыз, ${decodeURIComponent(name)}!`;
    }

    // Процентти жана баллды көрсөтүү
    document.getElementById('resPercent').innerText = `${perc}%`;
    document.getElementById('resDetails').innerText = `Сиз ${total} суроонун ичинен ${score} суроого туура жооп бердиңиз.`;

    // Индикатордун түсүн жана статусун аныктоо
    const scoreCircle = document.getElementById('scoreCircle');
    const statusMsg = document.getElementById('statusMsg');

    if (perc >= 85) {
        scoreCircle.style.borderColor = '#10b981';
        scoreCircle.style.color = '#10b981';
        scoreCircle.style.boxShadow = '0 0 25px rgba(16, 185, 129, 0.4)';
        statusMsg.style.color = '#10b981';
        statusMsg.innerText = '🎉 Эң сонун жыйынтык!';
    } else if (perc >= 60) {
        scoreCircle.style.borderColor = '#00f0ff';
        scoreCircle.style.color = '#00f0ff';
        scoreCircle.style.boxShadow = '0 0 25px rgba(0, 240, 255, 0.4)';
        statusMsg.style.color = '#00f0ff';
        statusMsg.innerText = '👍 Жакшы жыйынтык!';
    } else if (perc >= 40) {
        scoreCircle.style.borderColor = '#f59e0b';
        scoreCircle.style.color = '#f59e0b';
        scoreCircle.style.boxShadow = '0 0 25px rgba(245, 158, 11, 0.4)';
        statusMsg.style.color = '#f59e0b';
        statusMsg.innerText = '😐 Орточо, дагы аракет кылуу керек.';
    } else {
        scoreCircle.style.borderColor = '#ff0055';
        scoreCircle.style.color = '#ff0055';
        scoreCircle.style.boxShadow = '0 0 25px rgba(255, 0, 85, 0.4)';
        statusMsg.style.color = '#ff0055';
        statusMsg.innerText = '⚠️ Теманы кайра кайталоо сунушталат.';
    }
});
