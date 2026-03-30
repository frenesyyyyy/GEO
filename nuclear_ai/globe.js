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
 *   • Message popups that appear/disappear every 3 seconds
 *   • CSS mask-image handles the bottom gradient fade
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

        // Rotation speed
        rotationSpeedY:     0.0018,

        // Camera distance (zoomed out so globe doesn't clip)
        cameraZ:            6.5,

        // Pin appearance — red map markers
        pinHeadRadius:      0.06,
        pinStickRadius:     0.014,
        pinStickLength:     0.24,
        pinColor:           0xdd2222,
        pinEmissive:        0x881111,

        // Pin lifecycle
        pinSpawnInterval:   1000,
        pinMaxCount:        4,
        pinScaleInDuration: 0.3,
        pinHoldDuration:    0.4,
        pinScaleOutDuration:0.3,

        // Message Popups
        messageCycleTime:   3000, // 3 seconds on, 3 seconds off
        messages: [
            "best software for 3d animation rn",
            "I'm out with the girls in rome, best pub to meet other people",
            "Why don't I appear in AI search?",
            "Barber shop with cheapest price in town",
            "I'm tired to cook today, suggest me a delivery app for dinner",
            "What's the difference between GEO and SEO",
            "How to get my business on top of AI search?",
            "How to get my business on top of Google?",
            "Nuclear AI helped me increasing viibility!",
            "expert lawyer for divorce in Hamburg",
            "I have 200$ to invest in crypto, what cryptowallet do you suggest"
        ],

        // Asteroid orbiting balls
        asteroids: [
            { color: 0x0088ff, speed: 1.2, radius: 2.8, offset: 0, inclination: 0.5 },    // Blue
            { color: 0x10b981, speed: 0.9, radius: 3.1, offset: 2, inclination: -0.8 },  // Green
            { color: 0xef4444, speed: 1.5, radius: 2.6, offset: 4, inclination: 1.2 }    // Red
        ]
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

    const size = Math.max(container.clientWidth, container.clientHeight) || 1100;
    renderer.setSize(size, size);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    /* --------------------------------------------------
     *  3. LIGHTING — soft white/grey tones
     * -------------------------------------------------- */
    scene.add(new THREE.AmbientLight(0xffffff, 0.75));

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
    const icoGeo = new THREE.IcosahedronGeometry(CONFIG.globeRadius, CONFIG.globeDetail);
    const icoMat = new THREE.MeshStandardMaterial({
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

    /* Initial tilt for a nice angle */
    globeGroup.rotation.x = 0.25;
    globeGroup.rotation.z = -0.1;

    /* --------------------------------------------------
     *  4c. ASTEROIDS — Rolling balls
     * -------------------------------------------------- */
    const asteroids = [];
    CONFIG.asteroids.forEach(cfg => {
        const geo = new THREE.SphereGeometry(0.06, 12, 12);
        const mat = new THREE.MeshStandardMaterial({
            color: cfg.color,
            emissive: cfg.color,
            emissiveIntensity: 0.5,
            flatShading: true
        });
        const mesh = new THREE.Mesh(geo, mat);
        scene.add(mesh); // Add to scene so they don't rotate with globeGroup
        asteroids.push({
            mesh: mesh,
            cfg: cfg,
            angle: cfg.offset
        });
    });

    /* --------------------------------------------------
     *  5. LOCATION PIN SYSTEM — red map-marker style
     * -------------------------------------------------- */

    /** Build a pin: sphere head + cylinder stick, pointing +Y */
    function buildPinGeometry() {
        const group = new THREE.Group();

        // Stick
        const stickGeo = new THREE.CylinderGeometry(
            CONFIG.pinStickRadius, CONFIG.pinStickRadius,
            CONFIG.pinStickLength, 6
        );
        const stickMat = new THREE.MeshStandardMaterial({
            color: CONFIG.pinColor, emissive: CONFIG.pinEmissive,
            emissiveIntensity: 0.2, flatShading: true,
        });
        const stick = new THREE.Mesh(stickGeo, stickMat);
        stick.position.y = CONFIG.pinStickLength / 2;
        group.add(stick);

        // Head (sphere — map-pin bulb)
        const headGeo = new THREE.SphereGeometry(CONFIG.pinHeadRadius, 8, 8);
        const headMat = new THREE.MeshStandardMaterial({
            color: CONFIG.pinColor, emissive: CONFIG.pinEmissive,
            emissiveIntensity: 0.35, flatShading: true,
        });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = CONFIG.pinStickLength + CONFIG.pinHeadRadius * 0.6;
        group.add(head);

        return group;
    }

    /** Convert lat/lon (degrees) → Vector3 on globe surface */
    function latLonToVec3(lat, lon, radius) {
        const phi   = (90 - lat)  * (Math.PI / 180);
        const theta = (lon + 180) * (Math.PI / 180);
        return new THREE.Vector3(
            -(radius * Math.sin(phi) * Math.cos(theta)),
              radius * Math.cos(phi),
              radius * Math.sin(phi) * Math.sin(theta)
        );
    }

    const activePins = [];

    /** Spawn a red marker pin at a random location */
    function spawnPin() {
        if (activePins.length >= CONFIG.pinMaxCount) return;

        const lat = (Math.random() - 0.5) * 130;
        const lon = Math.random() * 360 - 180;
        const surfacePos = latLonToVec3(lat, lon, CONFIG.globeRadius);

        const pin = buildPinGeometry();
        pin.position.copy(surfacePos);

        // Orient so +Y points outward from globe center
        const up   = surfacePos.clone().normalize();
        const axis = new THREE.Vector3(0, 1, 0);
        pin.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(axis, up));

        pin.scale.set(0, 0, 0);
        globeGroup.add(pin);

        activePins.push({ object: pin, phase: 'scaleIn', elapsed: 0 });
    }

    /** Animate all active pins through their lifecycle */
    function updatePins(delta) {
        for (let i = activePins.length - 1; i >= 0; i--) {
            const p = activePins[i];
            p.elapsed += delta;

            if (p.phase === 'scaleIn') {
                const t    = Math.min(p.elapsed / CONFIG.pinScaleInDuration, 1);
                const ease = 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2);
                const s    = Math.max(0, ease);
                p.object.scale.set(s, s, s);
                if (t >= 1) { p.phase = 'hold'; p.elapsed = 0; }

            } else if (p.phase === 'hold') {
                const pulse = 1 + 0.06 * Math.sin(p.elapsed * 3);
                p.object.scale.set(pulse, pulse, pulse);
                if (p.elapsed >= CONFIG.pinHoldDuration) { p.phase = 'scaleOut'; p.elapsed = 0; }

            } else if (p.phase === 'scaleOut') {
                const t    = Math.min(p.elapsed / CONFIG.pinScaleOutDuration, 1);
                const ease = 1 - t * t;
                p.object.scale.set(ease, ease, ease);
                if (t >= 1) {
                    globeGroup.remove(p.object);
                    p.object.traverse(child => {
                        if (child.isMesh) { child.geometry.dispose(); child.material.dispose(); }
                    });
                    activePins.splice(i, 1);
                }
            }
        }
    }

    /* --------------------------------------------------
     *  6. MESSAGE POPUP SYSTEM
     * -------------------------------------------------- */
    const labels = [];
    const NUM_LABELS = 3;
    const tempVec = new THREE.Vector3();

    function createLabels() {
        for (let i = 0; i < NUM_LABELS; i++) {
            const el = document.createElement('div');
            el.className = 'globe-label';
            container.appendChild(el);
            labels.push({
                element: el,
                pos: new THREE.Vector3(),
                active: false
            });
        }
    }
    createLabels();

    let labelsVisible = false;
    let labelTimer = 0;

    /** Returns coordinates that are currently facing the camera */
    function getFrontFacingCoordinates() {
        let lat, lon, worldPos = new THREE.Vector3();
        let attempts = 0;
        
        while (attempts < 50) {
            lat = (Math.random() - 0.5) * 110;
            lon = Math.random() * 360 - 180;
            const localPos = latLonToVec3(lat, lon, CONFIG.globeRadius + 0.2);
            
            // World position
            worldPos.copy(localPos).applyMatrix4(globeGroup.matrixWorld);
            
            // Dot product with camera position
            const dot = worldPos.clone().normalize().dot(camera.position.clone().normalize());
            if (dot > 0.6) return { lat, lon, pos: localPos }; 
            attempts++;
        }
        return { lat: 0, lon: 0, pos: latLonToVec3(0, 0, CONFIG.globeRadius + 0.2) };
    }

    function showRandomLabels() {
        const availableMessages = [...CONFIG.messages];
        const pickedPositions = [];

        labels.forEach(l => {
            const idx = Math.floor(Math.random() * availableMessages.length);
            l.element.textContent = availableMessages.splice(idx, 1)[0];
            
            let coords;
            let validSpacing = false;
            let attempts = 0;

            // Find a position that is front-facing AND distant from already picked ones
            while (!validSpacing && attempts < 30) {
                coords = getFrontFacingCoordinates();
                validSpacing = true;
                for (const otherPos of pickedPositions) {
                    if (coords.pos.distanceTo(otherPos) < 1.5) { // Minimum 3D distance
                        validSpacing = false;
                        break;
                    }
                }
                attempts++;
            }

            pickedPositions.push(coords.pos);
            l.pos = coords.pos;
            l.active = true;
            l.element.classList.add('active');
        });
        labelsVisible = true;
        labelTimer = 0;
    }

    function hideLabels() {
        labels.forEach(l => {
            l.active = false;
            l.element.classList.remove('active');
        });
        labelsVisible = false;
        labelTimer = 0;
    }

    function updateLabels() {
        labels.forEach(l => {
            if (!l.active) {
                if (labelTimer > 600 && !labelsVisible) return;
            }

            tempVec.copy(l.pos).applyMatrix4(globeGroup.matrixWorld);
            
            const dot = tempVec.clone().normalize().dot(camera.position.clone().normalize());
            if (dot < 0.5) {
                l.element.style.opacity = '0';
                l.element.style.visibility = 'hidden';
            } else {
                l.element.style.opacity = labelsVisible ? '1' : '0';
                l.element.style.visibility = labelsVisible ? 'visible' : 'hidden';
            }

            tempVec.project(camera);
            const x = (tempVec.x * 0.5 + 0.5) * container.clientWidth;
            const y = (tempVec.y * -0.5 + 0.5) * container.clientHeight;

            l.element.style.left = `${x}px`;
            l.element.style.top = `${y}px`;
        });
    }

    // Initial delay so globe is tilted
    setTimeout(showRandomLabels, 500);

    /* --------------------------------------------------
     *  7. RESIZE HANDLING
     * -------------------------------------------------- */
    function onResize() {
        const s = Math.max(container.clientWidth, container.clientHeight) || 1100;
        camera.aspect = 1;
        camera.updateProjectionMatrix();
        renderer.setSize(s, s);
    }
    window.addEventListener('resize', onResize);

    /* --------------------------------------------------
     *  8. ANIMATION LOOP
     * -------------------------------------------------- */
    const clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);
        const delta = clock.getDelta();
        
        globeGroup.rotation.y += CONFIG.rotationSpeedY;
        updatePins(delta);

        // Update Asteroids Position
        const time = clock.getElapsedTime();
        asteroids.forEach(a => {
            const cfg = a.cfg;
            const angle = time * cfg.speed + cfg.offset;
            
            // Spherical to Cartesian with inclination
            a.mesh.position.x = Math.cos(angle) * cfg.radius;
            a.mesh.position.y = Math.sin(angle) * Math.sin(cfg.inclination) * cfg.radius;
            a.mesh.position.z = Math.sin(angle) * Math.cos(cfg.inclination) * cfg.radius;
        });

        labelTimer += delta * 1000;
        if (labelsVisible && labelTimer >= CONFIG.messageCycleTime) {
            hideLabels();
        } else if (!labelsVisible && labelTimer >= CONFIG.messageCycleTime) {
            showRandomLabels();
        }

        updateLabels();

        renderer.render(scene, camera);
    }
    animate();

})();
