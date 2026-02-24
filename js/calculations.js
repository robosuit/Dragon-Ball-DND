function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function signed(value) {
  return value >= 0 ? `+${value}` : `${value}`;
}

function abilityMod(score) {
  return Math.floor((toNumber(score) - 10) / 2);
}

function proficiencyBonus(level) {
  const safeLevel = Math.max(1, toNumber(level, 1));
  return 2 + Math.floor((safeLevel - 1) / 4);
}

function formatLargeNumber(value) {
  const safe = toNumber(value);
  const abs = Math.abs(safe);
  if (abs >= 10000000) {
    return safe.toExponential(2).replace("+", "");
  }
  return safe.toLocaleString("en-US");
}

function emptyStatBonuses() {
  return { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0, spi: 0 };
}

function emptyFlatBonuses() {
  return {
    hpBonus: 0,
    kiBonus: 0,
    speedBonus: 0,
    attackBonus: 0,
    damageBonus: 0,
    defenseBonus: 0,
    initiativeBonus: 0,
    techSaveBonus: 0,
    kiRecoveryBonus: 0,
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getById(list, id) {
  if (!Array.isArray(list) || !list.length) {
    return null;
  }
  return list.find((item) => item.id === id) || list[0];
}

function addBonuses(target, source, weight = 1) {
  const weighted = toNumber(weight, 1);
  const statSource = source?.statBonuses || {};
  for (const key of Object.keys(target.statBonuses)) {
    target.statBonuses[key] += toNumber(statSource[key]) * weighted;
  }
  for (const key of Object.keys(target.flats)) {
    target.flats[key] += toNumber(source?.[key]) * weighted;
  }
}

function cleanShares(shares) {
  const entries = Object.entries(shares).filter(([, share]) => toNumber(share) > 0);
  const total = entries.reduce((sum, [, share]) => sum + toNumber(share), 0);
  if (total <= 0) {
    return { human: 1 };
  }
  const normalized = {};
  for (const [id, share] of entries) {
    normalized[id] = toNumber(share) / total;
  }
  return normalized;
}

function resolveLineageShares(meta) {
  const primary = meta?.primaryRaceId || "human";
  const secondaryFallback = primary === "human" ? "saiyan" : "human";
  const secondary = meta?.secondaryRaceId || secondaryFallback;
  const preset = meta?.lineagePreset || "full";
  const shares = {};

  function addShare(id, amount) {
    if (!id) {
      return;
    }
    shares[id] = (shares[id] || 0) + toNumber(amount);
  }

  if (preset === "half_human") {
    addShare(primary, 0.5);
    addShare("human", 0.5);
    return cleanShares(shares);
  }
  if (preset === "quarter_human") {
    addShare(primary, 0.25);
    addShare("human", 0.75);
    return cleanShares(shares);
  }
  if (preset === "half_hybrid") {
    addShare(primary, 0.5);
    addShare(secondary, 0.5);
    return cleanShares(shares);
  }
  if (preset === "quarter_hybrid") {
    addShare(primary, 0.75);
    addShare(secondary, 0.25);
    return cleanShares(shares);
  }

  addShare(primary, 1);
  return cleanShares(shares);
}

function lineagePresetLabel(preset) {
  const labels = {
    full: "Full Blood",
    half_human: "Half Human Hybrid",
    quarter_human: "Quarter Human Hybrid",
    half_hybrid: "Half Hybrid (Any Two Races)",
    quarter_hybrid: "Quarter Hybrid (75/25)",
  };
  return labels[preset] || "Full Blood";
}

function resolveRaceComposite(races, shares, preset) {
  const raceMap = new Map((races || []).map((race) => [race.id, race]));
  const composite = {
    statBonuses: emptyStatBonuses(),
    flats: emptyFlatBonuses(),
    features: [],
    breakdown: [],
    summary: "",
    dominantRace: null,
    lineageLabel: lineagePresetLabel(preset),
  };

  const pool = { statBonuses: emptyStatBonuses(), flats: emptyFlatBonuses() };
  for (const [raceId, share] of Object.entries(shares)) {
    const race = raceMap.get(raceId);
    if (!race) {
      continue;
    }
    const weightedShare = toNumber(share);
    const raceModel = {
      statBonuses: race.statBonuses || {},
      hpBonus: race.hpBonus || 0,
      kiBonus: race.kiBonus || 0,
      speedBonus: race.speedBonus || 0,
      attackBonus: race.attackBonus || 0,
      damageBonus: race.damageBonus || 0,
      defenseBonus: race.defenseBonus || 0,
      initiativeBonus: race.initiativeBonus || 0,
      techSaveBonus: race.techSaveBonus || 0,
      kiRecoveryBonus: race.kiRecoveryBonus || 0,
    };
    addBonuses(pool, raceModel, weightedShare);

    const pct = Math.round(weightedShare * 100);
    composite.breakdown.push(`${race.name} ${pct}%`);
    for (const feature of race.features || []) {
      composite.features.push(`${race.name} ${pct}%: ${feature}`);
    }
  }

  composite.statBonuses = pool.statBonuses;
  composite.flats = pool.flats;
  composite.summary = composite.breakdown.join(" + ") || "No ancestry selected";

  let dominant = null;
  let maxShare = -1;
  for (const [raceId, share] of Object.entries(shares)) {
    if (share > maxShare && raceMap.has(raceId)) {
      maxShare = share;
      dominant = raceMap.get(raceId);
    }
  }
  composite.dominantRace = dominant;
  return composite;
}

function isTransformationAllowed(form, shares, meta) {
  const requiredShares = form.requiredRaceShares || {};
  for (const [raceId, minShare] of Object.entries(requiredShares)) {
    if (toNumber(shares[raceId]) < toNumber(minShare)) {
      return false;
    }
  }

  if (Array.isArray(form.allowedRaceIds) && form.allowedRaceIds.length) {
    const minShare = toNumber(form.minRaceShare, 1);
    let highestAllowedShare = 0;
    for (const raceId of form.allowedRaceIds) {
      highestAllowedShare = Math.max(highestAllowedShare, toNumber(shares[raceId]));
    }
    if (highestAllowedShare < minShare) {
      return false;
    }
  }

  if (Array.isArray(form.blockedLineages) && form.blockedLineages.includes(meta?.lineagePreset)) {
    return false;
  }
  return true;
}

function filterAllowedTransformations(transformations, shares, meta) {
  const safe = Array.isArray(transformations) ? transformations : [];
  const allowed = safe.filter((form) => isTransformationAllowed(form, shares, meta));
  if (allowed.length) {
    return allowed;
  }
  return [
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
  ];
}

function getActiveTransformation(allowedForms, activeId) {
  const list = Array.isArray(allowedForms) ? allowedForms : [];
  if (!list.length) {
    return {
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
    };
  }
  return list.find((form) => form.id === activeId) || list[0];
}

export function computeDerived(state, rules) {
  const races = rules?.races || [];
  const classes = rules?.classes || [];
  const professions = rules?.professions || [];
  const transformations = rules?.transformations || [];

  const lineageShares = resolveLineageShares(state.meta);
  const raceComposite = resolveRaceComposite(races, lineageShares, state.meta?.lineagePreset);
  const selectedClass = getById(classes, state.meta?.classId) || {
    id: "none",
    name: "None",
    statBonuses: {},
    features: [],
  };
  const selectedProfession = getById(professions, state.meta?.professionId) || {
    id: "none",
    name: "None",
    statBonuses: {},
    features: [],
  };

  const classPool = { statBonuses: emptyStatBonuses(), flats: emptyFlatBonuses() };
  addBonuses(classPool, selectedClass, 1);
  addBonuses(classPool, selectedProfession, 1);

  const allowedTransformations = filterAllowedTransformations(transformations, lineageShares, state.meta);
  const form = getActiveTransformation(allowedTransformations, state.activeTransformationId);
  const formAbilityBonuses = form.abilityBonuses || {};

  const boostedAbilities = {
    str:
      toNumber(state.abilities.str) +
      toNumber(raceComposite.statBonuses.str) +
      toNumber(classPool.statBonuses.str) +
      toNumber(formAbilityBonuses.str),
    dex:
      toNumber(state.abilities.dex) +
      toNumber(raceComposite.statBonuses.dex) +
      toNumber(classPool.statBonuses.dex) +
      toNumber(formAbilityBonuses.dex),
    con:
      toNumber(state.abilities.con) +
      toNumber(raceComposite.statBonuses.con) +
      toNumber(classPool.statBonuses.con) +
      toNumber(formAbilityBonuses.con),
    int:
      toNumber(state.abilities.int) +
      toNumber(raceComposite.statBonuses.int) +
      toNumber(classPool.statBonuses.int) +
      toNumber(formAbilityBonuses.int),
    wis:
      toNumber(state.abilities.wis) +
      toNumber(raceComposite.statBonuses.wis) +
      toNumber(classPool.statBonuses.wis) +
      toNumber(formAbilityBonuses.wis),
    cha:
      toNumber(state.abilities.cha) +
      toNumber(raceComposite.statBonuses.cha) +
      toNumber(classPool.statBonuses.cha) +
      toNumber(formAbilityBonuses.cha),
    spi:
      toNumber(state.abilities.spi) +
      toNumber(raceComposite.statBonuses.spi) +
      toNumber(classPool.statBonuses.spi) +
      toNumber(formAbilityBonuses.spi),
  };

  const mods = {
    str: abilityMod(boostedAbilities.str),
    dex: abilityMod(boostedAbilities.dex),
    con: abilityMod(boostedAbilities.con),
    int: abilityMod(boostedAbilities.int),
    wis: abilityMod(boostedAbilities.wis),
    cha: abilityMod(boostedAbilities.cha),
    spi: abilityMod(boostedAbilities.spi),
  };

  const level = Math.max(1, toNumber(state.meta.level, 1));
  const prof = proficiencyBonus(level);
  const plBase = Math.max(
    0,
    toNumber(state.progression.basePowerLevel) + toNumber(state.progression.powerBonusFlat),
  );
  const transformedPowerLevel = plBase * toNumber(form.multiplier, 1);

  const hpPool = toNumber(raceComposite.flats.hpBonus) + toNumber(classPool.flats.hpBonus);
  const baseMaxHp = toNumber(state.resources.maxHp, 1);
  const maxHp = Math.max(1, Math.floor(baseMaxHp + hpPool));
  const currentHp = clamp(toNumber(state.resources.currentHp), 0, maxHp);

  const kiPool = toNumber(raceComposite.flats.kiBonus) + toNumber(classPool.flats.kiBonus);
  const baseKi = Math.max(0, toNumber(state.resources.baseKi) + kiPool);
  const rawMaxKi = (baseKi + level * 4 + mods.spi * 3) * toNumber(form.kiModifier, 1);
  const maxKi = Math.max(1, Math.floor(rawMaxKi));
  const currentKi = clamp(toNumber(state.resources.currentKi), 0, maxKi);

  const passiveAttackBonus = toNumber(raceComposite.flats.attackBonus) + toNumber(classPool.flats.attackBonus);
  const passiveDamageBonus = toNumber(raceComposite.flats.damageBonus) + toNumber(classPool.flats.damageBonus);
  const passiveDefenseBonus = toNumber(raceComposite.flats.defenseBonus) + toNumber(classPool.flats.defenseBonus);
  const passiveInitiativeBonus =
    toNumber(raceComposite.flats.initiativeBonus) + toNumber(classPool.flats.initiativeBonus);
  const passiveSpeedBonus = toNumber(raceComposite.flats.speedBonus) + toNumber(classPool.flats.speedBonus);
  const passiveTechSaveBonus =
    toNumber(raceComposite.flats.techSaveBonus) + toNumber(classPool.flats.techSaveBonus);
  const passiveKiRecoveryBonus =
    toNumber(raceComposite.flats.kiRecoveryBonus) + toNumber(classPool.flats.kiRecoveryBonus);

  const attackStat = state.combat.attackStat || "str";
  const attackStatMod = mods[attackStat] ?? 0;
  const attackBonus =
    prof +
    attackStatMod +
    toNumber(state.combat.attackBonusFlat) +
    toNumber(form.attackBonus) +
    passiveAttackBonus;
  const damageBonus =
    attackStatMod + toNumber(state.combat.damageBonusFlat) + toNumber(form.damageBonus) + passiveDamageBonus;

  const defense = Math.max(
    1,
    10 +
      mods.dex +
      toNumber(state.combat.defenseBonus) +
      toNumber(form.defenseBonus) +
      passiveDefenseBonus,
  );
  const initiative =
    mods.dex + toNumber(state.combat.initiativeBonus) + toNumber(form.initiativeBonus) + passiveInitiativeBonus;
  const speed = Math.max(
    0,
    toNumber(state.combat.baseSpeed) + toNumber(form.speedBonus) + passiveSpeedBonus,
  );
  const techSaveDc = 8 + prof + mods.spi + toNumber(state.combat.techSaveBonus) + passiveTechSaveBonus;
  const kiRecovery = Math.max(
    1,
    Math.floor(level / 2) + mods.spi + toNumber(state.resources.kiRecoveryFlat) + passiveKiRecoveryBonus,
  );

  return {
    mods,
    boostedAbilities,
    level,
    proficiencyBonus: prof,
    form,
    allowedTransformations,
    lineageShares: clone(lineageShares),
    lineageLabel: lineagePresetLabel(state.meta?.lineagePreset),
    raceComposite,
    selectedClass,
    selectedProfession,
    transformedPowerLevel,
    transformedPowerLevelLabel: formatLargeNumber(transformedPowerLevel),
    currentHp,
    maxHp,
    currentKi,
    maxKi,
    attackBonus,
    damageBonus,
    defense,
    initiative,
    speed,
    techSaveDc,
    kiRecovery,
    passiveBonuses: {
      hpBonus: hpPool,
      kiBonus: kiPool,
      attackBonus: passiveAttackBonus,
      damageBonus: passiveDamageBonus,
      defenseBonus: passiveDefenseBonus,
      initiativeBonus: passiveInitiativeBonus,
      speedBonus: passiveSpeedBonus,
      techSaveBonus: passiveTechSaveBonus,
      kiRecoveryBonus: passiveKiRecoveryBonus,
    },
    signed,
    clamp,
    toNumber,
  };
}

export function rollDie(sides) {
  const count = Math.max(1, Math.floor(toNumber(sides, 20)));
  return Math.floor(Math.random() * count) + 1;
}

export function rollDiceExpression(expression) {
  const match = String(expression).trim().match(/^(\d+)d(\d+)$/i);
  if (!match) {
    return { total: 0, rolls: [], expression: "0d0" };
  }
  const numDice = Math.floor(toNumber(match[1], 0));
  const die = Math.floor(toNumber(match[2], 0));
  if (numDice <= 0 || die <= 0) {
    return { total: 0, rolls: [], expression: `${numDice}d${die}` };
  }
  const rolls = [];
  for (let i = 0; i < numDice; i += 1) {
    rolls.push(rollDie(die));
  }
  return { total: rolls.reduce((acc, value) => acc + value, 0), rolls, expression: `${numDice}d${die}` };
}
