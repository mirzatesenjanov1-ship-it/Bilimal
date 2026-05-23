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
 * АВТОРИЗАЦИЯ АБАЛЫН КӨЗӨМӨЛДӨӨ (ЖАҢЫ ТОЛУКТОО)
 * Бул функция мугалим Кыз Куумай оюнуна киргенде же баракчаларды алмаштырганда
 * анын сессиясын сактап, PERMISSION_DENIED катасынын алдын алат.
 */
firebase.auth().onAuthStateChanged((user) => {
    const currentPage = window.location.pathname;

    if (user) {
        console.log("Колдонуучу активдүү:", user.email);
        // Мугалимдин UID'ин локалдык сактагычка жазуу (оюн тараптан окуу үчүн)
        localStorage.setItem("teacherUid", user.uid);
        
        // Эгер мугалим кирүү баракчасында турса, автоматтык түрдө жеке кабинетке өткөрүү
        if (currentPage.includes("index.html") && !currentPage.includes("games") && !currentPage.includes("multi-quiz")) {
            window.location.href = "teacher-dashboard.html";
        }
    } else {
        console.log("Колдонуучу системага кирген эмес же чыгып кетти.");
        localStorage.removeItem("teacherUid");
        
        // Корголгон жеке кабинет баракчасын коноктордон коргоо
        if (currentPage.includes("teacher-dashboard.html") || currentPage.includes("cabinet.html")) {
            alert("Сураныч, алгач системага кириңиз!");
            window.location.href = "index.html"; 
        }
    }
});

/**
 * КИРҮҮ ФУНКЦИЯСЫ
 * Катталган колдонуучулар үчүн
 */
function login() {
    const email = document.getElementById('email').value.trim();
    const pass = document.getElementById('password').value.trim();
    
    if (!email || !pass) {
        showStatus("Сураныч, бардык талааларды толтуруңуз!", "error");
        return;
    }

    // Браузерде сессияны сактоо
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
        .then(() => {
            return auth.signInWithEmailAndPassword(email, pass);
        })
        .then((userCredential) => {
            console.log("Кирди:", userCredential.user.email);
            // Мугалим киргенде UID'ди дароо сактоо
            localStorage.setItem("teacherUid", userCredential.user.uid);
            
            showStatus("Кош келиңиз! Башкаруу панелине өтүп жатасыз...", "success");
            
            setTimeout(() => {
                window.location.href = "teacher-dashboard.html";
            }, 1500);
        })
        .catch((error) => {
            let errorMessage = "Ката кетти: " + error.message;
            if (error.code === 'auth/user-not-found') errorMessage = "Мындай колдонуучу табылган жок! Алгач каттоодон өтүңүз.";
            if (error.code === 'auth/wrong-password') errorMessage = "Сөз айкашы ката!";
            if (error.code === 'auth/configuration-not-found') errorMessage = "Firebase консолунда Email/Password күйгүзүлгөн эмес!";
            
            showStatus(errorMessage, "error");
        });
}

/**
 * КАТТОО ФУНКЦИЯСЫ
 * Биринчи жолу кирген колдонуучулар үчүн
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
            // Катталгандан кийин дароо киргизбөө үчүн (логин аркылуу кирүүсүн талап кылуу)
            auth.signOut(); 
            localStorage.removeItem("teacherUid");
            showStatus("Каттоо ийгиликтүү өттү! Эми сактаган почтаңыз менен кире аласыз.", "success");
        })
        .catch((error) => {
            let errorMessage = "Каттоодо ката: " + error.message;
            if (error.code === 'auth/email-already-in-use') errorMessage = "Бул почта мурда катталган!";
            
            showStatus(errorMessage, "error");
        });
}

/**
 * СИСТЕМАТАН ЧЫГУУ ФУНКЦИЯСЫ (ЖАҢЫ ТОЛУКТОО)
 * Жеке кабинеттеги "Чыгуу" баскычына туташтыруу үчүн
 */
function logout() {
    auth.signOut().then(() => {
        localStorage.removeItem("teacherUid");
        console.log("Колдонуучу ийгиликтүү чыкты.");
        window.location.href = "index.html";
    }).catch((error) => {
        console.error("Чыгууда ката кетти:", error);
    });
}

function showStatus(message, type) {
    alert(message);
    console.log(`[${type.toUpperCase()}]: ${message}`);
}
