const STORAGE_KEY = "dragonball_dnd_sheet_v1";
const SLOT_STORAGE_KEY = "dragonball_dnd_sheet_slots_v1";

function createDefaultState() {
  return {
    meta: {
      name: "New Fighter",
      primaryRaceId: "human",
      secondaryRaceId: "",
      lineagePreset: "full",
      classId: "martial_artist",
      professionId: "soldier",
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

function readSlotsStore() {
  try {
    const raw = localStorage.getItem(SLOT_STORAGE_KEY);
    if (!raw) {
      return { slots: [] };
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.slots)) {
      return { slots: [] };
    }
    return { slots: parsed.slots.filter((slot) => isObject(slot) && slot.id) };
  } catch {
    return { slots: [] };
  }
}

function writeSlotsStore(store) {
  localStorage.setItem(SLOT_STORAGE_KEY, JSON.stringify(store));
}

function sanitizeSlotName(name, fallback) {
  const value = String(name || "").trim();
  return value || fallback;
}

export function listCharacterSlots() {
  const store = readSlotsStore();
  return [...store.slots]
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .map((slot) => ({
      id: slot.id,
      name: sanitizeSlotName(slot.name, "Unnamed Slot"),
      updatedAt: slot.updatedAt || 0,
    }));
}

export function createCharacterSlot(name = "") {
  const now = Date.now();
  const slotId = `slot_${now}`;
  const slotName = sanitizeSlotName(name, getState().meta?.name || "New Character");
  const store = readSlotsStore();
  store.slots.push({
    id: slotId,
    name: slotName,
    updatedAt: now,
    state: exportState(),
  });
  writeSlotsStore(store);
  return slotId;
}

export function saveCurrentToSlot(slotId, name = "") {
  const store = readSlotsStore();
  const now = Date.now();
  const index = store.slots.findIndex((slot) => slot.id === slotId);
  const slotName = sanitizeSlotName(name, getState().meta?.name || "Character");

  if (index >= 0) {
    store.slots[index] = {
      ...store.slots[index],
      name: slotName,
      updatedAt: now,
      state: exportState(),
    };
  } else {
    store.slots.push({
      id: slotId || `slot_${now}`,
      name: slotName,
      updatedAt: now,
      state: exportState(),
    });
  }
  writeSlotsStore(store);
}

export function loadFromSlot(slotId) {
  const store = readSlotsStore();
  const slot = store.slots.find((item) => item.id === slotId);
  if (!slot || !slot.state) {
    return false;
  }
  setState(slot.state);
  return true;
}

export function deleteCharacterSlot(slotId) {
  const store = readSlotsStore();
  const before = store.slots.length;
  store.slots = store.slots.filter((slot) => slot.id !== slotId);
  writeSlotsStore(store);
  return store.slots.length < before;
}
