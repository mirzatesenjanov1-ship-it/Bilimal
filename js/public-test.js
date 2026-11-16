// js/public-test.js — BiliMal онлайн тест кыймылдаткычы (бекемделген нускасы)
//
// Өзгөрбөгөндөр: тест логикасы, упай эсептөө принциби, суроолордун түзүмү, Firebase жолдору
// (tests/{id}, test_results/{id}/{pushKey}), жыйынтык объектинин талаалары, MathJax чакырыктары.
//
// Кошулгандар: draft recovery, offline outbox + retry, идемпотенттүү жөнөтүү (бир ачкыч → set),
// Date.now() негизиндеги таймер, жалгыз anti-cheat эсеби (тестти автоматтык аяктабайт),
// коопсуз DOM, MathJax кезеги.

/* =====================================================================
   КОНФИГУРАЦИЯ
   ===================================================================== */
const CFG = {
    // false  -> анти-чит тестти АВТОМАТТЫК АЯКТАБАЙТ (эскертүү көрсөтөт жана cheatedCount'ка жазат)
    // true   -> эски жүрүм-турум: MAX_WARNINGS бузуудан кийин тест 'cheating' менен аяктайт
    AUTO_FINISH_ON_VIOLATIONS: false,
    MAX_WARNINGS: 3,
    AWAY_GRACE_MS: 3000,            // бул убакыттан кыска "кетүү" (билдирүү, кыска үзгүлтүк) бузуу эмес
    LOAD_TIMEOUT_MS: 10000,
    SEND_TIMEOUT_MS: 15000,
    ATTEMPT_CHECK_TIMEOUT_MS: 8000,
    NEXT_DEBOUNCE_MS: 400,
    RETRY_DELAYS_MS: [2000, 5000, 10000, 20000, 40000, 60000],
    DRAFT_VERSION: 1
};

window.__bilimalBooted = true;   // HTML watchdog үчүн

/* =====================================================================
   ТЕКСТТЕР (жаңы билдирүүлөр үчүн)
   ===================================================================== */
const MSG = {
    ky: {
        loadErr: 'Тестти жүктөөдө ката чыкты!', retry: 'Кайра аракет кылуу', noQuestions: 'Бул тестте суроолор жок.',
        saving: 'Жыйынтык жөнөтүлүүдө…', saved: '✅ Жыйынтык мугалимге жөнөтүлдү.',
        pending: '⚠️ Интернет жок. Жыйынтыгыңыз түзмөктө сакталды, байланыш келери менен автоматтык түрдө жөнөтүлөт. Бул баракты жаппаңыз.',
        resend: 'Кайра жөнөтүү', resumed: 'Тест калыбына келтирилди. Жоопторуңуз сакталган.',
        warnTitle: 'ЭСКЕРТҮҮ: Башка терезеге же AI куралына өтүүгө болбойт!',
        warnCount: 'Тесттен чыгуу эрежесин бузуу:', warnBack: 'Тестке кайтуу үчүн ушул экранды чыкылдатыңыз.',
        blockTitle: 'ТЕСТ БӨГӨТТӨЛДҮ!'
    },
    ru: {
        loadErr: 'Ошибка загрузки теста!', retry: 'Повторить', noQuestions: 'В этом тесте нет вопросов.',
        saving: 'Результат отправляется…', saved: '✅ Результат отправлен учителю.',
        pending: '⚠️ Нет интернета. Результат сохранён на устройстве и будет отправлен автоматически, когда появится связь. Не закрывайте эту страницу.',
        resend: 'Отправить ещё раз', resumed: 'Тест восстановлен. Ваши ответы сохранены.',
        warnTitle: 'ВНИМАНИЕ: нельзя переключаться на другое окно или ИИ!',
        warnCount: 'Нарушений правил выхода:', warnBack: 'Нажмите на этот экран, чтобы вернуться к тесту.',
        blockTitle: 'ТЕСТ ЗАБЛОКИРОВАН!'
    },
    en: {
        loadErr: 'Failed to load the test!', retry: 'Try again', noQuestions: 'This test has no questions.',
        saving: 'Sending your result…', saved: '✅ Your result was sent to the teacher.',
        pending: '⚠️ No internet. Your result is saved on this device and will be sent automatically once you are online. Do not close this page.',
        resend: 'Send again', resumed: 'Test restored. Your answers were saved.',
        warnTitle: 'WARNING: do not switch to another window or an AI tool!',
        warnCount: 'Rule violations:', warnBack: 'Tap this screen to return to the test.',
        blockTitle: 'TEST BLOCKED!'
    }
};
function curLang() {
    try { if (typeof currentLang !== 'undefined' && MSG[currentLang]) return currentLang; } catch (e) { /* ignore */ }
    return 'ru';
}
const m = (k) => MSG[curLang()][k];

/* =====================================================================
   ЖАРДАМЧЫЛАР: storage, hash, timeout
   ===================================================================== */
const mem = new Map();
const store = {
    all(k) {
        const out = [];
        try { const v = localStorage.getItem(k); if (v !== null) out.push(v); } catch (e) { /* blocked */ }
        try { const v = sessionStorage.getItem(k); if (v !== null) out.push(v); } catch (e) { /* blocked */ }
        if (mem.has(k)) out.push(mem.get(k));
        return out;
    },
    get(k) { const a = store.all(k); return a.length ? a[0] : null; },
    set(k, v) {                         // true -> жок дегенде бир туруктуу storage'ге жазылды
        let ok = false;
        try { localStorage.setItem(k, v); ok = true; } catch (e) { /* quota/blocked */ }
        try { sessionStorage.setItem(k, v); ok = true; } catch (e) { /* quota/blocked */ }
        mem.set(k, v);
        return ok;
    },
    del(k) {
        try { localStorage.removeItem(k); } catch (e) { /* ignore */ }
        try { sessionStorage.removeItem(k); } catch (e) { /* ignore */ }
        mem.delete(k);
    }
};

