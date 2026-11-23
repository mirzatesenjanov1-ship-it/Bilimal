/**
 * lightning.js
 * Чагылгандын пайда болуу процессинин 6 этабын 3D мейкиндикте көрсөтөт:
 * 1-ЭТАП: Заряддардын бөлүнүшү (+ / -)
 * 2-ЭТАП: Электр талаасынын күчөшү
 * 3-ЭТАП: Stepped Leader (бутакталган канал түшөт)
 * 4-ЭТАП: Upward Streamer (жерден каршы заряд көтөрүлөт)
 * 5-ЭТАП: Контакт (чоң жарк этүү)
 * 6-ЭТАП: Return Stroke (негизги канал өтө жарык көрүнөт)
 */

import * as THREE from 'three';

export class LightningSystem {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.scene.add(this.group);

        // 1-этап: + жана - заряддар
        this.chargeGroup = new THREE.Group();
        this.group.add(this.chargeGroup);
        this._buildCharges();

        // 2-этап: Электр талаасынын сызыктары
        this.fieldGroup = new THREE.Group();
        this.group.add(this.fieldGroup);
        this._buildElectricField();

        // 3-этап: Stepped Leader бутакталган линиялар
        this.leaderGroup = new THREE.Group();
        this.group.add(this.leaderGroup);

        // 4-этап: Upward Streamer
        this.streamerLine = null;

        // 5-этап: Контакт жарк этүү сферасы
        const flashGeo = new THREE.SphereGeometry(2.6, 20, 20);
        const flashMat = new THREE.MeshBasicMaterial({
            color: 0xe0f2fe,
            transparent: true,
            opacity: 0.0
        });
        this.contactFlash = new THREE.Mesh(flashGeo, flashMat);
        this.group.add(this.contactFlash);

        // 6-этап: Return Stroke негизги каналы
        this.returnStrokeGroup = new THREE.Group();
        this.group.add(this.returnStrokeGroup);

        // Сахнадагы чагылган жарыгы
        this.flashLight = new THREE.PointLight(0x7dd3fc, 0, 140, 1.5);
        this.flashLight.position.set(0, 16, 0);
        this.scene.add(this.flashLight);

