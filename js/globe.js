/**
 * AGNIWATCH - 3D Earth Intelligence Command Center
 * Three.js Interactive Earth Visualization Engine
 */

class EarthCommander {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error(`Container #${containerId} not found`);
      return;
    }

    this.options = Object.assign({
      earthRadius: 100,
      cameraDistance: 270,
      autoRotateSpeed: 0.35,
      onSelectHotspot: null,
      onHoverHotspot: null
    }, options);

    this.earthRadius = this.options.earthRadius;
    this.hotspots = [];
    this.markerObjects = [];
    this.selectedHotspot = null;
    this.selectedMarker = null;
    this.isAutoRotating = true;
    this.showClouds = true;
    this.showOrbits = true;
    this.showScanEffect = true;

    // Animation state
    this.clock = new THREE.Clock();
    this.pulseTime = 0;
    this.scanAngle = 0;
    this.satellites = [];

    // Raycasting
    this.raycaster = new THREE.Raycaster();
    this.raycaster.params.Points = { threshold: 3 };
    this.mouse = new THREE.Vector2(-999, -999);
    this.hoveredMarker = null;

    // Target camera transition
    this.cameraTransition = null;

    this.init();
  }

  init() {
    this.setupScene();
    this.setupCamera();
    this.setupRenderer();
    this.setupControls();
    this.setupLighting();
    this.setupStars();
    this.setupEarth();
    this.setupClouds();
    this.setupAtmosphere();
    this.setupGraticule();
    this.setupSatelliteOrbits();
    this.setupScanner();
    this.setupTargetReticle();
    this.setupEventListeners();

    // Start animation loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);

    // Initial focus on India coordinates (approx 21°N, 82°E)
    this.focusCoordinates(21, 82, 280, 1200);
  }

  setupScene() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x030712, 0.0007);
    this.earthGroup = new THREE.Group();
    this.hotspotGroup = new THREE.Group();
    this.earthGroup.add(this.hotspotGroup);
    this.scene.add(this.earthGroup);
  }

  setupCamera() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 4000);
    this.camera.position.set(0, 40, this.options.cameraDistance);
  }

  setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance"
    });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.container.appendChild(this.renderer.domElement);
  }

  setupControls() {
    if (typeof THREE.OrbitControls === "function") {
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.rotateSpeed = 0.65;
      this.controls.zoomSpeed = 0.85;
      this.controls.minDistance = this.earthRadius * 1.22;
      this.controls.maxDistance = this.earthRadius * 5.5;
      this.controls.enablePan = false;
    }
  }

  setupLighting() {
    // Ambient space light with slight deep-blue cosmic tint
    this.ambientLight = new THREE.AmbientLight(0x23314f, 1.2);
    this.scene.add(this.ambientLight);

    // Sun directional light (illuminates Earth from high angle)
    this.sunLight = new THREE.DirectionalLight(0xffffff, 2.0);
    this.sunLight.position.set(400, 200, 300);
    this.scene.add(this.sunLight);

    // Rim backlight for atmospheric edge depth
    this.rimLight = new THREE.DirectionalLight(0x00f0ff, 0.8);
    this.rimLight.position.set(-300, -100, -400);
    this.scene.add(this.rimLight);
  }

  setupStars() {
    const starCount = 3500;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    const palette = [
      new THREE.Color(0xffffff),
      new THREE.Color(0xa5c9ff),
      new THREE.Color(0x7ea9ff),
      new THREE.Color(0xffe8c3),
      new THREE.Color(0x00f0ff)
    ];

    for (let i = 0; i < starCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 1600 + Math.random() * 800;

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      const color = palette[Math.floor(Math.random() * palette.length)];
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 2.2,
      vertexColors: true,
      transparent: true,
      opacity: 0.85
    });

    this.starfield = new THREE.Points(geometry, material);
    this.scene.add(this.starfield);
  }

  setupEarth() {
    const textureLoader = new THREE.TextureLoader();

    // High quality Earth textures with fallbacks
    const dayMap = textureLoader.load(
      "assets/textures/earth_day.jpg",
      () => {},
      undefined,
      () => {
        // Fallback to CDN if needed
        textureLoader.load("https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_atmos_2048.jpg", (tex) => {
          if (this.earthMesh) this.earthMesh.material.map = tex;
        });
      }
    );

    const specularMap = textureLoader.load("assets/textures/earth_specular.jpg");
    const normalMap = textureLoader.load("assets/textures/earth_normal.jpg");

    const earthGeometry = new THREE.SphereGeometry(this.earthRadius, 64, 64);
    const earthMaterial = new THREE.MeshPhongMaterial({
      map: dayMap,
      specularMap: specularMap,
      normalMap: normalMap,
      normalScale: new THREE.Vector2(0.85, 0.85),
      specular: new THREE.Color(0x334466),
      shininess: 25,
      emissive: new THREE.Color(0x040814),
      emissiveIntensity: 0.15
    });

    this.earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
    this.earthGroup.add(this.earthMesh);
  }

  setupClouds() {
    const textureLoader = new THREE.TextureLoader();
    const cloudsMap = textureLoader.load("assets/textures/earth_clouds.png");

    const cloudsGeometry = new THREE.SphereGeometry(this.earthRadius * 1.009, 64, 64);
    const cloudsMaterial = new THREE.MeshLambertMaterial({
      map: cloudsMap,
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.cloudsMesh = new THREE.Mesh(cloudsGeometry, cloudsMaterial);
    this.earthGroup.add(this.cloudsMesh);
  }

  setupAtmosphere() {
    // Custom Fresnel atmosphere glow shell
    const atmosphereGeometry = new THREE.SphereGeometry(this.earthRadius * 1.14, 64, 64);
    const atmosphereMaterial = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          vec3 viewDir = normalize(-vPosition);
          float fresnel = dot(viewDir, vNormal);
          fresnel = clamp(1.0 - fresnel, 0.0, 1.0);
          float intensity = pow(fresnel, 2.8);
          // NASA cyan-blue atmospheric hue
          vec3 glowColor = vec3(0.08, 0.65, 1.0);
          gl_FragColor = vec4(glowColor, intensity * 0.75);
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false
    });

    this.atmosphereMesh = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    this.scene.add(this.atmosphereMesh);
  }

  setupGraticule() {
    // Subtle cybernetic coordinate grid overlay
    const graticuleGroup = new THREE.Group();
    const graticuleRadius = this.earthRadius * 1.002;
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.08
    });

    // Parallels (latitude lines every 30 degrees)
    for (let lat = -60; lat <= 60; lat += 30) {
      if (lat === 0) continue;
      const points = [];
      const phi = (90 - lat) * (Math.PI / 180);
      const r = graticuleRadius * Math.sin(phi);
      const y = graticuleRadius * Math.cos(phi);
      for (let theta = 0; theta <= Math.PI * 2 + 0.1; theta += Math.PI / 36) {
        points.push(new THREE.Vector3(r * Math.cos(theta), y, r * Math.sin(theta)));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      graticuleGroup.add(new THREE.Line(geo, lineMat));
    }

    // Equator highlighted
    const equatorMat = new THREE.LineBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.18
    });
    const eqPoints = [];
    for (let theta = 0; theta <= Math.PI * 2 + 0.1; theta += Math.PI / 36) {
      eqPoints.push(new THREE.Vector3(graticuleRadius * Math.cos(theta), 0, graticuleRadius * Math.sin(theta)));
    }
    const eqGeo = new THREE.BufferGeometry().setFromPoints(eqPoints);
    graticuleGroup.add(new THREE.Line(eqGeo, equatorMat));

    this.graticuleGroup = graticuleGroup;
    this.earthGroup.add(this.graticuleGroup);
  }

  setupScanner() {
    // Sci-fi orbital scanning radar ring
    const scanRadius = this.earthRadius * 1.03;
    const geometry = new THREE.RingGeometry(scanRadius - 0.7, scanRadius + 0.7, 64);
    const material = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.scannerMesh = new THREE.Mesh(geometry, material);
    this.scannerMesh.rotation.x = Math.PI / 2;
    this.earthGroup.add(this.scannerMesh);
  }

  setupTargetReticle() {
    // 3D targeting bracket that locks onto selected fire
    const reticleGroup = new THREE.Group();
    const size = 5.0;
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.95,
      linewidth: 2
    });

    // Outer circle
    const circlePoints = [];
    for (let i = 0; i <= 32; i++) {
      const theta = (i / 32) * Math.PI * 2;
      circlePoints.push(new THREE.Vector3(Math.cos(theta) * size, Math.sin(theta) * size, 0));
    }
    const circleGeo = new THREE.BufferGeometry().setFromPoints(circlePoints);
    reticleGroup.add(new THREE.Line(circleGeo, lineMat));

    // Corner crosshairs
    const crossPoints = [
      new THREE.Vector3(-size * 1.4, 0, 0), new THREE.Vector3(-size * 0.8, 0, 0),
      new THREE.Vector3(size * 0.8, 0, 0), new THREE.Vector3(size * 1.4, 0, 0),
      new THREE.Vector3(0, -size * 1.4, 0), new THREE.Vector3(0, -size * 0.8, 0),
      new THREE.Vector3(0, size * 0.8, 0), new THREE.Vector3(0, size * 1.4, 0)
    ];
    const crossGeo = new THREE.BufferGeometry().setFromPoints(crossPoints);
    reticleGroup.add(new THREE.LineSegments(crossGeo, lineMat));

    reticleGroup.visible = false;
    this.targetReticle = reticleGroup;
    this.earthGroup.add(this.targetReticle);
  }

  setupSatelliteOrbits() {
    this.orbitsGroup = new THREE.Group();

    // Satellite definitions matching NASA FIRMS active observation constellations
    const satelliteConfigs = [
      {
        name: "TERRA",
        sensor: "MODIS",
        color: 0xff6b2b,
        radius: this.earthRadius * 1.28,
        inclination: 98.2 * (Math.PI / 180),
        rotationY: 0.3,
        speed: 0.42,
        offset: 0.0
      },
      {
        name: "AQUA",
        sensor: "MODIS",
        color: 0xff9800,
        radius: this.earthRadius * 1.34,
        inclination: 98.2 * (Math.PI / 180),
        rotationY: 1.8,
        speed: 0.40,
        offset: 2.1
      },
      {
        name: "SUOMI-NPP",
        sensor: "VIIRS",
        color: 0x00f0ff,
        radius: this.earthRadius * 1.42,
        inclination: 98.7 * (Math.PI / 180),
        rotationY: 3.2,
        speed: 0.36,
        offset: 1.2
      },
      {
        name: "NOAA-20",
        sensor: "VIIRS",
        color: 0xa855f7,
        radius: this.earthRadius * 1.48,
        inclination: 98.7 * (Math.PI / 180),
        rotationY: 4.6,
        speed: 0.34,
        offset: 3.7
      },
      {
        name: "NOAA-21",
        sensor: "VIIRS",
        color: 0xd946ef,
        radius: this.earthRadius * 1.54,
        inclination: 98.7 * (Math.PI / 180),
        rotationY: 5.7,
        speed: 0.32,
        offset: 4.9
      }
    ];

    satelliteConfigs.forEach((cfg) => {
      // Orbit ellipse line
      const segments = 128;
      const points = [];
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        points.push(new THREE.Vector3(Math.cos(theta) * cfg.radius, 0, Math.sin(theta) * cfg.radius));
      }
      const orbitGeo = new THREE.BufferGeometry().setFromPoints(points);
      const orbitMat = new THREE.LineBasicMaterial({
        color: cfg.color,
        transparent: true,
        opacity: 0.28,
        blending: THREE.AdditiveBlending
      });
      const orbitLine = new THREE.Line(orbitGeo, orbitMat);

      // Rotate orbit plane to match inclination
      orbitLine.rotation.z = cfg.inclination;
      orbitLine.rotation.y = cfg.rotationY;
      this.orbitsGroup.add(orbitLine);

      // Satellite physical craft model
      const satCraft = this.createSatelliteCraft(cfg.color, cfg.name, cfg.sensor);
      this.scene.add(satCraft);

      this.satellites.push({
        config: cfg,
        mesh: satCraft,
        orbitLine: orbitLine
      });
    });

    this.scene.add(this.orbitsGroup);
  }

  createSatelliteCraft(colorHex, name, sensor) {
    const group = new THREE.Group();

    // Central satellite bus (gold foil)
    const bodyGeo = new THREE.BoxGeometry(2.4, 1.8, 1.8);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      metalness: 0.85,
      roughness: 0.25,
      emissive: 0x332200,
      emissiveIntensity: 0.3
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    group.add(body);

    // Solar array panels (electric blue)
    const panelGeo = new THREE.BoxGeometry(6.0, 0.15, 1.4);
    const panelMat = new THREE.MeshStandardMaterial({
      color: 0x1e3a8a,
      metalness: 0.9,
      roughness: 0.2,
      emissive: colorHex,
      emissiveIntensity: 0.4
    });
    const leftPanel = new THREE.Mesh(panelGeo, panelMat);
    leftPanel.position.x = -4.5;
    const rightPanel = new THREE.Mesh(panelGeo, panelMat);
    rightPanel.position.x = 4.5;
    group.add(leftPanel);
    group.add(rightPanel);

    // Optical sensor beacon / communications dish
    const sensorGeo = new THREE.SphereGeometry(0.7, 12, 12);
    const sensorMat = new THREE.MeshBasicMaterial({
      color: colorHex
    });
    const sensorMesh = new THREE.Mesh(sensorGeo, sensorMat);
    sensorMesh.position.y = -1.0;
    group.add(sensorMesh);

    // Glowing halo around satellite
    const glowGeo = new THREE.SphereGeometry(1.6, 16, 16);
    const glowMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending
    });
    group.add(new THREE.Mesh(glowGeo, glowMat));

    group.userData = { name, sensor, isSatellite: true };
    return group;
  }

  /**
   * Precise Lat/Lon to 3D Cartesian coordinates on sphere
   * Matches Three.js standard equirectangular UV mapping
   */
  latLonToVector3(lat, lon, altitude = 0) {
    const r = this.earthRadius + altitude;
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);

    const x = -r * Math.sin(phi) * Math.cos(theta);
    const z = r * Math.sin(phi) * Math.sin(theta);
    const y = r * Math.cos(phi);

    return new THREE.Vector3(x, y, z);
  }

  /**
   * Invert 3D vector to Lat/Lon
   */
  vector3ToLatLon(vector) {
    const norm = vector.clone().normalize();
    const lat = 90 - Math.acos(norm.y) * (180 / Math.PI);
    let lon = (Math.atan2(norm.z, -norm.x) * (180 / Math.PI)) - 180;
    while (lon < -180) lon += 360;
    while (lon > 180) lon -= 360;
    return { lat, lon };
  }

  /**
   * Set and render NASA FIRMS active hotspots on 3D globe
   */
  setHotspots(fires) {
    this.hotspots = fires || [];

    // Clear existing marker meshes
    while (this.hotspotGroup.children.length > 0) {
      const obj = this.hotspotGroup.children[0];
      this.hotspotGroup.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
    }
    this.markerObjects = [];
    this.selectedMarker = null;
    this.targetReticle.visible = false;

    if (!this.hotspots.length) return;

    this.hotspots.forEach((fire, idx) => {
      if (!Number.isFinite(fire.lat) || !Number.isFinite(fire.lon)) return;

      const isMODIS = fire.sensor === "MODIS";
      // MODIS = Glowing fiery orange; VIIRS = Electric violet / cyan
      const primaryColor = isMODIS ? 0xff5a1f : 0x00f0ff;
      const secondaryColor = isMODIS ? 0xffa000 : 0xa855f7;

      const pos = this.latLonToVector3(fire.lat, fire.lon, 0.4);
      const normal = pos.clone().normalize();

      const markerParent = new THREE.Group();
      markerParent.position.copy(pos);

      // Core thermal anomaly beacon
      const frpFactor = Math.min(Math.max((fire.frp || 5) / 40, 0.6), 2.2);
      const coreSize = (isMODIS ? 1.0 : 0.8) * frpFactor;

      const coreGeo = new THREE.SphereGeometry(coreSize, 12, 12);
      const coreMat = new THREE.MeshBasicMaterial({
        color: primaryColor
      });
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      markerParent.add(coreMesh);

      // Vertical holographic thermal beam
      const beamHeight = 4.0 * frpFactor;
      const beamGeo = new THREE.CylinderGeometry(0.15, 0.5, beamHeight, 8);
      const beamMat = new THREE.MeshBasicMaterial({
        color: secondaryColor,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending
      });
      const beamMesh = new THREE.Mesh(beamGeo, beamMat);
      beamMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
      beamMesh.position.copy(normal.clone().multiplyScalar(beamHeight / 2));
      markerParent.add(beamMesh);

      // Pulsing radiation ring
      const ringGeo = new THREE.RingGeometry(coreSize * 1.3, coreSize * 2.6, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: primaryColor,
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
      markerParent.add(ringMesh);

      // Hit-test invisible sphere for smooth raycasting click/hover
      const hitGeo = new THREE.SphereGeometry(coreSize * 3.5, 8, 8);
      const hitMat = new THREE.MeshBasicMaterial({
        visible: false
      });
      const hitMesh = new THREE.Mesh(hitGeo, hitMat);
      markerParent.add(hitMesh);

      // Associate NASA telemetry data
      markerParent.userData = {
        hotspot: fire,
        index: idx,
        isHotspot: true,
        coreMesh: coreMesh,
        ringMesh: ringMesh,
        baseScale: 1.0,
        normal: normal,
        primaryColor: primaryColor
      };
      hitMesh.userData = markerParent.userData;

      this.hotspotGroup.add(markerParent);
      this.markerObjects.push(markerParent);
    });
  }

  /**
   * Select a hotspot and target it with 3D reticle and camera focus
   */
  selectHotspot(hotspot, smoothTransition = true, triggerCallback = false) {
    if (!hotspot) {
      this.selectedHotspot = null;
      this.selectedMarker = null;
      this.targetReticle.visible = false;
      return;
    }

    this.selectedHotspot = hotspot;
    const marker = this.markerObjects.find(
      (m) => m.userData.hotspot && m.userData.hotspot.lat === hotspot.lat && m.userData.hotspot.lon === hotspot.lon
    );

    if (marker) {
      this.selectedMarker = marker;
      this.targetReticle.position.copy(marker.position);
      this.targetReticle.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), marker.userData.normal);
      this.targetReticle.visible = true;
    }

    if (smoothTransition) {
      this.focusCoordinates(hotspot.lat, hotspot.lon, 180, 900);
    }

    if (triggerCallback && typeof this.options.onSelectHotspot === "function") {
      this.options.onSelectHotspot(hotspot);
    }
  }

  /**
   * Smoothly interpolate camera to focus on given coordinates
   */
  focusCoordinates(lat, lon, distance = 200, durationMs = 1000) {
    const targetPos = this.latLonToVector3(lat, lon, distance - this.earthRadius);
    const startPos = this.camera.position.clone();
    const startTime = performance.now();

    this.cameraTransition = {
      startPos: startPos,
      endPos: targetPos,
      startTime: startTime,
      duration: durationMs
    };
  }

  setupEventListeners() {
    // Window resize
    window.addEventListener("resize", () => this.onWindowResize());

    // Mouse move for raycasting hover
    this.renderer.domElement.addEventListener("mousemove", (e) => this.onMouseMove(e));
    this.renderer.domElement.addEventListener("mouseleave", () => {
      this.mouse.set(-999, -999);
      this.clearHover();
    });

    // Click to select
    this.renderer.domElement.addEventListener("click", (e) => this.onMouseClick(e));
  }

  onWindowResize() {
    if (!this.container) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  onMouseMove(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Perform raycast for hover
    this.checkRaycastHover(event);
  }

  checkRaycastHover(event) {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hitCandidates = [];

    this.markerObjects.forEach((m) => {
      m.children.forEach((c) => hitCandidates.push(c));
    });

    const intersects = this.raycaster.intersectObjects(hitCandidates, false);

    if (intersects.length > 0) {
      const topObj = intersects[0].object;
      const markerData = topObj.userData.isHotspot ? topObj.userData : topObj.parent?.userData;

      if (markerData && markerData.isHotspot) {
        this.container.style.cursor = "pointer";
        this.setHoveredMarker(markerData, event);
        return;
      }
    }

    this.clearHover();
  }

  setHoveredMarker(markerData, event) {
    this.hoveredMarker = markerData;
    if (typeof this.options.onHoverHotspot === "function") {
      this.options.onHoverHotspot(markerData.hotspot, event);
    }
  }

  clearHover() {
    if (this.hoveredMarker) {
      this.hoveredMarker = null;
      this.container.style.cursor = "default";
      if (typeof this.options.onHoverHotspot === "function") {
        this.options.onHoverHotspot(null);
      }
    }
  }

  onMouseClick(event) {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hitCandidates = [];

    this.markerObjects.forEach((m) => {
      m.children.forEach((c) => hitCandidates.push(c));
    });

    const intersects = this.raycaster.intersectObjects(hitCandidates, false);

    if (intersects.length > 0) {
      const topObj = intersects[0].object;
      const markerData = topObj.userData.isHotspot ? topObj.userData : topObj.parent?.userData;

      if (markerData && markerData.hotspot) {
        this.selectHotspot(markerData.hotspot, true, true);
        return;
      }
    }
  }

  toggleAutoRotate(enable) {
    this.isAutoRotating = enable !== undefined ? enable : !this.isAutoRotating;
    return this.isAutoRotating;
  }

  toggleClouds(enable) {
    this.showClouds = enable !== undefined ? enable : !this.showClouds;
    if (this.cloudsMesh) this.cloudsMesh.visible = this.showClouds;
    return this.showClouds;
  }

  toggleOrbits(enable) {
    this.showOrbits = enable !== undefined ? enable : !this.showOrbits;
    if (this.orbitsGroup) this.orbitsGroup.visible = this.showOrbits;
    this.satellites.forEach(s => s.mesh.visible = this.showOrbits);
    return this.showOrbits;
  }

  animate() {
    requestAnimationFrame(this.animate);

    const delta = this.clock.getDelta();
    const elapsedTime = this.clock.getElapsedTime();
    this.pulseTime += delta;

    // Handle smooth camera fly-to transition
    if (this.cameraTransition) {
      const now = performance.now();
      const progress = Math.min((now - this.cameraTransition.startTime) / this.cameraTransition.duration, 1.0);
      // Smooth easeInOutCubic
      const ease = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      this.camera.position.lerpVectors(this.cameraTransition.startPos, this.cameraTransition.endPos, ease);
      if (this.controls) this.controls.target.set(0, 0, 0);

      if (progress >= 1.0) {
        this.cameraTransition = null;
      }
    }

    // Auto-rotation around Earth axis
    if (this.isAutoRotating && !this.cameraTransition) {
      const rotDelta = (this.options.autoRotateSpeed * Math.PI) / 180 * delta;
      this.earthGroup.rotation.y += rotDelta;
    }

    // Rotate cloud layer slightly faster to simulate atmospheric wind
    if (this.cloudsMesh && this.showClouds) {
      this.cloudsMesh.rotation.y += 0.0003;
    }

    // Animate radar scanner ring
    if (this.scannerMesh && this.showScanEffect) {
      this.scanAngle += delta * 0.8;
      const scanLat = Math.sin(this.scanAngle) * 75;
      const scanPos = this.latLonToVector3(scanLat, 0, 2);
      this.scannerMesh.position.y = scanPos.y;
      const scale = Math.cos(scanLat * (Math.PI / 180));
      this.scannerMesh.scale.set(scale, scale, 1);
    }

    // Animate satellite craft positions along inclined orbits
    this.satellites.forEach((sat) => {
      const cfg = sat.config;
      const t = elapsedTime * cfg.speed + cfg.offset;
      const r = cfg.radius;

      // Position in orbit plane
      const orbitX = Math.cos(t) * r;
      const orbitZ = Math.sin(t) * r;
      const satPos = new THREE.Vector3(orbitX, 0, orbitZ);

      // Apply inclination and nodal rotation
      satPos.applyAxisAngle(new THREE.Vector3(0, 0, 1), cfg.inclination);
      satPos.applyAxisAngle(new THREE.Vector3(0, 1, 0), cfg.rotationY);

      sat.mesh.position.copy(satPos);
      sat.mesh.lookAt(0, 0, 0); // Point optical sensor towards Earth
    });

    // Animate hotspot markers pulse & beacon rings
    const pulseScale = 1.0 + Math.sin(this.pulseTime * 4.5) * 0.28;
    const ringPulse = (Math.sin(this.pulseTime * 3.5) + 1.0) * 0.5; // 0 to 1

    this.markerObjects.forEach((marker) => {
      const isSelected = this.selectedMarker === marker;
      const isHovered = this.hoveredMarker === marker.userData;

      if (marker.userData.ringMesh) {
        const ring = marker.userData.ringMesh;
        ring.scale.set(1.0 + ringPulse * 0.9, 1.0 + ringPulse * 0.9, 1.0);
        ring.material.opacity = (1.0 - ringPulse * 0.7) * (isSelected || isHovered ? 0.95 : 0.65);
      }

      if (marker.userData.coreMesh) {
        const targetScale = isSelected ? 1.6 : (isHovered ? 1.4 : 1.0);
        marker.userData.coreMesh.scale.set(targetScale * pulseScale, targetScale * pulseScale, targetScale * pulseScale);
      }
    });

    // Animate target reticle rotation
    if (this.targetReticle && this.targetReticle.visible) {
      this.targetReticle.rotation.z += delta * 1.5;
    }

    if (this.controls) {
      this.controls.update();
    }

    this.renderer.render(this.scene, this.camera);
  }
}

window.EarthCommander = EarthCommander;
