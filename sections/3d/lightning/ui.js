/**
 * ui.js
 * Интерфейс контролдору, 3 тил которуу (KY / RU / EN), аралык слайдери,
 * Slow Motion баскычтары, байкоо таймери жана көз/кулак индикаторлору.
 */

import {
    DISTANCE_STEPS,
    TRANSLATIONS,
    calculateArrivalTimes
} from './physics.js';

export class SimulationUI {
    constructor(callbacks) {
        this.callbacks = callbacks;
        this.lang = 'ky';
        this.distanceIndex = 2; // демейки: 1 км
        this.speedMultiplier = 1;
        this.cinemaActive = false;
        this.soundEnabled = true;

        this._cacheElements();
        this._bindEvents();
        this.applyLanguage('ky');
        this.updateDistanceDisplay();
    }

    _cacheElements() {
        this.el = {
            appTitle: document.getElementById('appTitle'),
            appSubtitle: document.getElementById('appSubtitle'),
            eduTitle: document.getElementById('eduTitle'),
            stageBadge: document.getElementById('stageBadge'),
            stageName: document.getElementById('stageName'),
            stageDesc: document.getElementById('stageDesc'),
            stageProgressBar: document.getElementById('stageProgressBar'),
            timerTitle: document.getElementById('timerTitle'),
            eyeIndicator: document.getElementById('eyeIndicator'),
            earIndicator: document.getElementById('earIndicator'),
            eyeText: document.getElementById('eyeText'),
            earText: document.getElementById('earText'),
            lightTimeVal: document.getElementById('lightTimeVal'),
            soundTimeVal: document.getElementById('soundTimeVal'),
            logStrike: document.getElementById('logStrike'),
            logLight: document.getElementById('logLight'),
            logSound: document.getElementById('logSound'),
            logStrikeRow: document.querySelector('#eventLog .log-item:nth-child(1)'),
            logLightRow: document.getElementById('logLightRow'),
            logSoundRow: document.getElementById('logSoundRow'),
            logLightTime: document.getElementById('logLightTime'),
            logSoundTime: document.getElementById('logSoundTime'),
            safetyTitle: document.getElementById('safetyTitle'),
            safetyList: document.getElementById('safetyList'),
            startBtn: document.getElementById('startBtn'),
            pauseBtn: document.getElementById('pauseBtn'),
            replayBtn: document.getElementById('replayBtn'),
            startText: document.getElementById('startText'),
            pauseText: document.getElementById('pauseText'),
            replayText: document.getElementById('replayText'),
            distanceLabel: document.getElementById('distanceLabel'),
            distanceSlider: document.getElementById('distanceSlider'),
            distanceDisplay: document.getElementById('distanceDisplay'),
            delayDisplay: document.getElementById('delayDisplay'),
            slowmoLabel: document.getElementById('slowmoLabel'),
            cinemaBtn: document.getElementById('cinemaBtn'),
            cinemaText: document.getElementById('cinemaText'),
            soundToggleBtn: document.getElementById('soundToggleBtn'),
            fullscreenBtn: document.getElementById('fullscreenBtn'),
            fpsCounter: document.getElementById('fpsCounter')
        };
    }