        this.mainPathPoints = [];
        this.strikeAnchor = new THREE.Vector3(0, 0.2, 0);
        this.reset();
    }

    _buildCharges() {
        const posGeo = new THREE.SphereGeometry(0.42, 12, 12);
        const posMat = new THREE.MeshBasicMaterial({ color: 0xff5252 });

        const negGeo = new THREE.SphereGeometry(0.42, 12, 12);
        const negMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });

        // Үстүнкү оң (+) заряддар
        for (let i = 0; i < 14; i++) {
            const m = new THREE.Mesh(posGeo, posMat);
            m.position.set(
                (Math.random() - 0.5) * 18,
                22.2 + (Math.random() - 0.5) * 2.2,
                (Math.random() - 0.5) * 8
            );
            this.chargeGroup.add(m);
        }

        // Төмөнкү терс (-) заряддар
        for (let i = 0; i < 18; i++) {
            const m = new THREE.Mesh(negGeo, negMat);
            m.position.set(
                (Math.random() - 0.5) * 18,
                18.2 + (Math.random() - 0.5) * 1.8,
                (Math.random() - 0.5) * 8
            );
            this.chargeGroup.add(m);
        }
    }

    _buildElectricField() {
        const lineMat = new THREE.LineBasicMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.0
        });

        for (let i = -3; i <= 3; i++) {
            const pts = [
                new THREE.Vector3(i * 2.4, 17.5, 0),
                new THREE.Vector3(i * 1.7, 9.0, Math.sin(i) * 1.2),
                new THREE.Vector3(i * 1.1, 0.3, 0)
            ];
            const geo = new THREE.BufferGeometry().setFromPoints(pts);
            const line = new THREE.Line(geo, lineMat.clone());
            this.fieldGroup.add(line);
        }
    }

    /**
     * Жаңы чагылгандын ийри каналын жана бутактарын генерациялайт
     */
    generateBoltPath(targetPos = new THREE.Vector3(0, 0.2, 0)) {
        this.strikeAnchor.copy(targetPos);
        this._clearGroup(this.leaderGroup);
        this._clearGroup(this.returnStrokeGroup);
        if (this.streamerLine) {
            this.group.remove(this.streamerLine);
            this.streamerLine = null;
        }

        const start = new THREE.Vector3(
            targetPos.x + (Math.random() - 0.5) * 4.0,
            18.0,
            targetPos.z + (Math.random() - 0.5) * 2.0
        );
        const end = targetPos.clone();

        const steps = 18;
        this.mainPathPoints = [start.clone()];

        for (let i = 1; i < steps; i++) {
            const t = i / steps;
            const jitter = (1 - t * 0.25) * 2.1;
            this.mainPathPoints.push(new THREE.Vector3(
                THREE.MathUtils.lerp(start.x, end.x, t) + (Math.random() - 0.5) * jitter,
                THREE.MathUtils.lerp(start.y, end.y, t),
                THREE.MathUtils.lerp(start.z, end.z, t) + (Math.random() - 0.5) * jitter * 0.7
            ));
        }
        this.mainPathPoints.push(end.clone());

        // Кошумча бутактар (Stepped Leader branches)
        for (let i = 3; i < steps - 4; i += 3) {
            const origin = this.mainPathPoints[i];
            const branchPts = [origin.clone()];
            let cur = origin.clone();
            for (let b = 0; b < 5; b++) {
                cur = cur.clone().add(new THREE.Vector3(
                    (Math.random() - 0.5) * 3.2,
                    -1.4 - Math.random() * 1.1,
                    (Math.random() - 0.5) * 2.2
                ));
                branchPts.push(cur.clone());
            }
            const branchGeo = new THREE.BufferGeometry().setFromPoints(branchPts);
            const branchMat = new THREE.LineBasicMaterial({
                color: 0x7dd3fc,
                transparent: true,
                opacity: 0.75
            });
            this.leaderGroup.add(new THREE.Line(branchGeo, branchMat));
        }

        // Upward Streamer (жерден өйдө көтөрүлгөн канал)
        const streamerPts = [
            end.clone(),
            end.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 1.5, 0)),
            end.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.2, 3.2, 0))
        ];
        const streamerGeo = new THREE.BufferGeometry().setFromPoints(streamerPts);
        const streamerMat = new THREE.LineBasicMaterial({
            color: 0xf472b6,
            transparent: true,
            opacity: 0.0
        });
        this.streamerLine = new THREE.Line(streamerGeo, streamerMat);
        this.group.add(this.streamerLine);

        // Return Stroke (негизги өтө жарык канал)
        const mainGeo = new THREE.BufferGeometry().setFromPoints(this.mainPathPoints);
        const mainMat = new THREE.LineBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.0
        });
        const coreLine = new THREE.Line(mainGeo, mainMat);
        this.returnStrokeGroup.add(coreLine);

        // Сырткы көгүш-кызгылт ореол сызыктары
        const haloOffsets = [
            new THREE.Vector3(0.08, 0, 0.08),
            new THREE.Vector3(-0.08, 0, -0.08)
        ];
        haloOffsets.forEach((off) => {
            const shifted = this.mainPathPoints.map((p) => p.clone().add(off));
            const hGeo = new THREE.BufferGeometry().setFromPoints(shifted);
            const hMat = new THREE.LineBasicMaterial({
                color: 0x00e5ff,
                transparent: true,
                opacity: 0.0
            });
            this.returnStrokeGroup.add(new THREE.Line(hGeo, hMat));
        });

        this.contactFlash.position.copy(end).add(new THREE.Vector3(0, 2.2, 0));
    }

    _clearGroup(grp) {
        while (grp.children.length > 0) {
            const child = grp.children[0];
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
            grp.remove(child);
        }
    }

    reset() {
        this.chargeGroup.visible = true;
        this.fieldGroup.children.forEach((l) => { l.material.opacity = 0; });
        this._clearGroup(this.leaderGroup);
        this._clearGroup(this.returnStrokeGroup);
        if (this.streamerLine) {
            this.group.remove(this.streamerLine);
            this.streamerLine = null;
        }
        this.contactFlash.material.opacity = 0;
        this.contactFlash.scale.setScalar(0.2);
        this.flashLight.intensity = 0;
    }

    /**
     * Симуляция убактысына (simTime, 0..6.5 сек) жараша 6 этапты жаңыртат
     */
    update(simTime, elapsedReal) {
        // Заряддардын акырын термелиши
        this.chargeGroup.children.forEach((c, idx) => {
            c.position.y += Math.sin(elapsedReal * 3 + idx) * 0.004;
        });

        // 1-ЭТАП (0.0 - 1.0 сек): Заряддардын бөлүнүшү
        // 2-ЭТАП (1.0 - 2.0 сек): Электр талаасы күчөйт
        const fieldOpacity = simTime >= 1.0 && simTime < 3.2
            ? Math.min(0.65, (simTime - 1.0) * 0.65)
            : Math.max(0, 0.65 - (simTime - 3.2) * 0.8);

        this.fieldGroup.children.forEach((line, i) => {
            line.material.opacity = Math.max(0, fieldOpacity * (0.7 + 0.3 * Math.sin(elapsedReal * 8 + i)));
        });

        // 3-ЭТАП (2.0 - 3.2 сек): Stepped Leader төмөн түшөт
        if (simTime >= 2.0 && this.mainPathPoints.length > 1) {
            const p = Math.min(1, (simTime - 2.0) / 1.2);
            const visibleCount = Math.max(2, Math.floor(p * this.mainPathPoints.length));
            const partialPts = this.mainPathPoints.slice(0, visibleCount);

            let leaderLine = this.leaderGroup.getObjectByName('mainLeader');
            if (!leaderLine) {
                const geo = new THREE.BufferGeometry().setFromPoints(partialPts);
                const mat = new THREE.LineBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.95 });
                leaderLine = new THREE.Line(geo, mat);
                leaderLine.name = 'mainLeader';
                this.leaderGroup.add(leaderLine);
            } else {
                leaderLine.geometry.dispose();
                leaderLine.geometry = new THREE.BufferGeometry().setFromPoints(partialPts);
            }
        }

        // 4-ЭТАП (2.8 - 3.4 сек): Upward Streamer көтөрүлөт
        if (this.streamerLine && simTime >= 2.8) {
            const sp = Math.min(1, (simTime - 2.8) / 0.6);
            this.streamerLine.material.opacity = simTime < 3.6 ? sp : Math.max(0, 1 - (simTime - 3.6) * 2.5);
        }

        // 5-ЭТАП (3.4 - 3.8 сек): Контакт жарк этүүсү
        if (simTime >= 3.4 && simTime < 4.1) {
            const fp = 1 - Math.abs((simTime - 3.55) / 0.35);
            const clamped = Math.max(0, fp);
            this.contactFlash.material.opacity = clamped * 0.9;
            this.contactFlash.scale.setScalar(0.5 + clamped * 2.2);
        } else {
            this.contactFlash.material.opacity = 0;
        }

        // 6-ЭТАП (3.5 секден баштап): Return Stroke өтө жарык көрүнөт
        if (simTime >= 3.5) {
            const age = simTime - 3.5;
            const pulse = Math.max(0, 1 - age * 0.85) + (age < 0.25 ? 0.35 * Math.sin(age * 60) : 0);
            const intensity = Math.max(0, Math.min(1, pulse));

            this.returnStrokeGroup.children.forEach((line, idx) => {
                line.material.opacity = idx === 0 ? intensity : intensity * 0.7;
            });

            this.flashLight.position.set(this.strikeAnchor.x, 10, this.strikeAnchor.z);
            this.flashLight.intensity = intensity * 18;
        } else {
            this.flashLight.intensity = 0;
        }
    }
}
