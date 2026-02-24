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

function getActiveTransformation(transformations, id) {
  const fallback = transformations[0] || {
    id: "base",
    name: "Base Form",
    multiplier: 1,
    kiModifier: 1,
    attackBonus: 0,
    damageBonus: 0,
    defenseBonus: 0,
    initiativeBonus: 0,
    speedBonus: 0,
    notes: "",
  };
  return transformations.find((t) => t.id === id) || fallback;
}

export function computeDerived(state, transformations) {
  const form = getActiveTransformation(transformations, state.activeTransformationId);
  const formAbilityBonuses = form.abilityBonuses || {};
  const boostedAbilities = {
    str: toNumber(state.abilities.str) + toNumber(formAbilityBonuses.str),
    dex: toNumber(state.abilities.dex) + toNumber(formAbilityBonuses.dex),
    con: toNumber(state.abilities.con) + toNumber(formAbilityBonuses.con),
    int: toNumber(state.abilities.int) + toNumber(formAbilityBonuses.int),
    wis: toNumber(state.abilities.wis) + toNumber(formAbilityBonuses.wis),
    cha: toNumber(state.abilities.cha) + toNumber(formAbilityBonuses.cha),
    spi: toNumber(state.abilities.spi) + toNumber(formAbilityBonuses.spi),
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

  const maxHp = Math.max(1, toNumber(state.resources.maxHp, 1));
  const currentHp = clamp(toNumber(state.resources.currentHp), 0, maxHp);

  const baseKi = Math.max(0, toNumber(state.resources.baseKi));
  const rawMaxKi = (baseKi + level * 4 + mods.spi * 3) * toNumber(form.kiModifier, 1);
  const maxKi = Math.max(1, Math.floor(rawMaxKi));
  const currentKi = clamp(toNumber(state.resources.currentKi), 0, maxKi);

  const attackStat = state.combat.attackStat || "str";
  const attackStatMod = mods[attackStat] ?? 0;
  const attackBonus =
    prof + attackStatMod + toNumber(state.combat.attackBonusFlat) + toNumber(form.attackBonus);
  const damageBonus = attackStatMod + toNumber(state.combat.damageBonusFlat) + toNumber(form.damageBonus);

  const defense = Math.max(
    1,
    10 + mods.dex + toNumber(state.combat.defenseBonus) + toNumber(form.defenseBonus),
  );
  const initiative = mods.dex + toNumber(state.combat.initiativeBonus) + toNumber(form.initiativeBonus);
  const speed = Math.max(0, toNumber(state.combat.baseSpeed) + toNumber(form.speedBonus));
  const techSaveDc = 8 + prof + mods.spi + toNumber(state.combat.techSaveBonus);
  const kiRecovery = Math.max(
    1,
    Math.floor(level / 2) + mods.spi + toNumber(state.resources.kiRecoveryFlat),
  );

  return {
    mods,
    boostedAbilities,
    level,
    proficiencyBonus: prof,
    form,
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
