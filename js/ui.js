import { computeDerived, rollDie, rollDiceExpression } from "./calculations.js";
import {
  createCharacterSlot,
  deleteCharacterSlot,
  exportState,
  getState,
  listCharacterSlots,
  loadFromSlot,
  loadState,
  resetState,
  saveCurrentToSlot,
  setState,
  subscribe,
} from "./state.js";

const fallbackRaces = {
  races: [
    {
      id: "android",
      name: "Android",
      subraces: ["Artificial Construct", "Cybernetic Organism", "Bio-Engineered"],
      hpModifier: { default: 4, bioEngineered: 5 },
      startingAttributes: { dex: 2, wis: 2, cha: 2, spi: 2, str: 2, con: 5 },
      source: "DragonBallRedux V2",
    },
    {
      id: "arcosian",
      name: "Arcosian",
      subraces: ["Arcosian"],
      hpModifier: { default: 3 },
      startingAttributes: { dex: 2, wis: 2, cha: 2, spi: 5, str: 2, con: 4 },
      source: "DragonBallRedux V2",
    },
    {
      id: "human",
      name: "Earthling",
      subraces: ["Earthling", "Beast-men"],
      hpModifier: { default: 6 },
      startingAttributes: {},
      source: "DragonBallRedux V2",
    },
    {
      id: "namekian",
      name: "Namekian",
      subraces: ["Warrior", "Priest"],
      hpModifier: { default: 4 },
      startingAttributes: { dex: 2, wis: 5, cha: 2, spi: 4, str: 2, con: 5 },
      source: "DragonBallRedux V2",
    },
    {
      id: "majin",
      name: "Majin",
      subraces: ["Majin"],
      hpModifier: { default: 3 },
      startingAttributes: { dex: 2, wis: 2, cha: 5, spi: 5, str: 2, con: 4 },
      source: "DragonBallRedux V2",
    },
    {
      id: "saiyan",
      name: "Saiyan",
      subraces: ["Full-Blood", "Half-Blood"],
      hpModifier: { default: 3 },
      startingAttributes: { dex: 4, wis: 2, cha: 2, spi: 2, str: 5, con: 5 },
      source: "DragonBallRedux V2",
    },
    {
      id: "shinjin",
      name: "Shinjin",
      subraces: ["Kaio", "Makaio"],
      hpModifier: { kaio: 5, makaio: 4 },
      startingAttributes: { wis: 5, spi: 5 },
      source: "DragonBallRedux V2",
    },
  ],
};

