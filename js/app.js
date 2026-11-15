/**
 * AGNIWATCH — 3D Earth Intelligence Command Center
 * Master Dashboard & NASA FIRMS Integration Controller
 */

(function () {
  "use strict";

  // API Endpoints
  const API_FIRES = "https://agniwatch.onrender.com/api/fires";
  const API_HEALTH = "https://agniwatch.onrender.com/api/health";

  // State
  let rawFires = [];
  let filteredFires = [];
  let selectedFire = null;
  let earthCommander = null;
  let lastSyncTime = null;
  let isBackendOnline = false;

  // Chart instances
  let sensorDoughnutChart = null;
  let activityTimelineChart = null;
  let frpDistChart = null;

  // DOM Helper
  const $ = (id) => document.getElementById(id);

  /**
   * Initialize Command Center
   */
  async function init() {
    initClock();
    initGlobe();
    initFilters();
    initControls();
    initChartTabs();

    // Check health and load real NASA data
    await checkBackendHealth();
    await fetchNASAData();

    // Periodic telemetry ping every 60 seconds
    setInterval(checkBackendHealth, 60000);
  }

  /**
   * Live UTC Mission Clock
   */
  function initClock() {
    function updateTime() {
      const now = new Date();
      const utcString = now.toISOString().replace("T", " ").substring(0, 19) + " UTC";
      const clockEl = $("utc-clock");
      if (clockEl) clockEl.textContent = utcString;
    }
    updateTime();
    setInterval(updateTime, 1000);
  }

  /**
   * Initialize 3D Earth Commander
   */
  function initGlobe() {
    const container = $("globe-viewport");
    if (!container) return;

    earthCommander = new EarthCommander("globe-viewport", {
      earthRadius: 100,
      cameraDistance: 280,
      onSelectHotspot: (hotspot) => {
        selectHotspot(hotspot, false);
      },
      onHoverHotspot: (hotspot, event) => {
        handleGlobeHover(hotspot, event);
      }
    });

    window.earthCommander = earthCommander;
  }

  /**
   * Check Flask Backend Health
   */
  async function checkBackendHealth() {
    const statusPill = $("connection-status");
    const statusText = $("connection-status-text");
    const warningBanner = $("backend-warning-banner");

    try {
      const res = await fetch(API_HEALTH, { cache: "no-store", signal: AbortSignal.timeout(6000) });
      if (res.ok) {
        const data = await res.json();
        isBackendOnline = true;
        if (statusPill) {
          statusPill.className = "status-pill online";
        }
        if (statusText) {
          statusText.textContent =
            data.status === "running" || data.api_key_configured
              ? "AGNIWATCH GLOBAL API ONLINE"
              : "BACKEND ONLINE";
        }
        if (warningBanner) warningBanner.style.display = "none";
        return true;
      }
      throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      isBackendOnline = false;
      if (statusPill) {
        statusPill.className = "status-pill offline";
      }
      if (statusText) {
        statusText.textContent = "FIRMS FEED DISCONNECTED";
      }
      if (warningBanner) {
        warningBanner.style.display = "flex";
      }
      return false;
    }
  }

  /**
   * Fetch Real NASA FIRMS Hotspot Observations
   */
  async function fetchNASAData() {
    const refreshBtn = $("refresh-btn");
    const syncTimeEl = $("last-sync-time");

    if (refreshBtn) {
      refreshBtn.classList.add("loading");
      refreshBtn.disabled = true;
    }

    try {
      const response = await fetch(API_FIRES, {
        cache: "no-store",
        signal: AbortSignal.timeout(45000)
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      if (!Array.isArray(data.fires)) {
        throw new Error("Invalid response format: 'fires' array missing.");
      }

      // Map real NASA FIRMS data rows
      rawFires = data.fires.map((f, index) => {
        const sensor = f.sensor || (String(f.source || "").toUpperCase().includes("MODIS") ? "MODIS" : "VIIRS");
        return {
          id: f.id || `NASA-${index + 1}`,
          lat: Number(f.latitude),
          lon: Number(f.longitude),
          date: String(f.date || f.acq_date || ""),
          time: String(f.time || f.acq_time || "0000"),
          sensor: sensor,
          satellite: f.satellite || (sensor === "MODIS" ? "Terra/Aqua" : "Suomi-NPP/NOAA"),
          confidence: f.confidence !== undefined && f.confidence !== "" ? f.confidence : "Nominal",
          frp: Number(f.frp || 0),
          source: f.source || `${sensor}_NRT`,
          region: "India",
          coverage: "India Area (68°E–98°E, 6°N–36°N)"
        };
      }).filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lon));

      lastSyncTime = new Date();
      if (syncTimeEl) {
        syncTimeEl.textContent = `LAST SYNC: ${lastSyncTime.toLocaleTimeString()} UTC`;
      }

      const warningBanner = $("backend-warning-banner");
      if (warningBanner) warningBanner.style.display = "none";

      applyFilters();

      console.log(`[AGNIWATCH] Successfully ingested ${rawFires.length} real NASA FIRMS observations.`);

    } catch (error) {
      console.warn("[AGNIWATCH] Failed to retrieve live NASA FIRMS data:", error.message);
      rawFires = [];
      filteredFires = [];

      const warningBanner = $("backend-warning-banner");
      if (warningBanner) {
        warningBanner.style.display = "flex";
        const msg = $("warning-message");
        if (msg) {
          msg.textContent = `Backend connection failed (${error.message}). Start Flask backend at http://127.0.0.1:5000 via 'python backend/app.py'.`;
        }
      }

      updateMetrics();
      renderHotspotList();
      if (earthCommander) earthCommander.setHotspots([]);
    } finally {
      if (refreshBtn) {
        refreshBtn.classList.remove("loading");
        refreshBtn.disabled = false;
      }
    }
  }

  /**
   * Filter Handlers
   */
  function initFilters() {
    ["sensor-filter", "time-filter", "frp-slider"].forEach((id) => {
      const el = $(id);
      if (el) el.addEventListener("input", applyFilters);
    });

    const frpSlider = $("frp-slider");
    const frpVal = $("frp-val");
    if (frpSlider && frpVal) {
      frpSlider.addEventListener("input", (e) => {
        frpVal.textContent = `${e.target.value} MW`;
      });
    }

    const resetBtn = $("reset-filters-btn");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        if ($("sensor-filter")) $("sensor-filter").value = "ALL";
        if ($("time-filter")) $("time-filter").value = "ALL";
        if ($("frp-slider")) {
          $("frp-slider").value = "0";
          if ($("frp-val")) $("frp-val").textContent = "0 MW";
        }
        applyFilters();
      });
    }
  }

  /**
   * Apply Active Filters to Telemetry Data
   */
  function applyFilters() {
    const sensorVal = $("sensor-filter")?.value || "ALL";
    const timeVal = $("time-filter")?.value || "ALL";
    const minFRP = Number($("frp-slider")?.value || 0);

    filteredFires = rawFires.filter((f) => {
      if (sensorVal !== "ALL" && f.sensor !== sensorVal) return false;
      if (f.frp < minFRP) return false;

      if (timeVal !== "ALL" && f.date) {
        const fireDate = new Date(`${f.date}T00:00:00`);
        const now = new Date();
        const diffDays = (now - fireDate) / (1000 * 60 * 60 * 24);

        if (timeVal === "TODAY" && diffDays > 1.2) return false;
        if (timeVal === "7D" && diffDays > 7.5) return false;
      }
      return true;
    });

    // Update 3D Earth
    if (earthCommander) {
      earthCommander.setHotspots(filteredFires);
    }

    // Refresh UI panels
    updateMetrics();
    renderHotspotList();
    renderCharts();

    // Auto-select first hotspot if currently selected is filtered out
    if (selectedFire && !filteredFires.some(f => f.lat === selectedFire.lat && f.lon === selectedFire.lon)) {
      selectHotspot(filteredFires.length > 0 ? filteredFires[0] : null, false);
    } else if (!selectedFire && filteredFires.length > 0) {
      selectHotspot(filteredFires[0], false);
    }
  }

  /**
   * Update Summary Metrics Counters
   */
  function updateMetrics() {
    const total = filteredFires.length;
    const modis = filteredFires.filter((f) => f.sensor === "MODIS").length;
    const viirs = filteredFires.filter((f) => f.sensor === "VIIRS").length;

    const frps = filteredFires.map((f) => f.frp).filter((v) => Number.isFinite(v) && v > 0);
    const peakFrp = frps.length ? Math.max(...frps).toFixed(1) : "0.0";
    const avgFrp = frps.length ? (frps.reduce((a, b) => a + b, 0) / frps.length).toFixed(1) : "0.0";

    if ($("metric-total")) $("metric-total").textContent = total.toLocaleString();
    if ($("metric-modis")) $("metric-modis").textContent = modis.toLocaleString();
    if ($("metric-viirs")) $("metric-viirs").textContent = viirs.toLocaleString();
    if ($("metric-peak-frp")) $("metric-peak-frp").textContent = `${peakFrp} MW`;
    if ($("metric-avg-frp")) $("metric-avg-frp").textContent = `${avgFrp} MW`;

    if ($("badge-modis-count")) $("badge-modis-count").textContent = `${modis} OBS`;
    if ($("badge-viirs-count")) $("badge-viirs-count").textContent = `${viirs} OBS`;

    const statusTelemetry = $("status-telemetry-text");
    if (statusTelemetry) {
      if (!isBackendOnline) {
        statusTelemetry.textContent = "DISCONNECTED • RUN 'python backend/app.py'";
      } else if (total === 0) {
        statusTelemetry.textContent = "ACTIVE • 0 HOTSPOTS IN SELECTION";
      } else {
        statusTelemetry.textContent = `TELEMETRY ACTIVE • ${total} HOTSPOTS IDENTIFIED`;
      }
    }
  }

  /**
   * Select a Hotspot and populate Right Inspector
   */
  function selectHotspot(fire, focusOnGlobe = true) {
    if (!fire) {
      selectedFire = null;
      const emptyState = $("inspector-empty-state");
      const contentState = $("inspector-content-state");
      if (emptyState) emptyState.style.display = "flex";
      if (contentState) contentState.style.display = "none";
      if (earthCommander) earthCommander.selectHotspot(null, false, false);
      return;
    }

    selectedFire = fire;

    const emptyState = $("inspector-empty-state");
    const contentState = $("inspector-content-state");
    if (emptyState) emptyState.style.display = "none";
    if (contentState) contentState.style.display = "block";

    // Populate Fields
    const latFormatted = `${Math.abs(fire.lat).toFixed(4)}° ${fire.lat >= 0 ? "N" : "S"}`;
    const lonFormatted = `${Math.abs(fire.lon).toFixed(4)}° ${fire.lon >= 0 ? "E" : "W"}`;

    if ($("target-coords")) $("target-coords").textContent = `${latFormatted}, ${lonFormatted}`;
    if ($("target-sensor")) {
      $("target-sensor").textContent = fire.sensor;
      $("target-sensor").className = `sensor-pill ${fire.sensor.toLowerCase()}`;
    }
    if ($("target-satellite")) $("target-satellite").textContent = fire.satellite;
    if ($("target-confidence")) $("target-confidence").textContent = `${fire.confidence}${typeof fire.confidence === "number" ? "%" : ""}`;
    if ($("target-frp")) $("target-frp").textContent = `${fire.frp.toFixed(2)} MW`;
    if ($("target-datetime")) {
      const timeFmt = fire.time.length === 4
        ? `${fire.time.slice(0, 2)}:${fire.time.slice(2, 4)} UTC`
        : `${fire.time} UTC`;
      $("target-datetime").textContent = `${fire.date} • ${timeFmt}`;
    }
    if ($("target-source")) $("target-source").textContent = fire.source;

    // FRP Visual Gauge (0 to 100 MW scale)
    const frpGauge = $("frp-gauge-fill");
    const frpPercent = Math.min((fire.frp / 60) * 100, 100);
    if (frpGauge) {
      frpGauge.style.width = `${frpPercent}%`;
      frpGauge.className = `gauge-fill ${fire.frp > 40 ? "extreme" : fire.frp > 15 ? "high" : "nominal"}`;
    }

    // Highlighting in 3D scene
    if (earthCommander && focusOnGlobe) {
      earthCommander.selectHotspot(fire, true, false);
    }

    // Highlight row in hotspot list table
    document.querySelectorAll(".hotspot-row").forEach((row) => {
      if (row.dataset.id === fire.id) {
        row.classList.add("active");
        row.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } else {
        row.classList.remove("active");
      }
    });
  }

  /**
   * Render Hotspot List Table in Right Panel
   */
  function renderHotspotList() {
    const listBody = $("hotspot-list-body");
    const countBadge = $("hotspot-list-count");

    if (countBadge) countBadge.textContent = `${filteredFires.length} DETECTIONS`;
    if (!listBody) return;

    if (filteredFires.length === 0) {
      listBody.innerHTML = `
        <div class="empty-list-notice">
          <span>⌖</span>
          <p>No NASA hotspot records match current filters.</p>
        </div>
      `;
      return;
    }

    let html = "";
    filteredFires.forEach((f) => {
      const isActive = selectedFire && selectedFire.lat === f.lat && selectedFire.lon === f.lon;
      const sensorClass = f.sensor === "MODIS" ? "modis-tag" : "viirs-tag";
      html += `
        <div class="hotspot-row ${isActive ? "active" : ""}" data-id="${f.id}">
          <div class="row-sensor"><span class="${sensorClass}">${f.sensor}</span></div>
          <div class="row-coords">${f.lat.toFixed(2)}°N, ${f.lon.toFixed(2)}°E</div>
          <div class="row-frp">${f.frp.toFixed(1)} MW</div>
          <div class="row-action"><button class="btn-target" title="Target on 3D globe">🎯</button></div>
        </div>
      `;
    });

    listBody.innerHTML = html;

    // Attach row click listeners
    listBody.querySelectorAll(".hotspot-row").forEach((row) => {
      row.addEventListener("click", () => {
        const id = row.dataset.id;
        const fire = filteredFires.find((f) => f.id === id);
        if (fire) selectHotspot(fire, true);
      });
    });
  }

  /**
   * Handle 3D Globe Hotspot Hover Tooltip
   */
  function handleGlobeHover(hotspot, event) {
    const tooltip = $("globe-hud-tooltip");
    if (!tooltip) return;

    if (!hotspot || !event) {
      tooltip.style.display = "none";
      return;
    }

    const rect = $("globe-viewport").getBoundingClientRect();
    const x = event.clientX - rect.left + 16;
    const y = event.clientY - rect.top - 20;

    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
    tooltip.style.display = "block";

    const badgeClass = hotspot.sensor === "MODIS" ? "modis-color" : "viirs-color";
    tooltip.innerHTML = `
      <div class="tooltip-header">
        <span class="tooltip-tag ${badgeClass}">● ${hotspot.sensor}</span>
        <span class="tooltip-sat">${hotspot.satellite}</span>
      </div>
      <div class="tooltip-body">
        <strong>${hotspot.frp.toFixed(1)} MW</strong> FRP
        <small>${hotspot.lat.toFixed(4)}°N, ${hotspot.lon.toFixed(4)}°E</small>
      </div>
      <div class="tooltip-footer">Click to acquire target</div>
    `;
  }

  /**
   * Initialize Dashboard HUD Controls
   */
  function initControls() {
    // Refresh button
    const refreshBtn = $("refresh-btn");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => {
        fetchNASAData();
      });
    }

    // Retry button on warning banner
    const retryBtn = $("retry-connection-btn");
    if (retryBtn) {
      retryBtn.addEventListener("click", async () => {
        await checkBackendHealth();
        await fetchNASAData();
      });
    }

    // Globe controls
    const autoRotateBtn = $("btn-toggle-rotate");
    if (autoRotateBtn) {
      autoRotateBtn.addEventListener("click", () => {
        const active = earthCommander.toggleAutoRotate();
        autoRotateBtn.classList.toggle("active", active);
      });
    }

    const cloudsBtn = $("btn-toggle-clouds");
    if (cloudsBtn) {
      cloudsBtn.addEventListener("click", () => {
        const active = earthCommander.toggleClouds();
        cloudsBtn.classList.toggle("active", active);
      });
    }

    const orbitsBtn = $("btn-toggle-orbits");
    if (orbitsBtn) {
      orbitsBtn.addEventListener("click", () => {
        const active = earthCommander.toggleOrbits();
        orbitsBtn.classList.toggle("active", active);
      });
    }

    const focusIndiaBtn = $("btn-focus-india");
    if (focusIndiaBtn) {
      focusIndiaBtn.addEventListener("click", () => {
        if (earthCommander) earthCommander.focusCoordinates(21, 82, 280, 1000);
      });
    }

    const zoomInBtn = $("btn-zoom-in");
    if (zoomInBtn) {
      zoomInBtn.addEventListener("click", () => {
        if (earthCommander && earthCommander.camera) {
          const newDist = Math.max(earthCommander.camera.position.length() - 35, earthCommander.earthRadius * 1.3);
          earthCommander.camera.position.setLength(newDist);
        }
      });
    }

    const zoomOutBtn = $("btn-zoom-out");
    if (zoomOutBtn) {
      zoomOutBtn.addEventListener("click", () => {
        if (earthCommander && earthCommander.camera) {
          const newDist = Math.min(earthCommander.camera.position.length() + 35, earthCommander.earthRadius * 4.5);
          earthCommander.camera.position.setLength(newDist);
        }
      });
    }

    // Fly to current target button
    const flyBtn = $("btn-fly-to-target");
    if (flyBtn) {
      flyBtn.addEventListener("click", () => {
        if (selectedFire && earthCommander) {
          earthCommander.selectHotspot(selectedFire, true, false);
        }
      });
    }

    // Copy telemetry button
    const copyBtn = $("btn-copy-telemetry");
    if (copyBtn) {
      copyBtn.addEventListener("click", () => {
        if (!selectedFire) return;
        const text = `AGNIWATCH NASA TELEMETRY:
Coordinates: ${selectedFire.lat.toFixed(4)}, ${selectedFire.lon.toFixed(4)}
Sensor: ${selectedFire.sensor} | Satellite: ${selectedFire.satellite}
Fire Radiative Power: ${selectedFire.frp} MW | Confidence: ${selectedFire.confidence}
Date/Time: ${selectedFire.date} ${selectedFire.time} UTC
Source: ${selectedFire.source}`;
        navigator.clipboard.writeText(text).then(() => {
          copyBtn.textContent = "COPIED ✓";
          setTimeout(() => { copyBtn.textContent = "COPY TELEMETRY"; }, 2000);
        });
      });
    }
  }

  /**
   * Analytics Tab Switching
   */
  function initChartTabs() {
    const tabs = document.querySelectorAll(".analytics-tab");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        tabs.forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");

        const target = tab.dataset.target;
        document.querySelectorAll(".analytics-view").forEach((view) => {
          view.classList.remove("active");
        });
        const activeView = $(target);
        if (activeView) activeView.classList.add("active");
      });
    });
  }

  /**
   * Render Chart.js Analytics
   */
  function renderCharts() {
    if (typeof Chart === "undefined") return;

    renderSensorDoughnut();
    renderTimelineChart();
    renderFrpDistributionChart();
  }

  function renderSensorDoughnut() {
    const canvas = $("sensorMixChart");
    if (!canvas) return;

    const modisCount = filteredFires.filter((f) => f.sensor === "MODIS").length;
    const viirsCount = filteredFires.filter((f) => f.sensor === "VIIRS").length;

    if (sensorDoughnutChart) sensorDoughnutChart.destroy();

    sensorDoughnutChart = new Chart(canvas, {
      type: "doughnut",
      data: {
        labels: ["MODIS (1km)", "VIIRS (375m)"],
        datasets: [{
          data: [modisCount, viirsCount],
          backgroundColor: ["#ff6b2b", "#00f0ff"],
          borderColor: "#0a1122",
          borderWidth: 4,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "74%",
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              color: "#94a3b8",
              font: { family: "'Space Grotesk', sans-serif", size: 11 },
              usePointStyle: true,
              padding: 14
            }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${ctx.raw} detections`
            }
          }
        }
      }
    });
  }

  function renderTimelineChart() {
    const canvas = $("activityTimelineChart");
    if (!canvas) return;

    // Group by acquisition hour / date
    const hourBuckets = {};
    for (let h = 0; h < 24; h += 3) {
      const label = `${String(h).padStart(2, "0")}:00`;
      hourBuckets[label] = { modis: 0, viirs: 0 };
    }

    filteredFires.forEach((f) => {
      const timeStr = String(f.time || "0000").padStart(4, "0");
      const hour = parseInt(timeStr.substring(0, 2), 10) || 0;
      const bucketHour = Math.floor(hour / 3) * 3;
      const label = `${String(bucketHour).padStart(2, "0")}:00`;
      if (hourBuckets[label]) {
        if (f.sensor === "MODIS") hourBuckets[label].modis++;
        else hourBuckets[label].viirs++;
      }
    });

    const labels = Object.keys(hourBuckets);
    const modisData = labels.map((l) => hourBuckets[l].modis);
    const viirsData = labels.map((l) => hourBuckets[l].viirs);

    if (activityTimelineChart) activityTimelineChart.destroy();

    activityTimelineChart = new Chart(canvas, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "MODIS Detections",
            data: modisData,
            backgroundColor: "#ff6b2bcc",
            borderColor: "#ff6b2b",
            borderWidth: 1,
            borderRadius: 4
          },
          {
            label: "VIIRS Detections",
            data: viirsData,
            backgroundColor: "#00f0ffcc",
            borderColor: "#00f0ff",
            borderWidth: 1,
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: "#94a3b8",
              font: { family: "'Space Grotesk', sans-serif", size: 10 },
              usePointStyle: true
            }
          }
        },
        scales: {
          x: {
            stacked: true,
            ticks: { color: "#64748b", font: { size: 10 } },
            grid: { color: "#1e293b44" }
          },
          y: {
            stacked: true,
            beginAtZero: true,
            ticks: { precision: 0, color: "#64748b", font: { size: 10 } },
            grid: { color: "#1e293b44" }
          }
        }
      }
    });
  }

  function renderFrpDistributionChart() {
    const canvas = $("frpDistChart");
    if (!canvas) return;

    // FRP intensity bands: 0-10, 10-25, 25-50, 50-100, 100+ MW
    const bands = {
      "0–10 MW (Low)": 0,
      "10–25 MW (Moderate)": 0,
      "25–50 MW (Elevated)": 0,
      "50–100 MW (High)": 0,
      "100+ MW (Extreme)": 0
    };

    filteredFires.forEach((f) => {
      const v = f.frp;
      if (v < 10) bands["0–10 MW (Low)"]++;
      else if (v < 25) bands["10–25 MW (Moderate)"]++;
      else if (v < 50) bands["25–50 MW (Elevated)"]++;
      else if (v < 100) bands["50–100 MW (High)"]++;
      else bands["100+ MW (Extreme)"]++;
    });

    if (frpDistChart) frpDistChart.destroy();

    frpDistChart = new Chart(canvas, {
      type: "line",
      data: {
        labels: Object.keys(bands),
        datasets: [{
          label: "Hotspots in Range",
          data: Object.values(bands),
          borderColor: "#e11d48",
          backgroundColor: "#e11d4822",
          fill: true,
          tension: 0.35,
          pointBackgroundColor: "#fb7185",
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            ticks: { color: "#64748b", font: { size: 9 } },
            grid: { color: "#1e293b44" }
          },
          y: {
            beginAtZero: true,
            ticks: { precision: 0, color: "#64748b", font: { size: 10 } },
            grid: { color: "#1e293b44" }
          }
        }
      }
    });
  }

  // Self start
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
