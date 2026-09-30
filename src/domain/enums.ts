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

/**
 * 周期：周期是 item 的字段，不是分表依据（设计文档 §3.1）。
 *
 * 2026-09-28 两次收口，六个周期收敛到四个（用户决定）：
 *   - 删 `once`（一次性）—— 条目库里早已无此类条目；"只做一次"由 **`limited` + `until`** 承担
 *     （两者在 `reset.ts` 里本来就是同一个分支：不自动重置、只靠 `until` 归档）；
 *   - 删 `season`（赛季）并**把 `version` 并进 `limited`** —— 版本活动与限时活动在用户眼里
 *     是同一类东西（"当期有就去弄，过期就没了"），分成两个周期换不来任何区别。
 *
 * 合并且**记下代价**：版本条目原先靠 `meta.periods.version` 锚点**随版本自动翻篇**，
 * 合并后不再自动翻篇（勾上就一直是勾的）—— 要翻篇得给条目填 `until`，靠归档下线。
 * 随之整体退场的是整套锚点机制（`meta.periods` / `ResetCtx.periods` / `EVENT_CYCLE` /
 * 「数据版本」面板的两行锚点）：没有周期再消费它，留着就是死符号。
 */
export const CYCLE = ['daily', 'weekly', 'monthly', 'limited'] as const;
export type Cycle = (typeof CYCLE)[number];

/**
 * 奖励类型（9 类 = 币种 + 兑换券 + 三类产出）：数量可能浮动，但类型固定（需求 F21 / 设计 §4.2）。
 *
 * 2026-09-30 **由 18 类收口到 9 类**（用户看过全量明细后逐类判断，全程见 CHANGELOG）：
 *   - **并**：`blackDaruma` → `blackFrag`（1 黑蛋折算 25 黑碎 —— 黑蛋没有独立的数值口径，
 *     单列只会让"到底算不算"反复出现）；
 *   - **并**：`merit` → `medal`（标签改「勋章·功勋」：两者在游戏里同属"打出来的货币"，
 *     用户按自己的记账习惯合并）；
 *   - **并**：`bossSoul` → `soul`（首领御魂本就是御魂的子类）；
 *   - **删**：`daruma` / `shard` / `skin` / `token` / `other` / `exp` —— 前四个各自是"某一类
 *     物品"的筐（达摩 / 碎片 / 皮肤外观 / 兑换材料），`other` 是最大的筐（21 次引用里混着
 *     "真杂项"与"有名字却没类型"两种东西），`exp` 则是用户随后追加的判断（经验几乎总与
 *     金币同来，单列换不到区分度）。留下的口径是：**说不清的不再编码成数据**。
 *     代价已如实记下：整轮迁移后有 23 条条目**不再有任何奖励类型**（卡片上不出徽章）；
 *     摘 `exp` 这一步本身不新增任何空条目（那 5 条都还挂着金币等）。
 *
 * ⚠️ 前三个（`jade` / `blueTicket` / `blackFrag`）与 `GAIN_CURRENCY` 是同一批 code ——
 * 它们既是类型、又是 `gain` 对象的键，**动它们等于动数据结构**，不要合并或删除。
 */
export const GAIN_KIND = [
  'jade',
  'blueTicket',
  'blackFrag',
  'skinTicket',
  'medal',
  'soul',
  'gold',
  'stamina',
  'ssr',
] as const;
export type GainKind = (typeof GAIN_KIND)[number];

/* 2026-09-28 删除 `TOP_GAIN_KIND`（"UI 只暴露高频 6 类 chip"的那份清单 —— 它唯一的
   消费方是 `components/common/ViewBar` 的筛选面板，随奖励类型筛选整体删除一并退场）。

/* 2026-09-11 删除 `ENTRY` / `ACTION` 枚举（连同 `EntryKind` / `ActionKind` 类型）。
   它们标注为"纯展示字段（D4）"，但实测**零消费**：没有任何组件读这两个字段，
   89 条数据里 92% 的 `entry` 恰好等于 `path` 的第一段。
   详见 `api/types.ts` 里 `Item` 处的删除说明与设计文档 v1.4.1 修订 #46。 */

/**
 * 排序方式。
 *
 * 2026-09-30（用户："默认排序不用痛感算法了，就按照 db 的顺序来"）：删 `weight`（痛感分），
 * 默认改为 `db` —— **条目库（`items.db.json` / `limited.db.json`）里的书写顺序**。
 * 痛感分连同它的派生函数（`domain/weight.weightOf`）一并退场。
 * UI 依旧不写这个字段（排序不由用户选），生效值一律由 `domain/sort.effectiveSortBy` 派生。
 */
export const SORT_BY = ['db', 'cycle', 'deadline', 'custom', 'name'] as const;
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

/** 条目来源：预设 / 用户自建（`source` 已删除，这是唯一的自建标识，K5） */
export const ORIGIN = ['preset', 'custom'] as const;
export type Origin = (typeof ORIGIN)[number];

/** 固定收益支持的三个币种（不折算、不估算，Q6） */
export const GAIN_CURRENCY = ['jade', 'blackFrag', 'blueTicket'] as const;
export type GainCurrency = (typeof GAIN_CURRENCY)[number];
