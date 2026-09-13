// Ajustes persistentes del jugador (localStorage).
const Settings = (() => {
  const KEY = "deriva_settings_v1";
  const PROGRESS_KEY = "deriva_progress_v1";

  const defaults = {
    sensitivity: 1.0, // 0.5 .. 2.0 — afecta ratón, WASD y flechas por igual
    chillTendrils: "few", // "none" | "few" | "normal"
  };

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { ...defaults };
      const parsed = JSON.parse(raw);
      return { ...defaults, ...parsed };
    } catch (e) {
      return { ...defaults };
    }
  }

  function loadProgress() {
    try {
      const raw = localStorage.getItem(PROGRESS_KEY);
      if (!raw) return { unlockedLevel: 0 };
      return { unlockedLevel: 0, ...JSON.parse(raw) };
    } catch (e) {
      return { unlockedLevel: 0 };
    }
  }

  const data = load();
  const progress = loadProgress();

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {}
  }
  function saveProgress() {
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)); } catch (e) {}
  }

  return {
    get(key) { return data[key]; },
    set(key, value) { data[key] = value; save(); },
    getUnlockedLevel() { return progress.unlockedLevel; },
    unlockLevel(i) {
      if (i > progress.unlockedLevel) { progress.unlockedLevel = i; saveProgress(); }
    },
  };
})();
