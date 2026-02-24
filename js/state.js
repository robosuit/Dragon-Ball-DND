const STORAGE_KEY = "dragonball_dnd_sheet_v1";

function createDefaultState() {
  return {
    meta: {
      name: "New Fighter",
      race: "Saiyan",
      level: 1,
      alignment: "Neutral",
    },
    abilities: {
      str: 14,
      dex: 14,
      con: 14,
      int: 10,
      wis: 10,
      cha: 10,
      spi: 14,
    },
    progression: {
      basePowerLevel: 500,
      powerBonusFlat: 0,
    },
    resources: {
      maxHp: 32,
      currentHp: 32,
      baseKi: 12,
      currentKi: 12,
      kiRecoveryFlat: 0,
    },
    combat: {
      attackStat: "str",
      baseSpeed: 30,
      defenseBonus: 0,
      initiativeBonus: 0,
      attackBonusFlat: 0,
      damageBonusFlat: 0,
      techSaveBonus: 0,
    },
    activeTransformationId: "base",
    skills: {
      notes: "",
    },
    inventory: {
      items: "",
    },
    notes: {
      general: "",
    },
  };
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function deepMerge(base, override) {
  if (Array.isArray(base)) {
    return Array.isArray(override) ? override : base;
  }

  if (!isObject(base)) {
    return override === undefined ? base : override;
  }

  const result = { ...base };
  for (const key of Object.keys(result)) {
    result[key] = deepMerge(result[key], override?.[key]);
  }
  return result;
}

function normalizeState(raw) {
  const base = createDefaultState();
  if (!isObject(raw)) {
    return base;
  }
  return deepMerge(base, raw);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

let state = createDefaultState();
const subscribers = new Set();

function notify() {
  for (const fn of subscribers) {
    fn(state);
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function getState() {
  return state;
}

export function subscribe(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

export function setState(updater, options = {}) {
  const next = typeof updater === "function" ? updater(state) : updater;
  state = normalizeState(next);
  if (!options.skipSave) {
    persist();
  }
  notify();
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      state = createDefaultState();
      persist();
      return;
    }
    state = normalizeState(JSON.parse(raw));
    persist();
  } catch {
    state = createDefaultState();
    persist();
  }
}

export function resetState() {
  state = createDefaultState();
  persist();
  notify();
}

export function exportState() {
  return clone(state);
}
