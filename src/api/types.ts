/**
 * DTO / 实体类型（设计文档 §4 / §5.5 / §6.3）。
 *
 * 这里只定义**形状**，不含任何实现；Mock 与后期的 Http Adapter 都实现同一套契约。
 * 字段命名一律 camelCase（下划线命名由 S1 迁移一次性转换）。
 */
import type { Cycle, GainKind, Origin, SortBy } from '../domain/enums';
/* 结界寄养记录（2026-09-16 起为**档案级**用户数据，进 `BootstrapPayload` 与备份）。
   从 domain 借形状而不是在此重定义：递推规则与它绑定，两处定义必然漂移。
   `domain/nurture` 不 import 本文件，因此这条 import 不会成环。 */
import type { NurtureRecord } from '../domain/nurture';

/* ───────────────────────── 主数据：条目库 ───────────────────────── */

/** 固定收益（保底），进统计页。缺省 = 收益浮动，不计入 */
export interface Gain {
  jade?: number;
  blackFrag?: number;
  blueTicket?: number;
}

export interface Item {
  id: string;
  name: string;
  cycle: Cycle;
  /* 2026-09-11 **删除 `entry` / `action` 两个维度**。它们标记为"纯展示字段（D4）"，
     但实测是**零消费**：全库没有任何组件读它们，自建条目表单也不收集（落库时永远是
     兜底的 `其他` / `领取`）；而 89 条数据里 **92% 的 entry 恰好等于 `path` 的第一段**，
     等于维护着一份可推导的冗余。原计划的消费者（「按入口 / 动作的场景化批量勾选」，
     需求 F11）已延后，字段与必填约束却留在了当下 —— 与其保留一份没人读的数据，
     不如等真要实现那个功能时**连同维度一起重新录入**。
     代价已记入设计文档 v1.4.1 修订 #46：将来做批量勾选需要重录 89 条的 entry/action
     （`action` 无法从文本推出，重录成本高于 `entry`）。 */
  /** 适用星期，0 = 周日。缺省 = 每天（原 dayRules 内联） */
  days?: number[];
  path?: string;
  /* 2026-09-11 **删除 `reward`（奖励文本描述）**。三条理由：
     ① 它与 `gainKind` 信息重叠 —— `meta.gainKindNote` 自己写明"其余 71 条由人工读 reward 文本后核定"，
        即两者本就是同一事实的两份编码；实测 89 条里 28% 的 reward 完全等于 gainKind 中文标签的拼接，
        渲染到卡片上就是同义反复（用户直接提问"这两个有什么不一样"）；
     ② 它与"数量浮动但类型固定"的口径打架：文档要求浮动收益"在 reward 里照实写"，
        而 UI 已用 `gainKind` 徽章表达同一件事，两处维护必然漂移；
     ③ 它另外两个消费者（统计页「漏失明细」右列、`.ics` 事件描述）随本版一起去掉。
     奖励信息现在由三者分工承担：`gainKind`（类型，可筛选）+ `gain`（有保底数值，进统计）+ `gainNote`（口径）。
     历史值仍在 `data/` 与版本历史里，可回溯。 */
  /** 奖励类型，数量可浮动但类型固定。UI 徽章 + 筛选，不进统计 */
  gainKind?: GainKind[];
  gain?: Gain;
  gainNote?: string;
  condition?: string;
  /** 日常类开放时间 HH:mm。只提示，不限制勾选 */
  time?: string;
  timeEnd?: string;
  timeNote?: string;
  /** true = 时间由所在寮自定 */
  isGuildTime?: boolean;
  /** 活动类开始日 */
  start?: string;
  /** 活动类截止时间（仍要提示去领） */
  deadline?: string;
  /** 条目下线日，过期自动归档。与 deadline 语义不同 */
  until?: string;
  since?: string;
  /** 官方「一键日常」默认已覆盖，用户可逐项覆盖 */
  autoDaily?: boolean;
  /** 一键日常入口本身：排序前置特判恒第 0 位（D1） */
  isAutoHub?: boolean;
  premium?: boolean;
  note?: string;
  /** 预设 / 用户自建（`source` 删除后唯一的自建标识） */
  origin: Origin;
}