function hash(str) {                    // FNV-1a — localStorage бузулушун аныктоо үчүн (коопсуздук эмес)
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(36);
}
function pack(obj) { const b = JSON.stringify(obj); return JSON.stringify({ c: hash(b), b }); }
function unpack(s) {
    if (typeof s !== 'string') return null;
    try {
        const w = JSON.parse(s);
        if (!w || typeof w.b !== 'string' || hash(w.b) !== w.c) return null;
        return JSON.parse(w.b);
    } catch (e) { return null; }
}
function withTimeout(p, ms, label) {
    return new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('timeout:' + label)), ms);
        Promise.resolve(p).then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
    });
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const $ = (id) => document.getElementById(id);

/* =====================================================================
   FIREBASE (бир жолу жүктөлөт, ката болсо кайра аракет кылууга болот)
   ===================================================================== */
let fbPromise = null;
function loadFirebase() {
    if (!fbPromise) {
        fbPromise = (async () => {
            const [cfg, dbm] = await Promise.all([
                import('../firebase/firebase-config.js'),
                import('https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js')
            ]);
            return { db: cfg.db, ref: dbm.ref, get: dbm.get, child: dbm.child, push: dbm.push, set: dbm.set };
        })().catch(e => { fbPromise = null; throw e; });
    }
    return fbPromise;
}

/* =====================================================================
   КҮЙ (STATE)
   ===================================================================== */
