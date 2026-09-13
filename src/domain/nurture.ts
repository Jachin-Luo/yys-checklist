/**
 * 结界寄养时间派生（S6）—— 纯函数，无 IO。
 *
 * 规则（原型 v6 定稿，需求侧已确认）：**每次 6 小时**，记下「上卡时间」后，
 * 自动排出往后每 6h 的收/续点（跨天标 明天/后天/日期）。
 *
 * 两个状态刻意分开：
 *   - **任务**（`started: true`）：记录已过 / 未到 / 下一个
 *   - **计划**（`started: false`）：纯查看，不背状态；决定开刷时点「开始」转正
 * 这个区分是有意义的 —— 用户常常只是"打算这个点寄"，并不想一存就被判成未到。
 */

/** 寄养间隔（小时）。写成常量而不是散落的 6 —— 官方若调整，只改这一处 */
export const NURTURE_HOURS = 6;
/** 往后推的点数上限（5 个 ≈ 30h，够覆盖一张 6 星卡） */
export const MAX_NURTURE_N = 5;

export interface NurtureRecord {
  id: string;
  /** 上卡时间 `HH:mm` */
  base: string;
  /** 往后推几个 6h 点 */
  n: number;
  /** true = 任务（记状态） / false = 计划（纯查看） */
  started: boolean;
  createdAt: number;
}

export interface NurturePoint {
  ts: number;
  hm: string;
  /** 今天 / 明天 / 后天 / `M/D` */
  dayLabel: string;
  past: boolean;
}

const pad2 = (n: number): string => (n < 10 ? `0${n}` : `${n}`);

/** `HH:mm` 合法性（允许 `9:00` 这种不补零写法） */
export const isHM = (v: string): boolean => /^([01]?\d|2[0-3]):([0-5]\d)$/.test(v.trim());

/** 归一成 `HH:mm`；非法返回 null（调用方负责回落到"现在"） */
export function normalizeHM(v: string): string | null {
  const t = v.trim();
  if (!isHM(t)) return null;
  const [h, m] = t.split(':');
  return `${pad2(Number(h))}:${m}`;
}

export const nowHM = (now: Date = new Date()): string =>
  `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;

/**
 * 从上卡时间起每 `NURTURE_HOURS` 推 `n` 个点（**从第 1 个点开始**，不含上卡时刻本身 ——
 * 上卡那一刻是自己操作，不需要提醒）。
 * `now` 显式传入：这样"已过/未到"可测，也不依赖调用时机。
 */
export function nurturePoints(base: string, n: number, now: Date): NurturePoint[] {
  const norm = normalizeHM(base) ?? nowHM(now);
  const [h, m] = norm.split(':').map(Number);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
  const day0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const out: NurturePoint[] = [];
  for (let i = 1; i <= n; i++) {
    const t = new Date(start.getTime() + i * NURTURE_HOURS * 3600000);
    const dayStart = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
    const gap = Math.round((dayStart - day0) / 86400000);
    out.push({
      ts: t.getTime(),
      hm: `${pad2(t.getHours())}:${pad2(t.getMinutes())}`,
      dayLabel: gap <= 0 ? '今天' : gap === 1 ? '明天' : gap === 2 ? '后天' : `${t.getMonth() + 1}/${t.getDate()}`,
      past: t.getTime() < now.getTime(),
    });
  }
  return out;
}

/** 下一个未到点的下标；全部已过返回 -1 */
export const nextPointIndex = (points: NurturePoint[]): number => points.findIndex((p) => !p.past);

/** 已过 / 未到 计数（列表头部一句话总结用） */
export function pointStats(points: NurturePoint[]): { past: number; future: number } {
  const past = points.filter((p) => p.past).length;
  return { past, future: points.length - past };
}

/* id 生成：时间戳 + 自增序号。放在领域层是为了让 store 不必自己拼 id，
   同时保证同一毫秒内连加两条也不会撞 id。 */
let seq = 0;
export const nurtureId = (now: Date): string => `nr_${now.getTime().toString(36)}_${(seq++).toString(36)}`;

export function makeNurture(base: string, n: number, started: boolean, now: Date): NurtureRecord {
  return {
    id: nurtureId(now),
    base: normalizeHM(base) ?? nowHM(now),
    n: Math.min(Math.max(1, n), MAX_NURTURE_N),
    started,
    createdAt: now.getTime(),
  };
}

/** 任务在前、计划在后；各自按创建时间倒序（最近加的排最上） */
export const sortNurture = (records: NurtureRecord[]): NurtureRecord[] =>
  [...records].sort((a, b) => {
    if (a.started !== b.started) return a.started ? -1 : 1;
    return b.createdAt - a.createdAt;
  });