/* ───────────────────────── 主数据：工具模块 ───────────────────────── */

export interface DropEntry {
  soulId: string;
  /** 限定星期 0–6；缺省 = 不限（常驻掉落） */
  dow?: number;
}

export type DungeonMode = 'weekly' | 'follow' | 'fixed' | 'special';

export interface Dungeon {
  id: string;
  name: string;
  sub?: string;
  mode: DungeonMode;
  section: string;
  sort: number;
  tip?: string;
  weekendRandom?: boolean;
  randNote?: string;
  followId?: string | null;
  followOld?: string | null;
  reward?: string | null;
  drops: DropEntry[];
}

export interface DayTip {
  dungeonId: string;
  dow: number;
  tip: string;
}

export interface YuhunDb {
  dungeons: Dungeon[];
  dayTips: DayTip[];
  /**
   * 「周末常规御魂全集」随机池里**排除**的名单（纯展示串，渲染在 `YuhunSection` 页脚）。
   *
   * 成员规则（2026-09-11 按 `reports/御魂掉落总表_2026-09-11.md` 核对）：
   *   秘魂屋专属 4 种（伤魂鸟 / 镇墓兽 / 骰子鬼 / 珍珠 —— 无任何副本产出）
   * \+ 业原火专属 3 种（木魅 / 薙魂 / 返魂香）
   * \+ 一个伪条目「首领御魂」（代表 13 种首领御魂整体，它们只在逢魔系产出）。
   *
   * ⚠️ 同日**移除了「火灵」**：报表标明它的来源是「八岐 周末 · 秘魂屋」——
   * 既然周末出，它就在周末池里，列进"排除"是反的。
   */
  excluded: string[];
}

export interface Shikigami {
  id: string;
  name: string;
}

export interface Spot {
  id: string;
  name: string;
  kind: string;
}

export interface ShikigamiSpot {
  shikigamiId: string;
  spotId: string;
  count: number;
}

export interface ShikigamiClue {
  shikigamiId: string;
  word: string;
}

export interface BountyDb {
  shikigami: Shikigami[];
  spots: Spot[];
  shikigamiSpots: ShikigamiSpot[];
  shikigamiClues: ShikigamiClue[];
}

export interface SoulRow {
  id: string;
  name: string;
  /**
   * 两件套效果。2026-09-11 起为**原文全文**（导入自 `reports/御魂掉落总表_2026-09-11.md`）。
   * 常规御魂是一句短效果（"攻击加成 15%"）；**首领御魂的两件套本身就是一段长被动**
   * （土蜘蛛那条 60 余字）—— 所以消费方必须按**可变长文本**处理，
   * `YuhunSection.SoulChip` 因此加了截断 + `title` 悬停看全文。
   * 本次导入同时修正了两处系统性错误：防御类误写 `15%`（实为 `30%`）、
   * 首领类只写了占位串「首领 · 对怪生效」。
   */
  effect2: string;
  /** 四件套效果原文。**首领御魂没有四件套**（单件随机属性 + 两件套唯一被动），故对首领缺省 */
  effect4?: string;
  category: string;
  /**
   * 备注：机制标记（唯一效果 / 独立乘区 / 加算乘区 / 无御魂副本产出 / 十周年新增）与玩法提示。
   *
   * ⚠️ **来源要分清**：取值自那份报表的「备注」列 —— 套效果原文来自灰机 wiki 结构化数据，
   * 而**备注列是报表的注释**（含玩家向解读如"奶妈向""残血收割"），**不是官方原文**。
   */
  note?: string;
}

export interface SoulsDb {
  rows: SoulRow[];
}

/* ───────────────────────── 系统库 meta ───────────────────────── */