const urlParams = new URLSearchParams(window.location.search);
const testId = urlParams.get('testId') || urlParams.get('id');
const validId = (s) => typeof s === 'string' && /^[^.$#\[\]\/\u0000-\u001f]{1,128}$/.test(s);

let testData = null;
let qs = [];                    // нормалдаштырылган суроолор
let currentQIndex = 0;
let userAnswers = {};
let questionTimes = {};
let questionStartTime = Date.now();
let renderedIndex = -1;         // DOM'до кайсы суроо тартылган
let renderTok = 0;

let session = null;             // {v,testId,attemptId,name,cls,startedAt,endAt}
let running = false;
let starting = false;
let finishLock = false;
let warningCount = 0;

let timerInterval = null;
let timerTextEl = null;
let timerShown = -1;
let persistTimer = null;
let lastNextAt = 0;
let wakeLock = null;
let awaySince = 0;
let overlayEl = null;
let lastAttemptKey = null;
let listenersBound = false;

const DRAFT_KEY = `bilimal_draft_${testId}`;
const SNAP_KEY = `bilimal_snap_${testId}`;
const CACHE_KEY = `bilimal_testcache_${testId}`;
const OUTBOX_KEY = 'bilimal_outbox_v1';

const els = {};
function cacheEls() {
    ['lblTitle', 'lblMeta', 'startBtn', 'nextBtn', 'startScreen', 'runningScreen', 'timer', 'progress',
        'pisaBox', 'qText', 'imgContainer', 'optionsContainer', 'alreadyPassedContainer']
        .forEach(id => { els[id] = $(id); });
}

/* =====================================================================
   КООПСУЗ DOM: HTML тазалоо (формулаларга тийбейт)
   ===================================================================== */
const BLOCK_TAGS = new Set(['SCRIPT', 'IFRAME', 'FRAME', 'FRAMESET', 'OBJECT', 'EMBED', 'LINK', 'META', 'STYLE', 'BASE', 'FORM', 'APPLET', 'NOSCRIPT']);
const URL_ATTRS = new Set(['href', 'src', 'xlink:href', 'action', 'formaction', 'srcset', 'data', 'poster', 'background']);

function badUrl(v) {
    const p = String(v).replace(/[\u0000-  ]+/g, '').toLowerCase();
    if (/^(javascript|vbscript):/.test(p)) return true;
    if (/^data:/.test(p) && !/^data:image\/(png|jpe?g|gif|webp|bmp)[;,]/.test(p)) return true;
    return false;
}
function cleanTree(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    const kill = [];
    let n;
    while ((n = walker.nextNode())) {
        if (BLOCK_TAGS.has(String(n.tagName).toUpperCase())) { kill.push(n); continue; }
        for (const a of Array.from(n.attributes)) {
            const name = a.name.toLowerCase();
            if (name.startsWith('on')) { n.removeAttribute(a.name); continue; }
            if (URL_ATTRS.has(name) && badUrl(a.value)) { n.removeAttribute(a.name); continue; }
            if (name === 'style' && /expression\s*\(|javascript:|url\s*\(/i.test(a.value)) n.removeAttribute(a.name);
        }
    }
    kill.forEach(k => k.remove());
}
// innerHTML менен бирдей DOM пайда болот, бирок коркунучтуу элементтер/атрибуттар алынып салынат.
// LaTeX ($...$, \(...\)) текст катары өзгөрүүсүз калат.
function setSafeHtml(el, html, append) {
    const t = document.createElement('template');
    t.innerHTML = String(html == null ? '' : html);
    cleanTree(t.content);
    try { if (window.BiliRender) window.BiliRender.processImages(t.content); } catch (e) { /* ignore */ }
    if (!append) el.textContent = '';
    el.appendChild(t.content);
}
function htmlToText(s) {                // <option> үчүн: innerHTML'дин тексттик натыйжасы
    const t = document.createElement('template');
    t.innerHTML = String(s == null ? '' : s);
    return t.content.textContent || '';
}
function safeUrl(u) {
    const s = String(u == null ? '' : u).trim();
    return (!s || badUrl(s)) ? '' : s;
}
function prepareMathText(text) {
    if (!text) return '';
    let str = String(text);
    if ((str.includes('\\text') || str.includes('\\frac') || str.includes('^')) && !str.includes('$')) {
        return `$${str}$`;
    }
    return str;
}
function cleanName(str) {
    if (!str) return '';
    return str.toLowerCase().replace(/\s+/g, ' ').trim();
}
function shuffled(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
}

/* =====================================================================
   ТЕСТТИ НОРМАЛДАШТЫРУУ (null/object түрүндөгү массивдерден коргонуу)
   ===================================================================== */
function numericKeysToArray(obj) {
    return Object.keys(obj).sort((a, b) => Number(a) - Number(b)).map(k => obj[k]);
}
function normalizeTest(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const t = Object.assign({}, raw);
    let list = raw.questions;
    if (list && !Array.isArray(list) && typeof list === 'object') list = numericKeysToArray(list);
    if (!Array.isArray(list)) list = [];
    t.questions = list.filter(q => q && typeof q === 'object').map(q => {
        const n = Object.assign({}, q);
        let o = q.options;
        if (o && !Array.isArray(o) && typeof o === 'object') o = numericKeysToArray(o);
        if (Array.isArray(o)) n.options = o.map(x => (x === null || x === undefined) ? '' : x);
        return n;
    });
    return t;
}

/* =====================================================================
   ТЕСТТИ ЖҮКТӨӨ (retry + кэш)
   ===================================================================== */
async function fetchTestOnce() {
    const fb = await withTimeout(loadFirebase(), CFG.LOAD_TIMEOUT_MS, 'firebase');
    const snap = await withTimeout(get_(fb, `tests/${testId}`), CFG.LOAD_TIMEOUT_MS, 'test');
    return snap.exists() ? { exists: true, data: snap.val() } : { exists: false };
}
function get_(fb, path) { return fb.get(fb.child(fb.ref(fb.db), path)); }

async function loadTestWithRetry() {
    let lastErr = null;
    for (let i = 0; i < 3; i++) {
        try {
            const r = await fetchTestOnce();
            if (r.exists) store.set(CACHE_KEY, pack(r.data));
            return r;
        } catch (e) { lastErr = e; await sleep(700 * (i + 1)); }
    }
    const cached = unpack(store.get(CACHE_KEY));
    if (cached) return { exists: true, data: cached, fromCache: true };
    throw lastErr || new Error('load failed');
}

function showMeta() {
    els.lblTitle.textContent = testData.title || 'Тест';
    const maxAtt = testData.maxAttempts !== undefined ? testData.maxAttempts : 0;
    const attText = maxAtt === 0 ? 'Чексиз' : `${maxAtt} жолу`;
    els.lblMeta.textContent = `${testData.subject || ''} | ${testData.grade || ''}-класс | Убакыт: ${testData.duration || 15} мүнөт | Тапшыруу чеги: ${attText}`;
}
function setReady() {
    window.__testReady = true;
    try { if (typeof window.__recheckStart === 'function') window.__recheckStart(); } catch (e) { /* ignore */ }
}
function showLoadError() {
    els.lblTitle.textContent = m('loadErr');
    const box = els.alreadyPassedContainer;
    if (!box) return;
    box.textContent = '';
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn-start'; b.textContent = m('retry');
    b.addEventListener('click', () => { box.textContent = ''; init(true); });
    box.appendChild(b);
}

/* =====================================================================
   DRAFT / SESSION RECOVERY
   ===================================================================== */
function loadBestDraft() {
    const cands = store.all(DRAFT_KEY).map(unpack)
        .filter(d => d && d.v === CFG.DRAFT_VERSION && d.testId === testId && d.attemptId && Number(d.endAt) > 0);
    cands.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
    return cands[0] || null;
}
function writeDraft() {
    if (!session || !running || finishLock) return;
    session.idx = currentQIndex;
    session.qStart = questionStartTime;
    session.answers = userAnswers;
    session.times = questionTimes;
    session.warnings = warningCount;
    session.savedAt = Date.now();
    store.set(DRAFT_KEY, pack(session));
}
function persistDraft(immediate) {
    if (!running || finishLock) return;
    if (immediate) { clearTimeout(persistTimer); persistTimer = null; writeDraft(); return; }
    if (persistTimer) return;
    persistTimer = setTimeout(() => { persistTimer = null; writeDraft(); }, 250);
}
function clearDraft() { store.del(DRAFT_KEY); store.del(SNAP_KEY); }
function flushNow() {                   // барак жабылар/фонго кетерде
    if (!running || finishLock) return;
    try { captureAnswer(); } catch (e) { /* ignore */ }
    persistDraft(true);
}

/* =====================================================================
   БАШТОО
   ===================================================================== */
async function getStudentAttemptsCount(targetTestId, studentName) {
    let count = 0;
    try {
        const fb = await withTimeout(loadFirebase(), CFG.ATTEMPT_CHECK_TIMEOUT_MS, 'firebase');
        const snap = await withTimeout(get_(fb, `test_results/${targetTestId}`), CFG.ATTEMPT_CHECK_TIMEOUT_MS, 'attempts');
        if (snap.exists()) {
            const results = snap.val() || {};
            const cleanedInputName = cleanName(studentName);
            Object.values(results).forEach(r => {
                if (r && r.studentName && cleanName(r.studentName) === cleanedInputName) count++;
            });
        }
    } catch (e) {
        console.warn('Аракеттер санын алууда эскертүү:', e && e.message);
    }
    return count;
}

function newAttemptKey(fb) {
    try { if (fb) { const k = fb.push(fb.ref(fb.db, `test_results/${testId}`)).key; if (k) return k; } } catch (e) { /* ignore */ }
    return '-Z' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

async function startTest() {
    if (starting || running || finishLock) return;
    const btn = els.startBtn;
    if (btn && btn.dataset.disabledLimit) return;

    const nameInput = $('studentName');
    const classInput = $('studentClass');
    const name = nameInput ? nameInput.value.trim().slice(0, 100) : '';
    const cls = classInput ? classInput.value.trim().slice(0, 30) : '';

    if (!name || !cls) { alert('Аты-жөнүңүздү жана классыңызды жазыңыз!'); return; }
    if (!testData) { els.lblTitle.textContent = m('loadErr'); return; }
    if (!qs.length) { els.lblTitle.textContent = m('noQuestions'); return; }

    starting = true;
    const prevText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Текшерилүүдө...';

    try {
        const maxAttempts = testData.maxAttempts !== undefined ? parseInt(testData.maxAttempts, 10) : 0;
        if (maxAttempts > 0) {
            const studentAttempts = await getStudentAttemptsCount(testId, name);
            const localKey = `bilimal_att_${testId}_${cleanName(name)}`;
            const localAttempts = parseInt(store.get(localKey) || '0', 10) || 0;
            const realAttempts = Math.max(studentAttempts, localAttempts);
            if (realAttempts >= maxAttempts) {
                alert(`⚠️ Кечириңиз, ${name}!\nБул тестти мугалим ${maxAttempts} жолу гана тапшырууга уруксат берген.\nСиз бул тестти буга чейин тапшыргансыз!`);
                btn.disabled = false;
                btn.textContent = prevText;
                return;
            }
        }

        let fb = null;
        try { fb = await withTimeout(loadFirebase(), 3000, 'firebase'); } catch (e) { /* offline старт */ }

        const duration = Number(testData.duration) > 0 ? Number(testData.duration) : 15;
        const now = Date.now();
        session = {
            v: CFG.DRAFT_VERSION, testId, attemptId: newAttemptKey(fb), name, cls,
            startedAt: now, endAt: now + duration * 60 * 1000
        };
        currentQIndex = 0; userAnswers = {}; questionTimes = {}; warningCount = 0;
        store.set(SNAP_KEY, pack(testData));

        btn.disabled = false;
        btn.textContent = prevText;
        enterRunning(false);
    } finally {
        starting = false;
    }
}

function enterRunning(restored) {
    running = true;
    els.startScreen.style.display = 'none';
    els.runningScreen.style.display = 'block';
    acquireWakeLock();
    startTimer(session.endAt);
    renderQuestion(restored);
    updateNextLabel();
    writeDraft();
    if (restored) showNote(m('resumed'));
}

function resumeFrom(draft) {
    session = {
        v: draft.v, testId, attemptId: draft.attemptId, name: draft.name || '', cls: draft.cls || '',
        startedAt: draft.startedAt, endAt: Number(draft.endAt)
    };
    userAnswers = (draft.answers && typeof draft.answers === 'object') ? draft.answers : {};
    questionTimes = (draft.times && typeof draft.times === 'object') ? draft.times : {};
    warningCount = Number(draft.warnings) || 0;
    currentQIndex = Math.min(Math.max(parseInt(draft.idx, 10) || 0, 0), Math.max(qs.length - 1, 0));
    questionStartTime = Number(draft.qStart) || Date.now();
    const ni = $('studentName'), ci = $('studentClass');
    if (ni) ni.value = session.name;
    if (ci) ci.value = session.cls;
    showMeta();
    setReady();

    if (Date.now() >= session.endAt) {          // убакыт өтүп кетти — жооптор менен аяктайт
        running = true;
        els.startScreen.style.display = 'none';
        els.runningScreen.style.display = 'block';
        finishTest('timeout');
        return;
    }
    enterRunning(true);
}

function showNote(text) {
    try {
        const n = document.createElement('div');
        n.style.cssText = 'color:#00f0ff;font-size:.85rem;margin:6px 0;';
        n.textContent = text;
        els.runningScreen.insertBefore(n, els.runningScreen.firstChild);
        setTimeout(() => { if (n.parentNode) n.parentNode.removeChild(n); }, 6000);
    } catch (e) { /* ignore */ }
}

/* =====================================================================
   СУРООНУ ТАРТУУ
   ===================================================================== */
const optText = (opt) => (typeof opt === 'object' && opt !== null) ? (opt.text || opt.label || '') : opt;

function renderQuestion(keepStart) {
    const q = qs[currentQIndex];
    if (!q) return;
    if (!keepStart) questionStartTime = Date.now();
    const tok = ++renderTok;
    renderedIndex = -1;

    try {
        els.progress.textContent = `Суроо ${currentQIndex + 1} / ${qs.length}`;

        if (q.type === 'pisa' && q.context) {
            els.pisaBox.textContent = '';
            const st = document.createElement('strong'); st.textContent = 'Контекст:';
            els.pisaBox.appendChild(st);
            els.pisaBox.appendChild(document.createElement('br'));
            setSafeHtml(els.pisaBox, prepareMathText(q.context), true);
            els.pisaBox.style.display = 'block';
        } else {
            els.pisaBox.style.display = 'none';
            els.pisaBox.textContent = '';
        }

        setSafeHtml(els.qText, prepareMathText(q.text || ''));

        els.imgContainer.textContent = '';
        const url = safeUrl(q.imageUrl);
        if (url) {
            const img = document.createElement('img');
            img.className = 'test-image';
            img.draggable = false;
            img.addEventListener('dragstart', e => e.preventDefault());
            let src = url;
            try { if (window.BiliRender) src = window.BiliRender.normalizeImgSrc(url); } catch (e) { /* ignore */ }
            img.src = src;
            els.imgContainer.appendChild(img);
        }

        const box = els.optionsContainer;
        box.textContent = '';
        const options = Array.isArray(q.options) ? q.options : null;

        if (q.type === 'matching' && options) {
            const rights = shuffled(options.map(o => (typeof o === 'object' && o !== null) ? o.right : o));
            options.forEach((pair, idx) => {
                const leftText = (typeof pair === 'object' && pair !== null) ? pair.left : pair;
                const row = document.createElement('div');
                row.className = 'matching-row';
                const left = document.createElement('div');
                setSafeHtml(left, prepareMathText(leftText));
                const sel = document.createElement('select');
                sel.setAttribute('data-idx', String(idx));
                const ph = document.createElement('option');
                ph.value = ''; ph.textContent = '-- Тандаңыз --';
                sel.appendChild(ph);
                rights.forEach(r => {
                    const o = document.createElement('option');
                    o.value = String(r == null ? '' : r);
                    o.textContent = htmlToText(prepareMathText(r));
                    sel.appendChild(o);
                });
                row.appendChild(left); row.appendChild(sel);
                box.appendChild(row);
            });
        } else if (options) {
            const inputType = q.type === 'multiple' ? 'checkbox' : 'radio';
            options.forEach((opt, idx) => {
                const label = document.createElement('label');
                label.className = 'q-option';
                const input = document.createElement('input');
                input.type = inputType; input.name = 'q_opt'; input.value = String(idx);
                const span = document.createElement('span');
                setSafeHtml(span, prepareMathText(optText(opt)));
                label.appendChild(input); label.appendChild(span);
                box.appendChild(label);
            });
        }

        applyAnswer(q, userAnswers[currentQIndex]);
        renderedIndex = currentQIndex;
    } catch (e) {
        console.error('Суроону тартууда ката:', e);
        renderedIndex = currentQIndex;
    }
    typesetCurrent(tok);
}

function applyAnswer(q, ans) {
    if (!ans) return;
    const box = els.optionsContainer;
    if (q.type === 'matching') {
        box.querySelectorAll('select').forEach(s => {
            const v = ans[s.getAttribute('data-idx')];
            if (v !== undefined && v !== null && v !== '') s.value = String(v);
        });
    } else if (Array.isArray(ans)) {
        const picked = new Set(ans.map(Number));
        box.querySelectorAll('input[name="q_opt"]').forEach(i => { i.checked = picked.has(Number(i.value)); });
    }
}

function updateNextLabel() {
    if (currentQIndex === qs.length - 1) els.nextBtn.textContent = 'Тестти аяктоо 🏁';
}

/* =====================================================================
   MATHJAX КЕЗЕГИ (бир убакта бир гана typeset, эскирген суроолор өткөрүлөт)
   ===================================================================== */
let typesetChain = Promise.resolve();
function waitMathJax(tok, maxMs) {
    return new Promise(resolve => {
        const t0 = Date.now();
        (function poll() {
            const MJ = window.MathJax;
            if (MJ && typeof MJ.typesetPromise === 'function') return resolve(true);
            if (tok !== renderTok || Date.now() - t0 > maxMs) return resolve(false);
            setTimeout(poll, 250);
        })();
    });
}
function typesetCurrent(tok) {
    const targets = [els.qText, els.optionsContainer, els.pisaBox];
    const post = () => {
        if (tok !== renderTok) return;
        try {
            if (window.BiliRender) targets.forEach(t => window.BiliRender.fixDegreeFormatting(t));
        } catch (e) { /* ignore */ }
    };
    waitMathJax(tok, 20000).then(ready => {
        if (!ready) return post();
        typesetChain = typesetChain.then(() => {
            if (tok !== renderTok) return null;
            const MJ = window.MathJax;
            try { if (typeof MJ.typesetClear === 'function') MJ.typesetClear(); } catch (e) { /* ignore */ }
            return MJ.typesetPromise(targets).catch(err => console.error('MathJax катасы:', err));
        }).then(post, post);
    });
}

/* =====================================================================
   ЖООПТОР
   ===================================================================== */
function captureAnswer() {
    if (renderedIndex !== currentQIndex) return;
    const q = qs[currentQIndex];
    if (!q) return;
    const box = els.optionsContainer;
    if (!box) return;
    if (q.type === 'matching') {
        const ans = {};
        box.querySelectorAll('select').forEach(s => { ans[s.getAttribute('data-idx')] = s.value; });
        userAnswers[currentQIndex] = ans;
    } else {
        userAnswers[currentQIndex] = Array.from(box.querySelectorAll('input[name="q_opt"]:checked')).map(i => parseInt(i.value, 10));
    }
}
function saveAnswer() {
    if (renderedIndex !== currentQIndex || !qs[currentQIndex]) return;
    questionTimes[currentQIndex] = Math.round((Date.now() - questionStartTime) / 1000);
    captureAnswer();
}
function onAnswerChange() {
    captureAnswer();
    persistDraft(false);
}
function onNext() {
    const now = Date.now();
    if (!running || finishLock || now - lastNextAt < CFG.NEXT_DEBOUNCE_MS) return;
    lastNextAt = now;
    saveAnswer();
    currentQIndex++;
    if (currentQIndex < qs.length) {
        renderQuestion(false);
        updateNextLabel();
        persistDraft(true);
    } else {
        finishTest('normal');
    }
}

/* =====================================================================
   ТАЙМЕР (Date.now(): түзмөк уктаса да убакыт туура)
   ===================================================================== */
const pad2 = (n) => (n < 10 ? '0' : '') + n;
function stopTimer() { if (timerInterval) { clearInterval(timerInterval); timerInterval = null; } }
function startTimer(endAt) {
    stopTimer();
    const el = els.timer;
    if (el && !el.querySelector('#timerText')) {
        el.innerHTML = '<i class="fa-solid fa-clock"></i> <span id="timerText">00:00</span>';
    }
    timerTextEl = $('timerText');
    timerShown = -1;
    const tick = () => {
        const rem = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
        if (rem !== timerShown) {
            timerShown = rem;
            if (timerTextEl) timerTextEl.textContent = `${pad2(Math.floor(rem / 60))}:${pad2(rem % 60)}`;
        }
        if (rem <= 0) { stopTimer(); finishTest('timeout'); }
    };
    tick();
    if (!finishLock) timerInterval = setInterval(tick, 500);
}

/* =====================================================================
   ANTI-CHEAT: бир гана эсеп. Тестти автоматтык аяктабайт (CFG боюнча).
   Кыска кетүүлөр (чалуу, билдирүү) санала бербейт.
   ===================================================================== */
function onLeave() {
    if (!running || finishLock || awaySince) return;
    awaySince = Date.now();
    flushNow();
}
function onReturn() {
    if (!awaySince) return;
    const away = Date.now() - awaySince;
    awaySince = 0;
    if (!running || finishLock) return;
    acquireWakeLock();
    if (away >= CFG.AWAY_GRACE_MS) registerViolation();
}
function registerViolation() {
    warningCount++;
    window.userViolationCount = warningCount;
    persistDraft(true);
    if (CFG.AUTO_FINISH_ON_VIOLATIONS && warningCount >= CFG.MAX_WARNINGS) {
        showOverlay(true);
        finishTest('cheating');
        return;
    }
    showOverlay(false);
}
function showOverlay(blocked) {
    if (!overlayEl || !overlayEl.isConnected) {
        overlayEl = document.createElement('div');
        overlayEl.id = 'ai-protection-overlay';
        overlayEl.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:#03030d; z-index:999999; display:flex; flex-direction:column; justify-content:center; align-items:center; color:#00f0ff; font-size:1.3rem; font-weight:bold; text-align:center; padding:20px; box-sizing:border-box;';
        overlayEl.addEventListener('click', () => { if (!blocked && !finishLock) overlayEl.style.display = 'none'; });
        document.body.appendChild(overlayEl);
    }
    const o = overlayEl;
    if (blocked) {
        o.innerHTML = `
            <i class="fa-solid fa-ban" style="font-size:3.5rem; color:#ff0055; margin-bottom:15px;"></i>
            <div style="color:#ff0055; font-size:1.6rem; margin-bottom:10px;">${m('blockTitle')}</div>
            <div>${m('warnCount')} ${warningCount}/${CFG.MAX_WARNINGS}</div>`;
    } else {
        o.innerHTML = `
            <i class="fa-solid fa-triangle-exclamation" style="font-size:3.5rem; color:#ffcc00; margin-bottom:15px;"></i>
            <div style="font-size:1.5rem; margin-bottom:10px;">${m('warnTitle')}</div>
            <div style="background:rgba(255,0,85,0.2); border:1px solid #ff0055; color:#ff0055; padding:8px 16px; border-radius:20px; margin:15px 0; font-size:1.1rem;">
                ⚠️ ${m('warnCount')} <span style="font-size:1.4rem; font-weight:bold; color:#fff;">${warningCount}</span>
            </div>
            <div style="font-size:1rem; color:#a5b4fc; margin-top:10px; cursor:pointer;">${m('warnBack')}</div>`;
    }
    o.style.display = 'flex';
}
function removeOverlay() {
    if (overlayEl) { try { overlayEl.remove(); } catch (e) { /* ignore */ } overlayEl = null; }
    const stray = $('ai-protection-overlay');
    if (stray) stray.remove();
}
async function acquireWakeLock() {
    try {
        if (!running || wakeLock || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
        const wl = await navigator.wakeLock.request('screen');
        wakeLock = wl;
        wl.addEventListener('release', () => { if (wakeLock === wl) wakeLock = null; });
    } catch (e) { wakeLock = null; }
}
function releaseWakeLock() {
    try { if (wakeLock) wakeLock.release(); } catch (e) { /* ignore */ }
    wakeLock = null;
}

/* =====================================================================
   НАТЫЙЖАНЫ ЭСЕПТӨӨ (логика өзгөргөн жок)
   ===================================================================== */
function computeResult() {
    let score = 0;
    const reviewList = [];
    qs.forEach((q, idx) => {
        let isCorrect = false;
        let correctDesc = '';
        let userDesc = 'Жооп берилген жок';
        try {
            const userAns = userAnswers[idx];
            const options = Array.isArray(q.options) ? q.options : [];

            if (q.type === 'matching') {
                let correctCount = 0;
                const userAnsObj = (userAns && typeof userAns === 'object') ? userAns : {};
                const correctPairsStr = [];
                const userPairsStr = [];
                options.forEach((pair, pIdx) => {
                    const leftText = (typeof pair === 'object' && pair !== null) ? pair.left : pair;
                    const targetRight = (typeof pair === 'object' && pair !== null) ? pair.right : pair;
                    correctPairsStr.push(`${leftText} ➔ ${targetRight}`);
                    userPairsStr.push(`${leftText} ➔ ${userAnsObj[pIdx] || 'Жок'}`);
                    const ua = userAnsObj[pIdx];
                    if (ua !== undefined && String(ua) === String(targetRight)) correctCount++;
                });
                isCorrect = (correctCount === options.length);
                correctDesc = correctPairsStr.join('; ');
                userDesc = userPairsStr.join('; ');
            } else {
                const correctIndices = [];
                options.forEach((o, i) => {
                    if (typeof o === 'object' && o !== null) {
                        if (o.isCorrect === true || o.correct === true) correctIndices.push(i);
                    } else if (q.correctAnswer !== undefined) {
                        if (q.correctAnswer === i || (Array.isArray(q.correctAnswer) && q.correctAnswer.includes(i))) correctIndices.push(i);
                    }
                });
                const num = (a, b) => a - b;
                if (Array.isArray(userAns) && JSON.stringify(correctIndices.slice().sort(num)) === JSON.stringify(userAns.slice().sort(num))) {
                    isCorrect = true;
                }
                correctDesc = correctIndices.map(i => optText(options[i])).join(', ');
                userDesc = Array.isArray(userAns) ? userAns.map(i => optText(options[i])).join(', ') : 'Жооп берилген жок';
            }
        } catch (e) {
            console.error('Суроону баалоодо ката:', idx, e);
        }
        if (isCorrect) score++;
        reviewList.push({
            questionText: q.text || '',
            studentAnswer: userDesc,
            correctAnswer: correctDesc,
            isCorrect,
            timeSpent: questionTimes[idx] || 0
        });
    });
    return { score, reviewList };
}

/* =====================================================================
   ЖӨНӨТҮҮ: outbox + идемпотенттүү set() + retry
   ===================================================================== */
let outbox = [];
let flushing = false;
let retryTimer = null;
let retryStep = 0;

function loadOutbox() {
    store.all(OUTBOX_KEY).forEach(s => {
        const arr = unpack(s);
        if (Array.isArray(arr)) {
            arr.forEach(e => {
                if (e && e.key && e.testId && e.payload && !outbox.some(x => x.key === e.key)) outbox.push(e);
            });
        }
    });
}
function saveOutbox() {
    if (!outbox.length) { store.del(OUTBOX_KEY); return true; }
    return store.set(OUTBOX_KEY, pack(outbox));
}
async function sendEntry(fb, e) {
    const r = fb.ref(fb.db, `test_results/${e.testId}/${e.key}`);
    try {
        await withTimeout(fb.set(r, e.payload), CFG.SEND_TIMEOUT_MS, 'set');
    } catch (err) {
        // эреже кайра жазууга тыюу салса, мурунку аракет ийгиликтүү болгон болушу мүмкүн — текшерип көрөбүз
        if (err && (err.code === 'PERMISSION_DENIED' || /permission/i.test(String(err.message || '')))) {
            const s = await withTimeout(fb.get(r), CFG.SEND_TIMEOUT_MS, 'verify');
            if (s.exists()) return;
        }
        throw err;
    }
}
async function flushOutbox(reason) {
    if (flushing) return;
    if (!outbox.length) { updateStatus(); return; }
    flushing = true;
    clearTimeout(retryTimer);
    updateStatus();
    let failed = false;
    try {
        const fb = await withTimeout(loadFirebase(), CFG.LOAD_TIMEOUT_MS, 'firebase');
        for (const e of outbox.slice()) {
            try {
                await sendEntry(fb, e);
                outbox = outbox.filter(x => x.key !== e.key);
                saveOutbox();
            } catch (err) {
                failed = true;
                console.warn('Жөнөтүү ишке ашкан жок (кайра аракет болот):', err && (err.code || err.message));
                break;
            }
        }
    } catch (err) { failed = true; }
    flushing = false;
    if (failed && outbox.length) {
        const base = CFG.RETRY_DELAYS_MS[Math.min(retryStep, CFG.RETRY_DELAYS_MS.length - 1)];
        retryStep++;
        retryTimer = setTimeout(() => flushOutbox('retry'), base * (0.8 + Math.random() * 0.4));
    } else {
        retryStep = 0;
    }
    updateStatus();
}
function updateStatus() {
    const box = $('submitStatus');
    if (!box || !lastAttemptKey) return;
    const btn = $('resendBtn');
    const pending = outbox.some(x => x.key === lastAttemptKey);
    if (!pending) {
        box.textContent = m('saved'); box.style.color = '#4ade80';
        if (btn) btn.style.display = 'none';
    } else if (flushing) {
        box.textContent = m('saving'); box.style.color = '#38bdf8';
        if (btn) btn.style.display = 'none';
    } else {
        box.textContent = m('pending'); box.style.color = '#fbbf24';
        if (btn) btn.style.display = 'block';
    }
}

/* =====================================================================
   ТЕСТТИ АЯКТОО (бир гана жолу)
   ===================================================================== */
function stopProtection() {
    try { if (typeof window.stopAntiCheat === 'function') window.stopAntiCheat(); } catch (e) { /* ignore */ }
    window.isTestFinished = true;
    removeOverlay();
}

async function finishTest(reason = 'normal') {
    if (finishLock) return;
    finishLock = true;
    running = false;
    clearTimeout(persistTimer); persistTimer = null;
    stopTimer();
    releaseWakeLock();
    stopProtection();
    try { saveAnswer(); } catch (e) { /* ignore */ }

    const totalQ = qs.length;
    const { score, reviewList } = computeResult();
    const percent = totalQ > 0 ? Math.round((score / totalQ) * 100) : 0;
    const name = (session && session.name) || 'Аноним';
    const cls = (session && session.cls) || '-';
    const allowReview = !!testData && testData.allowReview === true;
    const attemptKey = (session && session.attemptId) || ('-Z' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
    lastAttemptKey = attemptKey;

    try {
        if (allowReview) store.set('student_test_review', JSON.stringify(reviewList));
        else store.del('student_test_review');
    } catch (e) { /* ignore */ }

    // undefined/NaN Firebase set()'ти бузбасын деп таза JSON
    let payload;
    try {
        payload = JSON.parse(JSON.stringify({
            testId: testId,
            studentName: name,
            studentClass: cls,
            score: score,
            totalQuestions: totalQ,
            percent: percent,
            cheatedCount: warningCount,
            cheatingAttempt: reason === 'cheating',
            date: new Date().toISOString(),
            reviewList: reviewList,
            userAnswers: userAnswers
        }));
    } catch (e) {
        payload = { testId, studentName: name, studentClass: cls, score, totalQuestions: totalQ, percent, cheatedCount: warningCount,
            cheatingAttempt: reason === 'cheating', date: new Date().toISOString() };
    }

    outbox.push({ key: attemptKey, testId: testId, payload: payload, createdAt: Date.now() });
    const persisted = saveOutbox();
    if (persisted) clearDraft();         // жыйынтык туруктуу сакталмайынча draft өчүрүлбөйт

    try {
        const localKey = `bilimal_att_${testId}_${cleanName(name)}`;
        const prevLocal = parseInt(store.get(localKey) || '0', 10) || 0;
        store.set(localKey, String(prevLocal + 1));
    } catch (e) { /* ignore */ }

    renderResult({ reason, percent, score, totalQ, allowReview });
    flushOutbox('finish');
}

function renderResult({ reason, percent, score, totalQ, allowReview }) {
    let statusHtml = '';
    if (reason === 'cheating') {
        statusHtml = `<p style="color:#ff0055; font-weight:bold; font-size:1.1rem; margin-bottom:10px;">⚠️ Тест эреже бузулгандыктан автоматтык түрдө токтотулду!</p>`;
    } else if (reason === 'timeout') {
        statusHtml = `<p style="color:#ff9900; font-weight:bold; font-size:1.1rem; margin-bottom:10px;">⏳ Тесттин убактысы бүттү!</p>`;
    }

    const runningScreen = $('runningScreen');
    if (!runningScreen) return;
    runningScreen.style.display = 'block';
    const startScreen = $('startScreen');
    if (startScreen) startScreen.style.display = 'none';
    runningScreen.innerHTML = `
        <div class="result-card">
            <div class="result-score-circle" style="--progress-deg: ${percent * 3.6}deg;">
                <div class="result-score-inner">
                    <span class="result-score-value">${percent}%</span>
                    <span style="font-size:0.75rem; color:#94a3b8;">Ийгилик</span>
                </div>
            </div>

            <h2 style="color:#00f0ff; margin-bottom:10px;">🎉 Тест Аяктады!</h2>
            ${statusHtml}
            <p style="font-size: 1.1rem; color: #e2e8f0; margin-bottom: 10px;">
                Сиздин жыйынтык: <strong>${score} / ${totalQ} (${percent}%)</strong>
            </p>
            <p style="color:#a5b4fc; font-size:0.9rem; margin-bottom: 15px;">Башка баракчага чыгуу аракети: <strong>${warningCount} жолу</strong></p>

            <div id="submitStatus" role="status" aria-live="polite" style="font-size:0.9rem; margin-bottom:10px; line-height:1.4;"></div>
            <button type="button" id="resendBtn" class="btn-start" style="display:none; margin:0 0 15px 0; background:linear-gradient(135deg,#f59e0b,#d97706);">${m('resend')}</button>

            ${allowReview ? `
                <div style="background: rgba(0, 240, 255, 0.08); border: 1px solid rgba(0, 240, 255, 0.3); border-radius: 12px; padding: 16px; margin: 15px 0; text-align: center;">
                    <p style="color: #38bdf8; font-weight: 600; font-size: 0.95rem; margin-bottom: 12px;">
                        <i class="fa-solid fa-circle-info"></i> Мугалим каталарыңызды көрүүгө уруксат берди. Кетирген каталарыңызды жана туура жоопторду толук талдап чыгыңыз!
                    </p>
                    <button type="button" class="btn-start" onclick="window.location.href='test-review.html'" style="background: linear-gradient(135deg, #00c6ff 0%, #0072ff 100%); width: 100%; margin-top:5px;">
                        <i class="fa-solid fa-magnifying-glass-chart"></i> КАТАЛАРДЫ ЖАНА ТУУРА ЖООПТОРДУ КӨРҮҮ ➔
                    </button>
                </div>
            ` : `
                <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 12px; padding: 14px; margin: 15px 0; text-align: center;">
                    <p style="color: #fca5a5; font-size: 0.9rem;">
                        <i class="fa-solid fa-lock"></i> Каталарды көрүү бул тест үчүн мугалим тарабынан чектелген.
                    </p>
                </div>
            `}

            <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(0, 240, 255, 0.3); border-radius: 12px; padding: 18px; margin: 15px 0; text-align: center;">
                <h3 style="color: #38bdf8; margin-bottom: 8px; font-size: 1.05rem;"><i class="fa-solid fa-book-open"></i> Билимиңизди андан ары тереңдетиңиз!</h3>
                <p style="color: #cbd5e1; font-size: 0.9rem; margin-bottom: 12px; line-height: 1.4;">
                    Тестти ийгиликтүү аяктадыңыз! Кошумча адабияттарды окуу үчүн Электрондук Китепканага өтүңүз.
                </p>
                <a href="/sections/ebooks1.html" class="btn-start" style="text-decoration:none; display:inline-block; width:100%; padding:10px 20px; background: linear-gradient(135deg, #00f0ff, #7000ff); color: #fff; font-weight: bold; border-radius: 8px;">
                    <i class="fa-solid fa-graduation-cap"></i> Электрондук китепканага өтүү
                </a>
            </div>

            <a href="tests-center.html" style="text-decoration:none; display:inline-block; color: #a5b4fc; font-size: 0.9rem; margin-top:5px;">Башкы баракчага кайтуу</a>
        </div>
    `;
    const rb = $('resendBtn');
    if (rb) rb.addEventListener('click', () => { retryStep = 0; flushOutbox('manual'); });
    updateStatus();
}

/* =====================================================================
   ИНИЦИАЛИЗАЦИЯ (бардык глобалдык listener'лер бир гана жолу)
   ===================================================================== */
function bindGlobalListeners() {
    if (listenersBound) return;
    listenersBound = true;

    els.startBtn.addEventListener('click', startTest);
    els.nextBtn.addEventListener('click', onNext);
    els.optionsContainer.addEventListener('change', onAnswerChange);

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) onLeave();
        else {
            onReturn();
            if (outbox.length) flushOutbox('visible');
        }
    });
    window.addEventListener('blur', onLeave);
    window.addEventListener('focus', onReturn);
    window.addEventListener('pagehide', flushNow);
    window.addEventListener('beforeunload', flushNow);
    window.addEventListener('online', () => { retryStep = 0; flushOutbox('online'); });
}

async function init(isRetry) {
    cacheEls();
    if (!isRetry) bindGlobalListeners();

    if (!testId) {
        els.lblTitle.textContent = 'Тест ID табылган жок!';
        return;
    }
    if (!validId(testId)) {
        els.lblTitle.textContent = 'Тест ID табылган жок!';
        return;
    }

    if (!isRetry) {
        loadOutbox();
        if (outbox.length) flushOutbox('boot');
    }

    // 1) аякталбаган сессияны калыбына келтирүү (желе жок эле иштейт)
    const draft = loadBestDraft();
    if (draft) {
        const snap = normalizeTest(unpack(store.get(SNAP_KEY)));
        if (snap && snap.questions.length) {
            testData = snap; qs = snap.questions;
            resumeFrom(draft);
            return;
        }
    }

    // 2) кадимки жүктөө
    try {
        const r = await loadTestWithRetry();
        if (!r.exists) {
            els.lblTitle.textContent = 'Тест табылган жок!';
            return;
        }
        testData = normalizeTest(r.data);
        qs = testData ? testData.questions : [];
        if (!testData) { els.lblTitle.textContent = 'Тест табылган жок!'; return; }
        if (draft && qs.length) { resumeFrom(draft); return; }
        showMeta();
        setReady();
    } catch (err) {
        console.error('Тестти жүктөөдө ката:', err);
        showLoadError();
    }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => init(false));
else init(false);
