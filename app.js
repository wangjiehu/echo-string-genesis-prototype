const TAGS = {
  "Semantic.Structure.Closed": { name: "封闭", slot: "Structure", color: "#B88CFF", extract: 1, inject: 2, compatible: ["Door", "Gate", "Mechanism", "Enemy", "Boss"] },
  "Semantic.Structure.Solid": { name: "坚固", slot: "Structure", color: "#9AA5B1", extract: 1, inject: 2, compatible: ["Door", "Stone", "Enemy", "Boss", "Mechanism"] },
  "Semantic.Structure.Fragile": { name: "脆弱", slot: "Structure", color: "#F2D36B", extract: 1, inject: 2, compatible: ["Door", "Stone", "Enemy", "Boss", "Mechanism", "Debris"] },
  "Semantic.Mass.Heavy": { name: "沉重", slot: "Mass", color: "#6B5B4A", extract: 1, inject: 2, compatible: ["Stone", "Enemy", "Boss", "Platform", "Mechanism", "Debris"] },
  "Semantic.Mass.Light": { name: "轻盈", slot: "Mass", color: "#9EE7FF", extract: 1, inject: 2, compatible: ["Stone", "Enemy", "Boss", "Platform", "Mechanism", "Debris"] },
  "Semantic.Temperature.Overheated": { name: "过热", slot: "Temperature", color: "#FF7043", extract: 1, inject: 3, compatible: ["Enemy", "Boss", "Water", "Ice", "Door", "Mechanism", "FireSource", "Stone"] },
  "Semantic.Temperature.Frozen": { name: "冻结", slot: "Temperature", color: "#72C9FF", extract: 1, inject: 3, compatible: ["Enemy", "Boss", "Water", "Mechanism", "Platform", "Door"] },
  "Semantic.Medium.Wet": { name: "潮湿", slot: "Medium", color: "#3FA7D6", extract: 1, inject: 2, compatible: ["Enemy", "Boss", "Stone", "Door", "Mechanism", "Water", "Debris"] },
  "Semantic.Field.Attract": { name: "吸引", slot: "Field", color: "#8A7CFF", extract: 1, inject: 3, compatible: ["FieldPillar", "Enemy", "Boss", "Mechanism", "Debris", "Stone"] },
  "Semantic.Field.Repel": { name: "排斥", slot: "Field", color: "#47D18C", extract: 1, inject: 3, compatible: ["FieldPillar", "Enemy", "Boss", "Mechanism", "Debris", "Stone"] }
};

/* ==========================================================================
   Echo Audio Engine (Web Audio API Synthesizer)
   ========================================================================== */
class EchoAudioEngine {
  constructor() {
    this.ctx = null;
    this.bgmGain = null;
    this.masterGain = null;
    this.sfxVolume = 0.7;
    this.bgmVolume = 0.4;
    this.initialized = false;
    this.isMuted = false;
    this.bgmTimeout = null;
  }

  init() {
    if (this.initialized) return;
    if (typeof window === "undefined" || typeof document === "undefined" || window.navigator?.webdriver || document.body?.dataset?.domClickMode || window.__echoRuntimeIsTesting) {
      this.isMuted = true;
      this.initialized = true;
      return;
    }
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) {
        this.isMuted = true;
        this.initialized = true;
        return;
      }
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      this.masterGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
      this.initialized = true;
      this.startBgm();
    } catch (e) {
      this.isMuted = true;
      this.initialized = true;
      console.warn("Web Audio Context initialization failed:", e);
    }
  }

  setSfxVolume(vol) {
    this.sfxVolume = vol;
  }

  setBgmVolume(vol) {
    this.bgmVolume = vol;
    if (this.bgmGain && this.ctx) {
      this.bgmGain.gain.setValueAtTime(vol * 0.15, this.ctx.currentTime);
    }
  }

  playSfx(type) {
    if (!this.initialized || this.isMuted || !this.ctx) return;
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.masterGain);

      if (type === "scan") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(150, now + 0.35);
        gain.gain.setValueAtTime(this.sfxVolume * 0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === "extract") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.linearRampToValueAtTime(580, now + 0.22);
        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(this.sfxVolume * 0.3, now + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.22);
      } else if (type === "inject") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(130, now);
        osc.frequency.linearRampToValueAtTime(50, now + 0.18);
        gain.gain.setValueAtTime(this.sfxVolume * 0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.18);

        // Add mechanical click noise
        const bufferSize = this.ctx.sampleRate * 0.1;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(150, now);
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(this.sfxVolume * 0.15, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.masterGain);
        noise.start(now);
        noise.stop(now + 0.1);
      } else if (type === "reaction") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.6);
        gain.gain.setValueAtTime(this.sfxVolume * 0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

        const osc2 = this.ctx.createOscillator();
        const gain2 = this.ctx.createGain();
        osc2.type = "triangle";
        osc2.frequency.setValueAtTime(660, now);
        osc2.frequency.linearRampToValueAtTime(220, now + 0.45);
        osc2.connect(gain2);
        gain2.connect(this.masterGain);
        gain2.gain.setValueAtTime(this.sfxVolume * 0.2, now);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

        osc.start(now);
        osc.stop(now + 0.6);
        osc2.start(now);
        osc2.stop(now + 0.45);
      } else if (type === "strike") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.linearRampToValueAtTime(120, now + 0.15);
        gain.gain.setValueAtTime(this.sfxVolume * 0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

        const osc2 = this.ctx.createOscillator();
        const gain2 = this.ctx.createGain();
        osc2.type = "sawtooth";
        osc2.frequency.setValueAtTime(850, now);
        osc2.connect(gain2);
        gain2.connect(this.masterGain);
        gain2.gain.setValueAtTime(this.sfxVolume * 0.08, now);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        osc.start(now);
        osc.stop(now + 0.18);
        osc2.start(now);
        osc2.stop(now + 0.08);
      } else if (type === "parry") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(1100, now);
        osc.frequency.linearRampToValueAtTime(650, now + 0.25);
        gain.gain.setValueAtTime(this.sfxVolume * 0.45, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        osc.start(now);
        osc.stop(now + 0.28);
      } else if (type === "error") {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.linearRampToValueAtTime(120, now + 0.18);
        gain.gain.setValueAtTime(this.sfxVolume * 0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.18);
      } else if (type === "success") {
        const sequence = [440, 554.37, 659.25, 880]; // A4 C#5 E5 A5
        sequence.forEach((freq, idx) => {
          const sOsc = this.ctx.createOscillator();
          const sGain = this.ctx.createGain();
          sOsc.type = "sine";
          sOsc.frequency.setValueAtTime(freq, now + idx * 0.08);
          sOsc.connect(sGain);
          sGain.connect(this.masterGain);
          sGain.gain.setValueAtTime(this.sfxVolume * 0.18, now + idx * 0.08);
          sGain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.25);
          sOsc.start(now + idx * 0.08);
          sOsc.stop(now + idx * 0.08 + 0.25);
        });
      } else if (type === "hover") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(1400, now);
        osc.frequency.linearRampToValueAtTime(900, now + 0.025);
        gain.gain.setValueAtTime(this.sfxVolume * 0.02, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
        osc.start(now);
        osc.stop(now + 0.025);
      }
    } catch (e) {
      console.warn("SFX play failed:", e);
    }
  }

  startBgm() {
    if (!this.initialized || this.isMuted || !this.ctx) return;
    try {
      this.bgmGain = this.ctx.createGain();
      this.bgmGain.connect(this.masterGain);
      this.bgmGain.gain.setValueAtTime(this.bgmVolume * 0.15, this.ctx.currentTime);

      const playPad = () => {
        if (!this.ctx || this.isMuted) return;
        try {
          const padNow = this.ctx.currentTime;
          const osc = this.ctx.createOscillator();
          const filter = this.ctx.createBiquadFilter();
          const padGain = this.ctx.createGain();

          osc.type = "triangle";
          const chord = [73.42, 87.31, 110.00, 130.81]; // D2 F2 A2 C3 (Low Dm7)
          const baseFreq = chord[Math.floor(Math.random() * chord.length)];
          osc.frequency.setValueAtTime(baseFreq, padNow);
          osc.frequency.linearRampToValueAtTime(baseFreq * 1.008, padNow + 5.5);

          filter.type = "lowpass";
          filter.frequency.setValueAtTime(200, padNow);
          filter.frequency.exponentialRampToValueAtTime(350, padNow + 2.5);
          filter.frequency.exponentialRampToValueAtTime(200, padNow + 5.5);

          padGain.gain.setValueAtTime(0, padNow);
          padGain.gain.linearRampToValueAtTime(0.5, padNow + 1.8);
          padGain.gain.linearRampToValueAtTime(0.5, padNow + 3.8);
          padGain.gain.linearRampToValueAtTime(0, padNow + 5.5);

          osc.connect(filter);
          filter.connect(padGain);
          padGain.connect(this.bgmGain);

          osc.start(padNow);
          osc.stop(padNow + 5.6);
        } catch (err) {}

        this.bgmTimeout = setTimeout(playPad, 5000);
      };

      playPad();
    } catch (e) {
      console.warn("BGM start failed:", e);
    }
  }

  stopBgm() {
    if (this.bgmTimeout) clearTimeout(this.bgmTimeout);
    if (this.bgmGain) {
      try {
        this.bgmGain.disconnect();
      } catch (e) {}
      this.bgmGain = null;
    }
  }
}

const audio = new EchoAudioEngine();

if (typeof window !== "undefined") {
  window.addEventListener("click", () => {
    audio.init();
  }, { once: true });
}

/* ==========================================================================
   Save & Load (LocalStorage)
   ========================================================================== */
function saveGameToLocal() {
  if (typeof window === "undefined" || typeof localStorage === "undefined" || window.navigator?.webdriver || document.body?.dataset?.domClickMode || window.__echoRuntimeIsTesting) return;
  try {
    const saveData = {
      zone: state.zone,
      ink: state.ink,
      inventory: state.inventory,
      flags: state.flags,
      unlockedZones: state.unlockedZones || ["Z1"],
      theme: state.theme
    };
    const currentZoneId = zone().id;
    if (!saveData.unlockedZones.includes(currentZoneId)) {
      saveData.unlockedZones.push(currentZoneId);
    }
    localStorage.setItem("echo_string_save_v1.1", JSON.stringify(saveData));
  } catch (e) {
    console.warn("LocalStorage save failed:", e);
  }
}

function loadGameFromLocal() {
  if (typeof window === "undefined" || typeof localStorage === "undefined" || window.navigator?.webdriver || document.body?.dataset?.domClickMode || window.__echoRuntimeIsTesting) return;
  try {
    const raw = localStorage.getItem("echo_string_save_v1.1");
    if (!raw) {
      applyTheme();
      return;
    }
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.zone === "number") {
      state.zone = parsed.zone;
      state.ink = parsed.ink;
      state.inventory = parsed.inventory || [];
      state.flags = parsed.flags || {};
      state.unlockedZones = parsed.unlockedZones || ["Z1"];
      state.theme = parsed.theme || "dark";
      state.zones = freshZones();
      state.flags = { ...state.flags, ...parsed.flags };
      applyTheme();
      log("本地从存档自动载入成功，欢迎回来。", "good");
    } else {
      applyTheme();
    }
  } catch (e) {
    console.warn("LocalStorage load failed:", e);
    applyTheme();
  }
}

function applyTheme() {
  if (typeof document === "undefined") return;
  if (state.theme === "light") {
    document.body.classList.add("theme-light");
    if (el.themeToggleBtn) el.themeToggleBtn.textContent = "☀️ 亮色";
  } else {
    document.body.classList.remove("theme-light");
    if (el.themeToggleBtn) el.themeToggleBtn.textContent = "🌙 暗色";
  }
}

function triggerScreenShake(intensity = 'medium') {
  if (typeof document === "undefined" || window.navigator?.webdriver || document.body?.dataset?.domClickMode || window.__echoRuntimeIsTesting) return;
  const target = document.querySelector(".app-shell") || document.body;
  if (!target) return;
  target.classList.remove("screen-shake-medium", "screen-shake-heavy");
  void target.offsetWidth; // force reflow
  target.classList.add(`screen-shake-${intensity}`);
  setTimeout(() => {
    target.classList.remove(`screen-shake-${intensity}`);
  }, 400);
}

/* ==========================================================================
   VFX & VFX Utilities (Floating Damage and Reaction Ripples)
   ========================================================================== */
function spawnFloatingDamage(amount, targetId, isCritical = false, isParry = false) {
  if (typeof document === "undefined") return;
  const container = document.getElementById("effectsContainer");
  if (!container) return;
  const elCard = document.querySelector(`[data-object-id="${targetId}"]`);
  if (!elCard) return;
  const rect = elCard.getBoundingClientRect();
  
  const dam = document.createElement("div");
  dam.className = `floating-damage${isCritical ? " critical" : ""}${isParry ? " parry-text" : ""}`;
  dam.style.left = `${rect.left + rect.width / 2 + (Math.random() * 40 - 20)}px`;
  dam.style.top = `${rect.top + rect.height / 2 - 20}px`;
  dam.textContent = amount;
  container.appendChild(dam);
  setTimeout(() => {
    dam.remove();
  }, 800);
}

function triggerVisualRipple(reactionId, targetId) {
  if (typeof document === "undefined") return;
  const container = document.getElementById("effectsContainer");
  if (!container) return;
  
  const elCard = document.querySelector(`[data-object-id="${targetId}"]`);
  let x = window.innerWidth / 2;
  let y = window.innerHeight / 2;
  if (elCard) {
    const rect = elCard.getBoundingClientRect();
    x = rect.left + rect.width / 2;
    y = rect.top + rect.height / 2;
  }

  const overlay = document.createElement("div");
  overlay.className = "reaction-ripple-overlay";
  
  const circle = document.createElement("div");
  let cls = "field";
  if (reactionId === "Reaction.SteamBurst") cls = "steam";
  else if (reactionId === "Reaction.FractureWindow") cls = "fracture";
  circle.className = `ripple-circle ${cls}`;
  circle.style.left = `${x}px`;
  circle.style.top = `${y}px`;
  circle.style.transform = "translate(-50%, -50%)";

  overlay.appendChild(circle);
  container.appendChild(overlay);
  setTimeout(() => {
    overlay.remove();
  }, 1300);
}

const TEST_MODES = {
  guided: "引导",
  low: "低引导",
  debug: "调试"
};

const BUILD_LABEL = "1.0.0";
const BUILD_NAME = "Public Playtest";
const BUILD_ROLLOUT = [
  { version: "UX11", focus: "低引导自动回归" },
  { version: "UX12", focus: "卡点与软锁审计" },
  { version: "UX13", focus: "通关质量评分" },
  { version: "UX14", focus: "Boss反制路线账本" },
  { version: "UX15", focus: "检查点恢复" },
  { version: "UX16", focus: "回归套件入口" },
  { version: "UX17", focus: "报告结构增强" },
  { version: "UX18", focus: "完成面板复盘增强" },
  { version: "UX19", focus: "验证脚本加严" },
  { version: "UX20", focus: "生产文档收口" },
  { version: "UX21", focus: "真人试玩反馈硬化" },
  { version: "1.0.0", focus: "公开发布与圆润视觉系统" }
];

const TAG_CAUSES = {
  "Semantic.Structure.Closed": "阻断通路或机关，需要替换结构词。",
  "Semantic.Structure.Solid": "让目标更难破坏，战斗中优先考虑剥离。",
  "Semantic.Structure.Fragile": "让结构更容易被重击破坏。",
  "Semantic.Mass.Heavy": "增加重量，可压机关但移动困难。",
  "Semantic.Mass.Light": "降低重量，便于推动或击飞。",
  "Semantic.Temperature.Overheated": "提供热源，可融冰并触发蒸汽。",
  "Semantic.Temperature.Frozen": "冻结目标，也能制造破裂窗口。",
  "Semantic.Medium.Wet": "自身不强，主要用于和过热组合。",
  "Semantic.Field.Attract": "把碎片或敌人拉向中心。",
  "Semantic.Field.Repel": "把碎片或敌人推离中心。"
};