export interface PeriodAnchor {
  key: string;
  startAt: string;
  note?: string;
}

export interface DictEntry {
  type: string;
  code: string;
  label: string;
  sort: number;
  note?: string;
  meta?: Record<string, unknown>;
}

export interface SortOption {
  id: SortBy;
  label: string;
  desc?: string;
}

export interface ViewDefaults {
  sortBy: SortBy;
  /** 按奖励类型筛选，空数组 = 全部显示 */
  showKinds: GainKind[];
  /**
   * ⚠️ 已废弃（2026-09-15）：痛感收敛为「只作默认排序键」，筛选门槛的判断已从
   * `domain/sort.isVisible` 移除，UI 也不再写入。字段与 `viewDefaults.minWeight`
   * 保留是为了不动契约形状与既有校验（与 `sortBy` 同一处理方式），**勿据此新增筛选 UI**。
   */
  minWeight: number;
  hideDone: boolean;
  pinned: string[];
}

/** `getMeta()` 的返回：meta 表 + dicts + sortOptions + viewDefaults 组装 */
export interface Meta {
  version: string;
  dataVersion: string;
  updated: string;
  resetHour: number;
  resetNote?: string;
  periods: { version?: PeriodAnchor; season?: PeriodAnchor };
  disclaimer: string;
  gainKindNote?: string;
  weightNote?: string;
  viewNote?: string;
  stateKeySpec?: string;
  dicts: DictEntry[];
  sortOptions: SortOption[];
  viewDefaults: ViewDefaults;
}

/* ───────────────────────── 用户 / 档案 / 会话 ───────────────────────── */

export interface User {
  id: string;
  nickname: string;
  avatar?: string;
  /** 登录方式，为后期预留；本期恒 local */
  authType: 'local' | 'password' | 'oauth';
  email?: string;
  phone?: string;
  createdAt: string;
  lastActiveAt: string;
}

export interface Profile {
  id: string;
  userId: string;
  name: string;
  server?: string;
  channel?: string;
  uid?: string;
  level?: number;
  avatar?: string;
  isDefault: boolean;
  sort: number;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  userId: string;
  /** 当前激活档案 */
  profileId: string;
  authType: 'local' | 'password' | 'oauth';
  /** 本期 undefined；接入登录后由后端下发，只存在于内存与请求头 */
  token?: string;
  expiresAt?: string;
}

/* ───────────────────────── 用户数据（按 scope 定址） ───────────────────────── */

export interface CheckState {
  profileId: string;
  userId: string;
  /** itemId -> 完成时间戳(ms)。周期重置靠时间戳与周期起点比对，不靠定时器 */
  checked: Record<string, number>;
  updatedAt: string;
}

/**
 * 勾选日志（2026-09-15 新增）：`YYYY-MM-DD` → 当日勾选的 itemId。
 *
 * 与 `CheckState.checked` 的分工：`checked` 每条只保留**最近一次**勾选时间戳
 * （周期重置靠它比对），所以"前天做过什么"一勾新的一笔就查不到了。
 * 统计页的日历与「近 N 天收益」要的正是历史，因此单独留一份按日期分桶的日志。
 *
 * 语义：**历史事实** —— 周期重置**不会**清它（那天确实完成过）；
 * 只有用户取消勾选才回退，且按该条目的**周期起点**回退（见 `stores/check`）。
 * 只保留最近 `LOG_KEEP_DAYS`（90）天，写入时顺手修剪（见 `domain/checkLog`）。
 */
export interface CheckLog {
  profileId: string;
  userId: string;
  /** `YYYY-MM-DD` → 当日勾选的 itemId（去重，无序） */
  days: Record<string, string[]>;
  updatedAt: string;
}

