/**
 * 御魂副本派生（设计文档 §4.3 / S6）—— 纯函数，无 IO。
 *
 * **为什么「今天掉什么」必须在这里算**：数据形态是内联的
 * `dungeons[].drops: [{ soulId, dow? }]`（`dow` 缺省 = 常驻不挑日子），
 * 不是原型的 `weekly: [{ dow, souls[], random, tip }]` 现成数组。
 * 把派生逻辑放组件里会导致：7 日条、今日掉落、跟随本三处各算一遍且容易算歪。
 *
 * 实测数据（10 副本）的三种形态，本模块都要覆盖：
 *   1. 轮换本（`weekly`）：drops 带 1–5 的 dow —— 八岐系周六/周日无名单 + `weekendRandom` → 随机
 *   2. 常驻本（`fixed`）：drops 无 dow —— 不挑日子
 *   3. 跟随本（`follow`）：自带常驻 drops + `followId` 指向另一个副本
 * 另有 `followOld`（永生之海的"老魂跟随魂十当天"）——与 `followId` 语义不同，单独派生。
 */
import type { DayTip, Dungeon, DungeonMode } from '../api/types';

/** 副本模式文案（原型 MODE_LABEL，措辞保持不变） */
export const MODE_LABEL: Record<DungeonMode, string> = {
  weekly: '按星期轮换',
  follow: '跟随八岐',
  fixed: '固定掉落',
  special: '特殊产出',
};

/** 7 日条顺序：周一 → 周日。**不是 0–6 自然序** —— 周重置是周一，日条要跟游戏认知一致 */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

export interface DungeonDay {
  /** 该日必掉的御魂 id；周末随机时为空数组 */
  souls: string[];
  /** 随机池：名单官方未公布，只能提示"随机"（八岐系周六/周日） */
  random: boolean;
  /** 攻略提示：`dayTips`（按副本+星期）优先，回落到副本级 `tip` */
  tip: string;
}

/** 是否存在按星期变化的掉落 —— 决定要不要渲染 7 日条（常驻本渲染它是纯噪音） */
export const hasDayGrid = (d: Dungeon): boolean => d.drops.some((x) => x.dow !== undefined);

/** 某个副本在星期 `dow` 的掉落与提示 */
export function dungeonDay(d: Dungeon, dow: number, tips: DayTip[]): DungeonDay {
  const souls = d.drops.filter((x) => x.dow === undefined || x.dow === dow).map((x) => x.soulId);
  return {
    souls,
    /* 当天无名单 **且** 标了周末随机 → 才判定为随机池。
       否则"这天本来就不掉"会被误标成随机，用户会一直等一个不存在的池子。 */
    random: souls.length === 0 && d.weekendRandom === true,
    tip: tips.find((t) => t.dungeonId === d.id && t.dow === dow)?.tip ?? d.tip ?? '',
  };
}

/** 解析 `followId` 指向的副本（跟随本 = 它当天掉什么，我就跟着掉什么） */
export function resolveFollow(d: Dungeon, dungeons: Dungeon[]): Dungeon | null {
  if (!d.followId) return null;
  return dungeons.find((x) => x.id === d.followId) ?? null;
}

export interface OldFollowInfo {
  /** 被跟随副本名 */
  name: string;
  souls: string[];
  /** 被跟随副本当天是随机池 */
  random: boolean;
}

/**
 * `followOld`（仅永生之海）：**老魂部分**跟随目标副本当天，专属海鲜仍按自己那天的表走。
 * 与 `followId` 的区别：`followId` 是"整本跟随"，`followOld` 是"只有老魂跟随"。
 */
export function oldFollowInfo(d: Dungeon, dungeons: Dungeon[], tips: DayTip[], dow: number): OldFollowInfo | null {
  if (!d.followOld) return null;
  const target = dungeons.find((x) => x.id === d.followOld);
  if (!target) return null;
  const day = dungeonDay(target, dow, tips);
  return { name: target.name, souls: day.souls, random: day.random };
}

/** 按 `section` 分组，组内与组间都按 `sort` 升序（组间顺序由 UI 按字典 sort 重排） */
export function groupBySection(dungeons: Dungeon[]): { section: string; list: Dungeon[] }[] {
  const groups = new Map<string, Dungeon[]>();
  for (const d of [...dungeons].sort((a, b) => a.sort - b.sort)) {
    const list = groups.get(d.section);
    if (list) list.push(d);
    else groups.set(d.section, [d]);
  }
  return [...groups.entries()].map(([section, list]) => ({ section, list }));
}
