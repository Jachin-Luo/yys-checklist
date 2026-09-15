/**
 * 结界寄养时间派生（S6）—— 纯函数，无 IO。
 *
 * 规则（原型 v6 定稿，需求侧已确认）：**每次 6 小时**，记下「上卡时间」后，
 * 自动排出往后每 6h 的收/续点（跨天标 明天/后天/日期）。
 *
 * 两个状态刻意分开：
 *   - **任务**（`started: true`）：逐点记录完成情况
 *   - **计划**（`started: false`）：纯查看，不背状态；决定开刷时点「开始」转正
 * 这个区分是有意义的 —— 用户常常只是"打算这个点寄"，并不想一存就被判成未到。
 *
 * ## 点模型（2026-09-15 重构）
 *
 * 点列表 = `[上卡点(index 0), 收/续点 1..n]`，**上卡点也作为一个点**展示
 * （它是任务的起点，之前只存在 `base` 里、列表上看不到）。
 *
 * 递推规则：第 k 点的预计时刻 = 前一个点的「实际完成时间（没有就用它的预计时刻）」+ 6h。
 * 于是给某个点记完成，只把它**之后**的点往后挪，之前的点原样不动 ——
 * 早先那版「记一次完成就把整条任务重新推一遍」会让用户觉得任务被初始化了（2026-09-15 用户反馈）。
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
  /**
   * 逐点完成记录：点序号（1..n，**不含上卡点**）→ 实际完成时间戳。
   * 缺席表示该点还没收/续。上卡点天然视为已完成（它的完成时刻就是 `base` 那一刻）。
   */
  dones?: Record<number, number>;
}

export interface NurturePoint {
  /** 0 = 上卡点；1..n = 收/续点。UI 用它定位"给哪个点记完成" */
  index: number;
  /** 预计时刻（点 0 = 上卡时刻；点 k = 前一点的完成/预计 + 6h） */
  ts: number;
  hm: string;
  /** 今天 / 明天 / 后天 / `M/D` */
  dayLabel: string;
  past: boolean;
  /** 实际完成时刻：点 0 = `ts`（上卡即完成）；其余取 `dones[index]`；没完成则 undefined */
  doneAt?: number;
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

/** `HH:mm` → **今天的**该时刻；非法输入返回 null（用于「实际完成时间」输入：记的都是已发生的事） */
export function hmToDate(v: string, now: Date): Date | null {
  const norm = normalizeHM(v);
  if (!norm) return null;
  const [h, m] = norm.split(':').map(Number);
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
}

/**
 * 上卡时刻（绝对时间戳）：把 `base`（`HH:mm`）按**今天**解释。
 * 不做"昨天"推断 —— 保留「预先登记今晚 18:00 上卡」这种用法。
 */
export function baseTsOf(record: Pick<NurtureRecord, 'base'>, now: Date): number {
  const norm = normalizeHM(record.base) ?? nowHM(now);
  const [h, m] = norm.split(':').map(Number);
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0).getTime();
}

/** 点的展示字段（不含完成状态，由调用方补 `doneAt`） */
function shapePoint(ts: number, index: number, now: Date): NurturePoint {
  const t = new Date(ts);
  const day0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayStart = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
  const gap = Math.round((dayStart - day0) / 86400000);
  return {
    index,
    ts,
    hm: `${pad2(t.getHours())}:${pad2(t.getMinutes())}`,
    dayLabel: gap <= 0 ? '今天' : gap === 1 ? '明天' : gap === 2 ? '后天' : `${t.getMonth() + 1}/${t.getDate()}`,
    past: ts < now.getTime(),
  };
}

/**
 * 从基准时刻按固定 6h 推 `n` 个点（**不含上卡点自身**，点序号从 1 开始）。
 * 用于表单预览（"首点几点"）与纯时间计算；带完成状态的完整列表见 `recordPoints`。
 */
export function nurturePointsFrom(baseTs: number, n: number, now: Date): NurturePoint[] {
  const out: NurturePoint[] = [];
  for (let i = 1; i <= n; i++) out.push(shapePoint(baseTs + i * NURTURE_HOURS * 3600000, i, now));
  return out;
}

/** 按 `HH:mm` 基准推点（等价于用今天的该时刻作基准） */
export const nurturePoints = (base: string, n: number, now: Date): NurturePoint[] =>
  nurturePointsFrom(baseTsOf({ base }, now), n, now);

/**
 * 一条记录的**完整点列表** `[上卡点, ...收/续点]`：展示、徽章与 `nextDue` 都走这里。
 *
 * 递推：第 k 点的预计时刻 = 前一点的「实际完成时间 ?? 预计时刻」+ 6h。
 * 所以某个点记了完成之后，只有它**之后**的点会挪动。
 */
export function recordPoints(record: NurtureRecord, now: Date): NurturePoint[] {
  const dones = record.dones ?? {};
  const start = baseTsOf(record, now);
  /* 上卡点：自己操作的那一刻，天然视为已完成 */
  const out: NurturePoint[] = [{ ...shapePoint(start, 0, now), doneAt: start }];

  let prev = start;
  for (let k = 1; k <= record.n; k++) {
    const ts = prev + NURTURE_HOURS * 3600000;
    const doneAt = dones[k];
    out.push({ ...shapePoint(ts, k, now), doneAt });
    prev = doneAt ?? ts;
  }
  return out;
}

/** 记某个点完成（纯函数）。点 0（上卡）不接受改写 —— 它由 `base` 决定 */
export const markPointDone = (record: NurtureRecord, index: number, at: Date): NurtureRecord =>
  index <= 0 ? record : { ...record, dones: { ...(record.dones ?? {}), [index]: at.getTime() } };

/** 取消某个点的完成记录（点错了 / 想重新记时间） */
export function clearPointDone(record: NurtureRecord, index: number): NurtureRecord {
  const dones = { ...(record.dones ?? {}) };
  delete dones[index];
  return { ...record, dones };
}

/** 该记录的下一个待办点 = 第一个**未完成的收/续点**（不管它是否已过时间）；全部完成 → null */
export const nextPendingPoint = (record: NurtureRecord, now: Date): NurturePoint | null =>
  recordPoints(record, now).find((p) => p.index > 0 && p.doneAt === undefined) ?? null;

/** 完成 / 待收 计数（列表头部一句话总结用；上卡点算已完成） */
export function pointStats(points: NurturePoint[]): { done: number; pending: number } {
  const done = points.filter((p) => p.doneAt !== undefined).length;
  return { done, pending: points.length - done };
}

export interface NurtureDue {
  record: NurtureRecord;
  point: NurturePoint;
}

/**
 * 最紧要的一个待办点（供壳层的实时徽章用）：
 * 「进行中的结界卡任务」= `started` 且**还有未完成的点**；计划不背状态、不参与。
 * 多个任务取时间最早的那个。返回 null 表示当前无事可等。
 */
export function nextDue(records: NurtureRecord[], now: Date): NurtureDue | null {
  let best: NurtureDue | null = null;
  for (const record of records) {
    if (!record.started) continue;
    const point = nextPendingPoint(record, now);
    if (!point) continue;
    if (!best || point.ts < best.point.ts) best = { record, point };
  }
  return best;
}

/** 距某个收/续点还有多久的可读文案（徽章用，窄容器所以写紧凑：`2h15m` / `45 分` / `该收卡了`） */
export function dueText(ts: number, now: Date): string {
  const ms = ts - now.getTime();
  if (ms <= 0) return '该收卡了';
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min} 分`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${pad2(m)}m` : `${h}h`;
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