export interface ViewPrefs {
  profileId: string;
  /**
   * ⚠️ 已不再由 UI 写入（产品决策：取消排序切换）。
   * 生效排序由 `domain/sort.effectiveSortBy(order)` 派生：默认痛感分，有自定义顺序则自定义接管。
   * 字段与 `meta.sortOptions` 保留是为了不动契约形状与既有校验，勿据此新增排序 UI。
   */
  sortBy: SortBy;
  showKinds: GainKind[];
  minWeight: number;
  hideDone: boolean;
  pinned: string[];
  /**
   * 清单卡片里显示哪些字段（2026-09-16 用户需求）。
   *
   * 一张卡默认渲染「名称 + 四类徽章 + 入口 + 条件 + 备注」，信息完整但很高 ——
   * 只想打个卡的用户要划很久。这里让用户自己决定卡片内容，关掉长文本后一屏能多看几条。
   * 缺省（老数据）由 `domain/cardDisplay.effectiveCardDisplay` 补成"全部显示"，
   * 因此**不改变任何现有观感**。
   */
  card?: CardDisplay;
  /** 被一键日常覆盖项的处理：`dim` 弱化（保留条目）/ `hide` 隐藏（不渲染）。**只影响列表显示，不影响统计口径** */
  coverMode?: 'dim' | 'hide';
  /**
   * 被一键日常覆盖的条目 id（**显式全量快照**）。
   * `undefined` = 用户未自定义 → 读取时回落数据默认（`items.autoDaily` 且非 `isAutoHub`），
   * 见 `domain/autoDaily.effectiveAutoSet`。显式 `[]` = 用户关掉了全部覆盖项。
   *
   * 与 `coverMode` 同处 `yys:view:{profileId}` 分片：大号与小号「玩不玩一键日常」的习惯不同，
   * 按档案隔离才正确（D3 口径）。设计文档 §4.6 的 viewPrefs 字段清单缺这一项（原型用刷新即丢的
   * 内存变量顶替），此处按 §4.2「用户可逐项覆盖」的语义补上。
   */
  autoSet?: string[];
  updatedAt: string;
}

/**
 * 清单卡片里显示哪些块（2026-09-16 用户需求）。
 *
 * **名称、勾选框、☆ 置顶不在其中** —— 它们不是"内容"而是卡片的身份与交互：
 * 关掉名称卡片不可识别，关掉勾选框就不能打卡（那正是这个功能要服务的事）。
 *
 * 六个字段一一对应 `components/common/ChecklistItem` 里的渲染块，
 * 加新渲染块时必须在这里同步加开关（否则它就成了"无论如何都显示"的例外）。
 */
export interface CardDisplay {
  /** 标题行徽章：截止倒计时 / 活动时间窗 / 一键覆盖 / 付费前置 */
  tags: boolean;
  /** 固定收益徽章（有保底数值才出现） */
  gain: boolean;
  /** 奖励类型徽章（浮动收益的类型） */
  kinds: boolean;
  /** 入口路径 */
  path: boolean;
  /** 参与条件 */
  condition: boolean;
  /** 备注 */
  note: boolean;
}

export interface ItemOverrides {
  profileId: string;
  /** 用户自建条目 */
  custom: Item[];
  /** 被隐藏的预设条目 id（软删，可恢复） */
  hidden: string[];
  /** 自定义排序全序（itemId 数组） */
  order: string[];
  updatedAt: string;
}

/**
 * 寮时间偏好：`itemId -> 'HH:mm'`。
 *
 * **2026-09-16 由设备级改为档案级**（用户决策）。原设计把它归为"这台手机的属性"，
 * 理由是"同一个寮"；但代管朋友号、或两个号在两个寮时，切号不切寮时间会互相污染。
 * 现在它与 `view.autoSet` 同属"用户配置"，因此**随档案、进备份**。
 *
 * 类型放在 types.ts 而不在 `domain/guildTime`：它与 `ViewPrefs` / `ItemOverrides` 是同一类
 * "用户数据分片的形状"，集中一处；`domain/guildTime` 只留纯函数，并从这里 re-export
 * （那里原本定义了这个类型，但 `domain` 依赖 `api/types` 的方向是既定的，反向会成环）。
 */
