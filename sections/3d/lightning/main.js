/**
 * main.js
 * Three.js сахнасы, OrbitControls, YouTube / Cinematic Capture Mode,
 * 6 этаптын хронологиясы, үн/жарык синхрондоштуруу жана 60 FPS оптимизациясы.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { calculateArrivalTimes } from './physics.js';
import { LightningSoundEngine } from './sound.js';
import { LightningSystem } from './lightning.js';
import { EnvironmentAndEffects } from './effects.js';
import { SimulationUI } from './ui.js';

class LightningSimulationApp {
    constructor() {
        this.container = document.getElementById('scene-container');

        // Сахна, камера, рендерер
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x030712);
        this.scene.fog = new THREE.FogExp2(0x050d21, 0.016);

        this.camera = new THREE.PerspectiveCamera(
            52,
            window.innerWidth / window.innerHeight,
            0.1,
            260
        );
        this.camera.position.set(0, 11, 28);

        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        this.renderer = new THREE.WebGLRenderer({
            antialias: !isMobile,
            powerPreference: 'high-performance'
        });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2));
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.container.appendChild(this.renderer.domElement);

        // Orbit Controls (Smooth rotation & zoom)
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.06;
        this.controls.maxPolarAngle = Math.PI * 0.485;
        this.controls.minDistance = 8;
        this.controls.maxDistance = 68;
        this.controls.target.set(0, 8, 0);

        // Жарыктандыруу
        this._setupLights();

        // Модулдар
        this.soundEngine = new LightningSoundEngine();
        this.lightning = new LightningSystem(this.scene);
        this.effects = new EnvironmentAndEffects(this.scene);

        // Симуляция абалы
        this.isPlaying = true;
        this.speedMultiplier = 1;
        this.cinemaMode = false;
        this.simTime = 0;         // 0..7.5 сек цикл
        this.elapsedReal = 0;
        this.postStrikeTimer = 0; // Чагылган контактынан (3.5 сек) кийинки убакыт
        this.distanceMeters = 1000;

        this.strikeTriggered = false;
        this.lightTriggered = false;
        this.soundTriggered = false;
        this.thunderRollTriggered = false;

        // FPS эсептөө
        this.frameCount = 0;
        this.fpsLastTime = performance.now();
        this.lastFrameTime = performance.now();

        this.ui = new SimulationUI({
            onStart: () => this.start(),
            onPause: () => this.pause(),
            onReplay: () => this.replay(),
            onDistanceChange: (meters) => {
                this.distanceMeters = meters;
            },
            onSpeedChange: (speed) => {
                this.speedMultiplier = speed;
            },
            onCinemaToggle: (active) => {
                this.cinemaMode = active;
                this.controls.enabled = !active;
            },
            onSoundToggle: (enabled) => {
                this.soundEngine.setEnabled(enabled);
            }
        });

        this.lightning.generateBoltPath(this.effects.strikePos);
        this._bindResize();
        this._animate(performance.now());
    }

    _setupLights() {
        const hemi = new THREE.HemisphereLight(0x38bdf8, 0x0f172a, 0.9);
        this.scene.add(hemi);

        const dirLight = new THREE.DirectionalLight(0x93c5fd, 1.1);
        dirLight.position.set(16, 28, 14);
        this.scene.add(dirLight);
    }

    _bindResize() {
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    start() {
        this.soundEngine.initContext();
        this.isPlaying = true;
    }

    pause() {
        this.isPlaying = false;
    }

    replay() {
        this.soundEngine.initContext();
        this.simTime = 0;
        this.postStrikeTimer = 0;
        this.strikeTriggered = false;
        this.lightTriggered = false;
        this.soundTriggered = false;
        this.thunderRollTriggered = false;
        this.isPlaying = true;

        this.lightning.reset();
        this.lightning.generateBoltPath(this.effects.strikePos);
        this.effects.resetWaves();
        this.ui.updateStage(0);
        this.ui.updateSensoryIndicators({
            strikeOccurred: false,
            lightArrived: false,
            soundArrived: false
        });
    }

    _updateStagesAndEvents(dt) {
        // 6 этапты аныктоо
        let stageIdx = 0;
        if (this.simTime < 1.0) stageIdx = 0;
        else if (this.simTime < 2.0) stageIdx = 1;
        else if (this.simTime < 2.8) stageIdx = 2;
        else if (this.simTime < 3.4) stageIdx = 3;
        else if (this.simTime < 3.55) stageIdx = 4;
        else stageIdx = 5;

        this.ui.updateStage(stageIdx);

        // Чагылган пайда болгон учур (3.5 сек)
        if (this.simTime >= 3.5) {
            if (!this.strikeTriggered) {
                this.strikeTriggered = true;
                // Кескин электр үнү (Sharp crack)
                this.soundEngine.playElectricCrack(this.distanceMeters, 0.25);
            }

            // Жарык (300 000 км/с) — дээрлик ошол замат жетет
            if (!this.lightTriggered) {
                this.lightTriggered = true;
            }

            this.postStrikeTimer += dt;
            const { soundDelaySec } = calculateArrivalTimes(this.distanceMeters);

            // Визуалдык кечигүүнү ыңгайлуу масштабда көрсөтүү (реалдуу убакытты UI'да так чыгаруу)
            const visualSoundArrival = Math.min(soundDelaySec, 4.5);
            if (this.postStrikeTimer >= visualSoundArrival && !this.soundTriggered) {
                this.soundTriggered = true;
            }

            if (this.postStrikeTimer >= soundDelaySec && !this.thunderRollTriggered) {
                this.thunderRollTriggered = true;
                this.soundEngine.playThunderRoll(this.distanceMeters, 0.25);
            }

            this.ui.updateSensoryIndicators({
                strikeOccurred: this.strikeTriggered,
                lightArrived: this.lightTriggered,
                soundArrived: this.soundTriggered
            });

            // Үн жеткенден кийин кыска тыныгуу жана жаңы циклге даярдык
            if (this.soundTriggered && this.postStrikeTimer > visualSoundArrival + 1.4 && !this.cinemaMode) {
                // Колдонуучу кайра ойнотуу же автоматтык цикл кааласа уланат
            }
        }
    }

    /**
     * YouTube / Cinematic Capture Mode: камеранын жылмакай кинематографиялык кыймылы
     */
    _updateCinematicCamera() {
        if (!this.cinemaMode) return;
        const t = this.elapsedReal * 0.35;
        const radius = 24 + Math.sin(t * 0.7) * 5;
        this.camera.position.x = Math.cos(t) * radius;
        this.camera.position.z = Math.sin(t) * radius;
        this.camera.position.y = 9.5 + Math.sin(t * 1.3) * 3.5;
        this.camera.lookAt(0, 8.5, 0);
    }

    _animate(now) {
        requestAnimationFrame((ts) => this._animate(ts));

        const rawDt = Math.min(0.05, (now - this.lastFrameTime) / 1000);
        this.lastFrameTime = now;

        // FPS эсептөө
        this.frameCount++;
        if (now - this.fpsLastTime >= 500) {
            const fps = (this.frameCount * 1000) / (now - this.fpsLastTime);
            this.ui.updateFPS(fps);
            this.frameCount = 0;
            this.fpsLastTime = now;
        }

        const effectiveDt = this.isPlaying ? rawDt * this.speedMultiplier : 0;
        this.elapsedReal += rawDt * (this.isPlaying ? 1 : 0.2);

        if (this.isPlaying) {
            this.simTime += effectiveDt;
            // Цикл аяктаганда (7.5 сек) кайра башталат
            if (this.simTime > 7.5) {
                this.simTime = 0;
                this.postStrikeTimer = 0;
                this.strikeTriggered = false;
                this.lightTriggered = false;
                this.soundTriggered = false;
                this.thunderRollTriggered = false;
                this.lightning.reset();
                this.lightning.generateBoltPath(this.effects.strikePos);
                this.effects.resetWaves();
                this.ui.updateSensoryIndicators({
                    strikeOccurred: false,
                    lightArrived: false,
                    soundArrived: false
                });
            }
        }

        const { soundDelaySec } = calculateArrivalTimes(this.distanceMeters);

        this._updateStagesAndEvents(effectiveDt);
        this.lightning.update(this.simTime, this.elapsedReal);
        this.effects.update(this.simTime, this.elapsedReal, soundDelaySec);

        if (this.cinemaMode) {
            this._updateCinematicCamera();
        } else {
            this.controls.update();
        }

        this.renderer.render(this.scene, this.camera);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new LightningSimulationApp();
});