    _bindEvents() {
        // Тил которгучтар (KY / RU / EN)
        document.querySelectorAll('.lang-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.lang-btn').forEach((b) => b.classList.remove('active'));
                btn.classList.add('active');
                this.applyLanguage(btn.dataset.lang);
            });
        });

        // Баштоо / Токтотуу / Кайра ойнотуу
        this.el.startBtn.addEventListener('click', () => this.callbacks.onStart?.());
        this.el.pauseBtn.addEventListener('click', () => this.callbacks.onPause?.());
        this.el.replayBtn.addEventListener('click', () => this.callbacks.onReplay?.());

        // Аралык слайдери
        this.el.distanceSlider.addEventListener('input', (e) => {
            this.distanceIndex = Number(e.target.value);
            this.updateDistanceDisplay();
            this.callbacks.onDistanceChange?.(this.getDistanceMeters());
        });

        // Slow Motion баскычтары
        document.querySelectorAll('.pill-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.pill-btn').forEach((b) => b.classList.remove('active'));
                btn.classList.add('active');
                this.speedMultiplier = Number(btn.dataset.speed);
                this.callbacks.onSpeedChange?.(this.speedMultiplier);
            });
        });

        // YouTube / Cinematic Mode
        this.el.cinemaBtn.addEventListener('click', () => {
            this.cinemaActive = !this.cinemaActive;
            this.el.cinemaBtn.classList.toggle('active', this.cinemaActive);
            this.callbacks.onCinemaToggle?.(this.cinemaActive);
        });

        // Үн On/Off
        this.el.soundToggleBtn.addEventListener('click', () => {
            this.soundEnabled = !this.soundEnabled;
            this.el.soundToggleBtn.innerHTML = this.soundEnabled
                ? '<i class="fa-solid fa-volume-high"></i>'
                : '<i class="fa-solid fa-volume-xmark"></i>';
            this.callbacks.onSoundToggle?.(this.soundEnabled);
        });

        // Fullscreen
        this.el.fullscreenBtn.addEventListener('click', () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen?.().catch(() => {});
            } else {
                document.exitFullscreen?.().catch(() => {});
            }
        });
    }

    getDistanceMeters() {
        return DISTANCE_STEPS[this.distanceIndex].meters;
    }

    applyLanguage(lang) {
        this.lang = TRANSLATIONS[lang] ? lang : 'ky';
        document.documentElement.lang = this.lang;
        const t = TRANSLATIONS[this.lang];

        this.el.appTitle.textContent = t.appTitle;
        this.el.appSubtitle.textContent = t.appSubtitle;
        this.el.eduTitle.textContent = t.eduTitle;
        this.el.timerTitle.textContent = t.timerTitle;
        this.el.eyeText.textContent = t.eyeText;
        this.el.earText.textContent = t.earText;
        this.el.logStrike.textContent = t.logStrike;
        this.el.logLight.textContent = t.logLight;
        this.el.logSound.textContent = t.logSound;
        this.el.safetyTitle.textContent = t.safetyTitle;
        this.el.startText.textContent = t.startText;
        this.el.pauseText.textContent = t.pauseText;
        this.el.replayText.textContent = t.replayText;
        this.el.distanceLabel.textContent = t.distanceLabel;
        this.el.slowmoLabel.textContent = t.slowmoLabel;
        this.el.cinemaText.textContent = t.cinemaText;

        this.el.safetyList.innerHTML = t.safety
            .map((item) => `
                <li class="${item.safe ? 'safe' : 'danger'}">
                    <i class="fa-solid ${item.safe ? 'fa-check' : 'fa-xmark'}"></i>
                    <span>${item.text}</span>
                </li>
            `)
            .join('');

        this.updateDistanceDisplay();
    }

    updateDistanceDisplay() {
        const t = TRANSLATIONS[this.lang];
        const step = DISTANCE_STEPS[this.distanceIndex];
        const times = calculateArrivalTimes(step.meters);

        this.el.distanceDisplay.textContent = step.label[this.lang];
        this.el.delayDisplay.textContent =
            `${t.delayPrefix}: ${times.soundDelayFormatted} ${t.secUnit}`;

        this.el.lightTimeVal.textContent = `0.01 ${t.secUnit}`;
        this.el.soundTimeVal.textContent = `${times.soundDelayFormatted} ${t.secUnit}`;
        this.el.logLightTime.textContent = `0.01 ${t.secUnit}`;
        this.el.logSoundTime.textContent = `${times.soundDelayFormatted} ${t.secUnit}`;
    }

    updateStage(stageIndex) {
        const t = TRANSLATIONS[this.lang];
        const clamped = Math.max(0, Math.min(5, stageIndex));
        const stage = t.stages[clamped];

        this.el.stageBadge.textContent = `${clamped + 1}/6`;
        this.el.stageName.textContent = stage.name;
        this.el.stageDesc.textContent = stage.desc;
        this.el.stageProgressBar.style.width = `${((clamped + 1) / 6) * 100}%`;
    }

    updateSensoryIndicators({ strikeOccurred, lightArrived, soundArrived }) {
        this.el.logStrikeRow?.classList.toggle('reached', Boolean(strikeOccurred));
        this.el.logLightRow?.classList.toggle('reached', Boolean(lightArrived));
        this.el.eyeIndicator?.classList.toggle('active-light', Boolean(lightArrived));

        this.el.logSoundRow?.classList.toggle('reached', Boolean(soundArrived));
        this.el.earIndicator?.classList.toggle('active-sound', Boolean(soundArrived));
    }

    updateFPS(fps) {
        if (this.el.fpsCounter) {
            this.el.fpsCounter.textContent = `${Math.round(fps)} FPS`;
        }
    }
}
