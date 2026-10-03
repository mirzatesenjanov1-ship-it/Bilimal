// Firebase Config Initialization (Бул жерге чыныгы Firebase конфигурацияңыз жазылат)
const firebaseConfig = {
  apiKey: "AIzaSyDummyKey_Bilimal_2026",
  authDomain: "bilimal-app.firebaseapp.com",
  databaseURL: "https://bilimal-default-rtdb.firebaseio.com",
  projectId: "bilimal-app",
  storageBucket: "bilimal-app.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const rtdb = firebase.database();

let currentUser = null;
let currentLanguage = 'ky';

const i18nTranslations = {
  ky: {
    nav_home: "Башкы бет",
    nav_marketplace: "Маркетплейс",
    nav_tests: "Тесттер",
    nav_plans: "Сабак пландары",
    nav_ebooks: "Э-Китептер",
    btn_login: "Кирүү",
    btn_register: "Катталуу",
    btn_cabinet: "Кабинет",
    btn_logout: "Чыгуу",
    mp_title: "Мугалимдердин маркетплейси",
    commission_note: "Платформа комиссиясы — 21%"
  },
  ru: {
    nav_home: "Главная",
    nav_marketplace: "Маркетплейс",
    nav_tests: "Тесты",
    nav_plans: "Планы уроков",
    nav_ebooks: "Э-Книги",
    btn_login: "Войти",
    btn_register: "Регистрация",
    btn_cabinet: "Кабинет",
    btn_logout: "Выйти",
    mp_title: "Маркетплейс учителей",
    commission_note: "Комиссия платформы — 21%"
  },
  en: {
    nav_home: "Home",
    nav_marketplace: "Marketplace",
    nav_tests: "Tests",
    nav_plans: "Lesson Plans",
    nav_ebooks: "E-Books",
    btn_login: "Login",
    btn_register: "Register",
    btn_cabinet: "Cabinet",
    btn_logout: "Logout",
    mp_title: "Teacher Marketplace",
    commission_note: "Platform commission — 21%"
  }
};

document.addEventListener('DOMContentLoaded', () => {
  initAuthListeners();
  initNavigation();
  initLanguageSelector();
});

function initAuthListeners() {
  auth.onAuthStateChanged((user) => {
    currentUser = user;
    const authButtons = document.getElementById('authButtons');
    const userProfile = document.getElementById('userProfile');
    const userNameDisplay = document.getElementById('userNameDisplay');

    if (user) {
      authButtons.classList.add('hidden');
      userProfile.classList.remove('hidden');
      userNameDisplay.textContent = user.displayName || user.email;

      rtdb.ref(`users/${user.uid}`).once('value', (snap) => {
        if (snap.exists() && snap.val().role === 'admin') {
          document.getElementById('admin-finance-section').classList.remove('hidden');
          if (window.AdminFinance) window.AdminFinance.loadAdminDashboard();
        }
      });

      if (window.TeacherCabinet) window.TeacherCabinet.loadCabinetData(user.uid);
    } else {
      authButtons.classList.remove('hidden');
      userProfile.classList.add('hidden');
    }
  });

  document.getElementById('logoutBtn').addEventListener('click', () => auth.signOut());
}

function initNavigation() {
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');

      const target = link.getAttribute('href');
      if (target === '#marketplace') {
        document.getElementById('marketplace-section').classList.remove('hidden');
        document.getElementById('cabinet-section').classList.add('hidden');
      }
    });
  });

  document.getElementById('cabinetBtn').addEventListener('click', () => {
    document.getElementById('marketplace-section').classList.add('hidden');
    document.getElementById('cabinet-section').classList.remove('hidden');
  });
}

function initLanguageSelector() {
  const langSelect = document.getElementById('langSelect');
  langSelect.addEventListener('change', (e) => {
    currentLanguage = e.target.value;
    updateLanguageTexts();
  });
}

function updateLanguageTexts() {
  const lang = i18nTranslations[currentLanguage];
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (lang[key]) el.textContent = lang[key];
  });
}
