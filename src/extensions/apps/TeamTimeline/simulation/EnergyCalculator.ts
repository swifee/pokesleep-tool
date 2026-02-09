/**
 * EnergyCalculator.ts
 * ポケモンのげんき値を時間帯ごとに計算するモジュール
 */

/** げんき値の上限（スキル回復時） */
export const MAX_ENERGY = 150;

/** げんき値の通常上限 */
export const DEFAULT_MAX_ENERGY = 100;

/** げんき回復ボーナス時の上限 */
export const ERB_MAX_ENERGY = 105;

/** 睡眠スコア100%の睡眠時間（8.5時間 = 510分） */
export const FULL_SLEEP_MINUTES = 510;

/** げんき減少率（1分あたり0.1減少、10分で1減少） */
export const ENERGY_DECAY_RATE = 0.1;

/** 起床回復計算の入力 */
export interface WakeRecoveryInput {
    /** 睡眠時間（分） */
    sleepMinutes: number;
    /** 性格補正 (0.88/1.0/1.2) */
    recoveryFactor: number;
    /** ERBサブスキル有無 */
    hasEnergyRecoveryBonus: boolean;
    /** チームのERB持ち数（自分除く） */
    teamErbCount: number;
    /** 既使用睡眠スコア（複数睡眠対応） */
    usedSleepScore: number;
}

/** 起床回復計算の出力 */
export interface WakeRecoveryOutput {
    /** 回復量 */
    recoveredEnergy: number;
    /** 使用した睡眠スコア */
    sleepScoreUsed: number;
    /** 適用された上限 */
    maxEnergy: number;
}

/** げんき計算の入力パラメータ */
export interface EnergyInput {
  /** 開始時のげんき値 */
  startEnergy: number;
  /** 経過時間（分） */
  durationMinutes: number;
  /** 食事ラベルかどうか（時間帯開始時に食事回復を適用） */
  isMealSlot: boolean;
  /** チームからのスキル回復量合計 */
  teamSkillRecovery: number;
}

/** げんき計算の結果 */
export interface EnergyOutput {
  /** 終了時のげんき値 */
  endEnergy: number;
  /** 食事による回復量 */
  mealRecovery: number;
  /** スキルによる回復量（実際に適用された量） */
  skillRecovery: number;
  /** 平均げんき値（おてつだい効率計算用） */
  averageEnergy: number;
}

/**
 * 食事による回復量を計算
 * @param energy 現在のげんき値
 * @returns 食事による回復量
 */
export function getMealRecovery(energy: number): number {
  if (energy > 80) return 1;
  if (energy > 60) return 2;
  if (energy > 40) return 3;
  if (energy > 20) return 4;
  return 5;
}

/**
 * げんき値によるおてつだい効率倍率を返す（仕様書準拠）
 * @param energy げんき値
 * @returns 効率倍率
 */
export function getEfficiencyMultiplier(energy: number): number {
  if (energy >= 81) return 2.2;
  if (energy >= 61) return 1.6;
  if (energy >= 41) return 1.2;
  if (energy >= 1) return 1.0;
  return 0.45; // energy === 0
}

/**
 * 時間帯内での加重平均効率を計算
 * げんきが減少していく中で、各効率帯の時間を加重平均
 *
 * @param startEnergy 開始時のげんき値
 * @param durationMinutes 経過時間（分）
 * @returns 加重平均効率倍率
 *
 * @example
 * // 開始げんき85、経過60分の場合
 * // 0-50分: げんき85→80 (効率2.2)
 * // 50-60分: げんき80→79 (効率1.6)
 * // 加重平均 = (50*2.2 + 10*1.6) / 60
 * calculateWeightedEfficiency(85, 60); // 約2.13
 */
export function calculateWeightedEfficiency(
  startEnergy: number,
  durationMinutes: number
): number {
  if (durationMinutes <= 0) {
    return getEfficiencyMultiplier(startEnergy);
  }

  // 効率が変わる境界値（降順）
  const thresholds = [81, 61, 41, 1, 0];

  let currentEnergy = startEnergy;
  let remainingTime = durationMinutes;
  let weightedSum = 0;

  for (let i = 0; i < thresholds.length; i++) {
    if (remainingTime <= 0) break;
    if (currentEnergy < thresholds[i]) continue;

    const currentMultiplier = getEfficiencyMultiplier(currentEnergy);

    // 次の境界までのげんき値の差
    const nextThreshold = i < thresholds.length - 1 ? thresholds[i + 1] : -1;
    const energyToNextThreshold = currentEnergy - nextThreshold;

    // 次の境界に達するまでの時間（分）
    const timeToNextThreshold = energyToNextThreshold / ENERGY_DECAY_RATE;

    // この効率帯での滞在時間
    const timeInThisBand = Math.min(remainingTime, timeToNextThreshold);

    // 加重値を加算
    weightedSum += timeInThisBand * currentMultiplier;

    // 時間とげんき値を更新
    remainingTime -= timeInThisBand;
    currentEnergy -= timeInThisBand * ENERGY_DECAY_RATE;
  }

  // 残り時間がある場合（げんきが0になった後）
  if (remainingTime > 0) {
    weightedSum += remainingTime * getEfficiencyMultiplier(0);
  }

  return weightedSum / durationMinutes;
}