const fallbackTransformations = {
  transformations: [
    {
      id: "base",
      name: "Base Form",
      multiplier: 1,
      kiModifier: 1,
      attackBonus: 0,
      damageBonus: 0,
      defenseBonus: 0,
      initiativeBonus: 0,
      speedBonus: 0,
      notes: "No form bonus.",
    },
    {
      id: "kaioken_x2",
      name: "Kaioken x2",
      multiplier: 2,
      kiModifier: 0.9,
      attackBonus: 1,
      damageBonus: 2,
      defenseBonus: -1,
      initiativeBonus: 1,
      speedBonus: 10,
      hpUpkeep: 3,
      tierRequirement: "Tier 2+",
      notes: "High output with stamina strain.",
      source: "DBU Sourcebook",
    },
    {
      id: "kaioken_x3",
      name: "Kaioken x3",
      multiplier: 3,
      kiModifier: 0.8,
      attackBonus: 2,
      damageBonus: 3,
      defenseBonus: -2,
      initiativeBonus: 2,
      speedBonus: 15,
      hpUpkeep: 6,
      tierRequirement: "Tier 3+",
      notes: "Severe body stress.",
      source: "DBU Sourcebook",
    },
    {
      id: "kaioken_x4",
      name: "Kaioken x4",
      multiplier: 4,
      kiModifier: 0.75,
      attackBonus: 3,
      damageBonus: 4,
      defenseBonus: -3,
      initiativeBonus: 3,
      speedBonus: 20,
      hpUpkeep: 10,
      tierRequirement: "Tier 4+",
      notes: "Extreme body stress; use sparingly.",
      source: "DBU Sourcebook",
    },
    {
      id: "saiyan_pride",
      name: "Saiyan Pride",
      multiplier: 1,
      kiModifier: 1.05,
      attackBonus: 2,
      damageBonus: 2,
      defenseBonus: 1,
      initiativeBonus: 1,
      speedBonus: 5,
      abilityBonuses: { str: 1, dex: 1, con: 1, spi: 1 },
      tierRequirement: "Tier 4+",
      raceRequirement: "Saiyan",
      notes: "Racial transformation line focused on pressure and resolve.",
      source: "DBU Sourcebook",
    },
    {
      id: "earthling_spirit",
      name: "Earthling Spirit",
      multiplier: 1,
      kiModifier: 1.1,
      attackBonus: 1,
      damageBonus: 1,
      defenseBonus: 1,
      initiativeBonus: 1,
      speedBonus: 0,
      abilityBonuses: { str: 1, dex: 1, con: 1, spi: 1 },
      tierRequirement: "Tier 4+",
      raceRequirement: "Earthling",
      notes: "Discipline-based uplift; can stack in advanced stages.",
      source: "DBU Sourcebook",
    },
    {
      id: "hi_tension",
      name: "Hi-Tension",
      multiplier: 1,
      kiModifier: 1.1,
      attackBonus: 1,
      damageBonus: 2,
      defenseBonus: 0,
      initiativeBonus: 1,
      speedBonus: 5,
      abilityBonuses: { str: 1, con: 1, wis: 1, spi: 1 },
      tierRequirement: "Tier 4+",
      notes: "Focused pressure form with offensive spikes.",
      source: "DBU Sourcebook",
    },
    {
      id: "mushin",
      name: "Mushin",
      multiplier: 1,
      kiModifier: 1.15,
      attackBonus: 1,
      damageBonus: 1,
      defenseBonus: 1,
      initiativeBonus: 2,
      speedBonus: 5,
      abilityBonuses: { dex: 1, wis: 1 },
      tierRequirement: "Tier 4+",
      notes: "Calm focus form emphasizing action precision.",
      source: "DBU Sourcebook",
    },
    {
      id: "ascension",
      name: "Ascension",
      multiplier: 1,
      kiModifier: 1.2,
      attackBonus: 2,
      damageBonus: 2,
      defenseBonus: 1,
      initiativeBonus: 1,
      speedBonus: 0,
      abilityBonuses: { str: 1, int: 1, wis: 1, spi: 1, cha: 1 },
      tierRequirement: "Tier 4+",
      notes: "Shinjin progression with broad attribute growth.",
      source: "DBU Sourcebook",
    },
  ],
};

