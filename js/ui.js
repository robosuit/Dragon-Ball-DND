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
  races: [{ id: "human", name: "Earthling", statBonuses: {}, features: [] }],
};

const fallbackClasses = {
  classes: [{ id: "martial_artist", name: "Martial Artist", statBonuses: {}, features: [] }],
};

const fallbackProfessions = {
  professions: [{ id: "soldier", name: "Soldier", statBonuses: {}, features: [] }],
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
      notes: "Fallback base form.",
      source: "Core",
    },
  ],
};

const fallbackTechniques = {
  techniques: [],
};

const gameData = {
  races: fallbackRaces.races,
  classes: fallbackClasses.classes,
  professions: fallbackProfessions.professions,
  transformations: fallbackTransformations.transformations,
  techniques: fallbackTechniques.techniques,
};

const rollLog = [];
const lineagePresets = ["full", "half_human", "quarter_human", "half_hybrid", "quarter_hybrid"];
const sectionHelp = {
  overview: {
    title: "Overview Help",
    text: "Set ancestry, class, and profession. Bonuses apply automatically to stats and combat.",
    source: "Sheet rules engine",
  },
  combat: {
    title: "Combat Help",
    text: "Combat fields are base values. Race, class, profession, and active form bonuses are auto-applied.",
    source: "Sheet rules engine",
  },
  techniques: {
    title: "Techniques Help",
    text: "Technique cards use your current lineage and active form modifiers.",
    source: "Dragon Ball DnD techniques",
  },
  transformations: {
    title: "Transformations Help",
    text: "Only transformations legal for your ancestry mix are shown.",
    source: "Race-restricted transformation filter",
  },
  assets: {
    title: "Assets Help",
    text: "Reference view for race/class/profession traits and allowed forms.",
    source: "Race/Class/Profession assets",
  },
  skills: {
    title: "Skills Help",
    text: "Track custom skill notes and table rulings here.",
    source: "Campaign notes",
  },
  inventory: {
    title: "Inventory Help",
    text: "Track equipment, capsules, and consumables.",
    source: "Campaign notes",
  },
  notes: {
    title: "Notes Help",
    text: "General notes for roleplay and session planning.",
    source: "Campaign notes",
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

function setText(id, value) {
  const node = byId(id);
  if (node) {
    node.textContent = String(value ?? "");
  }
}

function signed(value) {
  return value >= 0 ? `+${value}` : `${value}`;
}

function setMeter(id, current, max) {
  const safeMax = Math.max(1, max);
  const pct = (Math.max(0, current) / safeMax) * 100;
  const meter = byId(id);
  if (meter) {
    meter.style.width = `${Math.max(0, Math.min(100, pct))}%`;
  }
}

function setList(id, items) {
  const target = byId(id);
  if (!target) {
    return;
  }
  target.replaceChildren();
  for (const item of items) {
    const li = document.createElement("li");
    li.textContent = item;
    target.appendChild(li);
  }
  if (!items.length) {
    const li = document.createElement("li");
    li.textContent = "None";
    target.appendChild(li);
  }
}

function populateSelect(selectId, entries) {
  const select = byId(selectId);
  if (!select) {
    return;
  }
  const current = select.value;
  select.replaceChildren();
  for (const entry of entries) {
    const option = document.createElement("option");
    option.value = entry.id;
    option.textContent = entry.name;
    select.appendChild(option);
  }
  if (entries.some((entry) => entry.id === current)) {
    select.value = current;
  }
}

function findAlternativeRace(primary) {
  const fallback = gameData.races.find((race) => race.id !== primary);
  return fallback ? fallback.id : primary;
}

function ensureSelectionDefaults(state) {
  const next = clone(state);
  let changed = false;

  if (!gameData.races.some((race) => race.id === next.meta.primaryRaceId)) {
    next.meta.primaryRaceId = gameData.races[0]?.id || "human";
    changed = true;
  }
  if (!lineagePresets.includes(next.meta.lineagePreset)) {
    next.meta.lineagePreset = "full";
    changed = true;
  }
  if (!gameData.classes.some((item) => item.id === next.meta.classId)) {
    next.meta.classId = gameData.classes[0]?.id || "martial_artist";
    changed = true;
  }
  if (!gameData.professions.some((item) => item.id === next.meta.professionId)) {
    next.meta.professionId = gameData.professions[0]?.id || "soldier";
    changed = true;
  }

  const primary = next.meta.primaryRaceId;
  if (next.meta.lineagePreset === "full") {
    if (next.meta.secondaryRaceId) {
      next.meta.secondaryRaceId = "";
      changed = true;
    }
  } else if (next.meta.lineagePreset === "half_human" || next.meta.lineagePreset === "quarter_human") {
    if (next.meta.secondaryRaceId !== "human") {
      next.meta.secondaryRaceId = "human";
      changed = true;
    }
  } else {
    const isValidSecondary = gameData.races.some((race) => race.id === next.meta.secondaryRaceId);
    if (!isValidSecondary || next.meta.secondaryRaceId === primary) {
      next.meta.secondaryRaceId = findAlternativeRace(primary);
      changed = true;
    }
  }

  if (changed) {
    setState(next);
    return false;
  }
  return true;
}

function updateSecondaryRaceVisibility(state) {
  const wrapper = byId("secondary-race-wrap");
  if (!wrapper) {
    return;
  }
  const preset = state.meta.lineagePreset;
  const requiresSecondary = preset === "half_hybrid" || preset === "quarter_hybrid";
  wrapper.classList.toggle("is-hidden", !requiresSecondary);
}

function initializeDataSelectors() {
  populateSelect("primary-race-select", gameData.races);
  populateSelect("secondary-race-select", gameData.races);
  populateSelect("class-select", gameData.classes);
  populateSelect("profession-select", gameData.professions);
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

function syncInputsFromState(state) {
  const elements = Array.from(document.querySelectorAll("[data-bind]"));
  elements.forEach((element) => {
    if (document.activeElement === element) {
      return;
    }
    const value = getPath(state, element.dataset.bind);
    element.value = value == null ? "" : String(value);
  });
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
    select.replaceChildren();
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No slots";
    select.appendChild(option);
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
    pushRollLog("Saved current character to slot.");
  });

  byId("slot-load-btn").addEventListener("click", () => {
    if (!activeSlotId) {
      pushRollLog("No slot selected to load.");
      return;
    }
    const loaded = loadFromSlot(activeSlotId);
    pushRollLog(loaded ? "Loaded selected slot." : "Could not load selected slot.");
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
}

function updateHelpForActiveTab() {
  setHelpContent(sectionHelp[activeTabId] || sectionHelp.overview);
}

function normalizeStatKey(raw) {
  const key = String(raw || "").trim().toLowerCase();
  const map = {
    str: "str",
    strength: "str",
    dex: "dex",
    dexterity: "dex",
    agility: "dex",
    con: "con",
    constitution: "con",
    tenacity: "con",
    int: "int",
    intelligence: "int",
    scholarship: "int",
    wis: "wis",
    wisdom: "wis",
    insight: "wis",
    cha: "cha",
    charisma: "cha",
    personality: "cha",
    spi: "spi",
    spirit: "spi",
    potency: "spi",
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
  return parts.reduce((sum, key) => {
    if (key === "none") {
      return sum;
    }
    return sum + readNumber(derived.mods[key], 0);
  }, 0);
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

function formatFormRequirements(form) {
  const chunks = [];
  const required = form.requiredRaceShares || {};
  const requiredEntries = Object.entries(required);
  if (requiredEntries.length) {
    chunks.push(
      `Requires ${requiredEntries
        .map(([raceId, share]) => `${raceId} ${Math.round(readNumber(share) * 100)}%`)
        .join(" + ")}`,
    );
  }
  if (Array.isArray(form.allowedRaceIds) && form.allowedRaceIds.length) {
    const min = Math.round(readNumber(form.minRaceShare, 1) * 100);
    chunks.push(`Allowed races: ${form.allowedRaceIds.join(", ")} (${min}%+)`);
  }
  return chunks.join(" | ") || "Universal";
}

function renderTransformationSection(state, derived) {
  const select = byId("transformation-select");
  const forms = derived.allowedTransformations || [];
  if (!select || !forms.length) {
    return true;
  }

  const validIds = forms.map((form) => form.id);
  if (!validIds.includes(state.activeTransformationId)) {
    setState((previous) => {
      const next = clone(previous);
      next.activeTransformationId = forms[0].id;
      return next;
    });
    return false;
  }

  if (select.options.length !== forms.length) {
    select.replaceChildren();
    for (const form of forms) {
      const option = document.createElement("option");
      option.value = form.id;
      option.textContent = form.name;
      select.appendChild(option);
    }
  }
  select.value = state.activeTransformationId;

  const abilityBonuses = Object.entries(derived.form.abilityBonuses || {})
    .filter(([, value]) => readNumber(value) !== 0)
    .map(([stat, value]) => `${stat.toUpperCase()} ${signed(readNumber(value))}`)
    .join(", ");

  setList("form-details", [
    `Power Multiplier: x${derived.form.multiplier}`,
    `Ki Modifier: x${derived.form.kiModifier}`,
    `Attack Bonus: ${signed(readNumber(derived.form.attackBonus))}`,
    `Damage Bonus: ${signed(readNumber(derived.form.damageBonus))}`,
    `Defense Bonus: ${signed(readNumber(derived.form.defenseBonus))}`,
    `Speed Bonus: ${signed(readNumber(derived.form.speedBonus))}`,
    `Ability Bonuses: ${abilityBonuses || "None"}`,
    `Requirements: ${formatFormRequirements(derived.form)}`,
    `Source: ${derived.form.source || "Custom"}`,
    `Notes: ${derived.form.notes || "None"}`,
  ]);
  return true;
}

function renderOverviewBonuses(derived) {
  const raceStats = Object.entries(derived.raceComposite.statBonuses)
    .filter(([, value]) => Math.abs(readNumber(value)) > 0)
    .map(([stat, value]) => `${stat.toUpperCase()} ${signed(readNumber(value).toFixed(2))}`)
    .join(", ");
  const classStats = Object.entries(derived.selectedClass.statBonuses || {})
    .filter(([, value]) => Math.abs(readNumber(value)) > 0)
    .map(([stat, value]) => `${stat.toUpperCase()} ${signed(readNumber(value))}`)
    .join(", ");
  const professionStats = Object.entries(derived.selectedProfession.statBonuses || {})
    .filter(([, value]) => Math.abs(readNumber(value)) > 0)
    .map(([stat, value]) => `${stat.toUpperCase()} ${signed(readNumber(value))}`)
    .join(", ");

  setList("overview-bonus-list", [
    `Lineage: ${derived.lineageLabel} (${derived.raceComposite.summary})`,
    `Race Stat Bonuses: ${raceStats || "None"}`,
    `Class Stat Bonuses: ${classStats || "None"}`,
    `Profession Stat Bonuses: ${professionStats || "None"}`,
    `Passive HP/Ki Bonuses: HP ${signed(derived.passiveBonuses.hpBonus)}, Ki ${signed(derived.passiveBonuses.kiBonus)}`,
  ]);
}

function renderAssetsSection(derived) {
  const raceTitle = derived.raceComposite.dominantRace
    ? `Race Profile - ${derived.raceComposite.dominantRace.name}`
    : "Race Profile";
  setText("asset-race-title", raceTitle);
  setText("asset-race-summary", `${derived.lineageLabel}: ${derived.raceComposite.summary}`);
  setList("asset-race-features", derived.raceComposite.features || []);

  setText("asset-class-title", `Class Profile - ${derived.selectedClass.name || "None"}`);
  setText("asset-class-summary", derived.selectedClass.source || "No source");
  setList("asset-class-features", derived.selectedClass.features || []);

  setText("asset-profession-title", `Profession Profile - ${derived.selectedProfession.name || "None"}`);
  setText("asset-profession-summary", derived.selectedProfession.source || "No source");
  setList("asset-profession-features", derived.selectedProfession.features || []);

  setText("asset-lineage-summary", `Current lineage: ${derived.lineageLabel}`);
  setList(
    "allowed-transforms-list",
    (derived.allowedTransformations || []).map(
      (form) => `${form.name} - ${formatFormRequirements(form)}`,
    ),
  );
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

function pushRollLog(text) {
  const stamp = new Date().toLocaleTimeString("en-US", { hour12: false });
  rollLog.unshift(`${stamp} - ${text}`);
  if (rollLog.length > 14) {
    rollLog.pop();
  }
  byId("roll-log").innerHTML = rollLog
    .map((entry) => `<div class="roll-entry">${escapeHtml(entry)}</div>`)
    .join("");
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
  if (!ensureSelectionDefaults(state)) {
    return;
  }

  updateSecondaryRaceVisibility(state);
  syncInputsFromState(state);
  renderSlotPicker();

  const derived = computeDerived(state, gameData);
  clampResourcesIfNeeded(derived, state);
  if (!renderTransformationSection(state, derived)) {
    return;
  }

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

  renderOverviewBonuses(derived);
  renderTechniques(derived);
  renderAssetsSection(derived);
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
    const derived = computeDerived(state, gameData);
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
  byId("apply-form-btn").addEventListener("click", () => {
    const selectedId = byId("transformation-select").value;
    setState((previous) => {
      const next = clone(previous);
      next.activeTransformationId = selectedId;
      return next;
    });
  });

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
    const derived = computeDerived(getState(), gameData);
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
    const derived = computeDerived(getState(), gameData);
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
    const derived = computeDerived(getState(), gameData);
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
      setState(JSON.parse(text));
      pushRollLog(`Imported ${file.name}.`);
    } catch {
      pushRollLog("Import failed: invalid JSON.");
    }
    event.target.value = "";
  });

  byId("reset-btn").addEventListener("click", () => {
    const confirmed = window.confirm("Reset this sheet to defaults?");
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
      return;
    }
    showHelpPanel();
    updateHelpForActiveTab();
  });

  byId("help-close-btn").addEventListener("click", hideHelpPanel);
}

async function init() {
  const [racesData, classesData, professionsData, transformationsData, techniquesData] = await Promise.all([
    loadJson("./data/races.json", fallbackRaces),
    loadJson("./data/classes.json", fallbackClasses),
    loadJson("./data/professions.json", fallbackProfessions),
    loadJson("./data/transformations.json", fallbackTransformations),
    loadJson("./data/techniques.json", fallbackTechniques),
  ]);

  gameData.races = racesData.races || fallbackRaces.races;
  gameData.classes = classesData.classes || fallbackClasses.classes;
  gameData.professions = professionsData.professions || fallbackProfessions.professions;
  gameData.transformations = transformationsData.transformations || fallbackTransformations.transformations;
  gameData.techniques = techniquesData.techniques || fallbackTechniques.techniques;

  initializeDataSelectors();
  setupTabs();
  setupBoundInputs();
  setupSlotActions();
  setupTechniquesEvents();
  setupQuickActions();
  setupFileActions();

  subscribe(render);
  loadState();

  const slots = listCharacterSlots();
  if (!slots.length) {
    activeSlotId = createCharacterSlot(getState().meta?.name || "Starter Character");
  } else {
    activeSlotId = slots[0].id;
  }

  updateHelpForActiveTab();
  render();
}

init();
