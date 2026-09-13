/**
 * 枚举 code 的**字面量联合类型** —— 编译期契约，唯一真相（设计文档 §4.0 双轨制）。
 *
 * 双轨制：
 *   - 本文件 = 取值集合（编译期，IDE 自动补全、写错即报错）
 *   - `src/db/meta.db.json` 的 `dicts` 表 = label / sort / 说明（运行期展示）
 *   - build 期双向校验：JSON 里的 code 必须 ∈ 本文件；本文件每个 code 必须在 JSON 有 label
 *
 * 因此「表少一张」与「类型安全」不必二选一。
 */

/** 周期：周期是 item 的字段，不是分表依据（设计文档 §3.1） */
export const CYCLE = [
  'once',
  'daily',
  'weekly',
  'monthly',
  'version',
  'limited',
  'season',
] as const;
export type Cycle = (typeof CYCLE)[number];

/** 非时基周期：重置锚点取 `meta.periods[cycle].startAt`，不套 resetHour（§7 / D2） */
export const EVENT_CYCLE = ['version', 'season'] as const satisfies readonly Cycle[];

/** 奖励类型（18 类）：数量可能浮动，但类型固定（需求 F21 / 设计 §4.2） */
export const GAIN_KIND = [
  'jade',
  'blueTicket',
  'blackFrag',
  'blackDaruma',
  'skinTicket',
  'medal',
  'merit',
  'soul',
  'bossSoul',
  'daruma',
  'gold',
  'stamina',
  'exp',
  'shard',
  'ssr',
  'skin',
  'token',
  'other',
] as const;
export type GainKind = (typeof GAIN_KIND)[number];

/**
 * UI 只暴露高频 6 类 chip，其余 12 类进可展开面板（设计文档 §4.2 / 评审 R6）。
 * 口径：按实测频次取，**排除兜底类 `other`** —— 它在 87 条里出现 24 次，但不具筛选意义。
 */
export const TOP_GAIN_KIND = ['jade', 'blueTicket', 'skin', 'blackFrag', 'soul', 'exp'] as const;

/* 2026-09-11 删除 `ENTRY` / `ACTION` 枚举（连同 `EntryKind` / `ActionKind` 类型）。
   它们标注为"纯展示字段（D4）"，但实测**零消费**：没有任何组件读这两个字段，
   89 条数据里 92% 的 `entry` 恰好等于 `path` 的第一段。
   详见 `api/types.ts` 里 `Item` 处的删除说明与设计文档 v1.4.1 修订 #46。 */

/** 排序方式（`value` 已换成 `weight` 痛感分） */
export const SORT_BY = ['weight', 'cycle', 'deadline', 'custom', 'name'] as const;
export type SortBy = (typeof SORT_BY)[number];

/** 字典表的类别（6 类，全量；`entry` / `action` 于 2026-09-11 随字段一起删除） */
export const DICT_TYPE = [
  'cycle',
  'gainKind',
  'weekday',
  'yuhunSection',
  'spotKind',
  'soulCategory',
] as const;
export type DictType = (typeof DICT_TYPE)[number];

/** 条目来源：预设 / 用户自建（`source` 已删除，这是唯一的自建标识，K5） */
export const ORIGIN = ['preset', 'custom'] as const;
export type Origin = (typeof ORIGIN)[number];

/** 固定收益支持的三个币种（不折算、不估算，Q6） */
export const GAIN_CURRENCY = ['jade', 'blackFrag', 'blueTicket'] as const;
export type GainCurrency = (typeof GAIN_CURRENCY)[number];

/** 按字典类别建索引用的通用类型 */
export interface DictRow {
  type: string;
  code: string;
  label: string;
  sort: number;
  note?: string;
  meta?: Record<string, unknown>;
}