const fallbackTechniques = {
  techniques: [
    {
      id: "basic_physical",
      name: "Basic Physical",
      kiCost: 2,
      toHitBonus: 0,
      damageDice: "1d10",
      damageFlat: 0,
      usesAttackMod: true,
      damageStat: "str",
      range: "Melee",
      source: "DragonBallRedux V2 Basic Attacks",
      notes: "Core strike profile.",
    },
    {
      id: "sphere_energy_attack",
      name: "Sphere Energy Attack",
      kiCost: 2,
      toHitBonus: 0,
      damageDice: "1d10",
      damageFlat: 0,
      usesAttackMod: true,
      damageStat: "spi",
      range: "Ranged",
      source: "DragonBallRedux V2 Basic Attacks",
      notes: "Focused orb projectile.",
    },
    {
      id: "incantation",
      name: "Incantation",
      kiCost: 2,
      toHitBonus: 0,
      damageDice: "1d10",
      damageFlat: 0,
      usesAttackMod: true,
      damageStat: "spi",
      range: "Ranged",
      source: "DragonBallRedux V2 Basic Attacks",
      notes: "Channeled cast attack.",
    },
    {
      id: "rapid_fire",
      name: "Rapid Fire",
      kiCost: 10,
      toHitBonus: 0,
      damageDice: "2d10",
      damageFlat: 0,
      usesAttackMod: false,
      damageStat: "none",
      range: "Ranged",
      source: "DragonBallRedux V2 Basic Attacks",
      notes: "Multiple blasts in quick succession.",
    },
    {
      id: "guided",
      name: "Guided",
      kiCost: 7,
      toHitBonus: 0,
      damageDice: "1d10",
      damageFlat: 0,
      usesAttackMod: true,
      damageStat: "spi",
      range: "Ranged (can split hit chance)",
      source: "DragonBallRedux V2 Basic Attacks",
      notes: "Can choose full hit check or half-value guided variant.",
    },
    {
      id: "kiai",
      name: "Kiai",
      kiCost: 8,
      toHitBonus: 1,
      damageDice: "2d10",
      damageFlat: 0,
      usesAttackMod: true,
      damageStat: "spi",
      range: "Close burst",
      source: "DragonBallRedux V2 Basic Attacks",
      notes: "Short-range concussive blast.",
    },
    {
      id: "energy_focus",
      name: "Energy Focus",
      kiCost: 9,
      toHitBonus: 0,
      damageDice: "1d10",
      damageFlat: 0,
      usesAttackMod: true,
      damageStat: "str+spi",
      range: "Melee",
      source: "DragonBallRedux V2 Basic Attacks",
      notes: "Weapons/limbs wrapped in ki.",
    },
    {
      id: "blast",
      name: "Blast",
      kiCost: 6,
      toHitBonus: 0,
      damageDice: "1d10",
      damageFlat: 0,
      usesAttackMod: true,
      damageStat: "spi",
      range: "3x3 ft line",
      source: "DragonBallRedux V2 Basic Attacks",
      notes: "Linear area attack.",
    },
    {
      id: "explosion",
      name: "Explosion",
      kiCost: 9,
      toHitBonus: 0,
      damageDice: "1d10",
      damageFlat: 0,
      usesAttackMod: true,
      damageStat: "spi",
      range: "3x3 ft burst",
      source: "DragonBallRedux V2 Basic Attacks",
      notes: "Localized blast area.",
    },
    {
      id: "beam",
      name: "Beam",
      kiCost: 12,
      toHitBonus: 0,
      damageDice: "1d10",
      damageFlat: 0,
      usesAttackMod: true,
      damageStat: "spi",
      range: "Line",
      source: "DragonBallRedux V2 Basic Attacks",
      notes: "Sustained directional beam.",
    },
    {
      id: "combination",
      name: "Combination",
      kiCost: 10,
      toHitBonus: 0,
      damageDice: "2d10",
      damageFlat: 0,
      usesAttackMod: false,
      damageStat: "none",
      range: "Melee",
      source: "DragonBallRedux V2 Basic Attacks",
      notes: "Flurry sequence with fixed output profile.",
    },
    {
      id: "powered",
      name: "Powered",
      kiCost: 9,
      toHitBonus: 0,
      damageDice: "1d10",
      damageFlat: 0,
      usesAttackMod: true,
      damageStat: "str+spi",
      range: "Melee",
      source: "DragonBallRedux V2 Basic Attacks",
      notes: "Empowered physical attack.",
    },
    {
      id: "solar_flare",
      name: "Solar Flare",
      kiCost: 3,
      toHitBonus: 0,
      damageDice: "0d0",
      damageFlat: 0,
      usesAttackMod: false,
      range: "30 ft burst",
      notes: "Targets in range make Con save or are blinded.",
      source: "DBU common technique",
    },
  ],
};

const gameData = {
  races: fallbackRaces.races,
  transformations: fallbackTransformations.transformations,
  techniques: fallbackTechniques.techniques,
};

const rollLog = [];
const sectionHelp = {
  overview: {
    title: "Overview Help",
    text: "Set your identity, base stats, and power progression here. This tab drives all downstream combat calculations.",
    source: "Sheet guide",
  },
  combat: {
    title: "Combat Help",
    text: "Configure your attack stat and combat modifiers, then use quick actions for HP/Ki and initiative during turns.",
    source: "Sheet guide",
  },
  techniques: {
    title: "Techniques Help",
    text: "Roll or use techniques from this list. Use Technique spends Ki, and rolls use your current form and stat modifiers.",
    source: "DragonBallRedux V2 / DBU mapped data",
  },
  transformations: {
    title: "Transformations Help",
    text: "Pick a form and apply it. The sheet immediately updates power level, combat stats, and form-based modifiers.",
    source: "DBU sourcebook mapped metadata",
  },
  skills: {
    title: "Skills Help",
    text: "Use this space for proficiency notes, learned techniques, and situational bonuses your table tracks.",
    source: "Sheet guide",
  },
  inventory: {
    title: "Inventory Help",
    text: "Track gear, capsules, and consumables. Keep one item per line for fast in-session reference.",
    source: "Sheet guide",
  },
  notes: {
    title: "Notes Help",
    text: "Store roleplay notes, story flags, session goals, and reminders you need between games.",
    source: "Sheet guide",
  },
};
let activeTabId = "overview";
let helpPanelVisible = false;
let activeSlotId = "";