export type GuildTimePrefs = Record<string, string>;

/**
 * 结界寄养任务 / 计划。**2026-09-16 由设备级改为档案级**（用户决策）。
 *
 * 原设计写"与玩哪个号无关"，但结界卡的种类与时长恰恰因号而异（太鼓 / 斗鱼 / 美食卡，
 * 6h / 12h…），上卡时间自然也不同；切号后看到同一个寄养列表更像 bug 而非特性。
 * 改档案级后，它同时自动进入备份（用户要求"所有配置项均可备份"）。
 */
export type NurturePlans = NurtureRecord[];

/* ───────────────────────── 首屏聚合 / 输入输出定型（§5.5） ───────────────────────── */

export interface BootstrapPayload {
  meta: Meta;
  /** 已合并覆盖层、已过滤下线条目 */
  items: Item[];
  session: Session;
  /** 已按当前周期重置过 */
  state: CheckState;
  view: ViewPrefs;
  overrides: ItemOverrides;
  /** 勾选日志：与 `state` 同一入口取，周期重置不参与（它是历史事实） */
  log: CheckLog;
  /**
   * 寮时间（2026-09-16 起为档案级）。
   * 进首屏的理由与 `plans` 相同：壳层与清单页都要用它做时间徽章叠加，
   * 单独再发一次请求既多一个往返，也让它与 `items` 可能来自不同时刻。
   */
  guildTime: GuildTimePrefs;
  /**
   * 结界寄养任务 / 计划（2026-09-16 起为档案级）。
   * 壳层的"下一次该收"徽章在首屏就会读它（此前是独立读 localStorage），
   * 走 bootstrap 后切号能跟着一起换，时序反而比原来更干净。
   */
  plans: NurturePlans;
}

/** 新建自建条目的入参：不含 id / origin（由实现生成，杜绝 id 冲突与 origin 伪造） */
export interface ItemDraft {
  name: string;
  cycle: Cycle;
  gainKind: GainKind[];
  deadline?: string;
  time?: string;
  timeEnd?: string;
  path?: string;
  condition?: string;
  note?: string;
  gain?: Gain;
}

export interface ProfileDraft {
  name: string;
  server?: string;
  channel?: string;
  uid?: string;
  level?: number;
  avatar?: string;
}

export interface UserDataBundle {
  schemaVersion: string;
  exportedAt: string;
  profiles: Profile[];
  data: Array<{
    profileId: string;
    state: CheckState;
    view: ViewPrefs;
    overrides: ItemOverrides;
    /** 勾选日志（2026-09-15 起纳入备份）：不带它的话，导入后统计页日历会是空的 */
    log: CheckLog;
    /**
     * 寮时间 + 寄养任务（2026-09-16 起纳入备份）。
     * 两者此前是设备级、不进备份，导致"清理浏览器数据后导入"会**永久丢失**它们
     * （清 localStorage 时设备级键一起没了，而备份里没有副本）。
     * 从 `data[]` 逐档案携带后，「所有用户配置项均可备份」这条主张才真正成立。
     *
     * 旧备份没有这两个字段 → 归一成空值，不报错（`domain/backup.normalizeBundle`）。
     */
    guildTime: GuildTimePrefs;
    plans: NurturePlans;
  }>;
}

/* ───────────────────────── 种子文件形状（仅 api/mock/db.ts 使用） ───────────────────────── */

export interface MetaDbFile {
  meta: Omit<Meta, 'dicts' | 'sortOptions' | 'viewDefaults'>;
  dicts: DictEntry[];
  sortOptions: SortOption[];
  viewDefaults: ViewDefaults;
}

export interface UsersDbFile {
  users: User[];
  profiles: Profile[];
  states: CheckState[];
  viewPrefs: ViewPrefs[];
  itemOverrides: ItemOverrides[];
  sessions: Session[];
}

export interface VersionRow {
  db: string;
  version: string;
  updated: string;
  snapshot?: string;
  checksum?: string;
}
