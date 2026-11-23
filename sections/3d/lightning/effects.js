/**
 * effects.js
 * 1) Сахнанын негизги элементтери: бороон булуттары, чөптүү талаа, бак, үй, адам модели
 * 2) Жарыктын таралышы (фотон бөлүкчөлөрү жана жарык толкуну — 300 000 км/с)
 * 3) Үн толкуну (Shockwave жана кеңейүүчү шакекчелер — 343 м/с)
 */

import * as THREE from 'three';

export class EnvironmentAndEffects {
    constructor(scene) {
        this.scene = scene;
        this.clouds = [];
        this.humanGroup = new THREE.Group();
        this.humanPos = new THREE.Vector3(-9, 0, 6);
        this.strikePos = new THREE.Vector3(4, 0, -2);

        // Жарык бөлүкчөлөрү (Фотоны) жана жарык толкуну
        this.photonPoints = null;
        this.photonVelocities = [];
        this.lightWaveRing = null;

        // Үн толкуну (Shockwave + Expanding rings)
        this.soundRings = [];
        this.shockwaveSphere = null;

        this._buildTerrain();
        this._buildClouds();
        this._buildTree();
        this._buildHouse();
        this._buildHuman();
        this._buildLightEffects();
        this._buildSoundEffects();
    }

    /**
     * Чөптүү талаа
     */
    _buildTerrain() {
        const groundGeo = new THREE.PlaneGeometry(140, 140, 24, 24);
        groundGeo.rotateX(-Math.PI / 2);

        const groundMat = new THREE.MeshStandardMaterial({
            color: 0x133824,
            roughness: 0.92,
            metalness: 0.05
        });

        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Чөп тутамдары (InstancedMesh — GPU'га ыңгайлуу)
        const bladeGeo = new THREE.ConeGeometry(0.08, 0.55, 4);
        bladeGeo.translate(0, 0.27, 0);
        const bladeMat = new THREE.MeshStandardMaterial({ color: 0x226b3a, roughness: 0.8 });

        const count = 420;
        const grassInst = new THREE.InstancedMesh(bladeGeo, bladeMat, count);
        const dummy = new THREE.Object3D();

        for (let i = 0; i < count; i++) {
            dummy.position.set(
                (Math.random() - 0.5) * 44,
                0,
                (Math.random() - 0.5) * 44
            );
            dummy.rotation.y = Math.random() * Math.PI * 2;
            const s = 0.7 + Math.random() * 0.9;
            dummy.scale.set(s, s, s);
            dummy.updateMatrix();
            grassInst.setMatrixAt(i, dummy.matrix);
        }
        this.scene.add(grassInst);
    }

    /**
     * Кара бороондуу булуттар
     */
    _buildClouds() {
        const cloudClusters = [
            { x: -6, y: 20, z: -2, scale: 1.15 },
            { x: 4,  y: 20.5, z: -1, scale: 1.25 },
            { x: 13, y: 19.8, z: -3, scale: 1.05 }
        ];

        const puffGeo = new THREE.SphereGeometry(2.6, 16, 14);
        const puffMat = new THREE.MeshStandardMaterial({
            color: 0x1e293b,
            roughness: 0.95,
            metalness: 0.02
        });

        cloudClusters.forEach((cfg) => {
            const cluster = new THREE.Group();
            cluster.position.set(cfg.x, cfg.y, cfg.z);
            cluster.scale.setScalar(cfg.scale);

            const offsets = [
                [-2.2, 0, 0, 0.85],
                [0, 0.6, 0.4, 1.05],
                [2.2, -0.1, -0.3, 0.9],
                [-1.0, 1.1, -0.5, 0.75],
                [1.2, 0.9, 0.5, 0.8]
            ];

            offsets.forEach(([ox, oy, oz, rScale]) => {
                const mesh = new THREE.Mesh(puffGeo, puffMat);
                mesh.position.set(ox, oy, oz);
                mesh.scale.setScalar(rScale);
                cluster.add(mesh);
            });

            this.scene.add(cluster);
            this.clouds.push({ group: cluster, baseX: cfg.x });
        });
    }

    /**
     * Жалгыз бак
     */
    _buildTree() {
        const tree = new THREE.Group();
        tree.position.set(8.5, 0, 4.5);

        const trunkGeo = new THREE.CylinderGeometry(0.25, 0.42, 3.2, 8);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a2e1b, roughness: 0.9 });
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 1.6;
        tree.add(trunk);