function byId(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function readNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function getPath(obj, path) {
  return path.split(".").reduce((acc, part) => (acc == null ? undefined : acc[part]), obj);
}

function setPath(obj, path, value) {
  const parts = path.split(".");
  let current = obj;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    if (typeof current[key] !== "object" || current[key] === null) {
      current[key] = {};
    }
    current = current[key];
  }
  current[parts[parts.length - 1]] = value;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function loadJson(path, fallback) {
  try {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to load ${path}`);
    }
    return await response.json();
  } catch {
    return fallback;
  }
}

function initializeDataLists() {
  const datalist = byId("race-options");
  datalist.replaceChildren();
  for (const race of gameData.races) {
    const option = document.createElement("option");
    option.value = race.name;
    datalist.appendChild(option);
  }
}

function formatSlotDate(updatedAt) {
  if (!updatedAt) {
    return "";
  }
  return new Date(updatedAt).toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderSlotPicker() {
  const select = byId("slot-select");
  if (!select) {
    return;
  }
  const slots = listCharacterSlots();
  if (!slots.length) {
    activeSlotId = "";
    select.innerHTML = `<option value="">No slots</option>`;
    return;
  }

  if (!activeSlotId || !slots.some((slot) => slot.id === activeSlotId)) {
    activeSlotId = slots[0].id;
  }

  select.replaceChildren();
  for (const slot of slots) {
    const option = document.createElement("option");
    option.value = slot.id;
    option.textContent = `${slot.name} - ${formatSlotDate(slot.updatedAt)}`;
    select.appendChild(option);
  }
  select.value = activeSlotId;
}

function setupSlotActions() {
  const select = byId("slot-select");
  select.addEventListener("change", () => {
    activeSlotId = select.value;
  });

  byId("slot-new-btn").addEventListener("click", () => {
    const suggested = getState().meta?.name || "New Character";
    const name = window.prompt("Slot name:", suggested);
    if (name === null) {
      return;
    }
    activeSlotId = createCharacterSlot(name);
    renderSlotPicker();
    pushRollLog(`Created slot "${name || suggested}".`);
  });

  byId("slot-save-btn").addEventListener("click", () => {
    const fallbackName = getState().meta?.name || "Character";
    if (!activeSlotId) {
      activeSlotId = createCharacterSlot(fallbackName);
    }
    saveCurrentToSlot(activeSlotId, fallbackName);
    renderSlotPicker();
    pushRollLog(`Saved current character to slot.`);
  });

  byId("slot-load-btn").addEventListener("click", () => {
    if (!activeSlotId) {
      pushRollLog("No slot selected to load.");
      return;
    }
    const loaded = loadFromSlot(activeSlotId);
    if (loaded) {
      pushRollLog("Loaded selected slot.");
      return;
    }
    pushRollLog("Could not load selected slot.");
  });

  byId("slot-delete-btn").addEventListener("click", () => {
    if (!activeSlotId) {
      pushRollLog("No slot selected to delete.");
      return;
    }
    const confirmed = window.confirm("Delete selected character slot?");
    if (!confirmed) {
      return;
    }
    const deleted = deleteCharacterSlot(activeSlotId);
    if (deleted) {
      activeSlotId = "";
      renderSlotPicker();
      pushRollLog("Deleted selected slot.");
      return;
    }
    pushRollLog("Could not delete selected slot.");
  });
}

function showHelpPanel() {
  helpPanelVisible = true;
  byId("help-panel").classList.add("active");
}

function hideHelpPanel() {
  helpPanelVisible = false;
  byId("help-panel").classList.remove("active");
}

function setHelpContent(payload) {
  if (!payload) {
    return;
  }
  setText("help-title", payload.title || "Help");
  setText("help-text", payload.text || "");
  setText("help-source", payload.source ? `Source: ${payload.source}` : "");
  if (helpPanelVisible) {
    byId("help-panel").classList.add("active");
  }
}

function updateHelpForActiveTab() {
  const info = sectionHelp[activeTabId] || sectionHelp.overview;
  setHelpContent(info);
}

function setupTabs() {
  const tabButtons = Array.from(document.querySelectorAll(".tab-btn"));
  const panels = Array.from(document.querySelectorAll(".tab-panel"));

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.tab;
      activeTabId = id;
      tabButtons.forEach((other) => other.classList.toggle("active", other === button));
      panels.forEach((panel) => panel.classList.toggle("active", panel.id === `tab-${id}`));
      updateHelpForActiveTab();
    });
  });
}

function setupBoundInputs() {
  const elements = Array.from(document.querySelectorAll("[data-bind]"));
  elements.forEach((element) => {
    const eventName = element.tagName === "SELECT" ? "change" : "input";
    element.addEventListener(eventName, () => {
      const path = element.dataset.bind;
      const type = element.dataset.type;
      let value = element.value;
      if (type === "number") {
        value = readNumber(value, 0);
      }

      setState((previous) => {
        const next = clone(previous);
        setPath(next, path, value);
        return next;
      });
    });
  });
}

function setText(id, value) {
  const node = byId(id);
  if (node) {
    node.textContent = String(value);
  }
}

function signed(value) {
  return value >= 0 ? `+${value}` : `${value}`;
}

function normalizeStatKey(raw) {
  const key = String(raw || "").trim().toLowerCase();
  const map = {
    strength: "str",
    str: "str",
    agility: "dex",
    dexterity: "dex",
    dex: "dex",
    tenacity: "con",
    con: "con",
    constitution: "con",
    scholarship: "int",
    int: "int",
    intelligence: "int",
    insight: "wis",
    wis: "wis",
    wisdom: "wis",
    personality: "cha",
    cha: "cha",
    charisma: "cha",
    spirit: "spi",
    potency: "spi",
    magic: "spi",
    spi: "spi",
    none: "none",
  };
  return map[key] || key;
}

function getModForStatSpec(derived, statSpec) {
  if (!statSpec) {
    return 0;
  }
  const parts = String(statSpec)
    .split("+")
    .map((part) => normalizeStatKey(part))
    .filter(Boolean);
  let total = 0;
  for (const key of parts) {
    if (key === "none") {
      continue;
    }
    total += readNumber(derived.mods[key], 0);
  }
  return total;
}

function computeTechniqueMath(technique, derived) {
  const hitStat = normalizeStatKey(technique.toHitStat || "");
  const baseHit =
    hitStat && hitStat !== "none"
      ? derived.proficiencyBonus + readNumber(derived.mods[hitStat], 0) + readNumber(technique.toHitBonus, 0)
      : derived.attackBonus + readNumber(technique.toHitBonus, 0);

  let damageMod = readNumber(technique.damageFlat, 0);
  if (technique.damageStat) {
    damageMod += getModForStatSpec(derived, technique.damageStat);
  } else if (technique.usesAttackMod) {
    damageMod += derived.damageBonus;
  }

  return { baseHit, damageMod };
}

function setMeter(id, current, max) {
  const safeMax = Math.max(1, max);
  const pct = (Math.max(0, current) / safeMax) * 100;
  const meter = byId(id);
  if (meter) {
    meter.style.width = `${Math.max(0, Math.min(100, pct))}%`;
  }
}

function syncInputsFromState(state) {
  const elements = Array.from(document.querySelectorAll("[data-bind]"));
  elements.forEach((element) => {
    if (document.activeElement === element) {
      return;
    }
    const value = getPath(state, element.dataset.bind);
    if (value === undefined || value === null) {
      element.value = "";
      return;
    }
    element.value = String(value);
  });
}

function renderTransformationSection(derived) {
  const select = byId("transformation-select");
  if (!select) {
    return;
  }

  if (select.options.length !== gameData.transformations.length) {
    select.replaceChildren();
    for (const form of gameData.transformations) {
      const option = document.createElement("option");
      option.value = form.id;
      option.textContent = form.name;
      select.appendChild(option);
    }
  }
  select.value = derived.form.id;

  const abilityBonuses = Object.entries(derived.form.abilityBonuses || {})
    .filter(([, value]) => readNumber(value) !== 0)
    .map(([stat, value]) => `${stat.toUpperCase()} ${signed(readNumber(value))}`)
    .join(", ");

  byId("form-details").innerHTML = [
    `<li><strong>Power Multiplier:</strong> x${escapeHtml(derived.form.multiplier)}</li>`,
    `<li><strong>Ki Modifier:</strong> x${escapeHtml(derived.form.kiModifier)}</li>`,
    `<li><strong>Attack Bonus:</strong> ${escapeHtml(signed(readNumber(derived.form.attackBonus)))}</li>`,
    `<li><strong>Damage Bonus:</strong> ${escapeHtml(signed(readNumber(derived.form.damageBonus)))}</li>`,
    `<li><strong>Defense Bonus:</strong> ${escapeHtml(signed(readNumber(derived.form.defenseBonus)))}</li>`,
    `<li><strong>Speed Bonus:</strong> ${escapeHtml(signed(readNumber(derived.form.speedBonus)))}</li>`,
    `<li><strong>Ability Bonuses:</strong> ${escapeHtml(abilityBonuses || "None")}</li>`,
    `<li><strong>Tier Requirement:</strong> ${escapeHtml(derived.form.tierRequirement || "None")}</li>`,
    `<li><strong>Race Requirement:</strong> ${escapeHtml(derived.form.raceRequirement || "None")}</li>`,
    `<li><strong>Ki Upkeep:</strong> ${readNumber(derived.form.kiUpkeep, 0)}</li>`,
    `<li><strong>HP Upkeep:</strong> ${readNumber(derived.form.hpUpkeep, 0)}</li>`,
    `<li><strong>Source:</strong> ${escapeHtml(derived.form.source || "Custom")}</li>`,
    `<li><strong>Notes:</strong> ${escapeHtml(derived.form.notes || "None")}</li>`,
  ].join("");

  if (activeTabId === "transformations") {
    setHelpContent({
      title: `${derived.form.name} Details`,
      text: derived.form.notes || "No notes.",
      source: derived.form.source || "Custom",
    });
  }
}

function pushRollLog(text) {
  const stamp = new Date().toLocaleTimeString("en-US", { hour12: false });
  rollLog.unshift(`${stamp} - ${text}`);
  if (rollLog.length > 12) {
    rollLog.pop();
  }

  byId("roll-log").innerHTML = rollLog
    .map((entry) => `<div class="roll-entry">${escapeHtml(entry)}</div>`)
    .join("");
}

function renderTechniques(derived) {
  const list = byId("techniques-list");
  list.innerHTML = gameData.techniques
    .map((technique) => {
      const { baseHit, damageMod } = computeTechniqueMath(technique, derived);
      const canUse = derived.currentKi >= readNumber(technique.kiCost);
      return `
        <article class="card technique-card">
          <h3>${escapeHtml(technique.name)}</h3>
          <p class="muted">${escapeHtml(technique.notes || "")}</p>
          <div class="technique-meta">
            <p><strong>Ki Cost:</strong> ${technique.kiCost}</p>
            <p><strong>TP Cost:</strong> ${technique.tpCost || 0}</p>
            <p><strong>Range:</strong> ${escapeHtml(technique.range || "-")}</p>
            <p><strong>To Hit:</strong> ${escapeHtml(signed(baseHit))}</p>
            <p><strong>Damage:</strong> ${escapeHtml(technique.damageDice)} ${escapeHtml(signed(damageMod))}</p>
            <p><strong>Source:</strong> ${escapeHtml(technique.source || "Custom")}</p>
          </div>
          <div class="technique-actions">
            <button class="btn btn-alt technique-info" data-tech="${technique.id}">Info</button>
            <button class="btn btn-alt technique-roll" data-tech="${technique.id}">Roll</button>
            <button class="btn technique-use" data-tech="${technique.id}" ${canUse ? "" : "disabled"}>Use Technique</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function applyTransformation() {
  const select = byId("transformation-select");
  if (!select) {
    return;
  }
  const selectedId = select.value;
  setState((previous) => {
    const next = clone(previous);
    next.activeTransformationId = selectedId;
    return next;
  });
}

function clampResourcesIfNeeded(derived, state) {
  if (derived.currentHp === state.resources.currentHp && derived.currentKi === state.resources.currentKi) {
    return;
  }
  setState((previous) => {
    const next = clone(previous);
    next.resources.currentHp = derived.currentHp;
    next.resources.currentKi = derived.currentKi;
    return next;
  });
}

function render() {
  const state = getState();
  const derived = computeDerived(state, gameData.transformations);

  syncInputsFromState(state);
  clampResourcesIfNeeded(derived, state);
  renderSlotPicker();

  setText("power-level-card", derived.transformedPowerLevelLabel);
  setText("active-form-card", derived.form.name);
  setText("defense-card", derived.defense);
  setText("attack-card", signed(derived.attackBonus));
  setText("save-dc-card", derived.techSaveDc);
  setText("speed-card", derived.speed);
  setText("initiative-card", signed(derived.initiative));

  setText("hp-current-label", derived.currentHp);
  setText("hp-max-label", derived.maxHp);
  setText("ki-current-label", derived.currentKi);
  setText("ki-max-label", derived.maxKi);
  setMeter("hp-meter-fill", derived.currentHp, derived.maxHp);
  setMeter("ki-meter-fill", derived.currentKi, derived.maxKi);

  setText("mod-str", signed(derived.mods.str));
  setText("mod-dex", signed(derived.mods.dex));
  setText("mod-con", signed(derived.mods.con));
  setText("mod-int", signed(derived.mods.int));
  setText("mod-wis", signed(derived.mods.wis));
  setText("mod-cha", signed(derived.mods.cha));
  setText("mod-spi", signed(derived.mods.spi));

  byId("prof-bonus-display").value = signed(derived.proficiencyBonus);
  byId("ki-recovery-display").value = derived.kiRecovery;

  renderTransformationSection(derived);
  renderTechniques(derived);
}

function setupTechniquesEvents() {
  const container = byId("techniques-list");
  container.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-tech]");
    if (!button) {
      return;
    }

    const techniqueId = button.dataset.tech;
    const technique = gameData.techniques.find((item) => item.id === techniqueId);
    if (!technique) {
      return;
    }

    const state = getState();
    const derived = computeDerived(state, gameData.transformations);
    const kiCost = readNumber(technique.kiCost);

    if (button.classList.contains("technique-use")) {
      if (derived.currentKi < kiCost) {
        pushRollLog(`${technique.name}: not enough Ki.`);
        return;
      }
      setState((previous) => {
        const next = clone(previous);
        next.resources.currentKi = Math.max(0, readNumber(next.resources.currentKi) - kiCost);
        return next;
      });
      pushRollLog(`${technique.name}: spent ${kiCost} Ki.`);
      return;
    }

    if (button.classList.contains("technique-info")) {
      showHelpPanel();
      setHelpContent({
        title: `${technique.name} Info`,
        text: technique.notes || "No notes.",
        source: technique.source || "Custom",
      });
      return;
    }

    if (button.classList.contains("technique-roll")) {
      const techniqueMath = computeTechniqueMath(technique, derived);
      const d20 = rollDie(20);
      const hitTotal = d20 + techniqueMath.baseHit;
      const damageRoll = rollDiceExpression(technique.damageDice);
      const damageTotal = damageRoll.total + techniqueMath.damageMod;

      pushRollLog(
        `${technique.name}: hit ${d20}${signed(hitTotal - d20)}=${hitTotal}, damage ${damageRoll.expression} (${damageRoll.rolls.join(",")}) ${signed(techniqueMath.damageMod)}=${damageTotal}`,
      );
    }
  });
}