const LOW_OBJECTIVES = {
  Z1: "打开被封住的庭院入口。",
  Z2: "让石块先移动，再让机关获得足够重量。",
  Z3: "清理断廊游兵，观察防御状态怎么影响伤害。",
  Z4: "解除冰封，并利用环境反应改变战斗局面。",
  Z5: "让碎片按正确方向移动，形成临时桥面。",
  Z6: "逐层拆开守卫护文，再处理裸露核心。",
  Z7: "查看切片结果并复盘本轮路径。"
};

const ZONES = [
  {
    id: "Z1",
    name: "封文大门",
    objective: "从裂纹石像剥离“脆弱”，注入封文大门，再用重击破门。",
    reflection: "第一段只验证最小闭环：看见词、取走词、写入词、看到世界变化。",
    objects: [
      object("gate", "封文大门", "Door", "门", ["Semantic.Structure.Closed", "Semantic.Structure.Solid"], [], ["Structure"], []),
      object("statue", "裂纹石像", "Stone", "像", ["Semantic.Structure.Fragile"], ["Semantic.Structure.Fragile"], ["Structure", "Mass"], [])
    ],
    complete: (s) => s.flags.gateDestroyed
  },
  {
    id: "Z2",
    name: "压机关庭",
    objective: "把压机关石变轻后推到机关板，再恢复沉重压住机关。",
    reflection: "质量词不能只像钥匙。轻盈负责移动，沉重负责产生压力。",
    objects: [
      object("block", "压机关石", "Stone", "石", ["Semantic.Mass.Heavy"], ["Semantic.Mass.Heavy"], ["Mass", "Structure"], []),
      object("tablet", "浮字碑", "Mechanism", "轻", ["Semantic.Mass.Light"], ["Semantic.Mass.Light"], ["Mass"], []),
      object("plate", "地面机关", "Mechanism", "机", [], [], [], [])
    ],
    complete: (s) => s.flags.platePressed
  },
  {
    id: "Z3",
    name: "断廊遭遇",
    objective: "通过弹反或重击打开语义破绽，剥离坚固或注入脆弱击败游兵。",
    reflection: "战斗里只显示关键槽位，避免玩家被数据库淹没。",
    objects: [
      enemy("guardA", "字壳游兵A", ["Semantic.Structure.Solid"], 38),
      enemy("guardB", "字壳游兵B", ["Semantic.Structure.Fragile"], 28)
    ],
    complete: (s) => zoneObjects(s).every((o) => o.defeated)
  },
  {
    id: "Z4",
    name: "冻水温室",
    objective: "用过热解除冰封，再把过热与潮湿组合成蒸汽爆发。",
    reflection: "潮湿必须马上接上反应收益，否则它会被玩家误认为弱词。",
    objects: [
      object("lift", "冰封升降台", "Mechanism", "台", ["Semantic.Temperature.Frozen"], [], ["Temperature"], []),
      object("pool", "冻结水池", "Water", "水", ["Semantic.Temperature.Frozen", "Semantic.Medium.Wet"], ["Semantic.Temperature.Frozen", "Semantic.Medium.Wet"], ["Temperature", "Medium"], [], true),
      object("brazier", "火盆", "FireSource", "火", ["Semantic.Temperature.Overheated"], ["Semantic.Temperature.Overheated"], ["Temperature"], ["Temperature"], true),
      enemy("beast", "缀刺兽", ["Semantic.Mass.Heavy", "Semantic.Temperature.Overheated"], 48)
    ],
    complete: (s) => s.flags.liftMelted && s.flags.steamBurst
  },
  {
    id: "Z5",
    name: "碎桥力场",
    objective: "用吸引聚拢碎片，再用排斥推入锚点形成桥面。",
    reflection: "物理谜题必须少量关键碎片，失控时宁可重置，不靠玩家忍耐。",
    objects: [
      object("pullPillar", "吸引力场柱", "FieldPillar", "引", ["Semantic.Field.Attract"], ["Semantic.Field.Attract"], ["Field"], []),
      object("pushPillar", "排斥力场柱", "FieldPillar", "斥", ["Semantic.Field.Repel"], ["Semantic.Field.Repel"], ["Field"], []),
      object("debris", "桥面碎片", "Debris", "桥", ["Semantic.Mass.Light"], [], ["Mass", "Field"], [])
    ],
    complete: (s) => s.flags.bridgeFormed
  },
  {
    id: "Z6",
    name: "残章中庭",
    objective: "用环境词缀削掉三层护文，结构槽开放后注入脆弱并重击核心。",
    reflection: "Boss不是背词表考试。每阶段只问玩家一个问题：我该从环境取什么词反制它？",
    objects: [
      boss("warden", "残章守卫", ["Semantic.Structure.Solid", "Semantic.Mass.Heavy"]),
      object("bossPool", "潮湿水纹", "Water", "水", ["Semantic.Medium.Wet"], ["Semantic.Medium.Wet"], ["Medium"], [], true),
      object("bossFire", "过热火盆", "FireSource", "火", ["Semantic.Temperature.Overheated"], ["Semantic.Temperature.Overheated"], ["Temperature"], ["Temperature"], true),
      object("bossIce", "冻结残页", "Mechanism", "冰", ["Semantic.Temperature.Frozen"], ["Semantic.Temperature.Frozen"], ["Temperature"], [], true),
      object("bossPull", "吸引残柱", "FieldPillar", "引", ["Semantic.Field.Attract"], ["Semantic.Field.Attract"], ["Field"], [], true),
      object("bossPush", "排斥残柱", "FieldPillar", "斥", ["Semantic.Field.Repel"], ["Semantic.Field.Repel"], ["Field"], [], true),
      object("bossTablet", "裂纹石碑", "Stone", "裂", ["Semantic.Structure.Fragile"], ["Semantic.Structure.Fragile"], ["Structure"], [], true)
    ],
    complete: (s) => s.flags.bossDefeated
  },
  {
    id: "Z7",
    name: "修正文库门槛",
    objective: "切片完成。这里只展示后期系统伏笔，不解锁新机制。",
    reflection: "结尾不再加新规则，让玩家带着刚建立的理解离开。",
    objects: [
      object("archive", "未授权文库", "Mechanism", "库", [], [], [], [])
    ],
    complete: () => true
  }
];

function freshZones() {
  return ZONES.map((zoneConfig) => ({
    ...zoneConfig,
    objects: zoneConfig.objects.map((item) => structuredClone(item))
  }));
}

function object(id, name, type, glyph, tags, provides, openSlots, lockedSlots, persistentSource = false) {
  return {
    id,
    name,
    type,
    glyph,
    currentTags: [...tags],
    providesTags: [...provides],
    openSlots: [...openSlots],
    lockedSlots: [...lockedSlots],
    persistentSource,
    scanned: false,
    hp: null,
    breach: false
  };
}

function enemy(id, name, tags, hp) {
  const e = object(id, name, "Enemy", "敌", tags, tags.filter((tag) => tag !== "Semantic.Structure.Fragile"), ["Structure", "Mass", "Temperature", "Medium", "Field"], []);
  e.hp = hp;
  e.maxHp = hp;
  return e;
}

function boss(id, name, tags) {
  const b = object(id, name, "Boss", "守", tags, ["Semantic.Structure.Solid", "Semantic.Mass.Heavy"], ["Structure", "Mass", "Temperature", "Medium", "Field"], ["Structure"]);
  b.hp = 90;
  b.maxHp = 90;
  b.shieldLayers = 3;
  return b;
}

const state = {
  sessionId: createSessionId(),
  zone: 0,
  testMode: "guided",
  ink: 12,
  maxInk: 12,
  inventory: [],
  selectedObjectId: null,
  selectedTagId: null,
  selectedInventoryIndex: null,
  zones: freshZones(),
  flags: {},
  metrics: createMetrics(),
  undoStack: [],
  checkpoints: {},
  log: [],
  lastFeedback: null,
  unlockedZones: ["Z1"],
  completionSfxPlayed: false,
  theme: "dark"
};

const el = {
  inkValue: document.getElementById("inkValue"),
  inventoryCount: document.getElementById("inventoryCount"),
  zoneIndex: document.getElementById("zoneIndex"),
  elapsedValue: document.getElementById("elapsedValue"),
  zoneList: document.getElementById("zoneList"),
  zoneTitle: document.getElementById("zoneTitle"),
  zoneObjective: document.getElementById("zoneObjective"),
  nextHint: document.getElementById("nextHint"),
  resultPulse: document.getElementById("resultPulse"),
  decisionStrip: document.getElementById("decisionStrip"),
  stepList: document.getElementById("stepList"),
  sceneMap: document.getElementById("sceneMap"),
  contextActions: document.getElementById("contextActions"),
  actionHelp: document.getElementById("actionHelp"),
  selectedHint: document.getElementById("selectedHint"),
  inspector: document.getElementById("inspector"),
  inventoryList: document.getElementById("inventoryList"),
  eventLog: document.getElementById("eventLog"),
  reflectionBox: document.getElementById("reflectionBox"),
  metricsBox: document.getElementById("metricsBox"),
  sessionStatus: document.getElementById("sessionStatus"),
  undoBtn: document.getElementById("undoBtn"),
  checkpointBtn: document.getElementById("checkpointBtn"),
  shareLinkBtn: document.getElementById("shareLinkBtn"),
  restartSessionBtn: document.getElementById("restartSessionBtn"),
  completionPanel: document.getElementById("completionPanel"),
  reportData: document.getElementById("reportData"),
  modeButtons: Array.from(document.querySelectorAll("[data-mode]")),
  resetBtn: document.getElementById("resetBtn"),
  clearInventoryBtn: document.getElementById("clearInventoryBtn"),
  refillInkBtn: document.getElementById("refillInkBtn"),
  resetZoneBtn: document.getElementById("resetZoneBtn"),
  downloadReportBtn: document.getElementById("downloadReportBtn"),
  themeToggleBtn: document.getElementById("themeToggleBtn"),
  travelMapBtn: document.getElementById("travelMapBtn"),
  toggleLogsBtn: document.getElementById("toggleLogsBtn"),
  closeTravelBtn: document.getElementById("closeTravelBtn"),
  closeInspectorBtn: document.getElementById("closeInspectorBtn"),
  zonePanel: document.querySelector(".zone-panel"),
  inspectorPanel: document.querySelector(".inspector-panel"),
  bottomPanel: document.querySelector(".bottom-panel")
};

function zone() {
  return state.zones[state.zone];
}

function zoneObjects(s = state) {
  return s.zones[s.zone].objects;
}

function selectedObject() {
  return zoneObjects().find((o) => o.id === state.selectedObjectId) || null;
}

function tag(id) {
  return TAGS[id];
}

function tagName(id) {
  return TAGS[id]?.name || id;
}

function tagCause(id) {
  return TAG_CAUSES[id] || "观察它能作用的槽位和对象。";
}

function isFinalZone() {
  return state.zone === state.zones.length - 1;
}

function isCompleted() {
  return state.metrics.completedAt != null;
}

function createSessionId() {
  const time = new Date();
  const stamp = [
    time.getFullYear(),
    String(time.getMonth() + 1).padStart(2, "0"),
    String(time.getDate()).padStart(2, "0"),
    String(time.getHours()).padStart(2, "0"),
    String(time.getMinutes()).padStart(2, "0"),
    String(time.getSeconds()).padStart(2, "0")
  ].join("");
  return `DUANJU-${stamp}`;
}

function createMetrics(testMode = "guided") {
  return {
    testMode,
    startedAt: Date.now(),
    completedAt: null,
    zoneVisitStartSec: 0,
    firstScanSec: null,
    firstExtractSec: null,
    firstInjectSec: null,
    scans: 0,
    extracts: 0,
    injects: 0,
    reactions: 0,
    reactionCounts: {
      SteamBurst: 0,
      FractureWindow: 0,
      FieldPulse: 0
    },
    warnings: 0,
    blockedActions: 0,
    heavyStrikes: 0,
    parries: 0,
    bossSemanticActions: 0,
    bossPhaseCounters: [],
    checkpointSaves: 0,
    checkpointRestores: 0,
    routeAssertions: [],
    regressionRuns: [],
    debugRecoveries: 0,
    shortcutsUsed: 0,
    undoUses: 0,
    failureCounts: {},
    failureEvents: [],
    feedbackEvents: [],
    playtestNotes: [],
    zoneVisits: { Z1: 1 },
    zoneCompletions: [],
    zoneDurations: [],
    modeChanges: [{ mode: testMode, label: TEST_MODES[testMode], t: 0, zone: "Z1" }],
    timeline: []
  };
}

function elapsedSeconds() {
  return Math.max(0, Math.round((Date.now() - state.metrics.startedAt) / 1000));
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function markFirst(key) {
  if (state.metrics[key] == null) state.metrics[key] = elapsedSeconds();
}

function currentModeLabel() {
  return TEST_MODES[state.testMode] || state.testMode;
}

function setTestMode(mode) {
  if (!TEST_MODES[mode] || state.testMode === mode) return;
  state.testMode = mode;
  state.metrics.testMode = mode;
  state.metrics.modeChanges.push({
    mode,
    label: TEST_MODES[mode],
    t: elapsedSeconds(),
    zone: zone().id
  });
  log(`测试模式切换为：${TEST_MODES[mode]}。`);
  render();
}

function applyInitialModeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");
  if (!TEST_MODES[mode] || state.testMode === mode) return;
  state.testMode = mode;
  state.metrics.testMode = mode;
  state.metrics.modeChanges = [{ mode, label: TEST_MODES[mode], t: 0, zone: "Z1" }];
}

function recordZoneDuration(outcome) {
  const start = state.metrics.zoneVisitStartSec ?? 0;
  const end = elapsedSeconds();
  state.metrics.zoneDurations.push({
    zone: zone().id,
    mode: state.testMode,
    startedAtSec: start,
    endedAtSec: end,
    durationSec: Math.max(0, end - start),
    outcome
  });
  state.metrics.zoneVisitStartSec = end;
}

function zoneDurationsSnapshot() {
  const durations = structuredClone(state.metrics.zoneDurations);
  const end = state.metrics.completedAt ?? elapsedSeconds();
  const start = state.metrics.zoneVisitStartSec ?? 0;
  durations.push({
    zone: zone().id,
    mode: state.testMode,
    startedAtSec: start,
    endedAtSec: end,
    durationSec: Math.max(0, end - start),
    outcome: isCompleted() ? "slice-complete" : "active"
  });
  return durations;
}

function activeZoneElapsedSec() {
  return Math.max(0, elapsedSeconds() - (state.metrics.zoneVisitStartSec ?? 0));
}

function reportSummary() {
  const durations = zoneDurationsSnapshot();
  const completedDurations = durations.filter((item) => item.outcome !== "active");
  const longestZone = durations.reduce((longest, item) => {
    if (!longest || item.durationSec > longest.durationSec) return item;
    return longest;
  }, null);
  return {
    mode: state.testMode,
    modeLabel: currentModeLabel(),
    totalMistakes: state.metrics.warnings + state.metrics.blockedActions,
    completedZones: completedDurations.length,
    activeZoneElapsedSec: activeZoneElapsedSec(),
    longestZone
  };
}

function reactionLedger() {
  return Object.entries(state.metrics.reactionCounts).map(([key, count]) => ({
    reaction: key,
    label: reactionName(`Reaction.${key}`),
    count
  }));
}

function failureLabel(category) {
  const labels = {
    "tag-unavailable": "目标不提供该词",
    "inventory-full": "词库已满",
    "slot-missing": "目标缺槽",
    "slot-locked": "槽位锁定",
    "ink-low": "原墨不足",
    incompatible: "对象不兼容",
    regression: "回归异常",
    general: "一般阻塞"
  };
  return labels[category] || category;
}

