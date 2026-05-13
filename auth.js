/**
 * Mugalim.AI - Авторизация логикасы
 * Firebase Authentication менен толук туташтырылды.
 */

// Сиздин Firebase конфигурацияңыз (bilimal-org долбоорунан)
const firebaseConfig = {
    apiKey: "AIzaSyAsRjj_5VoQwZA7hSBWhkQ58UvUnct-b28",
    authDomain: "bilimal-org.firebaseapp.com",
    databaseURL: "https://bilimal-org-default-rtdb.firebaseio.com",
    projectId: "bilimal-org",
    storageBucket: "bilimal-org.firebasestorage.app",
    messagingSenderId: "241750360816",
    appId: "1:241750360816:web:a991434eb5afbc470d7835",
    measurementId: "G-9GSQV60QV0"
};

// Firebase'ти ишке киргизүү
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();

/**
 * КИРҮҮ ФУНКЦИЯСЫ
 */
function login() {
    const email = document.getElementById('email').value.trim();
    const pass = document.getElementById('password').value.trim();
    
    if (!email || !pass) {
        showStatus("Сураныч, бардык талааларды толтуруңуз!", "error");
        return;
    }

    // Firebase аркылуу кирүү логикасы
    auth.signInWithEmailAndPassword(email, pass)
        .then((userCredential) => {
            const user = userCredential.user;
            console.log("Кирди:", user.email);
            showStatus("Кош келиңиз! Башкаруу панелине өтүп жатасыз...", "success");
            
            // Ийгиликтүү киргенден кийин 1.5 секунддан соң панелге жиберебиз
            setTimeout(() => {
                window.location.href = "teacher-dashboard.html";
            }, 1500);
        })
        .catch((error) => {
            let errorMessage = "Ката кетти: " + error.message;
            if (error.code === 'auth/user-not-found') errorMessage = "Мындай колдонуучу табылган жок!";
            if (error.code === 'auth/wrong-password') errorMessage = "Сөз айкашы ката!";
            
            showStatus(errorMessage, "error");
        });
}

/**
 * КАТТОО ФУНКЦИЯСЫ
 */
function register() {
    const email = document.getElementById('email').value.trim();
    const pass = document.getElementById('password').value.trim();

    if (!email || !pass) {
        showStatus("Каттоо үчүн почта жана сөз айкашын толтуруңуз!", "error");
        return;
    }

    if (pass.length < 6) {
        showStatus("Сөз айкашы кеминде 6 белгиден турушу керек!", "error");
        return;
    }

    // Firebase аркылуу жаңы колдонуучу түзүү
    auth.createUserWithEmailAndPassword(email, pass)
        .then((userCredential) => {
            showStatus("Каттоо ийгиликтүү өттү! Эми кире аласыз.", "success");
            console.log("Жаңы мугалим катталды:", userCredential.user.email);
        })
        .catch((error) => {
            showStatus("Каттоодо ката: " + error.message, "error");
        });
}

/**
 * Статус билдирүүсү
 */
function showStatus(message, type) {
    alert(message);
    console.log(`[${type.toUpperCase()}]: ${message}`);
}
