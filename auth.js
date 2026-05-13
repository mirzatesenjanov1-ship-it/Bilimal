/**
 * Mugalim.AI - Авторизация логикасы
 * Бул файл Firebase туташканга чейинки убактылуу функцияларды аткарат.
 */

function login() {
    // Формадагы маалыматтарды алуу
    const email = document.getElementById('email').value.trim();
    const pass = document.getElementById('password').value.trim();
    
    // Текшерүү (Validation)
    if (!email || !pass) {
        showStatus("Сураныч, бардык талааларды толтуруңуз!", "error");
        return;
    }

    // Email форматын текшерүү (жөнөкөй формат)
    if (!email.includes("@")) {
        showStatus("Сураныч, туура электрондук почта киргизиңиз!", "error");
        return;
    }

    // Ийгиликтүү кирүү (симуляция)
    console.log("Кирүү аракети:", email);
    showStatus(email + " кош келиңиз! Базага туташуу текшерилүүдө...", "success");

    // БУЛ ЖЕРГЕ КИЙИН FIREBASE ТУТАШТЫРАБЫЗ
    // Мисалы: auth.signInWithEmailAndPassword(email, pass)...
}

function register() {
    showStatus("Каттоо системасы даярдалууда. Firebase туташтырылгандан кийин активдешет.", "info");
}

/**
 * Колдонуучуга билдирүү көрсөтүү функциясы (alert ордуна кооздоо үчүн)
 * @param {string} message - Көрсөтүлө турган текст
 * @param {string} type - 'success', 'error', же 'info'
 */
function showStatus(message, type) {
    // Эгерде браузерде alert колдонууну кааласаңыз, төмөнкү кодду калтырыңыз:
    alert(message);
    
    // Келечекте бул жерге экрандын бурчуна чыга турган кооз "Toast" билдирүүлөрүн кошсо болот.
    console.log(`[${type.toUpperCase()}]: ${message}`);
}
