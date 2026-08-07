const resData = JSON.parse(localStorage.getItem('lastResult'));

if (!resData) {
    window.location.href = '/';
} else {
    document.getElementById('resPercent').innerText = `${resData.percentage}%`;
    document.getElementById('resDetails').innerText = `${resData.studentName}, Сиз ${resData.total} суроодон ${resData.score} туура жооп бердиңиз.`;
}
