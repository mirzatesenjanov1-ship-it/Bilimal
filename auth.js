/**
 * Mugalim.AI - Авторизация логикасы
 * Firebase Authentication менен толук туташтырылды.
 */

// Сиздин Firebase конфигурацияңыз (image_1ff39a.png негизинде)
const firebaseConfig = {
    apiKey: "AIzaSyAsRjj_5VoQwZA7hSBWhkQ58UvUnct-b28",
    authDomain: "bilimal-org.firebaseapp.com",
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

    auth.signInWithEmailAndPassword(email, pass)
        .then((userCredential) => {
            console.log("Кирди:", userCredential.user.email);
            showStatus("Кош келиңиз! Башкаруу панелине өтүп жатасыз...", "success");
            
            setTimeout(() => {
                window.location.href = "teacher-dashboard.html";
            }, 1500);
        })
        .catch((error) => {
            let errorMessage = "Ката кетти: " + error.message;
            if (error.code === 'auth/user-not-found') errorMessage = "Мындай колдонуучу табылган жок!";
            if (error.code === 'auth/wrong-password') errorMessage = "Сөз айкашы ката!";
            if (error.code === 'auth/configuration-not-found') errorMessage = "Firebase консолунда Email/Password күйгүзүлгөн эмес!";
            
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

    auth.createUserWithEmailAndPassword(email, pass)
        .then((userCredential) => {
            showStatus("Каттоо ийгиликтүү өттү! Эми кире аласыз.", "success");
        })
        .catch((error) => {
            showStatus("Каттоодо ката: " + error.message, "error");
        });
}

function showStatus(message, type) {
    alert(message);
    console.log(`[${type.toUpperCase()}]: ${message}`);
}