function setupQuickActions() {
  byId("apply-form-btn").addEventListener("click", applyTransformation);
  byId("transformation-select").addEventListener("change", () => {
    const selectedId = byId("transformation-select").value;
    const selected = gameData.transformations.find((item) => item.id === selectedId);
    if (!selected) {
      return;
    }
    showHelpPanel();
    setHelpContent({
      title: `${selected.name} Preview`,
      text: selected.notes || "No notes.",
      source: selected.source || "Custom",
    });
  });

  byId("ki-recover-btn").addEventListener("click", () => {
    const state = getState();
    const derived = computeDerived(state, gameData.transformations);
    setState((previous) => {
      const next = clone(previous);
      next.resources.currentKi = Math.min(derived.maxKi, readNumber(next.resources.currentKi) + derived.kiRecovery);
      return next;
    });
    pushRollLog(`Recovered ${derived.kiRecovery} Ki.`);
  });

  byId("ki-spend-btn").addEventListener("click", () => {
    setState((previous) => {
      const next = clone(previous);
      next.resources.currentKi = Math.max(0, readNumber(next.resources.currentKi) - 1);
      return next;
    });
    pushRollLog("Spent 1 Ki.");
  });

  byId("hp-heal-btn").addEventListener("click", () => {
    const state = getState();
    const derived = computeDerived(state, gameData.transformations);
    setState((previous) => {
      const next = clone(previous);
      next.resources.currentHp = Math.min(derived.maxHp, readNumber(next.resources.currentHp) + 10);
      return next;
    });
    pushRollLog("Healed 10 HP.");
  });

  byId("hp-damage-btn").addEventListener("click", () => {
    setState((previous) => {
      const next = clone(previous);
      next.resources.currentHp = Math.max(0, readNumber(next.resources.currentHp) - 10);
      return next;
    });
    pushRollLog("Took 10 damage.");
  });

  byId("roll-initiative-btn").addEventListener("click", () => {
    const state = getState();
    const derived = computeDerived(state, gameData.transformations);
    const roll = rollDie(20);
    const total = roll + derived.initiative;
    pushRollLog(`Initiative: ${roll}${signed(derived.initiative)}=${total}`);
  });
}

