/**
 * ============================================================
 *  globe.js — Low-Poly 3D Globe Background for Nuclear AI
 * ============================================================
 *
 *  Features:
 *   • IcosahedronGeometry with flatShading for a faceted look
 *   • EdgesGeometry network lines over the globe surface
 *   • Infinite Y-axis rotation
 *   • Location pins that spawn / despawn with smooth scaling
 *   • Scroll-based fade-out so the globe is hero-section only
 *
 *  Dependencies: Three.js r128+ loaded globally (THREE)
 * ============================================================
 */

(function () {
    'use strict';

    /* --------------------------------------------------
     *  1. CONFIGURATION
     * -------------------------------------------------- */
    const CONFIG = {
        // Globe
        globeRadius:        2.4,
        globeDetail:        3,          // icosahedron subdivision level
        globeColor:         0xf0f0f0,   // very light grey
        edgeColor:          0xcccccc,   // network-line grey
        edgeOpacity:        0.45,

        // Rotation
        rotationSpeedY:     0.002,
        rotationSpeedX:     0.0004,

        // Camera
        cameraZ:            5.4,

        // Pins
        pinRadius:          0.035,
        pinHeight:          0.16,
        pinColor:           0xbfbfbf,   // subtle light grey pin
        pinEmissive:        0x999999,
        pinSpawnInterval:   3200,       // ms between new pins
        pinMaxCount:        6,
        pinScaleDuration:   1.2,        // seconds to scale in / out
        pinLifetime:        2.5,        // seconds at full scale

        // Scroll fade
        fadeDistance:        300,        // px of scroll to reach 0 opacity
    };

    /* --------------------------------------------------
     *  2. CONTAINER & RENDERER SETUP
     * -------------------------------------------------- */
    const container = document.getElementById('globe-container');
    if (!container) return;

    const scene    = new THREE.Scene();
    const camera   = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, CONFIG.cameraZ);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth || 800, container.clientHeight || 800);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    /* --------------------------------------------------
     *  3. LIGHTING  (soft, white/grey — matches ref image)
     * -------------------------------------------------- */
    scene.add(new THREE.AmbientLight(0xffffff, 0.75));

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(4, 6, 5);
    scene.add(dirLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.25);
    rimLight.position.set(-3, -2, -4);
    scene.add(rimLight);

    /* --------------------------------------------------
     *  4. GLOBE GROUP  (everything rotates together)
     * -------------------------------------------------- */
    const globeGroup = new THREE.Group();
    scene.add(globeGroup);

    /* 4a. Solid low-poly globe */
    const icoGeo = new THREE.IcosahedronGeometry(CONFIG.globeRadius, CONFIG.globeDetail);
    const icoMat = new THREE.MeshStandardMaterial({
        color:        CONFIG.globeColor,
        flatShading:  true,
        roughness:    0.85,
        metalness:    0.05,
    });
    const globeMesh = new THREE.Mesh(icoGeo, icoMat);
    globeGroup.add(globeMesh);

    /* 4b. Network edge lines */
    const edgesGeo = new THREE.EdgesGeometry(icoGeo);
    const edgesMat = new THREE.LineBasicMaterial({
        color:       CONFIG.edgeColor,
        transparent: true,
        opacity:     CONFIG.edgeOpacity,
    });
    const edgeLines = new THREE.LineSegments(edgesGeo, edgesMat);
    globeGroup.add(edgeLines);

    /* Slight initial tilt so we see it from an angle */
    globeGroup.rotation.x = 0.25;
    globeGroup.rotation.z = -0.1;

    /* --------------------------------------------------
     *  5. LOCATION PIN SYSTEM
     * -------------------------------------------------- */
    const pinGeo = new THREE.ConeGeometry(CONFIG.pinRadius, CONFIG.pinHeight, 6);
    pinGeo.translate(0, CONFIG.pinHeight / 2, 0); // origin at base

    const activePins = [];

    /**
     * Convert latitude/longitude (degrees) to a Vector3 on the globe surface.
     */
    function latLonToVec3(lat, lon, radius) {
        const phi   = (90 - lat) * (Math.PI / 180);
        const theta = (lon + 180) * (Math.PI / 180);
        return new THREE.Vector3(
            -(radius * Math.sin(phi) * Math.cos(theta)),
              radius * Math.cos(phi),
              radius * Math.sin(phi) * Math.sin(theta)
        );
    }

    /**
     * Spawn a single pin at a random position on the globe.
     */
    function spawnPin() {
        if (activePins.length >= CONFIG.pinMaxCount) return;

        const lat = (Math.random() - 0.5) * 140;   // -70 to +70 (avoid poles)
        const lon = Math.random() * 360 - 180;      // -180 to +180
        const pos = latLonToVec3(lat, lon, CONFIG.globeRadius + 0.01);

        const mat = new THREE.MeshStandardMaterial({
            color:             CONFIG.pinColor,
            emissive:          CONFIG.pinEmissive,
            emissiveIntensity: 0.3,
            flatShading:       true,
            transparent:       true,
            opacity:           1,
        });
        const pin = new THREE.Mesh(pinGeo, mat);

        // Place on surface
        pin.position.copy(pos);

        // Orient so the pin points outward from the globe center
        pin.lookAt(new THREE.Vector3(0, 0, 0));
        pin.rotateX(Math.PI / 2);

        // Start at scale 0 for spawn animation
        pin.scale.set(0, 0, 0);
        globeGroup.add(pin);

        activePins.push({
            mesh:      pin,
            phase:     'scaleIn',       // scaleIn → hold → scaleOut → done
            elapsed:   0,
        });
    }

    /**
     * Update all active pins (scale-in, hold, scale-out).
     */
    function updatePins(delta) {
        for (let i = activePins.length - 1; i >= 0; i--) {
            const p = activePins[i];
            p.elapsed += delta;

            if (p.phase === 'scaleIn') {
                const t = Math.min(p.elapsed / CONFIG.pinScaleDuration, 1);
                const ease = 1 - Math.pow(1 - t, 3);           // ease-out cubic
                p.mesh.scale.set(ease, ease, ease);
                p.mesh.material.opacity = ease;
                if (t >= 1) { p.phase = 'hold'; p.elapsed = 0; }

            } else if (p.phase === 'hold') {
                if (p.elapsed >= CONFIG.pinLifetime) { p.phase = 'scaleOut'; p.elapsed = 0; }

            } else if (p.phase === 'scaleOut') {
                const t = Math.min(p.elapsed / CONFIG.pinScaleDuration, 1);
                const ease = 1 - t * t;                        // ease-in quad
                p.mesh.scale.set(ease, ease, ease);
                p.mesh.material.opacity = ease;
                if (t >= 1) {
                    globeGroup.remove(p.mesh);
                    p.mesh.material.dispose();
                    activePins.splice(i, 1);
                }
            }
        }
    }

    // Periodic pin spawner
    setInterval(spawnPin, CONFIG.pinSpawnInterval);
    spawnPin(); // spawn one immediately

    /* --------------------------------------------------
     *  6. SCROLL-BASED FADE-OUT
     * -------------------------------------------------- */
    function handleScroll() {
        const scrollY = window.scrollY || window.pageYOffset;
        const opacity = Math.max(0, 1 - scrollY / CONFIG.fadeDistance);
        container.style.opacity = opacity;

        // Pause rendering when fully invisible for performance
        if (opacity <= 0) {
            container.style.visibility = 'hidden';
        } else {
            container.style.visibility = 'visible';
        }
    }
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // set initial state

    /* --------------------------------------------------
     *  7. RESIZE HANDLING
     * -------------------------------------------------- */
    function onResize() {
        const w = container.clientWidth  || 800;
        const h = container.clientHeight || 800;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    }
    window.addEventListener('resize', onResize);

    /* --------------------------------------------------
     *  8. ANIMATION LOOP
     * -------------------------------------------------- */
    const clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);

        // Skip rendering when container is hidden
        if (container.style.visibility === 'hidden') return;

        const delta = clock.getDelta();

        // Infinite Y-axis rotation
        globeGroup.rotation.y += CONFIG.rotationSpeedY;

        // Update pin animations
        updatePins(delta);

        renderer.render(scene, camera);
    }
    animate();

})();
