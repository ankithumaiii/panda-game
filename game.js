/**
 * Panda Hide & Seek: Forest Safari
 * Complete Browser Hunting & Shooting Game Engine
 */

(function () {
  'use strict';

  var lastTouchTime = 0;
  window.lastTouchTime = 0;

  // --- Configuration & Constants ---
  const CONFIG = {
    MAX_AMMO: 6,
    RELOAD_TIME: 1100, // ms
    ZEN_DURATION: 5000, // ms
    ZEN_COOLDOWN: 14000, // ms
    RADAR_DURATION: 4000, // ms
    RADAR_COOLDOWN: 12000, // ms
    COMBO_TIMEOUT: 2800, // ms
    TIMED_GAME_DURATION: 90, // seconds
    MAX_LIVES: 3,
    PANDA_MAX_ACTIVE: 3,
    ZOOM_FACTOR: 1.85,
  };

  const PANDA_TYPES = {
    SNEAKY: {
      name: 'Sneaky Panda',
      points: 100,
      peekDuration: 2400,
      peekSpeed: 3.2,
      rarityWeight: 45,
    },
    MUNCHER: {
      name: 'Bamboo Muncher',
      points: 150,
      peekDuration: 3200,
      peekSpeed: 2.2,
      rarityWeight: 30,
    },
    NINJA: {
      name: 'Ninja Panda',
      points: 300,
      peekDuration: 1800,
      peekSpeed: 4.8,
      rarityWeight: 15,
      isDashing: true,
    },
    GOLDEN: {
      name: 'Golden Emperor',
      points: 1000,
      peekDuration: 1900,
      peekSpeed: 3.5,
      rarityWeight: 5,
      isGolden: true,
    },
    PRANKSTER: {
      name: 'Prankster Panda',
      points: 200,
      peekDuration: 3000,
      peekSpeed: 2.6,
      rarityWeight: 20,
      isPrankster: true,
    },
  };

  // --- Game State ---
  const state = {
    mode: 'timed', // 'timed', 'survival', 'zen'
    isPlaying: false,
    isPaused: false,
    score: 0,
    timeRemaining: CONFIG.TIMED_GAME_DURATION,
    lives: CONFIG.MAX_LIVES,
    shotsFired: 0,
    shotsHit: 0,
    headshots: 0,
    pandasTagged: 0,
    goldenTagged: 0,
    maxCombo: 1,
    combo: 1,
    comboTimer: 0,
    ammo: CONFIG.MAX_AMMO,
    isReloading: false,
    isScoped: false,
    
    // Skills
    isZenActive: false,
    zenTimer: 0,
    zenCooldown: 0,
    isRadarActive: false,
    radarTimer: 0,
    radarCooldown: 0,
    radarRadius: 0,

    // Mouse & Screen
    mouse: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
    canvasMouse: { x: 0, y: 0 },
    cam: { x: 0, y: 0, zoom: 1, targetZoom: 1 },
    screenShake: 0,
  };

  // --- DOM Elements ---
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const gameContainer = document.getElementById('game-container');
  const scopeOverlay = document.getElementById('scope-overlay');
  const customCrosshair = document.getElementById('custom-crosshair');
  const hitmarkerEl = document.getElementById('hitmarker');
  const splattersLayer = document.getElementById('splatters-layer');

  // HUD
  const scoreDisplay = document.getElementById('score-display');
  const timeDisplay = document.getElementById('time-display');
  const timerWrapper = document.getElementById('timer-wrapper');
  const livesWrapper = document.getElementById('lives-wrapper');
  const heartsDisplay = document.getElementById('hearts-display');
  const comboMultiplier = document.getElementById('combo-multiplier');
  const comboBar = document.getElementById('combo-bar');
  const btnToggleScope = document.getElementById('btn-toggle-scope');
  const scopeBtnText = document.getElementById('scope-btn-text');
  const btnZen = document.getElementById('btn-zen');
  const zenCd = document.getElementById('zen-cd');
  const btnRadar = document.getElementById('btn-radar');
  const radarCd = document.getElementById('radar-cd');
  const btnSoundToggle = document.getElementById('btn-sound-toggle');
  const btnPause = document.getElementById('btn-pause');
  const hudLayer = document.getElementById('hud-layer');
  const btnFullscreen = document.getElementById('btn-fullscreen');
  const fsExpandIcon = document.getElementById('fs-expand-icon');
  const fsCompressIcon = document.getElementById('fs-compress-icon');
  const orientationHint = document.getElementById('orientation-hint');
  const btnDismissHint = document.getElementById('btn-dismiss-hint');
  const touchRipplesContainer = document.getElementById('touch-ripples');
  let lastTouchTime = 0;

  // Modals
  const startScreen = document.getElementById('start-screen');
  const howModal = document.getElementById('how-modal');
  const trophyModal = document.getElementById('trophy-modal');
  const gameoverModal = document.getElementById('gameover-modal');
  const pauseModal = document.getElementById('pause-modal');
  const modeCards = document.querySelectorAll('.mode-card');

  // High score records in localStorage
  const RECORDS_KEY = 'panda_hunter_records_v1';
  let records = {
    timed: 0,
    survival: 0,
    maxCombo: 0,
    totalPandas: 0,
    goldenPandas: 0,
  };

  function loadRecords() {
    try {
      const saved = localStorage.getItem(RECORDS_KEY);
      if (saved) records = Object.assign(records, JSON.parse(saved));
    } catch (e) {
      console.warn('Could not read records', e);
    }
    updateTrophyUI();
  }

  function saveRecords() {
    try {
      localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
    } catch (e) {
      console.warn('Could not save records', e);
    }
    updateTrophyUI();
  }

  function updateTrophyUI() {
    document.getElementById('rec-timed').textContent = records.timed.toLocaleString();
    document.getElementById('rec-survival').textContent = records.survival.toLocaleString();
    document.getElementById('rec-combo').textContent = `x${records.maxCombo}`;
    document.getElementById('rec-total').textContent = records.totalPandas.toLocaleString();
    document.getElementById('rec-golden').textContent = records.goldenPandas.toLocaleString();
  }

  // --- Hide Spots & Environment Layout ---
  // Coordinates in virtual canvas space (1920 x 1080)
  const V_WIDTH = 1920;
  const V_HEIGHT = 1080;

  const HIDE_SPOTS = [
    { id: 0, x: 280, y: 720, w: 100, h: 120, coverType: 'bamboo_stalks', direction: 'up', depth: 2 },
    { id: 1, x: 490, y: 640, w: 110, h: 110, coverType: 'stone_lantern', direction: 'right', depth: 2 },
    { id: 2, x: 760, y: 550, w: 120, h: 100, coverType: 'pagoda_wall', direction: 'up', depth: 1 },
    { id: 3, x: 1020, y: 610, w: 130, h: 110, coverType: 'mossy_rock', direction: 'up', depth: 2 },
    { id: 4, x: 1280, y: 560, w: 110, h: 110, coverType: 'shrine_pillar', direction: 'left', depth: 1 },
    { id: 5, x: 1580, y: 680, w: 110, h: 130, coverType: 'bamboo_stalks', direction: 'left', depth: 2 },
    { id: 6, x: 380, y: 840, w: 120, h: 110, coverType: 'hollow_log', direction: 'up', depth: 3 },
    { id: 7, x: 880, y: 810, w: 130, h: 120, coverType: 'bush_fern', direction: 'up', depth: 3 },
    { id: 8, x: 1420, y: 830, w: 120, h: 110, coverType: 'bush_fern', direction: 'up', depth: 3 },
    { id: 9, x: 620, y: 460, w: 90, h: 90, coverType: 'mountain_crevice', direction: 'up', depth: 1 },
    { id: 10, x: 1180, y: 470, w: 90, h: 90, coverType: 'distant_bamboo', direction: 'right', depth: 1 },
    { id: 11, x: 1720, y: 780, w: 110, h: 120, coverType: 'bamboo_stalks', direction: 'left', depth: 3 },
  ];

  // --- Dynamic Entities ---
  let pandas = [];
  let particles = [];
  let floatingTexts = [];
  let mudProjectiles = [];
  let dartTracers = [];
  let ambientLeaves = [];
  let ambientFireflies = [];

  // --- Visual Dart Tracer Class ---
  class DartTracer {
    constructor(startX, startY, targetX, targetY) {
      this.startX = startX;
      this.startY = startY;
      this.targetX = targetX;
      this.targetY = targetY;
      this.progress = 0;
      this.duration = 130; // ms for high-velocity visible dart streak
      this.impactSpawned = false;
    }

    update(dt) {
      this.progress += dt / this.duration;
      if (this.progress >= 1 && !this.impactSpawned) {
        this.impactSpawned = true;
        spawnPuffParticles(this.targetX, this.targetY, 6, '#34d399');
      }
      return this.progress < 1.35;
    }

    draw(ctx) {
      const p = Math.min(1, this.progress);
      const curX = this.startX + (this.targetX - this.startX) * p;
      const curY = this.startY + (this.targetY - this.startY) * p;
      const tailP = Math.max(0, p - 0.45);
      const prevX = this.startX + (this.targetX - this.startX) * tailP;
      const prevY = this.startY + (this.targetY - this.startY) * tailP;

      ctx.save();

      // Outer glow trail
      ctx.beginPath();
      ctx.moveTo(prevX, prevY);
      ctx.lineTo(curX, curY);
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.shadowColor = '#10b981';
      ctx.shadowBlur = 16;
      ctx.stroke();

      // Bright inner core
      ctx.beginPath();
      ctx.moveTo(prevX, prevY);
      ctx.lineTo(curX, curY);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Glowing dart head
      ctx.beginPath();
      ctx.arc(curX, curY, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#34d399';
      ctx.shadowBlur = 14;
      ctx.fill();

      // Expanding impact ring upon arrival
      if (this.progress >= 1) {
        const ringP = (this.progress - 1) / 0.35;
        ctx.beginPath();
        ctx.arc(this.targetX, this.targetY, 8 + ringP * 28, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(52, 211, 153, ${Math.max(0, 1 - ringP)})`;
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  // --- Panda Entity Class ---
  class Panda {
    constructor(spot) {
      this.spot = spot;
      this.type = this.pickRandomType();
      this.state = 'rustling'; // 'rustling', 'peeking', 'taunting', 'retreating', 'hit', 'dashing'
      this.rustleTimer = 600 + Math.random() * 800;
      this.stateTimer = 0;
      this.peekProgress = 0; // 0 (fully hidden) to 1 (fully peeked)
      this.maxPeek = 1;
      this.direction = spot.direction; // 'up', 'left', 'right'
      
      // Position
      this.x = spot.x;
      this.y = spot.y;
      this.baseX = spot.x;
      this.baseY = spot.y;
      this.w = spot.w;
      this.h = spot.h;

      // Dash destination if Ninja
      this.targetSpot = null;
      this.dashProgress = 0;

      // Prankster mud throwing
      this.mudCharged = false;
      this.isHit = false;
      this.hitAngle = 0;
      this.headshotBox = { x: 0, y: 0, w: 0, h: 0 };
      this.bodyBox = { x: 0, y: 0, w: 0, h: 0 };
      this.eyeGlint = Math.random() < 0.7;

      // Rustle audio clue
      window.soundEngine.playPandaPeep();
    }

    pickRandomType() {
      const keys = Object.keys(PANDA_TYPES);
      const totalWeight = keys.reduce((acc, k) => acc + PANDA_TYPES[k].rarityWeight, 0);
      let rand = Math.random() * totalWeight;
      for (const k of keys) {
        if (rand < PANDA_TYPES[k].rarityWeight) return PANDA_TYPES[k];
        rand -= PANDA_TYPES[k].rarityWeight;
      }
      return PANDA_TYPES.SNEAKY;
    }

    update(dt) {
      const timeScale = state.isZenActive ? 0.38 : 1.0;
      const step = dt * timeScale;

      if (this.state === 'rustling') {
        this.rustleTimer -= step;
        if (this.rustleTimer <= 0) {
          this.state = 'peeking';
        }
      } else if (this.state === 'peeking') {
        this.peekProgress += (step / 1000) * this.type.peekSpeed;
        if (this.peekProgress >= this.maxPeek) {
          this.peekProgress = this.maxPeek;
          this.state = 'taunting';
          this.stateTimer = this.type.peekDuration;
        }
      } else if (this.state === 'taunting') {
        this.stateTimer -= step;

        // Prankster throw attack
        if (this.type.isPrankster && !this.mudCharged && this.stateTimer < this.type.peekDuration * 0.4) {
          this.throwMud();
          this.mudCharged = true;
        }

        // Ninja dash trigger
        if (this.type.isDashing && !this.targetSpot && this.stateTimer < this.type.peekDuration * 0.7) {
          this.startNinjaDash();
        }

        if (this.stateTimer <= 0) {
          this.state = 'retreating';
        }
      } else if (this.state === 'dashing') {
        this.dashProgress += (step / 1000) * 1.8;
        if (this.targetSpot) {
          this.x = this.baseX + (this.targetSpot.x - this.baseX) * this.dashProgress;
          this.y = this.baseY + (this.targetSpot.y - this.baseY) * this.dashProgress;
        }
        if (this.dashProgress >= 1) {
          this.state = 'retreating';
        }
      } else if (this.state === 'retreating') {
        this.peekProgress -= (step / 1000) * (this.type.peekSpeed * 1.5);
        if (this.peekProgress <= 0) {
          this.peekProgress = 0;
          return false; // Remove entity
        }
      } else if (this.state === 'hit') {
        this.peekProgress -= (step / 1000) * 4.0;
        this.hitAngle += (step / 1000) * 12;
        if (this.peekProgress <= 0) {
          return false; // Remove entity
        }
      }

      this.updateHitboxes();
      return true; // Keep alive
    }

    startNinjaDash() {
      // Find another available hide spot
      const others = HIDE_SPOTS.filter(s => s.id !== this.spot.id && !pandas.some(p => p.spot.id === s.id));
      if (others.length > 0) {
        this.targetSpot = others[Math.floor(Math.random() * others.length)];
        this.state = 'dashing';
        this.dashProgress = 0;
        spawnPuffParticles(this.x, this.y, 8, '#34d399');
      }
    }

    throwMud() {
      const startX = this.x;
      const startY = this.y - this.h * 0.4;
      // Target player's screen near random center
      const targetX = V_WIDTH * (0.3 + Math.random() * 0.4);
      const targetY = V_HEIGHT * (0.3 + Math.random() * 0.4);

      mudProjectiles.push(new MudProjectile(startX, startY, targetX, targetY));
    }

    updateHitboxes() {
      const offsetX = this.direction === 'left' ? -this.w * (1 - this.peekProgress) :
                      this.direction === 'right' ? this.w * (1 - this.peekProgress) : 0;
      const offsetY = this.direction === 'up' ? -this.h * (this.peekProgress * 0.75) : 0;

      const curX = this.x + offsetX;
      const curY = this.y + offsetY;

      // Head: upper portion
      this.headshotBox = {
        x: curX - this.w * 0.35,
        y: curY - this.h * 0.85,
        w: this.w * 0.7,
        h: this.h * 0.45,
      };

      // Body: lower portion
      this.bodyBox = {
        x: curX - this.w * 0.4,
        y: curY - this.h * 0.45,
        w: this.w * 0.8,
        h: this.h * 0.45,
      };
    }

    checkHit(px, py) {
      if (this.state === 'retreating' || this.state === 'hit' || this.state === 'rustling') return null;

      const inHead = px >= this.headshotBox.x && px <= this.headshotBox.x + this.headshotBox.w &&
                     py >= this.headshotBox.y && py <= this.headshotBox.y + this.headshotBox.h;
      if (inHead) return 'head';

      const inBody = px >= this.bodyBox.x && px <= this.bodyBox.x + this.bodyBox.w &&
                     py >= this.bodyBox.y && py <= this.bodyBox.y + this.bodyBox.h;
      if (inBody) return 'body';

      return null;
    }

    onHit(hitType) {
      this.state = 'hit';
      this.isHit = true;
      spawnPuffParticles(this.x, this.y - this.h * 0.5, 14, this.type.isGolden ? '#fbbf24' : '#ffffff');
    }

    draw(ctx) {
      if (this.peekProgress <= 0 && this.state !== 'rustling') return;

      ctx.save();

      const offsetX = this.direction === 'left' ? -this.w * (1 - this.peekProgress) :
                      this.direction === 'right' ? this.w * (1 - this.peekProgress) : 0;
      const offsetY = this.direction === 'up' ? -this.h * (this.peekProgress * 0.75) : 0;

      const px = this.x + offsetX;
      const py = this.y + offsetY;

      ctx.translate(px, py);

      if (this.isHit) {
        ctx.rotate(this.hitAngle * 0.2);
      }

      // If radar active, draw thermal sonar aura
      if (state.isRadarActive) {
        ctx.save();
        ctx.shadowColor = '#10b981';
        ctx.shadowBlur = 24;
        ctx.strokeStyle = 'rgba(52, 211, 153, 0.9)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, -this.h * 0.5, this.w * 0.55, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Golden aura
      if (this.type.isGolden) {
        ctx.save();
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 20;
        ctx.fillStyle = 'rgba(245, 158, 11, 0.25)';
        ctx.beginPath();
        ctx.arc(0, -this.h * 0.5, this.w * 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Body (Fluffy dark arms/torso)
      ctx.fillStyle = this.type.isGolden ? '#b45309' : '#1e293b';
      ctx.beginPath();
      ctx.ellipse(0, -this.h * 0.25, this.w * 0.38, this.h * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();

      // Paws gripping cover
      ctx.fillStyle = this.type.isGolden ? '#78350f' : '#0f172a';
      ctx.beginPath();
      ctx.arc(-this.w * 0.28, -this.h * 0.12, this.w * 0.1, 0, Math.PI * 2);
      ctx.arc(this.w * 0.28, -this.h * 0.12, this.w * 0.1, 0, Math.PI * 2);
      ctx.fill();

      // Ears
      const earColor = this.type.isGolden ? '#78350f' : '#0f172a';
      ctx.fillStyle = earColor;
      ctx.beginPath();
      ctx.arc(-this.w * 0.26, -this.h * 0.8, this.w * 0.14, 0, Math.PI * 2);
      ctx.arc(this.w * 0.26, -this.h * 0.8, this.w * 0.14, 0, Math.PI * 2);
      ctx.fill();

      // Inner ear pink
      ctx.fillStyle = '#f472b6';
      ctx.beginPath();
      ctx.arc(-this.w * 0.26, -this.h * 0.8, this.w * 0.07, 0, Math.PI * 2);
      ctx.arc(this.w * 0.26, -this.h * 0.8, this.w * 0.07, 0, Math.PI * 2);
      ctx.fill();

      // Head
      ctx.fillStyle = this.type.isGolden ? '#fef08a' : '#ffffff';
      ctx.beginPath();
      ctx.ellipse(0, -this.h * 0.52, this.w * 0.36, this.h * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();

      // Panda Black Eye Patches
      ctx.fillStyle = this.type.isGolden ? '#78350f' : '#0f172a';
      ctx.save();
      ctx.translate(-this.w * 0.14, -this.h * 0.54);
      ctx.rotate(-0.2);
      ctx.beginPath();
      ctx.ellipse(0, 0, this.w * 0.11, this.h * 0.13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.translate(this.w * 0.14, -this.h * 0.54);
      ctx.rotate(0.2);
      ctx.beginPath();
      ctx.ellipse(0, 0, this.w * 0.11, this.h * 0.13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Eyes (Look towards player's crosshair!)
      const lookDx = Math.max(-3, Math.min(3, (state.canvasMouse.x - (this.x + offsetX)) * 0.005));
      const lookDy = Math.max(-3, Math.min(3, (state.canvasMouse.y - (this.y + offsetY)) * 0.005));

      if (this.isHit) {
        // Dizzy spiral eyes when hit
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(-this.w * 0.14, -this.h * 0.54, 4, 0, Math.PI * 2);
        ctx.arc(this.w * 0.14, -this.h * 0.54, 4, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // White sclera & Pupil
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-this.w * 0.14 + lookDx, -this.h * 0.54 + lookDy, 5, 0, Math.PI * 2);
        ctx.arc(this.w * 0.14 + lookDx, -this.h * 0.54 + lookDy, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(-this.w * 0.14 + lookDx * 1.2, -this.h * 0.54 + lookDy * 1.2, 3, 0, Math.PI * 2);
        ctx.arc(this.w * 0.14 + lookDx * 1.2, -this.h * 0.54 + lookDy * 1.2, 3, 0, Math.PI * 2);
        ctx.fill();

        // Catchlight reflections
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-this.w * 0.14 + lookDx - 1, -this.h * 0.54 + lookDy - 1, 1.2, 0, Math.PI * 2);
        ctx.arc(this.w * 0.14 + lookDx - 1, -this.h * 0.54 + lookDy - 1, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Snout
      ctx.fillStyle = this.type.isGolden ? '#fde047' : '#f1f5f9';
      ctx.beginPath();
      ctx.ellipse(0, -this.h * 0.42, this.w * 0.14, this.h * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();

      // Nose
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.ellipse(0, -this.h * 0.44, 4, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      // Mouth
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(-3, -this.h * 0.40, 3, 0, Math.PI);
      ctx.arc(3, -this.h * 0.40, 3, 0, Math.PI);
      ctx.stroke();

      // Special Accessories per Type:
      if (this.type.isGolden) {
        // Golden Crown
        ctx.fillStyle = '#f59e0b';
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-this.w * 0.16, -this.h * 0.82);
        ctx.lineTo(-this.w * 0.20, -this.h * 0.98);
        ctx.lineTo(-this.w * 0.08, -this.h * 0.88);
        ctx.lineTo(0, -this.h * 1.02);
        ctx.lineTo(this.w * 0.08, -this.h * 0.88);
        ctx.lineTo(this.w * 0.20, -this.h * 0.98);
        ctx.lineTo(this.w * 0.16, -this.h * 0.82);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (this.type.isDashing) {
        // Ninja Headband
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-this.w * 0.35, -this.h * 0.72, this.w * 0.7, 8);
        // Headband tails
        ctx.beginPath();
        ctx.moveTo(this.w * 0.34, -this.h * 0.70);
        ctx.lineTo(this.w * 0.48, -this.h * 0.65);
        ctx.lineTo(this.w * 0.46, -this.h * 0.58);
        ctx.lineTo(this.w * 0.33, -this.h * 0.62);
        ctx.fill();
      } else if (this.type.name === 'Bamboo Muncher') {
        // Holding bamboo shoot
        ctx.fillStyle = '#84cc16';
        ctx.fillRect(-this.w * 0.1, -this.h * 0.38, 22, 6);
        ctx.beginPath();
        ctx.ellipse(14, -this.h * 0.40, 8, 4, 0.4, 0, Math.PI * 2);
        ctx.fill();
      } else if (this.type.isPrankster) {
        // Mud ball in hand
        ctx.fillStyle = '#78350f';
        ctx.beginPath();
        ctx.arc(this.w * 0.28, -this.h * 0.26, 12, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  // --- Mud Projectile Class (Prankster Attack) ---
  class MudProjectile {
    constructor(startX, startY, targetX, targetY) {
      this.x = startX;
      this.y = startY;
      this.targetX = targetX;
      this.targetY = targetY;
      this.progress = 0;
      this.speed = 1.35;
      this.size = 14;
      this.scale = 0.4;
    }

    update(dt) {
      this.progress += (dt / 1000) * this.speed;
      this.x += (this.targetX - this.x) * (dt / 1000) * 4.5;
      this.y += (this.targetY - this.y) * (dt / 1000) * 4.5;
      this.scale = 0.4 + this.progress * 2.2;

      if (this.progress >= 1) {
        // Impact!
        this.triggerScreenSplatter();
        return false;
      }
      return true;
    }

    triggerScreenSplatter() {
      window.soundEngine.playSplatter();
      createSplatterOnScreen(this.targetX, this.targetY);

      if (state.mode === 'survival') {
        state.lives--;
        updateLivesUI();
        if (state.lives <= 0) {
          endGame();
        }
      }
    }

    draw(ctx) {
      ctx.save();
      ctx.fillStyle = '#451a03';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * this.scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // --- Particle Effects ---
  class Particle {
    constructor(x, y, vx, vy, color, size, life) {
      this.x = x;
      this.y = y;
      this.vx = vx;
      this.vy = vy;
      this.color = color;
      this.size = size;
      this.maxLife = life;
      this.life = life;
    }

    update(dt) {
      this.life -= dt;
      this.x += this.vx * (dt / 16);
      this.y += this.vy * (dt / 16);
      this.vy += 0.15; // Gravity
      return this.life > 0;
    }

    draw(ctx) {
      const alpha = Math.max(0, this.life / this.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function spawnPuffParticles(x, y, count, color) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 5;
      particles.push(new Particle(
        x, y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed - 1.5,
        color,
        3 + Math.random() * 4,
        400 + Math.random() * 300
      ));
    }
  }

  // --- Floating Combat Text (+150, HEADSHOT!, etc.) ---
  class FloatingText {
    constructor(x, y, text, color, isBig = false) {
      this.x = x;
      this.y = y;
      this.text = text;
      this.color = color;
      this.isBig = isBig;
      this.life = 1000; // ms
      this.maxLife = 1000;
      this.vy = -1.8;
    }

    update(dt) {
      this.life -= dt;
      this.y += this.vy * (dt / 16);
      return this.life > 0;
    }

    draw(ctx) {
      const alpha = Math.max(0, this.life / this.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `bold ${this.isBig ? 26 : 20}px Outfit, Fredoka, sans-serif`;
      ctx.fillStyle = this.color;
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 8;
      ctx.textAlign = 'center';
      ctx.fillText(this.text, this.x, this.y);
      ctx.restore();
    }
  }

  // --- Screen Splatter Animation ---
  function createSplatterOnScreen(screenX, screenY) {
    // Convert to screen percentage for responsive overlay
    const rect = canvas.getBoundingClientRect();
    const pctX = (screenX / V_WIDTH) * 100;
    const pctY = (screenY / V_HEIGHT) * 100;

    const el = document.createElement('div');
    el.className = 'splatter-mark';
    const size = 60 + Math.random() * 70;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.left = `calc(${pctX}% - ${size / 2}px)`;
    el.style.top = `calc(${pctY}% - ${size / 2}px)`;
    el.style.setProperty('--rot', `${Math.random() * 360}deg`);

    splattersLayer.appendChild(el);

    // Screen shake
    triggerScreenShake(8);

    // Remove splatter after 4 seconds
    setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 1800);
    }, 4000);
  }

  function triggerScreenShake(magnitude = 6) {
    state.screenShake = magnitude;
  }

  // --- Background Scenery Rendering ---
  function initAmbientElements() {
    ambientLeaves = [];
    for (let i = 0; i < 30; i++) {
      ambientLeaves.push({
        x: Math.random() * V_WIDTH,
        y: Math.random() * V_HEIGHT,
        vx: 0.5 + Math.random() * 1.5,
        vy: 1.0 + Math.random() * 1.2,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: 0.02 + Math.random() * 0.03,
        size: 8 + Math.random() * 6,
      });
    }

    ambientFireflies = [];
    for (let i = 0; i < 20; i++) {
      ambientFireflies.push({
        x: Math.random() * V_WIDTH,
        y: Math.random() * V_HEIGHT,
        baseY: Math.random() * V_HEIGHT,
        phase: Math.random() * Math.PI * 2,
        speed: 0.002 + Math.random() * 0.003,
        size: 2 + Math.random() * 3,
      });
    }
  }

  function renderEnvironment(ctx) {
    // 1. Serene Mist Sky Gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, V_HEIGHT);
    skyGrad.addColorStop(0, '#061c14');
    skyGrad.addColorStop(0.35, '#0d3224');
    skyGrad.addColorStop(0.65, '#164e37');
    skyGrad.addColorStop(1, '#082518');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, V_WIDTH, V_HEIGHT);

    // 2. Distant Moon / Sun Sanctuary Glow
    const sunGrad = ctx.createRadialGradient(V_WIDTH * 0.72, V_HEIGHT * 0.25, 10, V_WIDTH * 0.72, V_HEIGHT * 0.25, 240);
    sunGrad.addColorStop(0, 'rgba(254, 243, 199, 0.45)');
    sunGrad.addColorStop(0.5, 'rgba(217, 119, 6, 0.15)');
    sunGrad.addColorStop(1, 'rgba(217, 119, 6, 0)');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(V_WIDTH * 0.72, V_HEIGHT * 0.25, 240, 0, Math.PI * 2);
    ctx.fill();

    // 3. Layer 1: Distant Mountain Silhouettes & Misty Valleys
    ctx.fillStyle = '#0a2318';
    ctx.beginPath();
    ctx.moveTo(0, V_HEIGHT * 0.55);
    ctx.bezierCurveTo(V_WIDTH * 0.2, V_HEIGHT * 0.35, V_WIDTH * 0.4, V_HEIGHT * 0.50, V_WIDTH * 0.6, V_HEIGHT * 0.38);
    ctx.bezierCurveTo(V_WIDTH * 0.8, V_HEIGHT * 0.28, V_WIDTH * 0.9, V_HEIGHT * 0.48, V_WIDTH, V_HEIGHT * 0.42);
    ctx.lineTo(V_WIDTH, V_HEIGHT);
    ctx.lineTo(0, V_HEIGHT);
    ctx.fill();

    // 4. Distant Pagoda Sanctuary Silhouette
    drawPagoda(ctx, V_WIDTH * 0.28, V_HEIGHT * 0.38, 0.55);
    drawPagoda(ctx, V_WIDTH * 0.78, V_HEIGHT * 0.32, 0.7);

    // 5. Layer 2: Midground Mountain Ridge & Waterfall
    ctx.fillStyle = '#0f3827';
    ctx.beginPath();
    ctx.moveTo(0, V_HEIGHT * 0.68);
    ctx.bezierCurveTo(V_WIDTH * 0.3, V_HEIGHT * 0.58, V_WIDTH * 0.5, V_HEIGHT * 0.62, V_WIDTH * 0.75, V_HEIGHT * 0.52);
    ctx.bezierCurveTo(V_WIDTH * 0.9, V_HEIGHT * 0.48, V_WIDTH * 0.95, V_HEIGHT * 0.65, V_WIDTH, V_HEIGHT * 0.60);
    ctx.lineTo(V_WIDTH, V_HEIGHT);
    ctx.lineTo(0, V_HEIGHT);
    ctx.fill();

    // Midground Stone Lanterns (Toro)
    drawStoneLantern(ctx, 490, 640);
    drawStoneLantern(ctx, 1280, 560);

    // 6. Draw Pandas at Depth 1 & 2 (behind foreground foliage)
    for (const p of pandas) {
      if (p.spot.depth <= 2) p.draw(ctx);
    }

    // 7. Mid-Fore Bamboo Stalks (Dense Bamboo Thicket)
    drawBambooForest(ctx);

    // 8. Draw Pandas at Depth 3 (Foreground hiding spots)
    for (const p of pandas) {
      if (p.spot.depth > 2) p.draw(ctx);
    }

    // 9. Foreground Cover Objects (Hollow logs, bushes, ferns)
    drawForegroundCover(ctx);

    // 10. Ambient particles (Floating leaves & fireflies)
    drawAmbientParticles(ctx);
  }

  function drawPagoda(ctx, x, y, scale = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = '#071811';

    // 3 Tiered Roofs
    for (let i = 0; i < 3; i++) {
      const tierY = -i * 28;
      const tierW = 70 - i * 14;
      ctx.beginPath();
      ctx.moveTo(-tierW, tierY);
      ctx.quadraticCurveTo(0, tierY - 14, tierW, tierY);
      ctx.lineTo(tierW - 6, tierY + 12);
      ctx.lineTo(-tierW + 6, tierY + 12);
      ctx.closePath();
      ctx.fill();

      // Posts
      ctx.fillRect(-18, tierY + 12, 36, 16);
    }
    // Pagoda spire
    ctx.fillRect(-2, -88, 4, 28);
    ctx.restore();
  }

  function drawStoneLantern(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#1e3a2b';
    ctx.strokeStyle = '#2d5a43';
    ctx.lineWidth = 2;

    // Base
    ctx.fillRect(-24, 0, 48, 14);
    // Pillar
    ctx.fillRect(-10, -32, 20, 32);
    // Firebox chamber (with gentle yellow glow)
    ctx.fillStyle = '#34d399';
    ctx.fillRect(-16, -56, 32, 24);
    ctx.fillStyle = 'rgba(254, 240, 138, 0.7)';
    ctx.fillRect(-8, -48, 16, 12);
    // Roof cap
    ctx.fillStyle = '#1e3a2b';
    ctx.beginPath();
    ctx.moveTo(-28, -56);
    ctx.lineTo(0, -74);
    ctx.lineTo(28, -56);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawBambooForest(ctx) {
    ctx.save();
    // Repeating vertical stalks with joints and leaf nodes
    const stalks = [
      { x: 120, w: 26, h: V_HEIGHT },
      { x: 180, w: 22, h: V_HEIGHT },
      { x: 280, w: 32, h: V_HEIGHT },
      { x: 340, w: 24, h: V_HEIGHT },
      { x: 670, w: 28, h: V_HEIGHT },
      { x: 740, w: 22, h: V_HEIGHT },
      { x: 980, w: 30, h: V_HEIGHT },
      { x: 1100, w: 26, h: V_HEIGHT },
      { x: 1540, w: 34, h: V_HEIGHT },
      { x: 1620, w: 26, h: V_HEIGHT },
      { x: 1740, w: 36, h: V_HEIGHT },
      { x: 1840, w: 24, h: V_HEIGHT },
    ];

    for (const b of stalks) {
      // Bamboo Stalk Body
      const bGrad = ctx.createLinearGradient(b.x, 0, b.x + b.w, 0);
      bGrad.addColorStop(0, '#164e37');
      bGrad.addColorStop(0.4, '#10b981');
      bGrad.addColorStop(0.85, '#059669');
      bGrad.addColorStop(1, '#064e3b');
      ctx.fillStyle = bGrad;
      ctx.fillRect(b.x, 0, b.w, b.h);

      // Bamboo Joints
      ctx.fillStyle = '#06281a';
      for (let j = 40; j < V_HEIGHT; j += 95) {
        ctx.fillRect(b.x - 3, j, b.w + 6, 6);
        ctx.fillStyle = '#34d399';
        ctx.fillRect(b.x - 2, j + 6, b.w + 4, 1.5);
        ctx.fillStyle = '#06281a';

        // Little leaf spray from joint
        if ((j + b.x) % 3 === 0) {
          drawBambooLeaves(ctx, b.x + b.w + 2, j + 2, 1);
        } else if ((j + b.x) % 4 === 0) {
          drawBambooLeaves(ctx, b.x - 2, j + 2, -1);
        }
      }
    }
    ctx.restore();
  }

  function drawBambooLeaves(ctx, x, y, dir) {
    ctx.save();
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.ellipse(x + dir * 20, y - 5, 24, 7, dir * 0.35, 0, Math.PI * 2);
    ctx.ellipse(x + dir * 30, y + 6, 22, 6, dir * -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawForegroundCover(ctx) {
    // Hollow log at x: 380, y: 840
    ctx.save();
    ctx.fillStyle = '#3b2510';
    ctx.beginPath();
    ctx.ellipse(380, 880, 110, 50, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1e1308';
    ctx.beginPath();
    ctx.ellipse(330, 880, 35, 45, 0, 0, Math.PI * 2);
    ctx.fill();
    // Green moss on top
    ctx.fillStyle = '#15803d';
    ctx.beginPath();
    ctx.ellipse(390, 840, 85, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Mossy rocks at x: 1020, y: 660
    ctx.save();
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.ellipse(1020, 680, 100, 65, 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#15803d';
    ctx.beginPath();
    ctx.ellipse(1015, 630, 70, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Dense fern bushes at bottom
    ctx.save();
    const bushes = [
      { x: 880, y: 890, r: 110 },
      { x: 1420, y: 910, r: 120 },
      { x: 100, y: 960, r: 140 },
      { x: 1820, y: 940, r: 130 },
    ];
    for (const b of bushes) {
      const bushGrad = ctx.createRadialGradient(b.x, b.y, 20, b.x, b.y, b.r);
      bushGrad.addColorStop(0, '#059669');
      bushGrad.addColorStop(0.6, '#047857');
      bushGrad.addColorStop(1, '#064e3b');
      ctx.fillStyle = bushGrad;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawAmbientParticles(ctx) {
    const time = performance.now() * 0.001;

    // Drifting bamboo leaves
    ctx.save();
    ctx.fillStyle = 'rgba(52, 211, 153, 0.65)';
    for (const leaf of ambientLeaves) {
      leaf.x += leaf.vx;
      leaf.y += leaf.vy;
      leaf.rot += leaf.rotSpeed;
      if (leaf.y > V_HEIGHT + 20) {
        leaf.y = -20;
        leaf.x = Math.random() * V_WIDTH;
      }
      if (leaf.x > V_WIDTH + 20) leaf.x = -20;

      ctx.save();
      ctx.translate(leaf.x, leaf.y);
      ctx.rotate(leaf.rot);
      ctx.beginPath();
      ctx.ellipse(0, 0, leaf.size, leaf.size * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    // Glowing fireflies
    ctx.save();
    for (const ff of ambientFireflies) {
      ff.y = ff.baseY + Math.sin(time + ff.phase) * 20;
      const alpha = 0.3 + 0.5 * Math.sin(time * 2 + ff.phase);
      ctx.fillStyle = `rgba(253, 224, 71, ${alpha})`;
      ctx.shadowColor = '#fde047';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(ff.x, ff.y, ff.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // --- Panda Spawning Engine ---
  let spawnTimer = 0;

  function updatePandaSpawner(dt) {
    if (pandas.length >= CONFIG.PANDA_MAX_ACTIVE) return;

    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnPanda();
      spawnTimer = 1200 + Math.random() * 1600;
    }
  }

  function spawnPanda() {
    // Pick an available hide spot
    const availableSpots = HIDE_SPOTS.filter(s => !pandas.some(p => p.spot.id === s.id));
    if (availableSpots.length === 0) return;

    const spot = availableSpots[Math.floor(Math.random() * availableSpots.length)];
    pandas.push(new Panda(spot));
  }

  // --- Shooting Mechanics (Unlimited Rapid Fire Darts) ---
  function shoot(explicitX, explicitY) {
    if (!state.isPlaying || state.isPaused) return;

    state.shotsFired++;
    window.soundEngine.playShoot();

    // Recoil animation on crosshair
    if (customCrosshair) {
      customCrosshair.classList.add('recoil');
      setTimeout(() => customCrosshair.classList.remove('recoil'), 100);
    }

    triggerScreenShake(3);

    // Hit test against pandas
    const shotX = explicitX !== undefined ? explicitX : state.canvasMouse.x;
    const shotY = explicitY !== undefined ? explicitY : state.canvasMouse.y;

    // Visual Dart Tracer streak
    const originX = V_WIDTH * 0.5;
    const originY = state.isScoped ? V_HEIGHT * 0.5 : V_HEIGHT * 0.98;
    dartTracers.push(new DartTracer(originX, originY, shotX, shotY));

    let hitDetected = false;

    // Sort by depth descending so foreground takes precedence
    const sortedPandas = [...pandas].sort((a, b) => b.spot.depth - a.spot.depth);

    for (const p of sortedPandas) {
      const hitType = p.checkHit(shotX, shotY);
      if (hitType) {
        handleHit(p, hitType, shotX, shotY);
        hitDetected = true;
        break;
      }
    }

    if (!hitDetected) {
      // Missed shot: breaks combo streak
      resetCombo();
      spawnPuffParticles(shotX, shotY, 4, '#10b981');
    }
  }

  function handleHit(panda, hitType, x, y) {
    state.shotsHit++;
    state.pandasTagged++;
    records.totalPandas++;

    const isCrit = hitType === 'head';
    const isGolden = !!panda.type.isGolden;

    if (isCrit) state.headshots++;
    if (isGolden) {
      state.goldenTagged++;
      records.goldenPandas++;
    }

    // Audio confirmation
    window.soundEngine.playHit(isCrit, isGolden);

    // Hitmarker UI
    showHitmarker(isCrit);

    // Combo streak
    state.combo++;
    if (state.combo > state.maxCombo) state.maxCombo = state.combo;
    if (state.combo > records.maxCombo) records.maxCombo = state.combo;
    state.comboTimer = CONFIG.COMBO_TIMEOUT;
    updateComboUI();

    // Score calculation
    let basePoints = panda.type.points;
    if (isCrit) basePoints *= 2;
    const pointsAwarded = basePoints * state.combo;
    state.score += pointsAwarded;
    updateScoreUI();

    // Floating text
    const textLabel = isCrit ? `CRITICAL PEEK! +${pointsAwarded}` :
                      isGolden ? `EMPEROR! +${pointsAwarded}` : `+${pointsAwarded}`;
    const textColor = isCrit ? '#fbbf24' : isGolden ? '#f59e0b' : '#34d399';
    floatingTexts.push(new FloatingText(x, y - 20, textLabel, textColor, isCrit || isGolden));

    // Stun / Hit panda
    panda.onHit(hitType);
  }

  function showHitmarker(isCrit) {
    hitmarkerEl.style.left = `${state.mouse.x}px`;
    hitmarkerEl.style.top = `${state.mouse.y}px`;
    hitmarkerEl.className = isCrit ? 'active hitmarker-crit' : 'active';
    setTimeout(() => {
      hitmarkerEl.className = 'hitmarker-hidden';
    }, 180);
  }

  function toggleScope() {
    state.isScoped = !state.isScoped;
    state.cam.targetZoom = state.isScoped ? CONFIG.ZOOM_FACTOR : 1.0;

    window.soundEngine.playScope(state.isScoped);

    if (state.isScoped) {
      scopeOverlay.classList.remove('hidden');
      scopeBtnText.innerHTML = 'EXIT SCOPE <span class="kbd-hint">[SPACE]</span>';
      // Randomize rangefinder readout for realism
      document.getElementById('scope-dist').textContent = `${(35 + Math.random() * 25).toFixed(1)}m`;
    } else {
      scopeOverlay.classList.add('hidden');
      scopeBtnText.innerHTML = 'SCOPE <span class="kbd-hint">[SPACE / RMB]</span>';
    }
  }

  // --- Skills & Tactical Abilities ---
  function activateZen() {
    if (state.zenCooldown > 0 || state.isZenActive) return;
    state.isZenActive = true;
    state.zenTimer = CONFIG.ZEN_DURATION;
    state.zenCooldown = CONFIG.ZEN_COOLDOWN;
    btnZen.classList.add('active');

    window.soundEngine.playZenTime(true);

    floatingTexts.push(new FloatingText(V_WIDTH / 2, V_HEIGHT * 0.35, 'ZEN FOCUS ACTIVATED!', '#fbbf24', true));
  }

  function deactivateZen() {
    state.isZenActive = false;
    btnZen.classList.remove('active');
    window.soundEngine.playZenTime(false);
  }

  function activateRadar() {
    if (state.radarCooldown > 0 || state.isRadarActive) return;
    state.isRadarActive = true;
    state.radarTimer = CONFIG.RADAR_DURATION;
    state.radarCooldown = CONFIG.RADAR_COOLDOWN;
    state.radarRadius = 0;
    btnRadar.classList.add('active');

    window.soundEngine.playRadar();

    floatingTexts.push(new FloatingText(V_WIDTH / 2, V_HEIGHT * 0.35, 'THERMAL RADAR SCANNING!', '#10b981', true));
  }

  function deactivateRadar() {
    state.isRadarActive = false;
    btnRadar.classList.remove('active');
  }

  // --- UI Update Helpers ---
  function updateScoreUI() {
    scoreDisplay.textContent = state.score.toString().padStart(5, '0');
  }


  function updateComboUI() {
    comboMultiplier.textContent = `x${state.combo}`;
    comboMultiplier.classList.add('pop');
    setTimeout(() => comboMultiplier.classList.remove('pop'), 140);
    comboBar.style.width = '100%';
    window.soundEngine.playComboStreak(state.combo);
  }

  function resetCombo() {
    state.combo = 1;
    comboMultiplier.textContent = 'x1';
    comboBar.style.width = '0%';
  }

  function updateLivesUI() {
    const hearts = heartsDisplay.children;
    for (let i = 0; i < CONFIG.MAX_LIVES; i++) {
      if (i < state.lives) {
        hearts[i].className = 'heart active';
      } else {
        hearts[i].className = 'heart lost';
      }
    }
  }

  // --- Game Loop ---
  let lastFrameTime = performance.now();

  function gameLoop(now) {
    const dt = Math.min(now - lastFrameTime, 100); // capped for stability
    lastFrameTime = now;

    if (state.isPlaying && !state.isPaused) {
      updateGame(dt);
    }

    renderGame();
    requestAnimationFrame(gameLoop);
  }

  function updateGame(dt) {
    // Mode timer
    if (state.mode === 'timed') {
      state.timeRemaining -= dt / 1000;
      timeDisplay.textContent = `${Math.ceil(Math.max(0, state.timeRemaining))}s`;
      if (state.timeRemaining <= 0) {
        endGame();
        return;
      }
    }

    // Combo countdown
    if (state.combo > 1) {
      state.comboTimer -= dt;
      const pct = Math.max(0, (state.comboTimer / CONFIG.COMBO_TIMEOUT) * 100);
      comboBar.style.width = `${pct}%`;
      if (state.comboTimer <= 0) {
        resetCombo();
      }
    }

    // Skills cooldowns
    if (state.isZenActive) {
      state.zenTimer -= dt;
      if (state.zenTimer <= 0) deactivateZen();
    }
    if (state.zenCooldown > 0) {
      state.zenCooldown -= dt;
      const pct = Math.max(0, (state.zenCooldown / CONFIG.ZEN_COOLDOWN) * 100);
      zenCd.style.height = `${pct}%`;
    }

    if (state.isRadarActive) {
      state.radarTimer -= dt;
      state.radarRadius += (dt / 1000) * 1200;
      if (state.radarTimer <= 0) deactivateRadar();
    }
    if (state.radarCooldown > 0) {
      state.radarCooldown -= dt;
      const pct = Math.max(0, (state.radarCooldown / CONFIG.RADAR_COOLDOWN) * 100);
      radarCd.style.height = `${pct}%`;
    }

    // Panda Spawning & Updates
    updatePandaSpawner(dt);

    pandas = pandas.filter(p => p.update(dt));
    mudProjectiles = mudProjectiles.filter(m => m.update(dt));
    dartTracers = dartTracers.filter(d => d.update(dt));
    particles = particles.filter(pt => pt.update(dt));
    floatingTexts = floatingTexts.filter(ft => ft.update(dt));

    // Screen Shake decay
    if (state.screenShake > 0) {
      state.screenShake *= 0.88;
      if (state.screenShake < 0.2) state.screenShake = 0;
    }

    // Camera Zoom Interpolation
    state.cam.zoom += (state.cam.targetZoom - state.cam.zoom) * 0.15;
  }

  function renderGame() {
    ctx.clearRect(0, 0, V_WIDTH, V_HEIGHT);

    ctx.save();

    // Screen shake
    if (state.screenShake > 0) {
      const sx = (Math.random() - 0.5) * state.screenShake * 3;
      const sy = (Math.random() - 0.5) * state.screenShake * 3;
      ctx.translate(sx, sy);
    }

    // Camera Zoom (Focus on crosshair point)
    if (state.cam.zoom > 1.01) {
      ctx.translate(state.canvasMouse.x, state.canvasMouse.y);
      ctx.scale(state.cam.zoom, state.cam.zoom);
      ctx.translate(-state.canvasMouse.x, -state.canvasMouse.y);
    }

    // Render Scenery & Entities
    renderEnvironment(ctx);

    // Mud Projectiles
    for (const m of mudProjectiles) m.draw(ctx);

    // Dart Projectiles / Tracers
    for (const d of dartTracers) d.draw(ctx);

    // Particles
    for (const pt of particles) pt.draw(ctx);

    // Floating Combat Texts
    for (const ft of floatingTexts) ft.draw(ctx);

    // Radar Wave Effect
    if (state.isRadarActive) {
      ctx.save();
      ctx.strokeStyle = 'rgba(52, 211, 153, 0.4)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(V_WIDTH / 2, V_HEIGHT / 2, state.radarRadius % V_WIDTH, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  // --- Canvas Coordinate Conversion ---
  function updateMousePositions(clientX, clientY) {
    state.mouse.x = clientX;
    state.mouse.y = clientY;

    // Update custom crosshair element
    customCrosshair.style.left = `${clientX}px`;
    customCrosshair.style.top = `${clientY}px`;

    // Map screen mouse to virtual 1920x1080 canvas coordinates
    const rect = canvas.getBoundingClientRect();
    state.canvasMouse.x = ((clientX - rect.left) / rect.width) * V_WIDTH;
    state.canvasMouse.y = ((clientY - rect.top) / rect.height) * V_HEIGHT;
  }

  let hintDismissed = false;
  function checkOrientationHint() {
    if (!orientationHint || hintDismissed) return;
    const isPortrait = window.innerHeight > window.innerWidth;
    const isMobile = window.innerWidth <= 768 || ('ontouchstart' in window);
    if (isPortrait && isMobile) {
      orientationHint.classList.add('visible');
    } else {
      orientationHint.classList.remove('visible');
    }
  }

  function handleResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const targetRatio = 16 / 9;
    const currentRatio = w / h;

    let displayW, displayH;
    if (currentRatio > targetRatio) {
      displayH = h;
      displayW = Math.round(h * targetRatio);
    } else {
      displayW = w;
      displayH = Math.round(w / targetRatio);
    }

    canvas.width = V_WIDTH;
    canvas.height = V_HEIGHT;
    canvas.style.width = `${displayW}px`;
    canvas.style.height = `${displayH}px`;

    checkOrientationHint();
  }

  // --- Game Lifecycle ---
  function startGame() {
    window.soundEngine.init();

    state.isPlaying = true;
    state.isPaused = false;
    state.score = 0;
    state.shotsFired = 0;
    state.shotsHit = 0;
    state.headshots = 0;
    state.pandasTagged = 0;
    state.goldenTagged = 0;
    state.maxCombo = 1;
    state.combo = 1;
    state.ammo = Infinity;
    state.isReloading = false;
    state.isScoped = false;
    state.timeRemaining = CONFIG.TIMED_GAME_DURATION;
    state.lives = CONFIG.MAX_LIVES;

    pandas = [];
    particles = [];
    mudProjectiles = [];
    dartTracers = [];
    floatingTexts = [];
    splattersLayer.innerHTML = '';

    // Mode UI setup
    if (state.mode === 'timed') {
      timerWrapper.classList.remove('hidden');
      livesWrapper.classList.add('hidden');
      timeDisplay.textContent = '90s';
    } else if (state.mode === 'survival') {
      timerWrapper.classList.add('hidden');
      livesWrapper.classList.remove('hidden');
      updateLivesUI();
    } else if (state.mode === 'zen') {
      timerWrapper.classList.remove('hidden');
      livesWrapper.classList.add('hidden');
      timeDisplay.textContent = '∞';
    }

    updateScoreUI();
    resetCombo();

    startScreen.classList.remove('active');
    startScreen.classList.add('hidden');
    gameoverModal.classList.add('hidden');
    pauseModal.classList.add('hidden');
    scopeOverlay.classList.add('hidden');
    if (hudLayer) hudLayer.classList.remove('hidden');
  }

  function endGame() {
    state.isPlaying = false;
    if (state.isScoped) toggleScope();
    if (hudLayer) hudLayer.classList.add('hidden');

    // Check high records
    let isNewHigh = false;
    if (state.mode === 'timed' && state.score > records.timed) {
      records.timed = state.score;
      isNewHigh = true;
    } else if (state.mode === 'survival' && state.score > records.survival) {
      records.survival = state.score;
      isNewHigh = true;
    }
    saveRecords();

    // Calculate accuracy
    const acc = state.shotsFired > 0 ? Math.round((state.shotsHit / state.shotsFired) * 100) : 0;

    // Fill results UI
    document.getElementById('res-score').textContent = state.score.toLocaleString();
    document.getElementById('res-accuracy').textContent = `${acc}%`;
    document.getElementById('res-combo').textContent = `x${state.maxCombo}`;
    document.getElementById('res-pandas').textContent = state.pandasTagged.toLocaleString();

    const banner = document.getElementById('new-high-score-banner');
    if (isNewHigh) {
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }

    gameoverModal.classList.remove('hidden');
    gameoverModal.classList.add('active');
  }

  function pauseGame() {
    if (!state.isPlaying) return;
    state.isPaused = true;
    pauseModal.classList.remove('hidden');
    pauseModal.classList.add('active');
  }

  function resumeGame() {
    state.isPaused = false;
    pauseModal.classList.add('hidden');
    pauseModal.classList.remove('active');
  }

  // --- Event Listeners ---
  function setupEvents() {
    window.addEventListener('resize', handleResize);

    // Mouse movement
    window.addEventListener('mousemove', (e) => {
      updateMousePositions(e.clientX, e.clientY);
    });

    // Shooting: Left Click
    gameContainer.addEventListener('mousedown', (e) => {
      // Prevent synthetic mousedown firing immediately after touchstart on mobile
      if (Date.now() - (window.lastTouchTime || 0) < 450) return;
      // Avoid triggering when clicking HUD buttons
      if (e.target.closest('button') || e.target.closest('.modal-box')) return;

      if (e.button === 0) {
        if (!state.isPlaying) {
          startGame();
        }
        updateMousePositions(e.clientX, e.clientY);
        shoot(state.canvasMouse.x, state.canvasMouse.y);
      } else if (e.button === 2) {
        // Right Click: Toggle Scope
        e.preventDefault();
        toggleScope();
      }
    });

    // Prevent context menu on right click
    window.addEventListener('contextmenu', (e) => {
      if (state.isPlaying) e.preventDefault();
    });

    // Touch support for mobile / tablet
    gameContainer.addEventListener('touchstart', (e) => {
      if (e.target.closest('button') || e.target.closest('.modal-box')) return;
      window.lastTouchTime = Date.now();
      lastTouchTime = window.lastTouchTime;
      if (!state.isPlaying) {
        startGame();
      }
      if (state.isPlaying && !state.isPaused) {
        e.preventDefault();
      }
      const touch = e.touches[0];
      updateMousePositions(touch.clientX, touch.clientY);
      createTouchRipple(touch.clientX, touch.clientY);
      shoot(state.canvasMouse.x, state.canvasMouse.y);
    }, { passive: false });

    // Direct Canvas Click Fallback
    canvas.addEventListener('click', (e) => {
      if (!state.isPlaying) {
        startGame();
      }
      updateMousePositions(e.clientX, e.clientY);
      shoot(state.canvasMouse.x, state.canvasMouse.y);
    });

    function createTouchRipple(clientX, clientY) {
      if (!touchRipplesContainer) return;
      const ripple = document.createElement('div');
      ripple.className = 'touch-ripple';
      ripple.style.left = `${clientX}px`;
      ripple.style.top = `${clientY}px`;
      touchRipplesContainer.appendChild(ripple);
      setTimeout(() => ripple.remove(), 400);
    }

    // Fullscreen Toggle with SVG Icons
    function updateFsIcons() {
      const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
      if (fsExpandIcon && fsCompressIcon) {
        fsExpandIcon.classList.toggle('hidden', isFs);
        fsCompressIcon.classList.toggle('hidden', !isFs);
      }
    }

    if (btnFullscreen) {
      btnFullscreen.addEventListener('click', () => {
        const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
        if (!isFs) {
          if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(() => {});
          } else if (document.documentElement.webkitRequestFullscreen) {
            document.documentElement.webkitRequestFullscreen();
          }
        } else {
          if (document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
          } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
          }
        }
      });

      document.addEventListener('fullscreenchange', updateFsIcons);
      document.addEventListener('webkitfullscreenchange', updateFsIcons);
    }

    // Dismiss Orientation Hint
    if (btnDismissHint) {
      btnDismissHint.addEventListener('click', (e) => {
        e.stopPropagation();
        hintDismissed = true;
        if (orientationHint) orientationHint.classList.remove('visible');
      });
    }

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        toggleScope();
      } else if (e.key === 'q' || e.key === 'Q') {
        activateZen();
      } else if (e.key === 'e' || e.key === 'E') {
        activateRadar();
      } else if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        if (state.isPaused) resumeGame();
        else pauseGame();
      }
    });

    // HUD Buttons
    btnToggleScope.addEventListener('click', toggleScope);
    btnZen.addEventListener('click', activateZen);
    btnRadar.addEventListener('click', activateRadar);

    btnSoundToggle.addEventListener('click', () => {
      const enabled = window.soundEngine.toggleSound();
      btnSoundToggle.textContent = enabled ? '🔊' : '🔇';
    });

    btnPause.addEventListener('click', () => {
      if (state.isPaused) resumeGame();
      else pauseGame();
    });

    // Mode selection
    modeCards.forEach((card) => {
      card.addEventListener('click', () => {
        modeCards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        state.mode = card.dataset.mode;
      });
    });

    // Modal Buttons
    document.getElementById('btn-start-game').addEventListener('click', startGame);
    document.getElementById('btn-restart').addEventListener('click', startGame);

    document.getElementById('btn-how-to-play').addEventListener('click', () => {
      howModal.classList.remove('hidden');
      howModal.classList.add('active');
    });
    document.getElementById('btn-close-how').addEventListener('click', () => {
      howModal.classList.add('hidden');
      howModal.classList.remove('active');
    });

    document.getElementById('btn-view-records').addEventListener('click', () => {
      trophyModal.classList.remove('hidden');
      trophyModal.classList.add('active');
    });
    document.getElementById('btn-close-trophy').addEventListener('click', () => {
      trophyModal.classList.add('hidden');
      trophyModal.classList.remove('active');
    });

    document.getElementById('btn-main-menu').addEventListener('click', () => {
      gameoverModal.classList.add('hidden');
      gameoverModal.classList.remove('active');
      if (hudLayer) hudLayer.classList.add('hidden');
      startScreen.classList.add('active');
    });

    document.getElementById('btn-resume').addEventListener('click', resumeGame);
    document.getElementById('btn-quit-to-menu').addEventListener('click', () => {
      state.isPlaying = false;
      pauseModal.classList.add('hidden');
      pauseModal.classList.remove('active');
      if (hudLayer) hudLayer.classList.add('hidden');
      startScreen.classList.add('active');
    });
  }

  // --- Initialization ---
  function init() {
    loadRecords();
    initAmbientElements();
    handleResize();
    setupEvents();
    requestAnimationFrame(gameLoop);
  }

  init();
})();
