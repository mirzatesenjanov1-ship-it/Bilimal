/**
 * sound.js
 * Web Audio API аркылуу реалисттүү чагылган жана күн күркүрөөсү аудио системасы:
 * 1) Кескин электр үнү (Sharp crack / Electric snap)
 * 2) Терең күн күркүрөөсү (Deep thunder roll)
 * 3) Алыстыкка жараша үн катуулугу жана жыштыгы
 * 4) Stereo spatial audio (StereoPannerNode)
 */

import { calculateSoundAttenuation } from './physics.js';

export class LightningSoundEngine {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.panner = null;
        this.enabled = true;
        this.noiseBuffer = null;
    }

    /**
     * Колдонуучу аракет кылганда AudioContext'ти ишке киргизет
     */
    initContext() {
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioCtx();

            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = this.enabled ? 0.85 : 0.0;

            this.panner = this.ctx.createStereoPanner();
            this.panner.pan.value = 0;

            this.panner.connect(this.masterGain);
            this.masterGain.connect(this.ctx.destination);

            this.noiseBuffer = this._createNoiseBuffer(3.5);
        }

        if (this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }
    }

    /**
     * Ак/күркүрөө ызы-чуу буферин түзөт (эстутумду үнөмдөө үчүн бир жолу)
     */
    _createNoiseBuffer(durationSec) {
        const sampleRate = this.ctx.sampleRate;
        const length = Math.floor(sampleRate * durationSec);
        const buffer = this.ctx.createBuffer(1, length, sampleRate);
        const data = buffer.getChannelData(0);

        let lastOut = 0;
        for (let i = 0; i < length; i++) {
            const white = Math.random() * 2 - 1;
            // Brown-ish warm noise for thunder rumble
            data[i] = (lastOut + 0.04 * white) / 1.04;
            lastOut = data[i];
            data[i] *= 2.4;
        }
        return buffer;
    }

    setEnabled(isEnabled) {
        this.enabled = isEnabled;
        if (this.masterGain && this.ctx) {
            this.masterGain.gain.setTargetAtTime(isEnabled ? 0.85 : 0.0, this.ctx.currentTime, 0.03);
        }
    }

    /**
     * Стерео багытты (-1 сол, 0 борбор, +1 оң) орнотот
     */
    setPan(panValue) {
        if (this.panner && this.ctx) {
            const clamped = Math.max(-1, Math.min(1, panValue));
            this.panner.pan.setTargetAtTime(clamped, this.ctx.currentTime, 0.05);
        }
    }

    /**
     * 1-БӨЛҮК: Чагылгандын кескин электр үнү (Sharp crack / Electric snap)
     */
    playElectricCrack(distanceMeters = 1000, pan = 0) {
        if (!this.enabled) return;
        this.initContext();
        this.setPan(pan);

        const now = this.ctx.currentTime;
        const atten = calculateSoundAttenuation(distanceMeters);

        // Кескин жогорку жыштыктагы электр чартылдашы
        const crackSource = this.ctx.createBufferSource();
        crackSource.buffer = this.noiseBuffer;

        const highpass = this.ctx.createBiquadFilter();
        highpass.type = 'bandpass';
        highpass.frequency.setValueAtTime(distanceMeters <= 500 ? 2200 : 1200, now);
        highpass.Q.setValueAtTime(1.4, now);

        const crackGain = this.ctx.createGain();
        const peakGain = Math.min(1.0, atten * (distanceMeters <= 500 ? 1.25 : 0.8));
        crackGain.gain.setValueAtTime(0.001, now);
        crackGain.gain.linearRampToValueAtTime(peakGain, now + 0.008);
        crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

        crackSource.connect(highpass);
        highpass.connect(crackGain);
        crackGain.connect(this.panner);

        crackSource.start(now, Math.random() * 1.0, 0.35);
    }

    /**
     * 2-БӨЛҮК: Күндүн күркүрөгөн үнү (Deep thunder roll) — үн толкуну жеткенде ойнотулат
     */
    playThunderRoll(distanceMeters = 1000, pan = 0) {
        if (!this.enabled) return;
        this.initContext();
        this.setPan(pan);

        const now = this.ctx.currentTime;
        const atten = calculateSoundAttenuation(distanceMeters);

        // Аралыкка жараша төмөн жыштык чеги (алыс болгон сайын буулуп угулат)
        const cutoffHz =
            distanceMeters <= 100  ? 480 :
            distanceMeters <= 500  ? 360 :
            distanceMeters <= 1000 ? 260 :
            distanceMeters <= 2000 ? 200 :
            distanceMeters <= 3000 ? 160 :
            distanceMeters <= 5000 ? 125 : 95;

        const duration = distanceMeters <= 500 ? 1.8 : distanceMeters <= 2000 ? 2.5 : 3.2;

        const rumbleSource = this.ctx.createBufferSource();
        rumbleSource.buffer = this.noiseBuffer;
        rumbleSource.loop = true;

        const lowpass = this.ctx.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.setValueAtTime(cutoffHz, now);
        lowpass.frequency.exponentialRampToValueAtTime(Math.max(55, cutoffHz * 0.45), now + duration);

        // Суб-басс толкуну (күндүн күркүрөгөн термелүүсү)
        const subOsc = this.ctx.createOscillator();
        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(distanceMeters <= 500 ? 58 : 44, now);
        subOsc.frequency.exponentialRampToValueAtTime(28, now + duration * 0.85);

        const subGain = this.ctx.createGain();
        subGain.gain.setValueAtTime(0.001, now);
        subGain.gain.linearRampToValueAtTime(atten * 0.55, now + 0.08);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.9);

        const rumbleGain = this.ctx.createGain();
        rumbleGain.gain.setValueAtTime(0.001, now);
        rumbleGain.gain.linearRampToValueAtTime(atten * 0.95, now + 0.06);
        rumbleGain.gain.setValueAtTime(atten * 0.72, now + duration * 0.35);
        rumbleGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        rumbleSource.connect(lowpass);
        lowpass.connect(rumbleGain);
        rumbleGain.connect(this.panner);

        subOsc.connect(subGain);
        subGain.connect(this.panner);

        rumbleSource.start(now, Math.random() * 1.5);
        rumbleSource.stop(now + duration + 0.05);

        subOsc.start(now);
        subOsc.stop(now + duration + 0.05);
    }
}