function setupFileActions() {
  byId("export-btn").addEventListener("click", () => {
    const data = JSON.stringify(exportState(), null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const name = (getState().meta.name || "character").trim().replace(/\s+/g, "_");

    const a = document.createElement("a");
    a.href = url;
    a.download = `${name || "character"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  byId("import-input").addEventListener("change", async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) {
      return;
    }
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      setState(parsed);
      pushRollLog(`Imported ${file.name}.`);
    } catch {
      pushRollLog("Import failed: invalid JSON file.");
    }
    event.target.value = "";
  });

  byId("reset-btn").addEventListener("click", () => {
    const confirmed = window.confirm("Reset this sheet to default values?");
    if (!confirmed) {
      return;
    }
    resetState();
    pushRollLog("Character reset to defaults.");
  });

  byId("copy-link-btn").addEventListener("click", async () => {
    const link = window.location.href;
    try {
      await navigator.clipboard.writeText(link);
      pushRollLog("Sheet link copied to clipboard.");
    } catch {
      window.prompt("Copy this sheet link:", link);
    }
  });

  byId("help-toggle-btn").addEventListener("click", () => {
    if (helpPanelVisible) {
      hideHelpPanel();
    } else {
      showHelpPanel();
      updateHelpForActiveTab();
    }
  });

  byId("help-close-btn").addEventListener("click", hideHelpPanel);
}

async function init() {
  const [racesData, transformationsData, techniquesData] = await Promise.all([
    loadJson("./data/races.json", fallbackRaces),
    loadJson("./data/transformations.json", fallbackTransformations),
    loadJson("./data/techniques.json", fallbackTechniques),
  ]);

  gameData.races = racesData.races || fallbackRaces.races;
  gameData.transformations = transformationsData.transformations || fallbackTransformations.transformations;
  gameData.techniques = techniquesData.techniques || fallbackTechniques.techniques;

  setupTabs();
  setupBoundInputs();
  setupSlotActions();
  setupTechniquesEvents();
  setupQuickActions();
  setupFileActions();
  initializeDataLists();

  subscribe(render);
  loadState();
  updateHelpForActiveTab();
  const slots = listCharacterSlots();
  if (!slots.length) {
    activeSlotId = createCharacterSlot(getState().meta?.name || "Starter Character");
  } else {
    activeSlotId = slots[0].id;
  }

  const formExists = gameData.transformations.some((form) => form.id === getState().activeTransformationId);
  if (!formExists) {
    setState((previous) => {
      const next = clone(previous);
      next.activeTransformationId = gameData.transformations[0]?.id || "base";
      return next;
    });
  }

  render();
}

init();
