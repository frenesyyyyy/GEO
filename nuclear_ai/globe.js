/**
 * ============================================================
 *  globe.js — Low-Poly 3D Globe Background for Nuclear AI
 * ============================================================
 *
 *  Features:
 *   • IcosahedronGeometry with flatShading for a faceted look
 *   • EdgesGeometry network lines over the globe surface
 *   • Infinite Y-axis rotation
 *   • Red location-marker pins that pop out from the surface
 *   • Bottom gradient mask fades the globe into the white page
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
        // Globe geometry
        globeRadius:        2.4,
        globeDetail:        3,              // icosahedron subdivision
        globeColor:         0xf0f0f0,       // light grey
        edgeColor:          0xcccccc,       // network line grey
        edgeOpacity:        0.4,

        // Rotation
        rotationSpeedY:     0.0018,

        // Camera
        cameraZ:            5.6,

        // Pin appearance
        pinHeadRadius:      0.055,          // sphere head
        pinStickRadius:     0.012,          // cylinder stick
        pinStickLength:     0.22,           // how far it pops out
        pinColor:           0xdd2222,       // RED marker
        pinEmissive:        0x881111,

        // Pin lifecycle
        pinSpawnInterval:   3000,           // ms between spawns
        pinMaxCount:        6,
        pinScaleInDuration: 0.8,            // seconds
        pinHoldDuration:    2.8,            // seconds at full scale
        pinScaleOutDuration:0.6,            // seconds
    };

    /* --------------------------------------------------
     *  2. CONTAINER & RENDERER
     * -------------------------------------------------- */
    const container = document.getElementById('globe-container');
    if (!container) return;

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, CONFIG.cameraZ);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth || 800, container.clientHeight || 800);
    renderer.setClearColor(0x000000, 0);   // fully transparent background
    container.appendChild(renderer.domElement);

    /* --------------------------------------------------
     *  3. LIGHTING — soft white/grey tones
     * -------------------------------------------------- */
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.65);
    dirLight.position.set(4, 6, 5);
    scene.add(dirLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.2);
    rimLight.position.set(-3, -2, -4);
    scene.add(rimLight);

    /* --------------------------------------------------
     *  4. GLOBE GROUP
     * -------------------------------------------------- */
    const globeGroup = new THREE.Group();
    scene.add(globeGroup);

    /* 4a. Solid low-poly globe */
    const icoGeo  = new THREE.IcosahedronGeometry(CONFIG.globeRadius, CONFIG.globeDetail);
    const icoMat  = new THREE.MeshStandardMaterial({
        color:       CONFIG.globeColor,
        flatShading: true,
        roughness:   0.85,
        metalness:   0.05,
    });
    globeGroup.add(new THREE.Mesh(icoGeo, icoMat));

    /* 4b. Network edge lines */
    const edgesGeo = new THREE.EdgesGeometry(icoGeo);
    const edgesMat = new THREE.LineBasicMaterial({
        color:       CONFIG.edgeColor,
        transparent: true,
        opacity:     CONFIG.edgeOpacity,
    });
    globeGroup.add(new THREE.LineSegments(edgesGeo, edgesMat));

    /* Initial tilt for a nice viewing angle */
    globeGroup.rotation.x = 0.25;
    globeGroup.rotation.z = -0.1;

    /* --------------------------------------------------
     *  5. LOCATION PIN SYSTEM — red map-marker style
     * -------------------------------------------------- */

    /**
     * Build a reusable pin geometry: sphere head + cylinder stick.
     * The pin "base" is at origin, pointing outward along +Y.
     */
    function buildPinGeometry() {
        const group = new THREE.Group();

        // Stick (cylinder)
        const stickGeo = new THREE.CylinderGeometry(
            CONFIG.pinStickRadius, CONFIG.pinStickRadius,
            CONFIG.pinStickLength, 6
        );
        const stickMat = new THREE.MeshStandardMaterial({
            color:     CONFIG.pinColor,
            emissive:  CONFIG.pinEmissive,
            emissiveIntensity: 0.2,
            flatShading: true,
        });
        const stick = new THREE.Mesh(stickGeo, stickMat);
        stick.position.y = CONFIG.pinStickLength / 2;
        group.add(stick);

        // Head (sphere — the classic map-pin bulb)
        const headGeo = new THREE.SphereGeometry(CONFIG.pinHeadRadius, 8, 8);
        const headMat = new THREE.MeshStandardMaterial({
            color:     CONFIG.pinColor,
            emissive:  CONFIG.pinEmissive,
            emissiveIntensity: 0.35,
            flatShading: true,
        });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = CONFIG.pinStickLength + CONFIG.pinHeadRadius * 0.6;
        group.add(head);

        return group;
    }

    /** Convert lat/lon (degrees) → Vector3 on globe surface */
    function latLonToVec3(lat, lon, radius) {
        const phi   = (90 - lat) * (Math.PI / 180);
        const theta = (lon + 180) * (Math.PI / 180);
        return new THREE.Vector3(
            -(radius * Math.sin(phi) * Math.cos(theta)),
              radius * Math.cos(phi),
              radius * Math.sin(phi) * Math.sin(theta)
        );
    }

    const activePins = [];

    /** Spawn a single red marker pin at a random location */
    function spawnPin() {
        if (activePins.length >= CONFIG.pinMaxCount) return;

        const lat = (Math.random() - 0.5) * 130;   // avoid poles
        const lon = Math.random() * 360 - 180;
        const surfacePos = latLonToVec3(lat, lon, CONFIG.globeRadius);

        const pin = buildPinGeometry();

        // Place on surface
        pin.position.copy(surfacePos);

        // Orient so +Y points away from globe center (outward normal)
        const up = surfacePos.clone().normalize();
        const axis = new THREE.Vector3(0, 1, 0);
        const quat = new THREE.Quaternion().setFromUnitVectors(axis, up);
        pin.quaternion.copy(quat);

        // Start invisible / at scale 0 for pop-in
        pin.scale.set(0, 0, 0);
        globeGroup.add(pin);

        activePins.push({
            object:  pin,
            phase:   'scaleIn',
            elapsed: 0,
        });
    }

    /** Animate all active pins through their lifecycle */
    function updatePins(delta) {
        for (let i = activePins.length - 1; i >= 0; i--) {
            const p = activePins[i];
            p.elapsed += delta;

            if (p.phase === 'scaleIn') {
                const t    = Math.min(p.elapsed / CONFIG.pinScaleInDuration, 1);
                // Overshoot easing — makes pins "pop out" from the surface
                const ease = 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2);
                const s    = Math.max(0, ease);
                p.object.scale.set(s, s, s);
                if (t >= 1) { p.phase = 'hold'; p.elapsed = 0; }

            } else if (p.phase === 'hold') {
                // Subtle breathing pulse while holding
                const pulse = 1 + 0.06 * Math.sin(p.elapsed * 3);
                p.object.scale.set(pulse, pulse, pulse);
                if (p.elapsed >= CONFIG.pinHoldDuration) { p.phase = 'scaleOut'; p.elapsed = 0; }

            } else if (p.phase === 'scaleOut') {
                const t    = Math.min(p.elapsed / CONFIG.pinScaleOutDuration, 1);
                const ease = 1 - t * t;    // ease-in quad
                p.object.scale.set(ease, ease, ease);
                if (t >= 1) {
                    globeGroup.remove(p.object);
                    // Dispose children materials
                    p.object.traverse(child => {
                        if (child.isMesh) {
                            child.geometry.dispose();
                            child.material.dispose();
                        }
                    });
                    activePins.splice(i, 1);
                }
            }
        }
    }

    // Periodic spawner + initial spawn
    setInterval(spawnPin, CONFIG.pinSpawnInterval);
    spawnPin();

    /* --------------------------------------------------
     *  6. RESIZE HANDLING
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
     *  7. ANIMATION LOOP
     * -------------------------------------------------- */
    const clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);
        const delta = clock.getDelta();

        // Infinite Y-axis rotation
        globeGroup.rotation.y += CONFIG.rotationSpeedY;

        // Update pin animations
        updatePins(delta);

        renderer.render(scene, camera);
    }
    animate();

})();