/**
 * 時間帯のげんき変化を計算
 *
 * 処理順序:
 * 1. 食事回復（isMealSlot=trueなら時間帯開始時に適用）
 * 2. スキル回復を適用（上限MAX_ENERGY=150）
 * 3. 経過時間によるげんき減少（duration * ENERGY_DECAY_RATE）
 * 4. 平均げんき値を計算
 * 5. 終了時げんきは0未満にならない
 *
 * @param input げんき計算の入力パラメータ
 * @returns げんき計算の結果
 */
export function calculateEnergy(input: EnergyInput): EnergyOutput {
  const {
    startEnergy,
    durationMinutes,
    isMealSlot,
    teamSkillRecovery,
  } = input;

  let currentEnergy = startEnergy;
  let mealRecovery = 0;
  let skillRecovery = 0;

  // 1. 食事回復（時間帯開始時）
  if (isMealSlot) {
    mealRecovery = getMealRecovery(currentEnergy);
    currentEnergy = Math.min(currentEnergy + mealRecovery, DEFAULT_MAX_ENERGY);
  }

  // 2. スキル回復（上限MAX_ENERGY=150）
  if (teamSkillRecovery > 0) {
    const energyBeforeSkill = currentEnergy;
    currentEnergy = Math.min(currentEnergy + teamSkillRecovery, MAX_ENERGY);
    skillRecovery = currentEnergy - energyBeforeSkill;
  }

  // 食事・スキル回復後のげんき値を記録（平均計算用）
  const energyAfterRecovery = currentEnergy;

  // 3. 経過時間によるげんき減少
  const energyDecay = durationMinutes * ENERGY_DECAY_RATE;
  currentEnergy -= energyDecay;

  // 4. 終了時げんきは0未満にならない
  const endEnergy = Math.max(currentEnergy, 0);

  // 5. 平均げんき値を計算（加重平均効率を使用）
  const averageEnergy = calculateWeightedEfficiency(
    energyAfterRecovery,
    durationMinutes
  ) * energyAfterRecovery / getEfficiencyMultiplier(energyAfterRecovery);

  return {
    endEnergy,
    mealRecovery,
    skillRecovery,
    averageEnergy,
  };
}

/**
 * 睡眠スコアを計算
 * @param sleepMinutes 睡眠時間（分）
 * @returns 睡眠スコア (0-100)
 */
export function calculateSleepScore(sleepMinutes: number): number {
    const rawScore = Math.round(sleepMinutes / FULL_SLEEP_MINUTES * 100);
    return Math.min(rawScore, 100);
}

/**
 * 起床時げんき回復を計算
 *
 * 計算式:
 * sleepRecovery = min(wakeMax,
 *   sleepScore * recoveryFactor * (1 + 0.14 * teamErbCount))
 *
 * @param input 起床回復計算の入力
 * @returns 起床回復計算の出力
 */
export function calculateWakeRecovery(input: WakeRecoveryInput): WakeRecoveryOutput {
    const {
        sleepMinutes,
        recoveryFactor,
        hasEnergyRecoveryBonus,
        teamErbCount,
        usedSleepScore,
    } = input;

    // 上限を決定
    const maxEnergy = hasEnergyRecoveryBonus ? ERB_MAX_ENERGY : DEFAULT_MAX_ENERGY;

    // 睡眠スコアを計算
    const rawSleepScore = calculateSleepScore(sleepMinutes);

    // 1日の上限（100 - 既使用スコア）
    const remainingQuota = 100 - usedSleepScore;
    const sleepScoreUsed = Math.min(rawSleepScore, remainingQuota);

    // チームボーナスを適用
    const teamBonus = 1 + 0.14 * teamErbCount;
    const rawRecovery = sleepScoreUsed * recoveryFactor * teamBonus;

    // 上限でカット
    const recoveredEnergy = Math.min(Math.round(rawRecovery), maxEnergy);

    return { recoveredEnergy, sleepScoreUsed, maxEnergy };
}