        const foliageGeo = new THREE.ConeGeometry(2.1, 4.6, 10);
        const foliageMat = new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.85 });
        const foliage = new THREE.Mesh(foliageGeo, foliageMat);
        foliage.position.y = 4.6;
        tree.add(foliage);

        this.scene.add(tree);
    }

    /**
     * Бир үй
     */
    _buildHouse() {
        const house = new THREE.Group();
        house.position.set(-13.5, 0, -5.5);

        const wallGeo = new THREE.BoxGeometry(4.4, 3.0, 3.8);
        const wallMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.75 });
        const walls = new THREE.Mesh(wallGeo, wallMat);
        walls.position.y = 1.5;
        house.add(walls);

        const roofGeo = new THREE.ConeGeometry(3.4, 2.0, 4);
        roofGeo.rotateY(Math.PI / 4);
        const roofMat = new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.7 });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.y = 4.0;
        house.add(roof);

        this.scene.add(house);
    }

    /**
     * Адам модели
     */
    _buildHuman() {
        this.humanGroup.position.copy(this.humanPos);

        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.5 });
        const headMat = new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.6 });

        const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 1.05, 10), bodyMat);
        torso.position.y = 1.15;
        this.humanGroup.add(torso);

        const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 12), headMat);
        head.position.y = 1.95;
        this.humanGroup.add(head);

        this.scene.add(this.humanGroup);
    }

    /**
     * Жарыктын таралышы (фотон бөлүкчөлөрү + жарык толкуну)
     */
    _buildLightEffects() {
        const count = 120;
        const positions = new Float32Array(count * 3);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const mat = new THREE.PointsMaterial({
            color: 0x7dd3fc,
            size: 0.35,
            transparent: true,
            opacity: 0.0
        });

        this.photonPoints = new THREE.Points(geo, mat);
        this.scene.add(this.photonPoints);

        const ringGeo = new THREE.RingGeometry(0.4, 0.9, 32);
        ringGeo.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0xe0f2fe,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.0
        });
        this.lightWaveRing = new THREE.Mesh(ringGeo, ringMat);
        this.lightWaveRing.position.set(this.strikePos.x, 0.25, this.strikePos.z);
        this.scene.add(this.lightWaveRing);
    }

    /**
     * Үн толкуну (Shockwave сферасы жана кеңейүүчү шакекчелер)
     */
    _buildSoundEffects() {
        const waveGeo = new THREE.SphereGeometry(1, 24, 18);
        const waveMat = new THREE.MeshBasicMaterial({
            color: 0xc084fc,
            wireframe: true,
            transparent: true,
            opacity: 0.0
        });
        this.shockwaveSphere = new THREE.Mesh(waveGeo, waveMat);
        this.shockwaveSphere.position.set(this.strikePos.x, 3.0, this.strikePos.z);
        this.scene.add(this.shockwaveSphere);

        for (let i = 0; i < 3; i++) {
            const rGeo = new THREE.RingGeometry(0.8, 1.15, 40);
            rGeo.rotateX(-Math.PI / 2);
            const rMat = new THREE.MeshBasicMaterial({
                color: 0xa855f7,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.0
            });
            const ring = new THREE.Mesh(rGeo, rMat);
            ring.position.set(this.strikePos.x, 0.35, this.strikePos.z);
            this.scene.add(ring);
            this.soundRings.push(ring);
        }
    }

    resetWaves() {
        this.photonPoints.material.opacity = 0;
        this.lightWaveRing.material.opacity = 0;
        this.lightWaveRing.scale.setScalar(0.1);

        this.shockwaveSphere.material.opacity = 0;
        this.shockwaveSphere.scale.setScalar(0.1);

        this.soundRings.forEach((r) => {
            r.material.opacity = 0;
            r.scale.setScalar(0.1);
        });
    }

    /**
     * Булуттарды, жарыкты жана үн толкунун анимациялайт
     */
    update(simTime, elapsedReal, soundDelaySec) {
        // Булуттардын акырын кыймылы
        this.clouds.forEach((c, idx) => {
            c.group.position.x = c.baseX + Math.sin(elapsedReal * 0.25 + idx) * 1.4;
        });

        // Чагылган контакты болгон учур (simTime >= 3.5 сек)
        if (simTime >= 3.5) {
            const strikeAge = simTime - 3.5;

            // 1) Жарыктын таралышы: 300 000 км/с -> визуалдык түрдө өтө тез жайылат
            const lightProgress = Math.min(1, strikeAge * 14);
            this.lightWaveRing.position.set(this.strikePos.x, 0.25, this.strikePos.z);
            this.lightWaveRing.scale.setScalar(1 + lightProgress * 22);
            this.lightWaveRing.material.opacity = Math.max(0, (1 - lightProgress) * 0.85);

            // Фотон бөлүкчөлөрү
            const posAttr = this.photonPoints.geometry.getAttribute('position');
            const count = posAttr.count;
            for (let i = 0; i < count; i++) {
                const angle = (i / count) * Math.PI * 2 + i * 0.37;
                const radius = Math.min(24, strikeAge * 42 * (0.4 + (i % 7) * 0.12));
                const y = 1.0 + ((i * 13) % 16) * (0.2 + lightProgress * 0.8);
                posAttr.setXYZ(
                    i,
                    this.strikePos.x + Math.cos(angle) * radius,
                    y,
                    this.strikePos.z + Math.sin(angle) * radius
                );
            }
            posAttr.needsUpdate = true;
            this.photonPoints.material.opacity = Math.max(0, 1 - strikeAge * 1.6);

            // 2) Үн толкуну: 343 м/с -> кечигүү шкаласына жараша акырын кеңейип тарайт
            const visualSoundRate = Math.max(0.45, 2.6 / Math.max(0.3, soundDelaySec));
            const soundRadius = Math.max(0.2, strikeAge * visualSoundRate * 6.5);

            this.shockwaveSphere.position.set(this.strikePos.x, 3.0, this.strikePos.z);
            this.shockwaveSphere.scale.setScalar(soundRadius);
            this.shockwaveSphere.material.opacity = Math.max(0, 0.42 - soundRadius * 0.015);

            this.soundRings.forEach((ring, idx) => {
                const rScale = Math.max(0.1, soundRadius - idx * 2.4);
                ring.position.set(this.strikePos.x, 0.35 + idx * 0.2, this.strikePos.z);
                ring.scale.setScalar(rScale);
                ring.material.opacity = Math.max(0, 0.65 - rScale * 0.022);
            });
        } else {
            this.resetWaves();
        }
    }
}
