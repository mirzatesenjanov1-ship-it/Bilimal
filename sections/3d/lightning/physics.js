/**
 * physics.js
 * Чагылган физикасы, жарык ($300\,000\text{ км/с}$) жана үн ($343\text{ м/с}$) эсептөөлөрү,
 * 6 этаптын маалыматтары жана 3 тилдүүлүк (KY / RU / EN).
 */

export const SPEED_OF_LIGHT_MPS = 300_000_000; // 300 000 км/с = 3e8 м/с
export const SPEED_OF_SOUND_MPS = 343;         // 343 м/с (абада ~20°C)

// Аралык маанилери (метр менен)
export const DISTANCE_STEPS = [
    { meters: 100,   label: { ky: '100 м',  ru: '100 м',  en: '100 m' } },
    { meters: 500,   label: { ky: '500 м',  ru: '500 м',  en: '500 m' } },
    { meters: 1000,  label: { ky: '1 км',   ru: '1 км',   en: '1 km' } },
    { meters: 2000,  label: { ky: '2 км',   ru: '2 км',   en: '2 km' } },
    { meters: 3000,  label: { ky: '3 км',   ru: '3 км',   en: '3 km' } },
    { meters: 5000,  label: { ky: '5 км',   ru: '5 км',   en: '5 km' } },
    { meters: 10000, label: { ky: '10 км',  ru: '10 км',  en: '10 km' } }
];

/**
 * Аралыкка жараша жарык жана үн жетүү убактысын (секунд) эсептейт
 */
export function calculateArrivalTimes(distanceMeters) {
    const lightDelaySec = distanceMeters / SPEED_OF_LIGHT_MPS; // ~0.0000033 сек (визуалдык түрдө дээрлик заматта)
    const soundDelaySec = distanceMeters / SPEED_OF_SOUND_MPS; // мис: 1000 / 343 = 2.915... -> 2.91 сек
    return {
        lightDelaySec,
        soundDelaySec,
        soundDelayFormatted: soundDelaySec.toFixed(2)
    };
}

/**
 * Аралыкка жараша үндүн интенсивдүүлүгүн (0.12 - 1.0) эсептейт
 */
export function calculateSoundAttenuation(distanceMeters) {
    if (distanceMeters <= 100) return 1.0;
    if (distanceMeters <= 500) return 0.85;
    if (distanceMeters <= 1000) return 0.65;
    if (distanceMeters <= 2000) return 0.48;
    if (distanceMeters <= 3000) return 0.35;
    if (distanceMeters <= 5000) return 0.22;
    return 0.13; // 10 км: өтө жай/акырын
}

