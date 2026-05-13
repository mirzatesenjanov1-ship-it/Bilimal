function login() {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    
    if(email && pass) {
        alert(email + " кош келиңиз! Базага туташуу текшерилүүдө...");
        // Бул жерге кийин Firebase туташтырабыз
    } else {
        alert("Сураныч, бардык талааларды толтуруңуз!");
    }
}

function register() {
    alert("Каттоо системасы даярдалууда. Firebase туташтырылгандан кийин активдешет.");
}