function failureLedger() {
  return Object.entries(state.metrics.failureCounts)
    .map(([category, count]) => ({
      category,
      label: failureLabel(category),
      count,
      latest: state.metrics.failureEvents.find((item) => item.category === category)?.message || ""
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "zh-Hans-CN"));
}

function experienceAudit() {
  const summary = reportSummary();
  const failureItems = failureLedger();
  const latestFailure = state.metrics.failureEvents[0] || null;
  const frictions = [];
  const strengths = [];
  const nextFixes = [];
  const mistakes = state.metrics.warnings + state.metrics.blockedActions;

  if (state.metrics.firstScanSec != null) strengths.push(`首扫 ${formatTime(state.metrics.firstScanSec)}，玩家能进入扫描闭环。`);
  if (Object.values(state.metrics.reactionCounts).filter((count) => count > 0).length >= 3) strengths.push("组合反应覆盖完整。");
  if (state.metrics.bossPhaseCounters.length >= 3) strengths.push("Boss三层护文都被不同反制击破。");
  if (state.metrics.feedbackEvents.length >= 8) strengths.push("操作反馈事件充足，可复盘关键路径。");

  if (latestFailure) {
    frictions.push(`最近阻塞：${failureLabel(latestFailure.category)} / ${latestFailure.message}`);
    nextFixes.push("优先检查最近阻塞对应的按钮禁用原因和扫描器预览。");
  }
  failureItems
    .filter((item) => item.count > 0)
    .slice(0, 3)
    .forEach((item) => frictions.push(`${item.label}出现 ${item.count} 次。`));
  if (summary.longestZone?.durationSec >= 90) {
    frictions.push(`${summary.longestZone.zone} 停留超过90秒。`);
    nextFixes.push("复查最长区域的下一步提示、对象高亮和行动反馈。");
  }
  if (state.testMode === "low" && mistakes > 0) {
    frictions.push("低引导模式出现误操作，需要判断是探索成本还是提示缺口。");
    nextFixes.push("低引导只补结果反馈，不直接暴露完整解法。");
  }
  if (state.metrics.checkpointRestores > 0) {
    frictions.push(`本轮依赖检查点恢复 ${state.metrics.checkpointRestores} 次。`);
  }
  if (!state.metrics.feedbackEvents.length) {
    frictions.push("尚无操作反馈事件。");
    nextFixes.push("先完成一次扫描，确认第一屏是否建立输入预期。");
  }

  const headline = frictions.length
    ? "存在可定位体验摩擦"
    : isCompleted()
      ? "路径稳定，适合真人低引导复测"
      : "当前体验暂无明显阻塞";

  return {
    headline,
    status: frictions.length ? "watch" : "clear",
    strengths: strengths.slice(0, 4),
    frictions: [...new Set(frictions)].slice(0, 5),
    nextFixes: [...new Set(nextFixes)].slice(0, 4),
    latestFailure,
    failureLedger: failureItems
  };
}

function currentAudit() {
  const mistakes = state.metrics.warnings + state.metrics.blockedActions;
  const reactionTypes = Object.values(state.metrics.reactionCounts).filter((count) => count > 0).length;
  const bossCounterTypes = new Set(state.metrics.bossPhaseCounters.map((item) => item.reaction)).size;
  const recovery = recoveryState();
  const risks = [...recovery.issues];
  const experience = experienceAudit();
  const failedAssertions = state.metrics.routeAssertions.filter((item) => !item.passed);
  failedAssertions.forEach((item) => risks.push(`回归断言失败：${item.label}`));
  experience.frictions.slice(0, 2).forEach((item) => risks.push(item));
  if (state.inventory.length >= 3) risks.push("词库已满。");
  if (!state.checkpoints[zone().id] && !isCompleted()) risks.push("当前区域缺少检查点。");
  if (state.zone >= 5 && bossCounterTypes < 3 && !state.flags.bossDefeated) risks.push("Boss反制覆盖不足。");
  const score = Math.max(0, Math.min(100,
    70 +
    reactionTypes * 4 +
    (bossCounterTypes >= 3 ? 12 : 0) +
    (isCompleted() ? 8 : 0) -
    mistakes * 8 -
    failedAssertions.length * 20 -
    state.metrics.undoUses * 3 -
    state.metrics.checkpointRestores * 5
  ));
  return {
    score,
    grade: score >= 90 ? "S" : score >= 78 ? "A" : score >= 64 ? "B" : "C",
    mistakes,
    reactionTypes,
    bossCounterTypes,
    risks: [...new Set(risks)].slice(0, 5)
  };
}

function log(message, type = "", category = "general") {
  const event = {
    message,
    type: type || "info",
    category,
    t: elapsedSeconds(),
    zone: zone().id,
    mode: state.testMode,
    selectedObjectId: state.selectedObjectId,
    selectedTagId: state.selectedTagId,
    selectedInventoryTag: state.inventory[state.selectedInventoryIndex] || null,
    ink: state.ink,
    inventoryCount: state.inventory.length
  };
  if (type === "warn") state.metrics.warnings += 1;
  if (type === "bad") {
    state.metrics.blockedActions += 1;
    state.metrics.failureCounts[category] = (state.metrics.failureCounts[category] || 0) + 1;
    state.metrics.failureEvents.unshift(event);
    state.metrics.failureEvents = state.metrics.failureEvents.slice(0, 24);
    audio.playSfx("error");
  }
  state.lastFeedback = event;
  state.metrics.feedbackEvents.unshift(event);
  state.metrics.feedbackEvents = state.metrics.feedbackEvents.slice(0, 40);
  state.log.unshift({ message, type, t: event.t, zone: event.zone, category });
  state.log = state.log.slice(0, 9);
  state.metrics.timeline.unshift({
    t: event.t,
    zone: event.zone,
    type: type || "info",
    message,
    category
  });
  state.metrics.timeline = state.metrics.timeline.slice(0, 80);
}

function semanticSnapshot(label) {
  return {
    label,
    zone: state.zone,
    ink: state.ink,
    inventory: structuredClone(state.inventory),
    selectedObjectId: state.selectedObjectId,
    selectedTagId: state.selectedTagId,
    selectedInventoryIndex: state.selectedInventoryIndex,
    zones: state.zones.map((item) => ({
      ...item,
      objects: item.objects.map((objectItem) => structuredClone(objectItem))
    })),
    flags: structuredClone(state.flags)
  };
}

function restoreSemanticSnapshot(snapshot) {
  state.zone = snapshot.zone;
  state.ink = snapshot.ink;
  state.inventory = structuredClone(snapshot.inventory);
  state.selectedObjectId = snapshot.selectedObjectId;
  state.selectedTagId = snapshot.selectedTagId;
  state.selectedInventoryIndex = snapshot.selectedInventoryIndex;
  state.zones = snapshot.zones.map((item) => ({
    ...item,
    objects: item.objects.map((objectItem) => structuredClone(objectItem))
  }));
  state.flags = structuredClone(snapshot.flags);
}

function pushUndo(label) {
  state.undoStack.unshift(semanticSnapshot(label));
  state.undoStack = state.undoStack.slice(0, 3);
}

function saveZoneCheckpoint(label = `检查点 ${zone().id}`) {
  state.checkpoints[zone().id] = semanticSnapshot(label);
  if (state.metrics) state.metrics.checkpointSaves += 1;
}

function restoreZoneCheckpoint() {
  const snapshot = state.checkpoints[zone().id];
  if (!snapshot || isCompleted()) {
    log("当前区域没有可恢复的检查点。", "warn");
    render();
    return;
  }
  restoreSemanticSnapshot(snapshot);
  state.undoStack = [];
  state.metrics.checkpointRestores += 1;
  state.metrics.debugRecoveries += 1;
  log(`已回到${snapshot.label}。`, "warn");
  render();
}

function canUndo() {
  return state.undoStack.length > 0 && !isCompleted();
}

function undoLastSemanticAction() {
  if (!canUndo()) {
    log("没有可撤销的语义操作。", "warn");
    render();
    return;
  }
  const snapshot = state.undoStack.shift();
  restoreSemanticSnapshot(snapshot);
  state.metrics.undoUses += 1;
  log(`已撤销：${snapshot.label}。`);
  render();
}

function selectObject(id) {
  state.selectedObjectId = id;
  state.selectedTagId = null;
  if (el.inspectorPanel && !document.body.classList.contains("regression-mode")) {
    el.inspectorPanel.classList.add("open");
  }
  render();
}

function scanSelected() {
  const obj = selectedObject();
  if (!obj) return log("先选择一个对象。", "warn");
  obj.scanned = true;
  state.metrics.scans += 1;
  markFirst("firstScanSec");
  audio.playSfx("scan");
  log(`扫描到 ${obj.name}：${obj.currentTags.map(tagName).join(" / ") || "无显性词缀"}。`, "good");
  render();
}

function selectTag(tagId) {
  state.selectedTagId = tagId;
  render();
}

function extractSelectedTag() {
  const obj = selectedObject();
  const tagId = state.selectedTagId;
  if (!obj) return log("先选择对象。", "warn");
  if (!obj.scanned) return log("先扫描目标，再剥离词缀。", "warn");
  if (!tagId) return log("先点选一个词缀。", "warn");
  const mechanicHint = z5MechanicHint(obj);
  if (mechanicHint) return log(mechanicHint, "warn");
  if (state.inventory.length >= 3) return log("临时词库已满，最多携带3个词缀。", "bad", "inventory-full");
  const def = tag(tagId);
  if (!def) return log("未知词缀，无法剥离。", "bad", "unknown-tag");
  if (state.ink < def.extract) return log("原墨不足，无法剥离。", "bad", "ink-low");
  if (!canTakeVisibleTag(obj, tagId)) return log(`${obj.name} 当前没有可剥离的“${def.name}”。`, "bad", "tag-unavailable");
  pushUndo(`剥离“${def.name}”`);
  state.ink -= def.extract;
  state.inventory.push(tagId);
  state.selectedInventoryIndex = state.inventory.length - 1;
  state.metrics.extracts += 1;
  markFirst("firstExtractSec");
  audio.playSfx("extract");
  if (!obj.persistentSource && !obj.lockedSlots.includes(def.slot)) {
    obj.currentTags = obj.currentTags.filter((item) => item !== tagId);
  }
  log(`剥离“${def.name}”，收入临时词库。`, "good");
  selectGuidedRecommendedTarget(obj.id);
  render();
}

function selectInventory(index) {
  state.selectedInventoryIndex = index;
  render();
}

function injectSelectedInventory() {
  const obj = selectedObject();
  if (!obj) return log("先选择注入目标。", "warn");
  if (!obj.scanned) return log("先扫描目标，确认槽位。", "warn");
  const tagId = state.inventory[state.selectedInventoryIndex];
  if (!tagId) return log("先选择词库中的词缀。", "warn");
  const def = tag(tagId);
  if (!obj.openSlots.includes(def.slot)) return log(`${obj.name} 没有${slotName(def.slot)}，无法写入“${def.name}”。`, "bad", "slot-missing");
  if (slotLockedForTag(obj, tagId)) return log(`${obj.name} 的${slotName(def.slot)}被锁定。`, "bad", "slot-locked");
  if (!def.compatible.includes(obj.type)) return log(`“${def.name}”不能作用于${objectTypeName(obj.type)}。`, "bad", "incompatible");
  if (state.ink < def.inject) return log("原墨不足，无法注入。", "bad", "ink-low");

  const collisionReaction = fieldCollisionReaction(obj, tagId);
  const suppressReplacementReturn = bossAllowsPhaseStructureWrite(obj, tagId);
  const replacedTags = obj.currentTags.filter((item) => tag(item)?.slot === def.slot && item !== tagId);
  pushUndo(`注入“${def.name}”`);
  state.ink -= def.inject;
  obj.currentTags = obj.currentTags.filter((item) => tag(item)?.slot !== def.slot);
  obj.currentTags.push(tagId);
  state.inventory.splice(state.selectedInventoryIndex, 1);
  if (replacedTags.length === 1 && state.inventory.length < 3 && !suppressReplacementReturn) {
    state.inventory.push(replacedTags[0]);
    state.selectedInventoryIndex = state.inventory.length - 1;
    log(`被替换的“${tagName(replacedTags[0])}”回流到词库。`, "good");
  } else if (suppressReplacementReturn && replacedTags.length) {
    state.selectedInventoryIndex = null;
    log("阶段护文吸收了被替换的结构词，没有回流到词库。", "good");
  } else {
    state.selectedInventoryIndex = null;
  }
  state.metrics.injects += 1;
  markFirst("firstInjectSec");
  if (obj.id === "warden") state.metrics.bossSemanticActions += 1;
  audio.playSfx("inject");
  log(`向 ${obj.name} 注入“${def.name}”。`, "good");
  applyImmediateEffects(obj, tagId);
  if (collisionReaction) triggerReaction(obj, collisionReaction);
  resolveReactions(obj);
  saveGameToLocal();
  render();
}

function applyImmediateEffects(obj, tagId) {
  if (obj.id === "lift" && tagId === "Semantic.Temperature.Overheated") {
    state.flags.liftMelted = true;
    log("冰封升降台被过热解冻，机关开始转动。", "good");
  }
  if (obj.id === "gate" && tagId === "Semantic.Structure.Fragile") {
    log("封文大门出现裂纹，需要重击破坏。", "good");
  }
  if (obj.id === "block" && tagId === "Semantic.Mass.Light") {
    log("压机关石变轻，可以推动。", "good");
  }
  if (obj.id === "warden" && tagId === "Semantic.Structure.Fragile" && obj.shieldLayers === 0) {
    log("残章守卫核心变得脆弱，重击可终结。", "good");
  }
  if (obj.id === "warden" && tagId === "Semantic.Temperature.Frozen" && obj.shieldLayers === 2) {
    log("第二层护文结霜，裂隙开始显影。", "good");
  }
  if (obj.id === "warden" && tag(tagId)?.slot === "Field" && obj.shieldLayers === 1) {
    log("第三层护文被力场牵动，等待相反力场相撞。", "good");
  }
}

function resolveReactions(obj) {
  const has = (id) => obj.currentTags.includes(id);
  if (has("Semantic.Temperature.Overheated") && has("Semantic.Medium.Wet")) {
    triggerReaction(obj, "Reaction.SteamBurst");
  }
  if (has("Semantic.Temperature.Frozen") && has("Semantic.Structure.Fragile")) {
    triggerReaction(obj, "Reaction.FractureWindow");
  }
  if (has("Semantic.Field.Attract") && has("Semantic.Field.Repel")) {
    triggerReaction(obj, "Reaction.FieldPulse");
  }
}

function applyReactionHpDamage(obj, amount) {
  if (!obj.hp) return;
  const floor = obj.id === "warden" && !obj.defeated ? 1 : 0;
  obj.hp = Math.max(floor, obj.hp - amount);
}

function triggerReaction(obj, reactionId) {
  const historyKey = reactionMetricKey(reactionId);
  obj.reactionHistory = obj.reactionHistory || {};
  if (reactionId !== "Reaction.FieldPulse" && obj.reactionHistory[reactionId] && obj.id !== "warden") return false;
  obj.reactionHistory[reactionId] = (obj.reactionHistory[reactionId] || 0) + 1;
  state.metrics.reactions += 1;
  state.metrics.reactionCounts[historyKey] += 1;

  if (reactionId === "Reaction.SteamBurst") {
    state.flags.steamBurst = true;
    obj.currentTags = obj.currentTags.filter((id) => id !== "Semantic.Medium.Wet");
    applyReactionHpDamage(obj, 12);
    triggerVisualRipple(reactionId, obj.id);
    audio.playSfx("reaction");
    triggerScreenShake("medium");
    if (obj.id === "warden") reduceBossShield(obj, "蒸汽爆发撕开第一层护文。", reactionId);
    log("触发组合反应：蒸汽爆发。", "good");
    return true;
  }

  if (reactionId === "Reaction.FractureWindow") {
    obj.fractureWindow = true;
    triggerVisualRipple(reactionId, obj.id);
    audio.playSfx("reaction");
    triggerScreenShake("medium");
    log("触发组合反应：破裂窗口。下一次重击会造成高额破坏。", "good");
    return true;
  }

  if (reactionId === "Reaction.FieldPulse") {
    state.flags.fieldPulse = true;
    applyReactionHpDamage(obj, 8);
    triggerVisualRipple(reactionId, obj.id);
    audio.playSfx("reaction");
    triggerScreenShake("medium");
    if (obj.id === "warden") reduceBossShield(obj, "力场震荡打散第三层护文。", reactionId);
    log("触发组合反应：力场震荡。", "good");
    return true;
  }

  return false;
}

function reduceBossShield(obj, reason, reactionId = "") {
  if (obj.shieldLayers > 0) {
    const expectedCounter = bossExpectedCounter(obj);
    if (reactionId && expectedCounter && expectedCounter !== reactionId) {
      log(`当前护文不响应该反应，需要${reactionName(expectedCounter)}。`, "warn");
      return false;
    }
    obj.shieldLayers -= 1;
    state.metrics.bossPhaseCounters.push({
      layerAfter: obj.shieldLayers,
      reaction: reactionId || "Direct",
      t: elapsedSeconds()
    });
    state.ink = Math.min(state.maxInk, state.ink + 5);
    log(reason, "good");
    log("护文碎片回流，恢复5点原墨。", "good");
    if (obj.shieldLayers === 0) {
      obj.lockedSlots = obj.lockedSlots.filter((slot) => slot !== "Structure");
      log("残章守卫结构槽开放。", "good");
    }
    return true;
  }
  return false;
}

function restoreBossGuardedStructure(obj) {
  if (obj.id !== "warden" || obj.shieldLayers <= 0) return;
  obj.currentTags = obj.currentTags.filter((item) => tag(item)?.slot !== "Structure" && item !== "Semantic.Temperature.Frozen");
  obj.currentTags.push("Semantic.Structure.Solid");
  if (!obj.lockedSlots.includes("Structure")) obj.lockedSlots.push("Structure");
  log("残章守卫结构护文重新闭合，冻结裂隙消散。", "good");
}

function heavyStrike() {
  const obj = selectedObject();
  if (!obj) return log("先选择目标。", "warn");
  state.metrics.heavyStrikes += 1;
  if (obj.id === "gate" && obj.currentTags.includes("Semantic.Structure.Fragile")) {
    obj.destroyed = true;
    state.flags.gateDestroyed = true;
    audio.playSfx("success");
    spawnFloatingDamage("击碎", "gate", true);
    triggerScreenShake("heavy");
    log("封文大门被击碎。", "good");
    saveGameToLocal();
    return render();
  }
  if (obj.hp != null && !obj.defeated) {
    let damage = 16;
    const hadFractureWindow = Boolean(obj.fractureWindow);
    if (obj.currentTags.includes("Semantic.Structure.Fragile")) damage *= 1.8;
    if (obj.currentTags.includes("Semantic.Structure.Solid")) damage *= 0.55;
    if (obj.fractureWindow) {
      damage *= 2.5;
      obj.fractureWindow = false;
      log("破裂窗口被重击引爆。", "good");
    }
    obj.hp = Math.max(0, Math.round(obj.hp - damage));
    obj.breach = true;
    
    // SFX and floating damage
    audio.playSfx("strike");
    spawnFloatingDamage(Math.round(damage), obj.id, damage > 16 || hadFractureWindow);
    triggerScreenShake(damage > 16 || hadFractureWindow ? "heavy" : "medium");
    
    log(`重击命中 ${obj.name}，造成 ${Math.round(damage)} 点伤害，并打开短暂破绽。`, "good");
    if (obj.id === "warden" && hadFractureWindow && obj.shieldLayers > 0) {
      const reduced = reduceBossShield(obj, "冻结裂隙被重击扩开，第二层护文破碎。", "Reaction.FractureWindow");
      if (reduced) restoreBossGuardedStructure(obj);
    }
    if (obj.id === "warden" && obj.currentTags.includes("Semantic.Structure.Fragile") && obj.shieldLayers === 0) {
      obj.hp = 0;
    }
    if (obj.hp === 0) {
      obj.defeated = true;
      audio.playSfx("success");
      log(`${obj.name} 被击败。`, "good");
      if (obj.id === "warden") state.flags.bossDefeated = true;
    }
    saveGameToLocal();
    return render();
  }
  audio.playSfx("error");
  log("重击没有产生关键效果。", "warn");
  render();
}

function parry() {
  const obj = selectedObject();
  if (!obj || obj.hp == null || obj.defeated) return log("选择一个正在战斗的敌人。", "warn");
  state.metrics.parries += 1;
  obj.breach = true;
  obj.scanned = true;
  audio.playSfx("parry");
  spawnFloatingDamage("PARRY", obj.id, false, true);
  triggerScreenShake("medium");
  log(`完美弹反 ${obj.name}，语义破绽打开。`, "good");
  saveGameToLocal();
  render();
}

function moveBlock() {
  const obj = selectedObject();
  if (!obj || obj.id !== "block") return log("选择压机关石。", "warn");
  if (!obj.currentTags.includes("Semantic.Mass.Light")) return log("石头太沉，先写入“轻盈”。", "warn");
  state.flags.blockMoved = true;
  log("压机关石被推到机关板上。", "good");
  render();
}

function pressPlate() {
  const obj = selectedObject();
  if (!obj || obj.id !== "block") return log("选择压机关石。", "warn");
  if (!state.flags.blockMoved) return log("先把石头推到机关板。", "warn");
  if (!obj.currentTags.includes("Semantic.Mass.Heavy")) return log("机关需要重量，给石头恢复“沉重”。", "warn");
  state.flags.platePressed = true;
  log("机关板被压住，出口栅门打开。", "good");
  render();
}

function gatherDebris() {
  if (zone().id !== "Z5") return;
  const obj = selectedObject();
  if (!obj || obj.id !== "pullPillar") return log("选择吸引力场柱。", "warn");
  if (!obj.currentTags.includes("Semantic.Field.Attract")) return log("力场柱当前不是“吸引”。", "warn");
  state.flags.debrisGathered = true;
  log("碎片被吸引到桥中央。", "good");
  render();
}

function formBridge() {
  if (zone().id !== "Z5") return;
  const obj = selectedObject();
  if (!obj || obj.id !== "pushPillar") return log("选择排斥力场柱。", "warn");
  if (!obj.currentTags.includes("Semantic.Field.Repel") && !state.flags.fieldPulse) return log("需要“排斥”或力场震荡把碎片推入锚点。", "warn");
  if (!state.flags.debrisGathered && !state.flags.fieldPulse) return log("先聚拢碎片，或者触发力场震荡。", "warn");
  state.flags.bridgeFormed = true;
  log("碎片进入锚点，临时桥面形成。", "good");
  render();
}

function nextZone() {
  if (!zone().complete(state)) return log("当前目标还没完成。", "warn");
  if (isFinalZone()) return log("切片已经完成。", "good");
  if (!state.metrics.zoneCompletions.some((item) => item.zone === zone().id)) {
    state.metrics.zoneCompletions.push({ zone: zone().id, t: elapsedSeconds() });
  }
  recordZoneDuration("complete");
  if (state.zone < state.zones.length - 1) {
    state.zone += 1;
    state.selectedObjectId = null;
    state.selectedTagId = null;
    state.selectedInventoryIndex = null;
    state.inventory = [];
    state.undoStack = [];
    state.ink = Math.min(12, state.ink + 4);
    
    // Unlock next zone in progression
    const nextZoneId = zone().id;
    if (state.unlockedZones && !state.unlockedZones.includes(nextZoneId)) {
      state.unlockedZones.push(nextZoneId);
    }
    
    const zoneId = zone().id;
    state.metrics.zoneVisits[zoneId] = (state.metrics.zoneVisits[zoneId] || 0) + 1;
    if (isFinalZone()) state.metrics.completedAt = state.metrics.completedAt ?? elapsedSeconds();
    saveZoneCheckpoint(`${zone().id}入口检查点`);
    audio.playSfx("success");
    log(`进入 ${zone().id}：${zone().name}。原墨恢复少量，临时词库已归档。`, "good");
    saveGameToLocal();
    render();
  }
}

function resetGame() {
  const mode = state.testMode;
  state.sessionId = createSessionId();
  state.zone = 0;
  state.testMode = mode;
  state.ink = 12;
  state.inventory = [];
  state.selectedObjectId = null;
  state.selectedTagId = null;
  state.selectedInventoryIndex = null;
  state.zones = freshZones();
  state.flags = {};
  state.metrics = createMetrics(mode);
  state.undoStack = [];
  state.checkpoints = {};
  state.log = [];
  state.lastFeedback = null;
  state.completionSfxPlayed = false;
  log("原型已重置。", "good");
  saveZoneCheckpoint("Z1入口检查点");
  render();
}

function refillInk() {
  state.ink = state.maxInk;
  state.metrics.debugRecoveries += 1;
  log("测试工具：原墨已补满。", "warn");
  render();
}

function resetCurrentZone() {
  const zoneIndex = state.zone;
  recordZoneDuration("reset");
  state.zones[zoneIndex] = {
    ...ZONES[zoneIndex],
    objects: ZONES[zoneIndex].objects.map((item) => structuredClone(item))
  };
  Object.keys(state.flags).forEach((key) => {
    if (zoneFlagBelongsToCurrentZone(key)) delete state.flags[key];
  });
  state.selectedObjectId = null;
  state.selectedTagId = null;
  state.selectedInventoryIndex = null;
  state.undoStack = [];
  state.metrics.debugRecoveries += 1;
  state.metrics.zoneVisits[zone().id] = (state.metrics.zoneVisits[zone().id] || 0) + 1;
  state.metrics.zoneVisitStartSec = elapsedSeconds();
  saveZoneCheckpoint(`${zone().id}重置检查点`);
  log(`测试工具：${zone().id} 已重置。`, "warn");
  render();
}

function zoneFlagBelongsToCurrentZone(key) {
  const flagMap = {
    Z1: ["gateDestroyed"],
    Z2: ["blockMoved", "platePressed"],
    Z4: ["liftMelted", "steamBurst"],
    Z5: ["debrisGathered", "bridgeFormed", "fieldPulse"],
    Z6: ["bossDefeated"]
  };
  return (flagMap[zone().id] || []).includes(key);
}

function slotName(slot) {
  return {
    Structure: "结构槽",
    Mass: "质量槽",
    Temperature: "温度槽",
    Medium: "介质槽",
    Field: "力场槽"
  }[slot] || slot;
}

function objectTypeName(type) {
  return {
    Door: "门",
    Stone: "石质对象",
    Mechanism: "机关",
    Enemy: "敌人",
    Boss: "Boss",
    Water: "水体",
    FireSource: "火源",
    FieldPillar: "力场柱",
    Debris: "碎片"
  }[type] || type;
}

function objectById(id) {
  return zoneObjects().find((item) => item.id === id) || null;
}

function hasInventory(tagId) {
  return state.inventory.includes(tagId);
}

function hasTag(obj, tagId) {
  return Boolean(obj?.currentTags.includes(tagId));
}

function canTakeVisibleTag(obj, tagId) {
  return Boolean(obj?.currentTags.includes(tagId));
}

function reactionName(reactionId) {
  return {
    "Reaction.SteamBurst": "蒸汽爆发",
    "Reaction.FractureWindow": "破裂窗口",
    "Reaction.FieldPulse": "力场震荡"
  }[reactionId] || reactionId;
}

function reactionMetricKey(reactionId) {
  return {
    "Reaction.SteamBurst": "SteamBurst",
    "Reaction.FractureWindow": "FractureWindow",
    "Reaction.FieldPulse": "FieldPulse"
  }[reactionId] || reactionId;
}

function bossExpectedCounter(obj = objectById("warden")) {
  if (!obj || obj.id !== "warden" || obj.shieldLayers <= 0) return "";
  return {
    3: "Reaction.SteamBurst",
    2: "Reaction.FractureWindow",
    1: "Reaction.FieldPulse"
  }[obj.shieldLayers] || "";
}

function bossCounterHint(obj = objectById("warden")) {
  const reactionId = bossExpectedCounter(obj);
  if (!reactionId) return "结构槽开放，写入脆弱后重击核心。";
  return {
    "Reaction.SteamBurst": "第一层护文响应过热与潮湿。",
    "Reaction.FractureWindow": "第二层护文需要冻结后写入脆弱，再用重击扩开裂隙。",
    "Reaction.FieldPulse": "第三层护文需要让吸引和排斥在守卫身上相撞。"
  }[reactionId];
}

function bossAllowsPhaseStructureWrite(obj, tagId) {
  return Boolean(
    obj?.id === "warden" &&
    obj.shieldLayers === 2 &&
    tagId === "Semantic.Structure.Fragile" &&
    hasTag(obj, "Semantic.Temperature.Frozen")
  );
}

function slotLockedForTag(obj, tagId) {
  const def = tag(tagId);
  if (!def) return false;
  return obj.lockedSlots.includes(def.slot) && !bossAllowsPhaseStructureWrite(obj, tagId);
}

function fieldCollisionReaction(obj, incomingTagId) {
  if (!obj || tag(incomingTagId)?.slot !== "Field") return "";
  if (incomingTagId === "Semantic.Field.Attract" && hasTag(obj, "Semantic.Field.Repel")) return "Reaction.FieldPulse";
  if (incomingTagId === "Semantic.Field.Repel" && hasTag(obj, "Semantic.Field.Attract")) return "Reaction.FieldPulse";
  return "";
}

function action(label, fn, cls, actionState, group = "语义") {
  return { label, fn, cls, state: actionState, group };
}

function allowed(enabled, reason) {
  return { enabled, reason };
}

function canScan() {
  const obj = selectedObject();
  if (!obj) return allowed(false, "先选择一个对象。");
  if (obj.scanned) return allowed(false, `${obj.name} 已扫描。`);
  return allowed(true, `扫描 ${obj.name}`);
}

function canExtract() {
  const obj = selectedObject();
  const tagId = state.selectedTagId;
  if (!obj) return allowed(false, "先选择对象。");
  if (!obj.scanned) return allowed(false, "先扫描目标。");
  if (!tagId) return allowed(false, "先点选目标身上的词缀。");
  const mechanicHint = z5MechanicHint(obj);
  if (mechanicHint) return allowed(false, mechanicHint);
  if (state.inventory.length >= 3) return allowed(false, "临时词库已满。");
  const def = tag(tagId);
  if (!def) return allowed(false, "未知词缀。");
  if (state.ink < def.extract) return allowed(false, "原墨不足。");
  if (!canTakeVisibleTag(obj, tagId)) return allowed(false, "目标当前没有这个可剥离词缀。");
  return allowed(true, `消耗${def.extract}原墨剥离“${def.name}”。`);
}

function canInject() {
  const obj = selectedObject();
  const tagId = state.inventory[state.selectedInventoryIndex];
  if (!obj) return allowed(false, "先选择注入目标。");
  if (!obj.scanned) return allowed(false, "先扫描目标。");
  if (!tagId) return allowed(false, "先选择词库中的词缀。");
  const def = tag(tagId);
  if (!obj.openSlots.includes(def.slot)) return allowed(false, `${obj.name} 没有${slotName(def.slot)}。`);
  if (slotLockedForTag(obj, tagId)) return allowed(false, `${slotName(def.slot)}被锁定。`);
  if (!def.compatible.includes(obj.type)) return allowed(false, `“${def.name}”不能作用于${objectTypeName(obj.type)}。`);
  if (state.ink < def.inject) return allowed(false, "原墨不足。");
  return allowed(true, `消耗${def.inject}原墨注入“${def.name}”。`);
}

function canHeavyStrike() {
  const obj = selectedObject();
  if (!obj) return allowed(false, "先选择目标。");
  if (obj.id === "gate" && hasTag(obj, "Semantic.Structure.Fragile") && !obj.destroyed) return allowed(true, "击碎已经脆弱的大门。");
  if (obj.hp != null && !obj.defeated) return allowed(true, "造成伤害并打开破绽。");
  return allowed(false, "当前目标不需要重击。");
}

function canParry() {
  const obj = selectedObject();
  return allowed(Boolean(obj && obj.hp != null && !obj.defeated), obj ? "敌人才有弹反破绽。" : "先选择敌人。");
}

function canMoveBlock() {
  const obj = selectedObject();
  if (zone().id !== "Z2") return allowed(false, "当前区域不需要推动石块。");
  if (!obj || obj.id !== "block") return allowed(false, "选择压机关石。");
  if (!hasTag(obj, "Semantic.Mass.Light")) return allowed(false, "先把石头变轻。");
  if (state.flags.blockMoved) return allowed(false, "石头已经在机关板上。");
  return allowed(true, "推动轻盈石块。");
}

function canPressPlate() {
  const obj = selectedObject();
  if (zone().id !== "Z2") return allowed(false, "当前区域没有机关板操作。");
  if (!obj || obj.id !== "block") return allowed(false, "选择压机关石。");
  if (!state.flags.blockMoved) return allowed(false, "先推动石块。");
  if (!hasTag(obj, "Semantic.Mass.Heavy")) return allowed(false, "机关需要沉重。");
  if (state.flags.platePressed) return allowed(false, "机关已经打开。");
  return allowed(true, "压住机关板。");
}

function canGatherDebris() {
  const obj = selectedObject();
  if (zone().id !== "Z5") return allowed(false, "当前区域没有碎桥。");
  if (!obj || obj.id !== "pullPillar") return allowed(false, "选择吸引力场柱。");
  if (!hasTag(obj, "Semantic.Field.Attract")) return allowed(false, "力场柱需要吸引。");
  if (state.flags.debrisGathered) return allowed(false, "碎片已经聚拢。");
  return allowed(true, "把碎片拉到桥中央。");
}

function canFormBridge() {
  const obj = selectedObject();
  if (zone().id !== "Z5") return allowed(false, "当前区域没有碎桥。");
  if (!obj || obj.id !== "pushPillar") return allowed(false, "选择排斥力场柱。");
  if (!state.flags.debrisGathered && !state.flags.fieldPulse) return allowed(false, "先聚拢碎片。");
  if (!hasTag(obj, "Semantic.Field.Repel") && !state.flags.fieldPulse) return allowed(false, "需要排斥或力场震荡。");
  if (state.flags.bridgeFormed) return allowed(false, "桥面已经形成。");
  return allowed(true, "把碎片推入锚点。");
}

function z5MechanicHint(obj = selectedObject()) {
  if (zone().id !== "Z5" || !obj?.scanned) return "";
  if (obj.id === "pullPillar" && !state.flags.debrisGathered) return "本段先点击“聚拢碎片”，不需要剥离力场词。";
  if (obj.id === "pushPillar" && state.flags.debrisGathered && !state.flags.bridgeFormed) return "本段先点击“形成桥面”，不需要剥离力场词。";
  return "";
}

function nextHint() {
  if (state.testMode === "low") return lowGuidance();
  if (isFinalZone()) return "切片完成。可以重置后重跑，或查看事件日志复盘路径。";
  if (zone().complete(state)) return "当前目标已达成，进入下一区域。";

  const z = zone().id;
  const obj = selectedObject();
  if (obj && !obj.scanned) return `扫描 ${obj.name}，确认它的词缀和槽位。`;

  if (z === "Z1") {
    const gate = objectById("gate");
    const statue = objectById("statue");
    if (!hasInventory("Semantic.Structure.Fragile") && !hasTag(gate, "Semantic.Structure.Fragile")) {
      return statue?.scanned ? "点选“脆弱”，剥离到临时词库。" : "选择裂纹石像并扫描，找到“脆弱”。";
    }
    if (!hasTag(gate, "Semantic.Structure.Fragile")) {
      return gate?.scanned ? "选择词库里的“脆弱”，注入封文大门。" : "选择封文大门并扫描，确认结构槽。";
    }
    return "重击封文大门，完成第一段。";
  }

  if (z === "Z2") {
    const block = objectById("block");
    const tablet = objectById("tablet");
    if (!state.flags.blockMoved) {
      if (!hasTag(block, "Semantic.Mass.Light")) {
        if (!hasInventory("Semantic.Mass.Light")) return tablet?.scanned ? "从浮字碑剥离“轻盈”。" : "选择浮字碑并扫描，获取“轻盈”。";
        return block?.scanned ? "选择词库里的“轻盈”，注入压机关石。" : "选择压机关石并扫描。";
      }
      return "推动变轻的压机关石。";
    }
    if (!hasTag(block, "Semantic.Mass.Heavy")) {
      if (hasInventory("Semantic.Mass.Heavy")) return "选择词库里的“沉重”，写回压机关石。";
      return "把质量槽替换时，旧词会回流；需要找回“沉重”。";
    }
    return "压住机关板，打开出口。";
  }

  if (z === "Z3") {
    const target = zoneObjects().find((item) => item.hp != null && !item.defeated);
    if (!target) return "敌人已清理，进入下一区域。";
    if (state.selectedObjectId !== target.id) return `选择 ${target.name}。`;
    if (!target.breach) return "用弹反或重击打开语义破绽。";
    if (hasTag(target, "Semantic.Structure.Solid")) return "点选“坚固”并剥离，降低敌人防御。";
    return "重击敌人，利用破绽击败它。";
  }

  if (z === "Z4") {
    const lift = objectById("lift");
    const brazier = objectById("brazier");
    const pool = objectById("pool");
    const beast = objectById("beast");
    if (!state.flags.liftMelted) {
      if (!hasInventory("Semantic.Temperature.Overheated")) return brazier?.scanned ? "从火盆剥离“过热”。" : "选择火盆并扫描，获取“过热”。";
      return lift?.scanned ? "把“过热”注入冰封升降台。" : "选择冰封升降台并扫描。";
    }
    if (!state.flags.steamBurst) {
      if (!hasInventory("Semantic.Medium.Wet")) return pool?.scanned ? "从冻结水池剥离“潮湿”。" : "选择冻结水池并扫描，获取“潮湿”。";
      return beast?.scanned ? "把“潮湿”注入带“过热”的缀刺兽，触发蒸汽爆发。" : "选择缀刺兽并扫描。";
    }
  }

  if (z === "Z5") {
    if (!state.flags.debrisGathered) return "选择吸引力场柱，扫描后聚拢碎片。";
    return "选择排斥力场柱，扫描后形成桥面。";
  }

  if (z === "Z6") {
    const warden = objectById("warden");
    const bossFire = objectById("bossFire");
    const bossPool = objectById("bossPool");
    const bossIce = objectById("bossIce");
    const bossPull = objectById("bossPull");
    const bossPush = objectById("bossPush");
    const bossTablet = objectById("bossTablet");
    if (warden?.shieldLayers === 3) {
      if (!hasTag(warden, "Semantic.Temperature.Overheated")) {
        if (!hasInventory("Semantic.Temperature.Overheated")) return bossFire?.scanned ? "从过热火盆剥离“过热”。" : "选择过热火盆并扫描。";
        return warden?.scanned ? "把“过热”注入残章守卫。" : "选择残章守卫并扫描。";
      }
      if (!hasInventory("Semantic.Medium.Wet")) return bossPool?.scanned ? "从潮湿水纹剥离“潮湿”。" : "选择潮湿水纹并扫描。";
      return "把“潮湿”注入过热的残章守卫，触发蒸汽爆发。";
    }
    if (warden?.shieldLayers === 2) {
      if (!hasTag(warden, "Semantic.Temperature.Frozen")) {
        if (!hasInventory("Semantic.Temperature.Frozen")) return bossIce?.scanned ? "从冻结残页剥离“冻结”。" : "选择冻结残页并扫描。";
        return warden?.scanned ? "把“冻结”注入残章守卫，让第二层护文显露裂隙。" : "选择残章守卫并扫描。";
      }
      if (!hasTag(warden, "Semantic.Structure.Fragile")) {
        if (!hasInventory("Semantic.Structure.Fragile")) return bossTablet?.scanned ? "从裂纹石碑剥离“脆弱”。" : "选择裂纹石碑并扫描。";
        return "把“脆弱”写入结霜裂隙，触发破裂窗口。";
      }
      return "重击残章守卫，打穿第二层护文。";
    }
    if (warden?.shieldLayers === 1) {
      const hasAnyField = hasTag(warden, "Semantic.Field.Attract") || hasTag(warden, "Semantic.Field.Repel");
      const hasAttract = hasTag(warden, "Semantic.Field.Attract");
      const hasRepel = hasTag(warden, "Semantic.Field.Repel");
      if (!hasAnyField) {
        if (!hasInventory("Semantic.Field.Attract")) return bossPull?.scanned ? "从吸引残柱剥离“吸引”。" : "选择吸引残柱并扫描。";
        return warden?.scanned ? "把“吸引”注入残章守卫，准备力场碰撞。" : "选择残章守卫并扫描。";
      }
      if (hasAttract && !hasInventory("Semantic.Field.Repel")) return bossPush?.scanned ? "从排斥残柱剥离“排斥”。" : "选择排斥残柱并扫描。";
      if (hasRepel && !hasInventory("Semantic.Field.Attract")) return bossPull?.scanned ? "从吸引残柱剥离“吸引”。" : "选择吸引残柱并扫描。";
      return `把相反力场注入残章守卫，触发${reactionName("Reaction.FieldPulse")}。`;
    }
    if (!hasTag(warden, "Semantic.Structure.Fragile")) {
      if (!hasInventory("Semantic.Structure.Fragile")) return bossTablet?.scanned ? "从裂纹石碑剥离“脆弱”。" : "选择裂纹石碑并扫描。";
      return "把“脆弱”注入结构槽已开放的残章守卫。";
    }
    return "重击残章守卫核心，完成Boss战。";
  }

  return obj ? "根据扫描结果选择剥离、注入或攻击。" : "选择一个场景对象开始。";
}

function lowGuidance() {
  if (isFinalZone()) return "切片完成。";
  if (zone().complete(state)) return "目标已达成。";
  const obj = selectedObject();
  if (obj && !obj.scanned) return "扫描当前对象，确认词缀与槽位。";
  const guidance = {
    Z1: "寻找能改变结构强度的词缀。",
    Z2: "质量会同时影响移动和机关压力。",
    Z3: "战斗目标需要先暴露可改写窗口。",
    Z4: "温度和介质的组合会改变场面。",
    Z5: "力场方向决定碎片移动结果。",
    Z6: "Boss护文会轮换响应不同组合反应。",
    Z7: "查看结果并复盘路径。"
  };
  return guidance[zone().id] || "观察对象词缀和开放槽位。";
}

function zoneSteps() {
  const z = zone().id;
  if (z === "Z1") {
    return [
      step("扫描裂纹石像", objectById("statue")?.scanned),
      step("剥离脆弱", hasInventory("Semantic.Structure.Fragile") || hasTag(objectById("gate"), "Semantic.Structure.Fragile")),
      step("注入大门并重击", state.flags.gateDestroyed)
    ];
  }
  if (z === "Z2") {
    return [
      step("取得轻盈", hasInventory("Semantic.Mass.Light") || hasTag(objectById("block"), "Semantic.Mass.Light") || state.flags.blockMoved),
      step("推动石块", state.flags.blockMoved),
      step("恢复沉重并压机关", state.flags.platePressed)
    ];
  }
  if (z === "Z3") {
    const enemies = zoneObjects().filter((item) => item.hp != null);
    return [
      step("扫描并打开破绽", enemies.some((item) => item.scanned && item.breach)),
      step("改写或剥离防御", hasInventory("Semantic.Structure.Solid") || enemies.some((item) => hasTag(item, "Semantic.Structure.Fragile") || !hasTag(item, "Semantic.Structure.Solid"))),
      step("击败游兵", enemies.every((item) => item.defeated))
    ];
  }
  if (z === "Z4") {
    return [
      step("用过热融冰", state.flags.liftMelted),
      step("取得潮湿", hasInventory("Semantic.Medium.Wet") || state.flags.steamBurst),
      step("触发蒸汽爆发", state.flags.steamBurst)
    ];
  }
  if (z === "Z5") {
    return [
      step("扫描吸引柱", objectById("pullPillar")?.scanned),
      step("聚拢碎片", state.flags.debrisGathered),
      step("形成桥面", state.flags.bridgeFormed)
    ];
  }
  if (z === "Z6") {
    const warden = objectById("warden");
    return [
      step("蒸汽撕开第一层", warden && warden.shieldLayers <= 2),
      step("冻裂打穿第二层", warden && warden.shieldLayers <= 1),
      step("力场震掉第三层", warden && warden.shieldLayers === 0),
      step("脆弱终结核心", state.flags.bossDefeated)
    ];
  }
  if (z === "Z7") {
    return [
      step("抵达修正文库", true),
      step("后期系统只读", true),
      step("等待试玩复盘", true)
    ];
  }
  return [];
}

function step(label, done) {
  return { label, done: Boolean(done) };
}

function activeStepIndex(steps) {
  const index = steps.findIndex((item) => !item.done);
  return index === -1 ? steps.length - 1 : index;
}

function decisionSummary() {
  const steps = zoneSteps();
  const activeStep = steps[activeStepIndex(steps)];
  const audit = currentAudit();
  const selected = selectedObject();
  const inventoryText = state.inventory.length
    ? state.inventory.map(tagName).join(" / ")
    : "空";
  const pressure = state.ink <= 3
    ? "原墨偏紧"
    : state.inventory.length >= 3
      ? "词库已满"
      : "资源稳定";
  const targetText = selected
    ? `${selected.name}${selected.scanned ? "已读" : "待扫"}`
    : "未选目标";
  return [
    { label: "意图", value: activeStep?.label || "观察对象" },
    { label: "目标", value: targetText },
    { label: "资源", value: `${state.ink}/${state.maxInk} · ${inventoryText} · ${pressure}` },
    { label: "审计", value: audit.risks[0] || `${audit.grade} ${audit.score}` }
  ];
}

function recommendedObjectIds() {
  if (state.testMode === "low") return [];
  const z = zone().id;
  if (zone().complete(state)) return [];
  if (z === "Z1") {
    if (!hasInventory("Semantic.Structure.Fragile") && !hasTag(objectById("gate"), "Semantic.Structure.Fragile")) return ["statue"];
    if (!hasTag(objectById("gate"), "Semantic.Structure.Fragile")) return ["gate"];
    return ["gate"];
  }
  if (z === "Z2") {
    const block = objectById("block");
    if (!state.flags.blockMoved && !hasTag(block, "Semantic.Mass.Light") && !hasInventory("Semantic.Mass.Light")) return ["tablet"];
    return ["block"];
  }
  if (z === "Z3") {
    const target = zoneObjects().find((item) => item.hp != null && !item.defeated);
    return target ? [target.id] : [];
  }
  if (z === "Z4") {
    if (!state.flags.liftMelted && !hasInventory("Semantic.Temperature.Overheated")) return ["brazier"];
    if (!state.flags.liftMelted) return ["lift"];
    if (!state.flags.steamBurst && !hasInventory("Semantic.Medium.Wet")) return ["pool"];
    if (!state.flags.steamBurst) return ["beast"];
  }
  if (z === "Z5") {
    if (!state.flags.debrisGathered) return ["pullPillar"];
    return ["pushPillar"];
  }
  if (z === "Z6") {
    const warden = objectById("warden");
    if (warden?.shieldLayers === 3) {
      if (!hasTag(warden, "Semantic.Temperature.Overheated") && !hasInventory("Semantic.Temperature.Overheated")) return ["bossFire"];
      if (!hasTag(warden, "Semantic.Temperature.Overheated")) return ["warden"];
      if (!hasInventory("Semantic.Medium.Wet")) return ["bossPool"];
      return ["warden"];
    }
    if (warden?.shieldLayers === 2) {
      if (!hasTag(warden, "Semantic.Temperature.Frozen") && !hasInventory("Semantic.Temperature.Frozen")) return ["bossIce"];
      if (!hasTag(warden, "Semantic.Temperature.Frozen")) return ["warden"];
      if (!hasTag(warden, "Semantic.Structure.Fragile") && !hasInventory("Semantic.Structure.Fragile")) return ["bossTablet"];
      if (!hasTag(warden, "Semantic.Structure.Fragile")) return ["warden"];
      return ["warden"];
    }
    if (warden?.shieldLayers === 1) {
      const hasAnyField = hasTag(warden, "Semantic.Field.Attract") || hasTag(warden, "Semantic.Field.Repel");
      const hasAttract = hasTag(warden, "Semantic.Field.Attract");
      const hasRepel = hasTag(warden, "Semantic.Field.Repel");
      if (!hasAnyField && !hasInventory("Semantic.Field.Attract")) return ["bossPull"];
      if (!hasAnyField) return ["warden"];
      if (hasAttract && !hasInventory("Semantic.Field.Repel")) return ["bossPush"];
      if (hasRepel && !hasInventory("Semantic.Field.Attract")) return ["bossPull"];
      return ["warden"];
    }
    if (!hasTag(warden, "Semantic.Structure.Fragile") && !hasInventory("Semantic.Structure.Fragile")) return ["bossTablet"];
    if (!hasTag(warden, "Semantic.Structure.Fragile")) return ["warden"];
    return ["warden"];
  }
  return [];
}

function objectCanAcceptSelectedInventory(obj) {
  const tagId = state.inventory[state.selectedInventoryIndex];
  if (!tagId || !obj) return false;
  const def = tag(tagId);
  return Boolean(obj.scanned && obj.openSlots.includes(def.slot) && !slotLockedForTag(obj, tagId) && def.compatible.includes(obj.type));
}

function objectWriteReadiness(obj) {
  const tagId = state.inventory[state.selectedInventoryIndex];
  if (!tagId || !obj) return { status: "", label: "" };
  const def = tag(tagId);
  if (!obj.scanned) return { status: "needs-scan", label: "需扫描" };
  if (!obj.openSlots.includes(def.slot)) return { status: "blocked", label: "槽位不符" };
  if (slotLockedForTag(obj, tagId)) return { status: "blocked", label: "槽位锁定" };
  if (!def.compatible.includes(obj.type)) return { status: "blocked", label: "不可作用" };
  return { status: "compatible", label: "可写入" };
}

function objectStateLabel(obj, recommendedIds) {
  if (obj.defeated) return "已击败";
  if (obj.destroyed) return "已破坏";
  if (recommendedIds.includes(obj.id)) return "推荐目标";
  const readiness = objectWriteReadiness(obj);
  if (readiness.label) return readiness.label;
  if (!obj.scanned) return "可扫描";
  if (obj.providesTags.length) return obj.persistentSource ? "稳定词源" : "可取词";
  if (obj.hp != null) return obj.breach ? "破绽已开" : "可战斗";
  return "已读取";
}

function bossPhasePlanHtml(obj) {
  if (obj?.id !== "warden") return "";
  const low = state.testMode === "low";
  const phases = low
    ? [
      { layer: 3, label: "介质冲突", detail: "寻找会让护文过载的环境组合" },
      { layer: 2, label: "裂隙扩开", detail: "先显出裂隙，再用攻击扩开" },
      { layer: 1, label: "方向相撞", detail: "让相反方向在守卫身上冲突" }
    ]
    : [
      { layer: 3, label: "蒸汽", detail: "过热+潮湿" },
      { layer: 2, label: "冻裂", detail: "冻结+脆弱+重击" },
      { layer: 1, label: "力场", detail: "吸引+排斥" }
    ];
  const items = phases.map((phase) => {
    const done = obj.shieldLayers < phase.layer;
    const active = obj.shieldLayers === phase.layer;
    const cls = done ? "done" : active ? "active" : "";
    return `<span class="${cls}"><strong>${phase.label}</strong><small>${phase.detail}</small></span>`;
  }).join("");
  return `
    <div class="boss-phase-plan" aria-label="Boss护文反制顺序">
      ${items}
      <p>${low ? "扫描守卫和环境词源后，用结果反馈判断当前护文响应。" : bossCounterHint(obj)}</p>
    </div>
  `;
}

function previewForSelectedObject() {
  const obj = selectedObject();
  if (!obj) return { tone: "", title: "未选择对象", lines: ["选择对象后，扫描器会显示可取词和写入预览。"] };
  if (!obj.scanned) return { tone: "warn", title: "需要扫描", lines: [`先扫描 ${obj.name}，再判断词缀和槽位。`] };

  const inventoryTag = state.inventory[state.selectedInventoryIndex];
  if (inventoryTag) return injectionPreview(obj, inventoryTag);

  if (state.selectedTagId) {
    const def = tag(state.selectedTagId);
    if (!def) return { tone: "bad", title: "未知词缀", lines: ["这个词缀没有定义。"] };
    const canTake = canExtract();
    const lines = [
      `取词消耗：${def.extract} 原墨。`,
      obj.persistentSource ? "这是稳定词源，剥离后不会耗尽。" : "剥离后会从目标身上移除该词缀。"
    ];
    if (!canTake.enabled) lines.unshift(canTake.reason);
    return { tone: canTake.enabled ? "good" : "bad", title: `剥离预览：${def.name}`, lines };
  }

  return { tone: "", title: "扫描结果", lines: ["点选目标身上的词缀可查看剥离预览；点选词库词缀可查看写入预览。"] };
}

function injectionPreview(obj, tagId) {
  const def = tag(tagId);
  const result = canInject();
  const lines = [];
  if (!result.enabled) {
    lines.push(result.reason);
    return { tone: "bad", title: `写入预览：${def.name}`, lines };
  }
  const replaced = obj.currentTags.filter((item) => tag(item)?.slot === def.slot && item !== tagId);
  lines.push(`写入槽位：${slotName(def.slot)}，消耗 ${def.inject} 原墨。`);
  if (bossAllowsPhaseStructureWrite(obj, tagId)) lines.push("冻结裂隙允许临时写入结构词，用于打穿第二层护文。");
  if (replaced.length) lines.push(`<span class="replacement-flow">${replaced.map(tagName).join(" / ")} -> ${def.name}</span> 被替换词会回流到词库。`);
  const reactions = reactionPreview(obj, tagId);
  if (reactions.length) lines.push(`<span class="reaction-callout">会触发：${reactions.join(" / ")}</span>`);
  return { tone: reactions.length ? "warn" : "good", title: `写入预览：${def.name} -> ${obj.name}`, lines };
}

function reactionPreview(obj, incomingTagId) {
  const def = tag(incomingTagId);
  const resulting = obj.currentTags.filter((item) => tag(item)?.slot !== def.slot);
  resulting.push(incomingTagId);
  const hasResult = (id) => resulting.includes(id);
  const reactions = [];
  const collision = fieldCollisionReaction(obj, incomingTagId);
  if (collision) reactions.push(reactionName(collision));
  if (hasResult("Semantic.Temperature.Overheated") && hasResult("Semantic.Medium.Wet")) reactions.push("蒸汽爆发");
  if (hasResult("Semantic.Temperature.Frozen") && hasResult("Semantic.Structure.Fragile")) reactions.push("破裂窗口");
  if (hasResult("Semantic.Field.Attract") && hasResult("Semantic.Field.Repel")) reactions.push("力场震荡");
  return [...new Set(reactions)];
}

function renderModeControls() {
  document.body.dataset.mode = state.testMode;
  el.modeButtons.forEach((button) => {
    const active = button.dataset.mode === state.testMode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function renderStatusMeters() {
  const steps = zoneSteps();
  const stepPct = steps.length ? steps.filter((item) => item.done).length / steps.length : 0;
  const zonePct = state.zones.length ? (state.zone + stepPct) / state.zones.length : 0;
  const timePct = Math.min(1, elapsedSeconds() / 180);
  document.body.style.setProperty("--ink-pct", `${Math.max(0, Math.min(1, state.ink / state.maxInk)) * 100}%`);
  document.body.style.setProperty("--inventory-pct", `${Math.max(0, Math.min(1, state.inventory.length / 3)) * 100}%`);
  document.body.style.setProperty("--zone-pct", `${Math.max(0, Math.min(1, zonePct)) * 100}%`);
  document.body.style.setProperty("--time-pct", `${timePct * 100}%`);
}

function ensureGuidedSelection() {
  if (state.testMode === "low" || isCompleted()) return;
  if (state.selectedObjectId && objectById(state.selectedObjectId)) return;
  selectGuidedRecommendedTarget();
}

function selectGuidedRecommendedTarget(preferDifferentId = "") {
  if (state.testMode === "low" || isCompleted()) return false;
  const ids = recommendedObjectIds();
  const nextId = ids.find((id) => id !== preferDifferentId) || ids[0];
  if (!nextId || !objectById(nextId)) return false;
  state.selectedObjectId = nextId;
  state.selectedTagId = null;
  return true;
}

function recoveryState() {
  const issues = [];
  const obj = selectedObject();
  const inventoryTag = state.inventory[state.selectedInventoryIndex];
  if (isFinalZone() && isCompleted()) {
    issues.push("切片已完成，可以查看总结或重开。");
  } else if (zone().complete(state)) {
    issues.push("当前目标已完成，可以进入下一区域。");
  } else {
    if (!obj) issues.push("先选择一个场景对象。");
    if (obj && !obj.scanned) issues.push("当前对象未扫描，先确认词缀和槽位。");
    const mechanicHint = z5MechanicHint(obj);
    if (mechanicHint) issues.push(mechanicHint);
    if (state.inventory.length >= 3) issues.push("临时词库已满，需要写入、清空或重置区。");
    if (inventoryTag) {
      const compatibleTargets = zoneObjects().filter((item) => objectWriteReadiness(item).status === "compatible");
      if (!compatibleTargets.length) issues.push("当前选中词还没有明确可写入目标，先扫描候选对象。");
    }
    if (state.ink <= 1) issues.push("原墨偏低，调试模式可补墨，正式测试需找正确低消耗路径。");
    if (activeZoneElapsedSec() >= 90) issues.push("本区停留较久，建议复查目标、扫描器和词库。");
  }
  return {
    primary: issues[0] || "",
    issues
  };
}

function renderSessionStatus() {
  const recovery = recoveryState();
  el.sessionStatus.innerHTML = `
    <div class="session-chip"><span>会话</span><strong>${state.sessionId}</strong></div>
    <div class="session-chip"><span>模式</span><strong>${currentModeLabel()}</strong></div>
    <div class="session-chip"><span>构建</span><strong>${BUILD_LABEL}</strong></div>
    <div class="session-chip wide"><span>恢复建议</span><strong>${recovery.primary || "当前没有明显阻塞。"}</strong></div>
  `;
  el.undoBtn.disabled = !canUndo();
  el.undoBtn.title = canUndo() ? state.undoStack[0].label : "没有可撤销的语义操作。";
  el.checkpointBtn.disabled = !state.checkpoints[zone().id] || isCompleted();
  el.checkpointBtn.title = state.checkpoints[zone().id] ? "回到当前区域入口检查点。" : "当前区域没有检查点。";
}

function render() {
  renderModeControls();
  ensureGuidedSelection();
  renderStatusMeters();
  el.inkValue.textContent = state.ink;
  el.inventoryCount.textContent = `${state.inventory.length}/3`;
  el.zoneIndex.textContent = zone().id;
  el.elapsedValue.textContent = formatTime(state.metrics.completedAt ?? elapsedSeconds());
  el.nextHint.textContent = nextHint();
  renderZones();
  renderSteps();
  renderResultPulse();
  renderDecisionStrip();
  renderStage();
  renderInspector();
  renderInventory();
  renderLog();
  renderMetrics();
  renderSessionStatus();
  renderCompletionPanel();
  el.reflectionBox.textContent = zone().reflection;
  renderReportData();
}

function renderDecisionStrip() {
  if (!el.decisionStrip) return;
  el.decisionStrip.innerHTML = decisionSummary().map((item) => `
    <div class="decision-chip">
      <span>${item.label}</span>
      <strong>${item.value}</strong>
    </div>
  `).join("");
}

function renderResultPulse() {
  if (!el.resultPulse) return;
  const feedback = state.lastFeedback || {
    message: "选择场景对象后开始扫描。",
    type: "info",
    category: "initial",
    zone: zone().id,
    mode: state.testMode
  };
  const titleMap = {
    good: "已生效",
    warn: "需调整",
    bad: "被阻塞",
    info: "等待操作"
  };
  const tone = ["good", "warn", "bad"].includes(feedback.type) ? feedback.type : "info";
  const recovery = recoveryState();
  const detail = tone === "bad"
    ? (recovery.primary || "可撤销、回检查点，或换一个对象/词缀再试。")
    : tone === "warn"
      ? (recovery.primary || "当前状态仍可继续，观察对象槽位和词库。")
      : zone().complete(state)
        ? "目标已达成，推进到下一段。"
        : nextHint();
  el.resultPulse.className = `result-pulse ${tone}`;
  el.resultPulse.innerHTML = `
    <span>${titleMap[tone]}</span>
    <strong>${feedback.message}</strong>
    <small>${detail}</small>
  `;
}

function renderZones() {
  el.zoneList.innerHTML = "";
  state.zones.forEach((z, index) => {
    const active = index === state.zone;
    const reached = index <= state.zone;
    const complete = reached && (index < state.zone || z.complete(state));
    const button = document.createElement("button");
    button.className = `zone-item${active ? " active" : ""}${complete ? " complete" : ""}`;
    button.type = "button";
    button.style.setProperty("--zone-item-pct", `${index / Math.max(1, state.zones.length - 1) * 100}%`);
    button.innerHTML = `<strong>${z.id} ${z.name}</strong><span>${complete ? "已达成" : active ? "进行中" : "待进入"}</span><i></i>`;
    button.addEventListener("click", () => {
      if (index <= state.zone || state.zones[index - 1]?.complete(state)) {
        if (index !== state.zone) recordZoneDuration("manual-switch");
        state.zone = index;
        state.selectedObjectId = null;
        state.selectedTagId = null;
        state.selectedInventoryIndex = null;
        state.metrics.zoneVisits[zone().id] = (state.metrics.zoneVisits[zone().id] || 0) + 1;
        state.metrics.zoneVisitStartSec = elapsedSeconds();
        
        // Auto-close travel modal
        if (el.zonePanel && !document.body.classList.contains("regression-mode")) {
          el.zonePanel.classList.remove("open");
        }
        
        render();
      } else {
        log("先完成前一区域。", "warn");
      }
    });
    el.zoneList.appendChild(button);
  });
}

function renderSteps() {
  const steps = zoneSteps();
  const activeIndex = activeStepIndex(steps);
  el.stepList.innerHTML = steps.map((item, index) => {
    const cls = item.done ? "done" : index === activeIndex ? "active" : "";
    const prefix = item.done ? "完成" : index === activeIndex ? "当前" : "待办";
    return `<div class="step-item ${cls}"><strong>${prefix}</strong><br>${item.label}</div>`;
  }).join("");
}

function renderStage() {
  el.zoneTitle.textContent = `${zone().id} ${zone().name}`;
  el.zoneObjective.textContent = state.testMode === "low" ? (LOW_OBJECTIVES[zone().id] || zone().objective) : zone().objective;
  el.sceneMap.innerHTML = "";
  const recommendedIds = recommendedObjectIds();
  zoneObjects().forEach((obj) => {
    const readiness = objectWriteReadiness(obj);
    const button = document.createElement("button");
    button.className = [
      "object-token",
      obj.id === state.selectedObjectId ? "selected" : "",
      recommendedIds.includes(obj.id) ? "recommended" : "",
      objectCanAcceptSelectedInventory(obj) ? "compatible" : "",
      readiness.status === "blocked" ? "write-blocked" : "",
      readiness.status === "needs-scan" ? "needs-scan" : "",
      obj.defeated ? "defeated" : "",
      obj.destroyed ? "destroyed" : ""
    ].filter(Boolean).join(" ");
    button.type = "button";
    button.dataset.objectId = obj.id;
    button.setAttribute("aria-pressed", obj.id === state.selectedObjectId ? "true" : "false");
    const tags = obj.currentTags.map((tagId) => {
      const def = tag(tagId);
      if (obj.scanned) {
        return `<span class="mini-tag-label"><i style="background:${def?.color || "#ddd"}"></i>${def?.name || tagId}</span>`;
      }
      return `<i class="tag-dot unknown"></i>`;
    }).join("");
    const hp = obj.hp != null && !obj.defeated ? `<small>耐久 ${obj.hp}${obj.shieldLayers ? ` / 护文 ${obj.shieldLayers}` : ""}</small>` : "";
    const hpBar = obj.hp != null && !obj.defeated
      ? `<div class="hp-bar" aria-label="耐久"><span style="width:${Math.max(0, Math.min(100, obj.hp / (obj.maxHp || obj.hp || 1) * 100))}%"></span></div>`
      : "";
    const shieldPips = obj.shieldLayers != null && !obj.defeated
      ? `<div class="shield-pips" aria-label="护文">${[0, 1, 2].map((pip) => `<i class="${pip < obj.shieldLayers ? "on" : ""}"></i>`).join("")}</div>`
      : "";
    const stateLabel = objectStateLabel(obj, recommendedIds);
    button.setAttribute("aria-label", `${obj.name}，${objectTypeName(obj.type)}，${stateLabel}`);
    button.innerHTML = `
      <div class="object-card-top">
        <span class="type-badge">${objectTypeName(obj.type)}</span>
        <span class="object-state">${stateLabel}</span>
      </div>
      <strong>${obj.name}</strong>
      <small>${obj.scanned ? "已扫描" : "未扫描"}</small>
      ${hp}${hpBar}${shieldPips}
      <div class="mini-tags">${tags}</div>
      <span class="glyph">${obj.glyph}</span>
    `;
    button.addEventListener("click", () => selectObject(obj.id));
    el.sceneMap.appendChild(button);
  });
  renderActions();
}

function renderActions() {
  const canAdvance = zone().complete(state);
  const scanState = canScan();
  const actions = [
    action("扫描", scanSelected, scanState.enabled ? "primary" : "", scanState, "观察"),
    action("剥离选中词", extractSelectedTag, "", canExtract(), "语义"),
    action("注入选中词", injectSelectedInventory, "", canInject(), "语义"),
    action("重击", heavyStrike, "", canHeavyStrike(), "战斗"),
    action("弹反破绽", parry, "", canParry(), "战斗")
  ];
  if (zone().id === "Z2") {
    actions.push(action("推动石块", moveBlock, "", canMoveBlock(), "机关"), action("压住机关", pressPlate, "", canPressPlate(), "机关"));
  }
  if (zone().id === "Z5") {
    const gatherState = canGatherDebris();
    const bridgeState = canFormBridge();
    actions.push(
      action("聚拢碎片", gatherDebris, gatherState.enabled ? "primary" : "", gatherState, "机关"),
      action("形成桥面", formBridge, bridgeState.enabled ? "primary" : "", bridgeState, "机关")
    );
  }
  const advanceLabel = isFinalZone() && canAdvance ? "切片完成" : canAdvance ? "进入下一区域" : "目标未完成";
  actions.push(action(advanceLabel, nextZone, canAdvance && !isFinalZone() ? "primary" : "", { enabled: canAdvance && !isFinalZone(), reason: isFinalZone() ? "已经到达结尾。" : "完成当前目标后可进入下一段。" }, "推进"));
  el.contextActions.innerHTML = "";
  const disabledReasons = [];
  const visibleActions = actions.filter((item) => shouldShowAction(item));
  const groups = zone().id === "Z5"
    ? ["观察", "机关", "语义", "战斗", "推进"]
    : ["观察", "语义", "战斗", "机关", "推进"];
  groups.forEach((group) => {
    const groupActions = visibleActions.filter((item) => item.group === group);
    if (!groupActions.length) return;
    const wrapper = document.createElement("div");
    wrapper.className = `action-group${groupActions.some((item) => item.state.enabled) ? " has-ready" : ""}`;
    wrapper.innerHTML = `<span class="action-group-label">${group}</span>`;
    groupActions.forEach(({ label, fn, cls, state: actionState }) => {
      const button = document.createElement("button");
      button.className = `action-button ${cls}${actionState.enabled ? " ready" : ""}`;
      button.type = "button";
      button.textContent = label;
      button.dataset.action = label;
      button.disabled = !actionState.enabled;
      button.title = actionState.reason;
      button.setAttribute("aria-label", `${label}：${actionState.reason}`);
      if (!actionState.enabled) disabledReasons.push(`${label}：${actionState.reason}`);
      button.addEventListener("click", fn);
      wrapper.appendChild(button);
    });
    el.contextActions.appendChild(wrapper);
  });
  if (state.testMode === "low") {
    el.actionHelp.textContent = selectedObject() && disabledReasons.length ? disabledReasons.slice(0, 1).join("；") : "";
    return;
  }
  const recovery = recoveryState();
  el.actionHelp.textContent = recovery.primary || (disabledReasons.length ? disabledReasons.slice(0, 2).join("；") : "当前选择已有可执行操作。");
}

function shouldShowAction(item) {
  const anyScanned = zoneObjects().some((objectItem) => objectItem.scanned);
  const firstScanTeaching = state.testMode === "guided" && zone().id === "Z1" && !anyScanned;
  if (!firstScanTeaching) return true;
  return item.label === "扫描" || item.group === "推进";
}

function renderInspector() {
  const obj = selectedObject();
  el.selectedHint.textContent = obj ? obj.name : "未选择对象";
  if (!obj) {
    el.inspector.className = "inspector-empty";
    el.inspector.textContent = "选择场景中的对象，然后扫描。";
    return;
  }
  el.inspector.className = "";
  if (!obj.scanned) {
    el.inspector.innerHTML = `
      <div class="object-title-row">
        <div>
          <h3>${obj.name}</h3>
          <p class="hint">${objectTypeName(obj.type)} / 未扫描</p>
        </div>
        <span class="hint">未知</span>
      </div>
      <div class="scan-gate">
        <strong>扫描后显示词缀、槽位和取写成本。</strong>
        <span>当前只知道对象轮廓。先执行“扫描”，再决定剥离、注入或攻击。</span>
      </div>
    `;
    return;
  }
  const tagButtons = obj.currentTags.map((tagId) => {
    const def = tag(tagId);
    const selected = tagId === state.selectedTagId ? " selected" : "";
    return `<button class="tag-chip${selected}" data-tag="${tagId}" type="button" title="${tagCause(tagId)}"><span style="background:${def?.color || "#ddd"}"></span><strong>${def?.name || tagId}</strong><small>${tagCause(tagId)}</small><em class="chip-cost">取${def?.extract ?? "-"}</em></button>`;
  }).join("");
  const lockText = obj.lockedSlots.length ? `锁定：${obj.lockedSlots.map(slotName).join(" / ")}` : "无锁定槽";
  const preview = previewForSelectedObject();
  const previewLines = preview.lines.map((line) => `<li>${line}</li>`).join("");
  const slotItems = obj.openSlots.map((slot) => {
    const locked = obj.lockedSlots.includes(slot);
    return `<span class="slot-chip ${locked ? "locked" : ""}">${slotName(slot)}${locked ? " / 锁定" : ""}</span>`;
  }).join("");
  const bossGauge = obj.shieldLayers != null
    ? `<div class="boss-gauge" aria-label="Boss护文"><span style="width:${Math.max(0, Math.min(100, obj.shieldLayers / 3 * 100))}%"></span><strong>护文 ${obj.shieldLayers}/3</strong></div>`
    : "";
  const bossPhasePlan = bossPhasePlanHtml(obj);
  el.inspector.innerHTML = `
    <div class="object-title-row">
      <div>
        <h3>${obj.name}</h3>
        <p class="hint">${objectTypeName(obj.type)} / ${lockText}</p>
      </div>
      <span class="hint">${obj.scanned ? "已扫描" : "未扫描"}</span>
    </div>
    ${bossGauge}
    ${bossPhasePlan}
    <div class="scan-section">
      <span class="section-label">当前词缀</span>
      <div class="tag-list">${tagButtons || "<span class='hint'>无显性词缀</span>"}</div>
    </div>
    <div class="scan-section">
      <span class="section-label">开放槽位</span>
      <div class="slot-list">${slotItems || "<span class='hint'>无开放槽位</span>"}</div>
      ${obj.breach ? "<p class='scan-note'>语义破绽已打开，可优先处理结构词。</p>" : ""}
    </div>
    <div class="preview-box ${preview.tone}">
      <div class="preview-title">${preview.title}</div>
      <ul>${previewLines}</ul>
    </div>
  `;
  el.inspector.querySelectorAll(".tag-chip").forEach((button) => {
    button.addEventListener("click", () => selectTag(button.dataset.tag));
  });
}

function renderInventory() {
  el.inventoryList.innerHTML = "";
  if (!state.inventory.length) {
    el.inventoryList.innerHTML = `
      <div class="empty-state">
        <strong>词库为空</strong>
        <span>${state.testMode === "low" ? "从对象取词后会显示在这里。" : "扫描推荐目标，点选词缀并剥离。下一步写入目标会在场景中高亮。"}</span>
      </div>
    `;
    return;
  }
  state.inventory.forEach((tagId, index) => {
    const def = tag(tagId);
    const button = document.createElement("button");
    button.className = `inventory-token${index === state.selectedInventoryIndex ? " selected" : ""}`;
    button.type = "button";
    button.dataset.tag = tagId;
    button.dataset.index = String(index);
    button.title = tagCause(tagId);
    button.setAttribute("aria-pressed", index === state.selectedInventoryIndex ? "true" : "false");
    button.innerHTML = `<span style="background:${def.color}"></span><strong>${def.name}</strong><small>${inventoryRouteHint(tagId)}</small><em class="chip-cost">写${def.inject}</em>`;
    button.addEventListener("click", () => selectInventory(index));
    el.inventoryList.appendChild(button);
  });
}

function inventoryRouteHint(tagId) {
  const def = tag(tagId);
  if (!def || state.testMode === "low") return tagCause(tagId);
  const recommendedTargets = recommendedObjectIds()
    .map(objectById)
    .filter((obj) => obj && obj.openSlots.includes(def.slot) && def.compatible.includes(obj.type));
  if (recommendedTargets.length) {
    const scannedTargets = recommendedTargets.filter((obj) => obj.scanned && !obj.lockedSlots.includes(def.slot));
    const prefix = scannedTargets.length ? "可写" : "先扫描";
    return `${prefix}：${recommendedTargets.map((obj) => obj.name).slice(0, 2).join(" / ")}`;
  }
  const readyTargets = zoneObjects().filter((obj) => {
    return obj.scanned && obj.openSlots.includes(def.slot) && !obj.lockedSlots.includes(def.slot) && def.compatible.includes(obj.type);
  });
  if (readyTargets.length) return `可写：${readyTargets.map((obj) => obj.name).slice(0, 2).join(" / ")}`;
  const scanTargets = zoneObjects().filter((obj) => {
    return !obj.scanned && obj.openSlots.includes(def.slot) && def.compatible.includes(obj.type);
  });
  if (scanTargets.length) return `先扫描：${scanTargets.map((obj) => obj.name).slice(0, 2).join(" / ")}`;
  return tagCause(tagId);
}

function renderLog() {
  el.eventLog.innerHTML = state.log.map((item) => `
    <div class="event-line ${item.type}">
      <span>${formatTime(item.t ?? 0)} / ${item.zone || zone().id}</span>
      <strong>${item.message}</strong>
    </div>
  `).join("") || "<span class='hint'>还没有事件。</span>";
}

function renderMetrics() {
  const report = buildReport();
  const completeHtml = report.completed
    ? `<div class="completion-report">切片完成：${formatTime(report.elapsedSec)}。Boss语义操作 ${report.metrics.bossSemanticActions} 次，组合反应 ${report.metrics.reactions} 次。</div>`
    : "";
  const longestZone = report.summary.longestZone ? `${report.summary.longestZone.zone} ${formatTime(report.summary.longestZone.durationSec)}` : "-";
  el.metricsBox.innerHTML = `
    <div class="metrics-grid">
      ${metricHtml("模式", report.summary.modeLabel)}
      ${metricHtml("本区", formatTime(report.summary.activeZoneElapsedSec))}
      ${metricHtml("扫描", report.metrics.scans)}
      ${metricHtml("剥离", report.metrics.extracts)}
      ${metricHtml("注入", report.metrics.injects)}
      ${metricHtml("反应", report.metrics.reactions)}
      ${metricHtml("质量", `${report.audit.grade} ${report.audit.score}`)}
      ${metricHtml("误操作", report.metrics.warnings + report.metrics.blockedActions)}
      ${metricHtml("撤销", report.metrics.undoUses)}
      ${metricHtml("检查点", report.metrics.checkpointRestores)}
      ${metricHtml("Boss语义", report.metrics.bossSemanticActions)}
      ${metricHtml("护文反制", report.metrics.bossPhaseCounters?.length ?? 0)}
      ${metricHtml("首扫", timeOrDash(report.metrics.firstScanSec))}
      ${metricHtml("首取", timeOrDash(report.metrics.firstExtractSec))}
      ${metricHtml("首写", timeOrDash(report.metrics.firstInjectSec))}
      ${metricHtml("最长区", longestZone)}
    </div>
    ${completeHtml}
  `;
}

function calculateEndingBadges(report) {
  const badges = [];
  
  // Reaction Master
  const reactionTypes = new Set(Object.entries(report.metrics.reactionCounts).filter(([k,v]) => v > 0).map(([k,v]) => k)).size;
  if (reactionTypes >= 3 || report.metrics.reactions >= 4) {
    badges.push({
      icon: "🧪",
      name: "反应大师",
      desc: "成功触发了全部三种核心语义组合反应。"
    });
  }

  // Ink Efficiency
  if (report.ink >= 10) {
    badges.push({
      icon: "✒️",
      name: "省墨专家",
      desc: "通关时仍保留 10 点以上的充足原墨。"
    });
  }

  // Parry Master
  if (report.metrics.parries >= 2) {
    badges.push({
      icon: "🛡️",
      name: "完美防卫者",
      desc: "在断廊战斗中成功执行了两次完美弹反。"
    });
  }

  // No Undo
  if (report.metrics.undoUses === 0 && report.metrics.checkpointRestores === 0) {
    badges.push({
      icon: "⏳",
      name: "无瑕修正者",
      desc: "没有使用任何撤销或检查点恢复通过全关。"
    });
  }

  if (badges.length === 0) {
    badges.push({
      icon: "📜",
      name: "合格异墨者",
      desc: "成功克服故障谜题，跨入修正文库门槛。"
    });
  }

  return badges;
}

function renderCompletionPanel() {
  if (!el.completionPanel) return;
  const report = buildReport();
  if (!report.completed) {
    el.completionPanel.className = "completion-panel hidden";
    el.completionPanel.innerHTML = "";
    return;
  }
  
  if (!state.completionSfxPlayed) {
    audio.playSfx("success");
    state.completionSfxPlayed = true;
  }

  const longestDuration = Math.max(1, ...report.zoneDurations.map((item) => item.durationSec));
  const verdict = completionVerdict(report);
  const zoneRows = report.zoneDurations.map((item) => `
    <tr>
      <td>${item.zone}</td>
      <td>${item.mode}</td>
      <td><span class="duration-cell"><i style="width:${Math.max(4, item.durationSec / longestDuration * 100)}%"></i><b>${formatTime(item.durationSec)}</b></span></td>
      <td>${item.outcome}</td>
    </tr>
  `).join("");
  const reactionRows = report.reactionLedger.map((item) => `<span>${item.label}<strong>${item.count}</strong></span>`).join("");
  const frictionRows = report.experience.frictions.length
    ? report.experience.frictions.map((item) => `<li>${item}</li>`).join("")
    : "<li>本轮未记录明显体验摩擦。</li>";
  const fixRows = report.experience.nextFixes.length
    ? report.experience.nextFixes.map((item) => `<li>${item}</li>`).join("")
    : "<li>保持低引导真人复测。</li>";
  const failureRows = report.experience.failureLedger.length
    ? report.experience.failureLedger.map((item) => `<span>${item.label}<strong>${item.count}</strong></span>`).join("")
    : "<span>无阻塞<strong>0</strong></span>";
  const auditRisks = report.audit.risks.length
    ? report.audit.risks.map((item) => `<li>${item}</li>`).join("")
    : "<li>未发现明显阻塞。</li>";
    
  const badges = calculateEndingBadges(report);
  const badgeHtml = badges.map(b => `
    <div class="ending-badge">
      <span class="icon">${b.icon}</span>
      <span class="name">${b.name}</span>
      <span class="desc">${b.desc}</span>
    </div>
  `).join("");

  el.completionPanel.className = "completion-panel";
  el.completionPanel.innerHTML = `
    <div class="completion-head">
      <div>
        <p class="label">通关总结</p>
        <h2>断句庭院切片完成</h2>
      </div>
      <div class="completion-actions">
        <button class="quiet-button" type="button" data-completion-action="restart-guided">引导重开</button>
        <button class="quiet-button" type="button" data-completion-action="restart-low">低引导重开</button>
        <button class="quiet-button" type="button" data-completion-action="report">导出报告</button>
      </div>
    </div>
    <div class="summary-grid">
      ${metricHtml("总用时", formatTime(report.elapsedSec))}
      ${metricHtml("最长区", `${report.summary.longestZone.zone} ${formatTime(report.summary.longestZone.durationSec)}`)}
      ${metricHtml("误操作", report.summary.totalMistakes)}
      ${metricHtml("质量", `${report.audit.grade} ${report.audit.score}`)}
      ${metricHtml("组合反应", report.metrics.reactions)}
      ${metricHtml("Boss语义", report.metrics.bossSemanticActions)}
      ${metricHtml("护文反制", report.metrics.bossPhaseCounters?.length ?? 0)}
      ${metricHtml("检查点", report.metrics.checkpointRestores)}
      ${metricHtml("撤销", report.metrics.undoUses)}
    </div>
    
    <div class="completion-badges-section">
      <p class="label" style="text-align:center; margin-bottom: 12px; font-weight:700;">获得异墨勋章 (Badges Earned)</p>
      <div class="ending-badge-list">${badgeHtml}</div>
    </div>

    <div class="completion-verdict ${verdict.tone}">
      <strong>${verdict.title}</strong>
      <span>${verdict.detail}</span>
    </div>
    <div class="completion-audit">
      <div>
        <p class="label">反应覆盖</p>
        <div class="reaction-ledger">${reactionRows}</div>
      </div>
      <div>
        <p class="label">审计提示</p>
        <ul>${auditRisks}</ul>
      </div>
    </div>
    <div class="completion-audit experience-review">
      <div>
        <p class="label">体验摩擦</p>
        <ul>${frictionRows}</ul>
      </div>
      <div>
        <p class="label">整改线索</p>
        <ul>${fixRows}</ul>
      </div>
      <div>
        <p class="label">失败账本</p>
        <div class="reaction-ledger">${failureRows}</div>
      </div>
    </div>
    
    <div class="pitch-container">
      <h4>关注《语弦生态：创世纪》主线开发 / Add to Wishlist</h4>
      <p>完整版将包含 5 大文明语系变迁、主谓宾句法因果闭环、实时流体物理模拟及更宏大的叙事修正冒险！</p>
      <button class="wishlist-btn" onclick="window.open('https://github.com/wangjiehu/echo-string-genesis-prototype', '_blank')">🚀 关注项目开源库 / Wishlist</button>
    </div>

    <table class="zone-summary-table">
      <thead><tr><th>区域</th><th>模式</th><th>耗时</th><th>结果</th></tr></thead>
      <tbody>${zoneRows}</tbody>
    </table>
  `;
}

function completionVerdict(report) {
  if (report.audit.score >= 92 && report.metrics.bossPhaseCounters?.length >= 3) {
    return { tone: "good", title: "路径稳定", detail: "本轮覆盖三种组合反应；自动路线只能证明规则可达，仍需真人点击复测。" };
  }
  if (report.summary.totalMistakes === 0 && report.metrics.undoUses === 0) {
    return { tone: "good", title: "路径稳定", detail: "本轮没有误操作和撤销，主线理解负担较低。" };
  }
  if (report.summary.totalMistakes <= 2) {
    return { tone: "warn", title: "路径可用", detail: "存在少量停顿或试错，适合继续观察对应区域的提示强度。" };
  }
  return { tone: "bad", title: "需要复盘", detail: "误操作偏多，优先查看最长区域和最近事件，定位卡点。" };
}

function renderReportData() {
  if (!el.reportData) return;
  el.reportData.textContent = JSON.stringify(buildReport(), null, 2);
}

function metricHtml(label, value) {
  return `<div class="metric"><span>${label}</span><strong>${value}</strong></div>`;
}

function timeOrDash(value) {
  return value == null ? "-" : formatTime(value);
}

function buildReport() {
  const completed = isCompleted();
  const summary = reportSummary();
  const zoneDurations = zoneDurationsSnapshot();
  return {
    project: "Echo-String: Genesis",
    prototype: "Duanju Courtyard",
    uxBuild: BUILD_LABEL,
    uxBuildName: BUILD_NAME,
    rollout: structuredClone(BUILD_ROLLOUT),
    sessionId: state.sessionId,
    testMode: state.testMode,
    testModeLabel: currentModeLabel(),
    completed,
    elapsedSec: state.metrics.completedAt ?? elapsedSeconds(),
    activeZoneElapsedSec: activeZoneElapsedSec(),
    currentZone: zone().id,
    ink: state.ink,
    inventory: state.inventory.map(tagName),
    flags: { ...state.flags },
    metrics: structuredClone(state.metrics),
    zoneDurations,
    summary,
    audit: currentAudit(),
    experience: experienceAudit(),
    failureLedger: failureLedger(),
    reactionLedger: reactionLedger(),
    recovery: recoveryState(),
    currentHint: nextHint(),
    currentSteps: zoneSteps(),
    latestLog: state.log.map((item) => item.message)
  };
}

function downloadReport() {
  const report = buildReport();
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `duanju-courtyard-report-${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  log("试玩报告已生成。", "good");
  render();
}

async function sharePlayableLink() {
  const url = new URL(window.location.href);
  url.hash = "";
  url.search = "";
  const playableUrl = url.toString();
  try {
    await navigator.clipboard.writeText(playableUrl);
    log("试玩链接已复制。", "good");
  } catch {
    log(`试玩链接：${playableUrl}`, "good");
  }
  render();
}

function runShortcut(key) {
  const normalized = key.toLowerCase();
  const shortcutMap = {
    s: scanSelected,
    e: extractSelectedTag,
    i: injectSelectedInventory,
    h: heavyStrike,
    p: parry,
    n: nextZone
  };
  const fn = shortcutMap[normalized];
  if (!fn) return;
  state.metrics.shortcutsUsed += 1;
  fn();
}

function initSettings() {
  if (typeof document === "undefined") return;
  const settingsBtn = document.getElementById("settingsBtn");
  const settingsPanel = document.getElementById("settingsPanel");
  const closeSettingsBtn = document.getElementById("closeSettingsBtn");
  const bgmVolumeSlider = document.getElementById("bgmVolumeSlider");
  const bgmVolumeVal = document.getElementById("bgmVolumeVal");
  const sfxVolumeSlider = document.getElementById("sfxVolumeSlider");
  const sfxVolumeVal = document.getElementById("sfxVolumeVal");
  const resetSaveDataBtn = document.getElementById("resetSaveDataBtn");

  if (settingsBtn && settingsPanel && closeSettingsBtn) {
    settingsBtn.addEventListener("click", () => {
      settingsPanel.classList.remove("hidden");
      renderSettingsZones();
    });
    closeSettingsBtn.addEventListener("click", () => {
      settingsPanel.classList.add("hidden");
    });
  }

  if (bgmVolumeSlider && bgmVolumeVal) {
    bgmVolumeSlider.addEventListener("input", (e) => {
      const val = e.target.value;
      bgmVolumeVal.textContent = `${val}%`;
      audio.setBgmVolume(val / 100);
    });
  }

  if (sfxVolumeSlider && sfxVolumeVal) {
    sfxVolumeSlider.addEventListener("input", (e) => {
      const val = e.target.value;
      sfxVolumeVal.textContent = `${val}%`;
      audio.setSfxVolume(val / 100);
    });
  }

  if (resetSaveDataBtn) {
    resetSaveDataBtn.addEventListener("click", () => {
      if (confirm("确定要清空本地存档吗？所有关卡进度将被重置。")) {
        localStorage.removeItem("echo_string_save_v1.1");
        state.zone = 0;
        state.ink = 12;
        state.inventory = [];
        state.flags = {};
        state.unlockedZones = ["Z1"];
        state.zones = freshZones();
        log("本地存档已清空。", "warn");
        if (settingsPanel) settingsPanel.classList.add("hidden");
        render();
      }
    });
  }
}

function renderSettingsZones() {
  const container = document.getElementById("settingsZoneSelect");
  if (!container) return;
  container.innerHTML = "";
  
  const unlocked = state.unlockedZones || ["Z1"];
  state.zones.forEach((z, index) => {
    const isUnlocked = unlocked.includes(z.id) || index <= state.zone;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `settings-zone-btn ${isUnlocked ? "unlocked" : "locked"} ${index === state.zone ? "active" : ""}`;
    btn.textContent = z.id;
    if (index === state.zone) {
      btn.title = "当前所在区域";
    } else if (isUnlocked) {
      btn.addEventListener("click", () => {
        audio.playSfx("success");
        recordZoneDuration("manual-switch");
        state.zone = index;
        state.selectedObjectId = null;
        state.selectedTagId = null;
        state.selectedInventoryIndex = null;
        state.metrics.zoneVisits[zone().id] = (state.metrics.zoneVisits[zone().id] || 0) + 1;
        state.metrics.zoneVisitStartSec = elapsedSeconds();
        const settingsPanel = document.getElementById("settingsPanel");
        if (settingsPanel) settingsPanel.classList.add("hidden");
        render();
      });
    } else {
      btn.className += " locked";
      btn.disabled = true;
      btn.title = "通关前置关卡解锁";
    }
    container.appendChild(btn);
  });
}

function initPrologue() {
  if (typeof document === "undefined") return;
  const overlay = document.getElementById("prologueOverlay");
  const startBtn = document.getElementById("startPrologueBtn");
  
  const isRegression = (
    window.__echoRuntimeIsTesting || 
    new URLSearchParams(window.location.search).has("regression") || 
    document.body?.dataset?.domClickMode || 
    window.location.search.includes("mode=")
  );

  if (isRegression) {
    if (overlay) overlay.classList.add("hidden");
    audio.isMuted = true;
    return;
  }

  if (startBtn && overlay) {
    startBtn.addEventListener("click", () => {
      overlay.classList.add("hidden");
      audio.init();
      audio.playSfx("success");
    });
  }
}

el.resetBtn.addEventListener("click", resetGame);
el.undoBtn.addEventListener("click", undoLastSemanticAction);
el.checkpointBtn.addEventListener("click", restoreZoneCheckpoint);
el.shareLinkBtn.addEventListener("click", sharePlayableLink);
el.restartSessionBtn.addEventListener("click", resetGame);
el.modeButtons.forEach((button) => {
  button.addEventListener("click", () => setTestMode(button.dataset.mode));
});
if (el.themeToggleBtn) {
  el.themeToggleBtn.addEventListener("click", () => {
    state.theme = state.theme === "light" ? "dark" : "light";
    applyTheme();
    saveGameToLocal();
    if (typeof audio !== "undefined" && audio.playSfx) {
      audio.playSfx("success");
    }
  });
}
el.clearInventoryBtn.addEventListener("click", () => {
  if (state.inventory.length) pushUndo("清空临时词库");
  state.inventory = [];
  state.selectedInventoryIndex = null;
  log("临时词库已清空。", "warn");
  render();
});
el.refillInkBtn.addEventListener("click", refillInk);
el.resetZoneBtn.addEventListener("click", resetCurrentZone);
el.downloadReportBtn.addEventListener("click", downloadReport);
el.completionPanel.addEventListener("click", (event) => {
  const actionName = event.target?.dataset?.completionAction;
  if (!actionName) return;
  if (actionName === "report") return downloadReport();
  if (actionName === "restart-guided") {
    state.testMode = "guided";
    return resetGame();
  }
  if (actionName === "restart-low") {
    state.testMode = "low";
    return resetGame();
  }
});
window.addEventListener("keydown", (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (["s", "e", "i", "h", "p", "n"].includes(event.key.toLowerCase())) {
    event.preventDefault();
    runShortcut(event.key);
  }
});
setInterval(() => {
  if (!isCompleted()) {
    el.elapsedValue.textContent = formatTime(elapsedSeconds());
    renderMetrics();
    renderReportData();
  }
}, 1000);
window.__echoRuntime = { state, el, BUILD_LABEL, TEST_MODES };

window.__echoString = {
  buildReport,
  setTestMode,
  currentState: () => ({
    zone: zone().id,
    testMode: state.testMode,
    hint: nextHint(),
    metrics: structuredClone(state.metrics),
    flags: { ...state.flags }
  })
};

applyInitialModeFromUrl();
loadGameFromLocal();
initPrologue();
initSettings();
initLayoutInteractive();
saveZoneCheckpoint("Z1入口检查点");
if (!state.log.length) {
  log("选择封文大门或裂纹石像开始。", "good");
}
render();

// Global Hover Sound Effect Delegation
if (typeof document !== "undefined") {
  document.body.addEventListener("mouseover", (e) => {
    const target = e.target.closest("button, .tag-pill, .object-card, .inventory-item, .settings-zone-btn");
    if (target && target !== window.__lastHoveredElement) {
      window.__lastHoveredElement = target;
      if (typeof audio !== "undefined" && audio.playSfx) {
        audio.playSfx("hover");
      }
    }
  });
  document.body.addEventListener("mouseout", (e) => {
    const target = e.target.closest("button, .tag-pill, .object-card, .inventory-item, .settings-zone-btn");
    if (target && (!e.relatedTarget || !e.relatedTarget.closest || e.relatedTarget.closest("button, .tag-pill, .object-card, .inventory-item, .settings-zone-btn") !== target)) {
      window.__lastHoveredElement = null;
    }
  });
}

function initLayoutInteractive() {
  if (typeof document === "undefined") return;

  const isRegression = (
    window.__echoRuntimeIsTesting || 
    new URLSearchParams(window.location.search).has("regression") || 
    document.body?.dataset?.domClickMode || 
    window.location.search.includes("mode=")
  );
  if (isRegression) {
    document.body.classList.add("regression-mode");
  }

  if (el.travelMapBtn && el.zonePanel) {
    el.travelMapBtn.addEventListener("click", () => {
      el.zonePanel.classList.toggle("open");
    });
  }
  if (el.closeTravelBtn && el.zonePanel) {
    el.closeTravelBtn.addEventListener("click", () => {
      el.zonePanel.classList.remove("open");
    });
  }

  if (el.toggleLogsBtn && el.bottomPanel) {
    el.toggleLogsBtn.addEventListener("click", () => {
      el.bottomPanel.classList.toggle("open");
    });
  }

  if (el.closeInspectorBtn && el.inspectorPanel) {
    el.closeInspectorBtn.addEventListener("click", () => {
      el.inspectorPanel.classList.remove("open");
    });
  }
}