// 3 тилдик котормо сөздүгү (Кыргызча, Орусча, Англисче)
export const TRANSLATIONS = {
    ky: {
        appTitle: 'Чагылгандын пайда болушу жана жарык менен үн',
        appSubtitle: 'Bilimal.org • 3D Физика Лабораториясы',
        eduTitle: 'Окутуу режими',
        timerTitle: 'Байкоо таймери',
        eyeText: 'Жарык көрүндү',
        earText: 'Үн угулду',
        logStrike: '⚡ Чагылган пайда болду',
        logLight: '👁 Жарык жетти (300 000 км/с)',
        logSound: '👂 Үн жетти (343 м/с)',
        safetyTitle: 'Чагылган учурундагы коопсуздук',
        safety: [
            { safe: true,  text: 'Үй ичинде коопсуз' },
            { safe: true,  text: 'Унаа ичинде коопсуз' },
            { safe: false, text: 'Жалгыз бак астында коркунучтуу' },
            { safe: false, text: 'Ачык талаада коркунучтуу' },
            { safe: false, text: 'Металл объект жанында коркунучтуу' }
        ],
        startText: 'Баштоо',
        pauseText: 'Токтотуу',
        replayText: 'Кайра ойнотуу',
        distanceLabel: 'Аралык',
        delayPrefix: 'Үн кечигүүсү',
        secUnit: 'сек',
        slowmoLabel: 'Slow Motion:',
        cinemaText: 'YouTube / Cinematic Mode',
        stages: [
            {
                name: '1-ЭТАП: Заряддардын бөлүнүшү',
                desc: 'Булут ичинде аба агымдарынан улам үстүндө оң (+), астында терс (-) заряддар бөлүнүүдө.'
            },
            {
                name: '2-ЭТАП: Электр талаасынын күчөшү',
                desc: 'Булуттун терс заряды менен жер бетиндеги потенциалдар айырмасы чоңоюп, электр талаасы күчөөдө.'
            },
            {
                name: '3-ЭТАП: Stepped Leader',
                desc: 'Stepped Leader жерди көздөй баскычтуу бутакталган иондошкон канал түрүндө түшүүдө.'
            },
            {
                name: '4-ЭТАП: Upward Streamer',
                desc: 'Жерден, бактан же бийик чекиттен каршы оң заряд (Upward Streamer) өйдө көтөрүлүүдө.'
            },
            {
                name: '5-ЭТАП: Контакт',
                desc: 'Түшкөн лидер менен көтөрүлгөн стример тийишкен учурда күчтүү жарк этүү пайда болду.'
            },
            {
                name: '6-ЭТАП: Return Stroke & Толкундар',
                desc: 'Return Stroke жүрүүдө! Жарык 300 000 км/с менен дароо жетип, үн толкуну 343 м/с менен таралууда.'
            }
        ]
    },
    ru: {
        appTitle: 'Образование молнии и распространение света и звука',
        appSubtitle: 'Bilimal.org • 3D Физическая Лаборатория',
        eduTitle: 'Режим обучения',
        timerTitle: 'Таймер наблюдения',
        eyeText: 'Свет виден',
        earText: 'Звук услышан',
        logStrike: '⚡ Возникла молния',
        logLight: '👁 Свет дошёл (300 000 км/с)',
        logSound: '👂 Звук дошёл (343 м/с)',
        safetyTitle: 'Безопасность при грозе',
        safety: [
            { safe: true,  text: 'В помещении безопасно' },
            { safe: true,  text: 'В автомобиле безопасно' },
            { safe: false, text: 'Под одиноким деревом опасно' },
            { safe: false, text: 'На открытом поле опасно' },
            { safe: false, text: 'Рядом с металлом опасно' }
        ],
        startText: 'Старт',
        pauseText: 'Пауза',
        replayText: 'Повтор',
        distanceLabel: 'Расстояние',
        delayPrefix: 'Задержка звука',
        secUnit: 'сек',
        slowmoLabel: 'Slow Motion:',
        cinemaText: 'YouTube / Cinematic Mode',
        stages: [
            {
                name: 'ЭТАП 1: Разделение зарядов',
                desc: 'Внутри грозового облака разделяются положительные (+) и отрицательные (-) заряды.'
            },
            {
                name: 'ЭТАП 2: Усиление электрического поля',
                desc: 'Растёт разность потенциалов между облаком и землёй, усиливается электрическое поле.'
            },
            {
                name: 'ЭТАП 3: Stepped Leader',
                desc: 'Ступенчатый лидер (Stepped Leader) ветвящимся каналом движется вниз к земле.'
            },
            {
                name: 'ЭТАП 4: Upward Streamer',
                desc: 'От земли навстречу поднимается встречный разряд — Upward Streamer.'
            },
            {
                name: 'ЭТАП 5: Контакт',
                desc: 'При замыкании лидера и стримера происходит яркая вспышка контакта.'
            },
            {
                name: 'ЭТАП 6: Return Stroke и волны',
                desc: 'Идёт главный разряд (Return Stroke)! Свет приходит почти мгновенно, звук идёт 343 м/с.'
            }
        ]
    },
    en: {
        appTitle: 'Lightning Formation & Propagation of Light and Sound',
        appSubtitle: 'Bilimal.org • 3D Physics Laboratory',
        eduTitle: 'Learning Mode',
        timerTitle: 'Observation Timer',
        eyeText: 'Light Seen',
        earText: 'Sound Heard',
        logStrike: '⚡ Lightning occurred',
        logLight: '👁 Light arrived (300,000 km/s)',
        logSound: '👂 Sound arrived (343 m/s)',
        safetyTitle: 'Lightning Safety',
        safety: [
            { safe: true,  text: 'Safe indoors' },
            { safe: true,  text: 'Safe inside a car' },
            { safe: false, text: 'Dangerous under an isolated tree' },
            { safe: false, text: 'Dangerous in an open field' },
            { safe: false, text: 'Dangerous near metal objects' }
        ],
        startText: 'Start',
        pauseText: 'Pause',
        replayText: 'Replay',
        distanceLabel: 'Distance',
        delayPrefix: 'Sound delay',
        secUnit: 'sec',
        slowmoLabel: 'Slow Motion:',
        cinemaText: 'YouTube / Cinematic Mode',
        stages: [
            {
                name: 'STAGE 1: Charge Separation',
                desc: 'Positive (+) and negative (-) charges separate inside the storm cloud.'
            },
            {
                name: 'STAGE 2: Electric Field Intensification',
                desc: 'Potential difference between cloud and ground builds up, strengthening the electric field.'
            },
            {
                name: 'STAGE 3: Stepped Leader',
                desc: 'A branching stepped leader descends toward the ground.'
            },
            {
                name: 'STAGE 4: Upward Streamer',
                desc: 'An upward streamer rises from the ground to meet the descending leader.'
            },
            {
                name: 'STAGE 5: Attachment / Contact',
                desc: 'Leader and streamer connect, triggering a bright contact flash.'
            },
            {
                name: 'STAGE 6: Return Stroke & Waves',
                desc: 'Return stroke illuminates the main channel! Light arrives near-instantly; sound travels at 343 m/s.'
            }
        ]
    }
};
