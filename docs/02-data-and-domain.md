# 02 · 数据层与领域逻辑

> 对应数据版本：`2026.09.20-常驻条目按次数拆分` ｜ 事实核对日期：2026-09-20
> 本文回答：**数据长什么样、从哪来、到哪去、规则写在哪个函数里**。
> 本文只描述结构与规模，不逐条罗列条目明细 —— 明细以 `src/db/*.db.json` 为唯一真值。

## 1. 数据边界：`src/api/`

### 1.1 契约 `src/api/contract.ts`

只定义形状，不含实现。两个导出：

- `DataScope`：`{ userId, profileId }` —— **显式双参数**，所有用户数据方法都要求它，Mock 用 `assertScope` 做越权校验。
- `ApiClient`：31 个方法，分五组（2026-09-15 新增 `saveCheckLog`）：

| 组 | 方法 |
| --- | --- |
| 系统 / 元数据 | `getMeta`、`getBootstrap` |
| 条目 | `listItems`、`getItem`、`addCustomItem`、`removeCustomItem`、`hideItem`、`restoreItem`、`resetItemLibrary`、`saveOrder` |
| 工具资料 | `getYuhun`、`getBounty`、`getSouls` |
| 用户与档案 | `getSession`、`updateUser`、`listProfiles`、`createProfile`、`updateProfile`、`deleteProfile`、`switchProfile` |
| 用户数据（勾选 / 视图 / 覆盖） | `getState`、`setChecked`、`clearChecked`、`clearAllChecked`、`getView`、`saveView`、`getOverrides`、`saveOverrides` |
| 导入导出 | `exportUserData`、`importUserData` |

### 1.2 类型 `src/api/types.ts`

关键实体：

| 类型 | 说明 |
| --- | --- |
| `Item` | 条目实体（周期、痛感来源字段、`gain`、时间窗、`isAutoHub` 等）。**注意：字段 `reward` / `entry` / `action` 已被有意删除**，文件内有长注释说明原因 |
| `Gain` | 固定（保底）收益，三个可选数值字段：`jade`（勾玉）、`blackFrag`（黑碎）、`blueTicket`（蓝票）。**缺省 = 收益浮动，不进统计** |
| `Meta` | 元数据：`version`、`dataVersion`、`resetHour`（= 0）、`periods` 锚点、`dicts` 等 |
| `DictEntry` / `SortOption` / `ViewDefaults` | 字典行、排序选项、视图默认值 |
| `User` / `Profile` / `Session` | 用户、档案、会话 |
| `CheckState` / `ViewPrefs` / `ItemOverrides` | 用户数据三件套 |
| `BootstrapPayload` | 首屏聚合载荷（meta + items + session + state + view + overrides + **log**） |
| `ItemDraft` / `ProfileDraft` | 新增/编辑入参 |
| `UserDataBundle` | 备份载体（导入导出用）：每个档案含 state / view / overrides / **log**（勾选日志） |
| `MetaDbFile` / `UsersDbFile` / `VersionRow` | 种子文件形状 |
| 工具资料 | `Dungeon` / `DungeonMode` / `DayTip` / `YuhunDb`、`Shikigami` / `Spot` / `ShikigamiSpot` / `ShikigamiClue` / `BountyDb`、`SoulRow` / `SoulsDb` |

### 1.3 适配器切换 `src/api/index.ts`

```text
VITE_API_MODE === 'http' ? new HttpApi(baseURL) : new MockApi()
```

- 这是**全项目唯一的分支**；业务代码统一 `import { api } from '@/api'`。
- 同时再导出类型 `ApiClient`、`DataScope`。

## 2. Mock 适配器：四个文件的分工

| 文件 | 职责 | 不该做的事 |
| --- | --- | --- |
| `api/mock/db.ts` | **唯一允许 import `src/db/*.db.json` 的文件**。静态加载 `meta`/`items`/`limited`/`users`/`dataVersion`，动态 `import()` 懒加载 `yuhun`/`bounty`/`souls`。导出 `seedMetaDb`、`seedItems`（= items + limited 合并）、`seedUsersDb`、`seedVersions`、`loadYuhunDb()`、`loadBountyDb()`、`loadSoulsDb()` | 不写合并规则 |
| `api/mock/userStore.ts` | 内存库 + 分片读写 + 写队列。导出 `UserStore`、`nowIso`、`emptyState`、`emptyOverrides`、`ensureStore`、`resetStoreForTest`、`assertScope`、`saveSession`、`saveProfiles`、`readStateShard` / `saveStateShard`、`readViewShard` / `saveViewShard`、`readOverridesShard` / `saveOverridesShard`、`dropProfileShards`、`enqueue` | 不写合并规则（合并调 `domain/merge`） |
| `api/mock/persist.ts` | 分片键与字节层再导出：`KEY`、`removeProfileShards`，并再导出 `read` / `write` / `remove`（来自 `services/localStore`） | 不写合并规则 |
| `api/mock/latency.ts` | 延迟与失败注入：`ApiError`（带 `code`）、`delay`、`mainDelay`、`writeDelay`、`injectFailure` | —— |

### 2.1 localStorage 分片键（`api/mock/persist.ts` 的 `KEY`）

| 分片 | 键 | 内容 |
| --- | --- | --- |
| `session` | `yys:meta:session` | 当前会话 / 当前档案 |
| `profiles` | `yys:profiles` | 档案列表（含归档） |
| `state(profileId)` | `yys:state:{profileId}` | 该档案的**当前周期**勾选状态（`itemId → 时间戳`） |
| `checklog(profileId)` | `yys:checklog:{profileId}` | 该档案的勾选日志（`YYYY-MM-DD → itemId[]`，历史事实，保留 90 天） |
| `view(profileId)` | `yys:view:{profileId}` | 该档案的视图偏好 |
| `ovr(profileId)` | `yys:ovr:{profileId}` | 该档案的条目覆盖层（隐藏 / 自建 / 自定义顺序 / 一键日常配置） |
| `guild(profileId)` | `yys:guild:{profileId}` | 该档案的寮时间（`itemId -> HH:mm`）—— **2026-09-16 由设备级升格** |
| `plans(profileId)` | `yys:plans:{profileId}` | 该档案的结界寄养任务 / 计划 —— **2026-09-16 由设备级升格** |

设备级键（不挂档案，定义在 `services/localStore.ts` 的 `DEVICE_KEY`）：**只剩 `yys:onboarded`**。
`yys:guildTime` 与 `yys:plans` 于 2026-09-16 升为上面的两个档案级分片（理由：寮时间取决于所在寮、
寄养节奏取决于具体号的结界卡，都不是"这台手机的属性"；且只有变成档案级分片，它们才能随备份走）。
**旧的两个设备级键不做迁移**（用户决策）：新版本不再有读取点，用户重新配置一次，
或用设置页「同步到其他档案」批量铺开。`onboarded` 之所以留下，是因为它不是配置，
而是"这台设备看过引导没有"—— 换设备后重看一次引导是正确的。

**分片是硬约束**：勾选一条只重写**本档案**的分片（`yys:state:{profileId}` 逐条增量 + 一次 `yys:checklog:{profileId}` 整表），其他档案不受影响；由 `api/mock/contract.test.ts` 的「分片写入验证」与 `stores/check.test.ts` 的「整批只写」用例守护。

`state` 与 `checklog` 的分工（2026-09-15 新增日志）：前者只留每条条目**最近一次**勾选时间戳，周期重置靠它与周期起点比对；后者按日期分桶留历史，回答"哪天做过什么"（统计页日历与近 N 天收益全靠它）。**周期重置不动日志**；只有取消勾选才回退，且按该条目的**周期起点**回退（见 `stores/check` 的 `logAfter` 与 `domain/checkLog.removeEntrySince`）。

### 2.2 延迟与失败注入（有意为之）

| 项 | 值 | 位置 |
| --- | --- | --- |
| 读延迟 | 0–30ms | `latency.mainDelay` |
| 写延迟 | 80–150ms | `latency.writeDelay` |
| 失败注入 | 查询串 `?__fail=1` 或环境变量 `VITE_API_FAIL` | `latency.injectFailure` |
| 取消语义 | `delay(ms, signal)` 必须响应 `AbortSignal` | `latency.delay` |

为什么故意变慢：如果 Mock 瞬时返回，就会写出「没有 loading 态、没有竞态处理」的 UI，接真实后端那天会全线崩溃。**不要为了「更快」而删掉延迟。**

`hooks/useApi.ts` 是配套的取数 hook：AbortSignal 取消 + requestId 竞态守卫 + 卸载守卫（首屏不走它，首屏走 `useBootstrap`）。

## 3. HTTP 适配器（空壳）

`src/api/http/adapter.ts` 的 `HttpApi implements ApiClient`：构造时接 `baseURL`，所有方法走 `private fail()` 抛「未实现」（code `NOT_IMPLEMENTED`），文件顶部列出了端点映射参考，并留有 `TODO(S2 之后 / M2)`。

接入后端时的改动清单见 `docs/04-handover-guide.md` 第 5 项任务。

## 4. 种子数据 `src/db/`

### 4.1 文件结构与规模

| 文件 | 顶层 key | 规模 |
| --- | --- | --- |
| `items.db.json` | `items: Item[]` | **69 条**真正的常驻（每日 36 / 每周 29 / 每月 4） |
| `limited.db.json` | `items: Item[]` | **34 条**非常驻（活动期每日 4 / 限时活动 24 / 版本 5 / 赛季 1；带 `until` 的到期自动下线，版本与赛季条目随版本维护） |
| `yuhun.db.json` | `dungeons[]`、`dayTips[]`、`excluded[]` | 副本 **11**、日提示 **10**、排除项 **8** |
| `souls.db.json` | `rows: SoulRow[]` | **70** 种御魂（`effect2` 70 条；`effect4` 57 条，13 种首领御魂无四件套） |
| `bounty.db.json` | `shikigami[]`、`spots[]`、`shikigamiSpots[]`、`shikigamiClues[]` | 式神 **39**、地点 **64**、出处关系 **148**、线索词 **116** |
| `meta.db.json` | `meta`、`dicts[]`、`sortOptions[]`、`viewDefaults` | 字典 **50** 行（cycle 7 + gainKind 18 + weekday 7 + yuhunSection 5 + spotKind 6 + soulCategory 7）、排序选项 5 |
| `users.db.json` | `users`、`profiles`、`states`、`viewPrefs`、`itemOverrides`、`sessions` | 各 1 条（`u_local` / `p_main`） |
| `dataVersion.db.json` | `versions: VersionRow[]` | **7** 条（对应 meta / items / limited / yuhun / bounty / souls / users） |

常驻 + 活动总计 **103 条**条目。

`meta` 关键字段：`version`（应用版本，如 `1.4.0`）、`dataVersion`（如 `2026.09.17-十周年二阶段`）、`resetHour`（= 0）、`periods`（版本 / 赛季锚点）。

### 4.2 条目字段规格

`schema/item.schema.json`（draft-07，`additionalProperties: false`）为编辑器提供提示；
**运行时校验以 `tools/build.js` + `domain/enums.ts` 为准**（两者冲突时以后者为准）。

不要新增字段而不更新白名单：`tools/build.js` 里维护条目字段白名单，未知字段会直接报错。

## 5. 枚举双轨对齐

```text
src/domain/enums.ts 的字面量联合类型  ←── 双向校验 ──→  src/db/meta.db.json 的 dicts
```

`tools/build.js`（`npm run db:check`）的校验项：

1. 从 `enums.ts` 正则提取 `CYCLE` / `GAIN_KIND` / `SORT_BY` / `DICT_TYPE`，与 `dicts` 做 `PAIRS` 双向校验（任一方向的 code 缺失即失败）。
2. `dicts` 主键重复检查。
3. 条目字段白名单（`reward` / `entry` / `action` 已移出白名单，出现即报错）。
4. id 唯一性与格式。
5. `isAutoHub` 全局恰有 1 条。
6. `periods.version` / `periods.season` 锚点必填。
7. `viewDefaults` / `sortOptions` 合法性。
8. `yuhun` / `bounty` / `souls` 的引用完整性。
9. `users` / `sessions` 一致性。
10. `dataVersion` 覆盖每个 db 文件。

产物：`reports/data-check.md`；有 error 时退出码 1（可直接接 CI）。

**改枚举的正确顺序**：先想清楚语义 → 同步改 `enums.ts` 与 `meta.db.json` 的 `dicts` → 跑 `npm run db:check` → 再跑 `npm test`。

## 6. 领域逻辑 `src/domain/`（14 个模块）

| 模块 | 导出符号 | 用途 |
| --- | --- | --- |
| `enums.ts` | `CYCLE` / `Cycle`、`EVENT_CYCLE`、`GAIN_KIND` / `GainKind`、`TOP_GAIN_KIND`、`SORT_BY` / `SortBy`、`DICT_TYPE` / `DictType`、`ORIGIN` / `Origin`、`GAIN_CURRENCY` / `GainCurrency`、`DictRow` | 编译期唯一的枚举真相 |
| `reset.ts` | `ResetCtx`、`periodStartOf`、`mergeChecked`、`isArchived`、`activeItems`、`daysUntilExit` | 周期重置（**时间戳比对，不用定时器**）与到期过滤 |
| `merge.ts` | `mergeItems`、`effectiveView`、`emptyOverrides`、`buildMeta`；再导出 `mergeChecked`、`ResetCtx` | 种子 + 覆盖层合并规则（全项目唯一） |
| `weight.ts` | `weightOf`、`cycleRank`、`WEIGHT_LEGEND` | 痛感分计算与图例 |
| `sort.ts` | `SortContext`、`effectiveSortBy`、`seedOrder`、`moveBefore`、`moveAfter`、`moveWithinGroup`、`buildComparator`、`VisibilityContext`、`isVisible` | 排序、置顶、自定义顺序、可见性 |
| `countdown.ts` | `parseTs`、`daysLeft`、`DeadlineLevel`、`DeadlineBadge`、`deadlineBadge`、`TimeWindowState`、`TimeWindow`、`timeWindow`、`appliesToday` | 截止倒计时与时间窗状态（**只提示，不限制勾选**） |
| `stats.ts` | `StatPeriod`、`GainSummary` / `GainRow` / `GainReport`、`periodItems`、`summarizeGain`、`RangeGain` / `RangeDayGain`、`summarizeRangeGain`、`MissLevel` / `MissItem` / `MissGroup`、`missGroups`、`PERIOD_META` | 周期进度统计（本日 / 本周 / 本月，只吃 `gain`）、**按日期区间**的收益累计（统计页改版后由它承担）、漏失分级 |
| `checkLog.ts` | `LogDays`、`LOG_KEEP_DAYS`(90)、`dayKeyOf` / `dayKey` / `keyToTs` / `shiftDayKey`、`dayCount`、`addEntry`、`removeEntrySince` / `removeEntriesSince`、`pruneDays`、`eachDay` | 勾选日志（按日期分桶的历史）：幂等写入、按周期起点回退、90 天修剪、区间枚举 |
| `calendar.ts` | `CalendarCell` / `MonthGrid`、`WEEKDAY_HEAD`、`monthTitle`、`buildMonthGrid` | 月历网格排版（周一起始、固定 6 行、含前后补位格） |
| `autoDaily.ts` | `hubItem`、`isAutoDailyCandidate`、`dataDefaultAutoSet`、`effectiveAutoSet`、`isCovered`、`hiddenByCover`、`cascadeTargets`、`cascadeBatch` | 一键日常覆盖集合与级联 |
| `backup.ts` | `MAX_BUNDLE_CHARS`(4_000_000)、`STALE_DAYS`(45)、`BundleSummary`（含 `logDays` / `guildTime` / `plans`）、`ValidateResult`、`summarize`、`validateBundle`、`Freshness`、`dataFreshness`、`serializeBundle`、`parseBundleText` | 备份文本的校验、归一化与新鲜度。缺字段一律补空值而非判为损坏（旧备份没有 `log` / `guildTime` / `plans`）；寄养记录**逐条校验必需字段**（畸形记录会进 `recordPoints` 递推，宁可少几条） |
| `cardDisplay.ts` | `DEFAULT_CARD_DISPLAY`、`CardPresetKey` / `CardPreset` / `CARD_PRESETS`（极简 / 简要 / 完整）、`CARD_FIELDS`、`effectiveCardDisplay`、`matchPreset`、`hiddenFieldCount` | 清单卡片**显示哪些字段**（2026-09-16 新增，存在 `view.card`）。预设只是"一次设六项"的快捷键，改任一项后 `matchPreset` 返回 null；默认 = 全部显示，故不改变既有观感 |
| `guildTime.ts` | `GuildTimePrefs`（类型在 `api/types`，此处 re-export）、`isValidHm`、`guildTimeTargets`、`configuredCount`、`applyGuildTime`、`applyGuildTimeAll`、`withGuildTime` | 寮时间在展示层叠加（**不写回主数据**）。2026-09-16 起配置本身是**档案级**分片 |
| `sync.ts` | `SyncPartKey` / `SyncPart` / `SYNC_PARTS`、`SyncSource` / `SyncPatch`、`defaultSyncKeys`、`applyParts`、`describeKeys` | 档案间配置同步：可同步内容清单 + **字段级接管**规则（只勾「一键日常覆盖」时不动目标的筛选与置顶）。勾选状态与日志刻意不在清单内 |
| `nurture.ts` | `NURTURE_HOURS`(6)、`MAX_NURTURE_N`(5)、`NurtureRecord`（含 `dones`）/ `NurturePoint`（含 `index` / `doneAt`）、`isHM` / `normalizeHM` / `nowHM` / `hmToDate`、`baseTsOf` / `nurturePointsFrom` / `recordPoints` / `nurturePoints`、`markPointDone` / `clearPointDone` / `nextPendingPoint`、`pointStats`、`NurtureDue` / `nextDue` / `dueText`、`nurtureId`、`makeNurture`、`sortNurture` | 结界寄养 6 小时收 / 续点派生：点列表 = 上卡点 + 逐点递推（`dones` 逐点记实际完成时间）；`nextDue` / `dueText` 供壳层常驻徽章用 |
| `yuhun.ts` | `MODE_LABEL`、`WEEK_ORDER`、`DungeonDay`、`hasDayGrid`、`dungeonDay`、`resolveFollow`、`OldFollowInfo`、`oldFollowInfo`、`groupBySection` | 御魂副本轮换与掉落派生 |
| `bounty.ts` | `BountySpotRef` / `BountyEntry` / `BountyUnionRow`、`buildBountyEntries`、`matchBounty`、`bountyUnion`、`fullCoverage`、`RankedEntry`、`pinMatches` | 悬赏出处派生、线索反查与并集 |
| `dateLabel.ts` | `todayDateLabel`、`weekRangeLabel` | 顶部日期标签（纯展示，与重置口径无关） |

## 7. 特殊机制（改动前务必理解）

### 7.1 周期重置：0 点口径 + 时间戳比对

- 每日与周常都在 0 点刷新（周常落在周一 0 点；`meta.resetHour` = 0，`resetNote` 里有说明）；版本 / 赛季按开服锚点重置，锚点就是**版本上线当日维护完成的时刻**（通常 9:00）—— 当前版本 `2026-09-09 09:00`、赛年「寻龙逐英」`2026-07-06 06:00`（值在 `src/db/meta.db.json` 的 `meta.periods`）。
- 实现方式：`domain/reset.periodStartOf` 计算周期起点，`mergeChecked` 在读取时把「上一个周期的勾选」归零 —— **不是靠定时器清数据**。
- 前台刷新由 `hooks/usePeriodRefresh.ts` 在分钟边界 / 窗口聚焦 / 可见性变化时触发，只重算内存态、不写盘。
- 结论：**不要在页面里判周期**，也不要在 store 里存「今天是否重置过」。

### 7.2 痛感分与排序

```text
痛感分 = 周期权重 + 稀缺性加成 + 固定收益加成
周期：一次性 / 限时 / 版本 / 赛季 40  >  每月 30  >  每周 20  >  每日 10
稀缺性：有 deadline 或 until  +15
固定收益：标注了 gain（具体数值）  +10
```

- 实现在 `domain/weight.weightOf` / `cycleRank`。**痛感只用于排序**（2026-09-15 收敛）：
  原先的 `minWeight` 筛选门槛、今日页「本周高痛感还剩 N 项」警示条、`missGroups` 漏失分级
  与 `WEIGHT_LEGEND` 图例均已删除 —— 界面里除了「默认排序」不会再出现痛感的任何出口。
- 一键日常入口恒排第 0 位：`domain/sort.buildComparator` 的前置特判，**不参与上面的比较**。
- 排序优先级：星标置顶 > （自定义顺序若已调过则接管）> 痛感分；同分兜底依次为截止日 → 周期 → 自定义顺序。
- 可见性：`domain/sort.isVisible`（奖励类型筛选 + 隐藏已完成 + 一键日常覆盖导致隐藏）。

### 7.3 一键日常：配置 ≠ 状态

- 集合语义：`domain/autoDaily.effectiveAutoSet`（未配置时回落到 `dataDefaultAutoSet` 的数据默认集合）。
- `hubItem` 取唯一入口条目（`isAutoHub`）；`isCovered` / `hiddenByCover` 只影响渲染。
- 级联：`cascadeTargets` / `cascadeBatch` 计算入口勾选时要一起勾上的条目；`stores/check.toggleWithCascade` 执行。
- **关键约束**：单独取消某个被覆盖项的勾选，不会把它移出覆盖集合 —— 避免「状态变化偷偷改配置」。显示方式（弱化 / 隐藏）只影响列表渲染，**不影响统计与漏失口径**。
- 候选范围（2026-09-14 收窄）：只有**常驻每日 + 数据里标了 `autoDaily`** 的条目可被覆盖（当前 14 条）。斗技、逢魔之时、地域鬼王、寮活动等官方不代做的每日任务既不出现在配置界面，也不会被级联勾选 —— 否则点入口会把玩家没做的任务标成已完成。旧配置中混入的此类 id 会在 `effectiveAutoSet` 归一化时自动失效。

### 7.4 寮时间：展示层叠加

各寮活动时间自定，写死即错。数据里的时间只是参考值，用户配置（`stores/guildTime`，**档案级**分片 `yys:guild:{profileId}`）在展示层经 `domain/guildTime.applyGuildTimeAll` 叠加。

它的归属在 2026-09-16 变过一次：原设计放设备级、理由是"同一个寮，换号不用重配"，但那只对"所有号都在自己寮"成立 —— 代管他人的号、或两个号分处两寮时，一份配置会互相污染。改档案级后它也随备份走（见 7.5），代价是"多号同寮"要配多次，由设置页的**同步到其他档案**（`domain/sync` + `services/profileSync`）补上。

### 7.5 备份：文本载体 + 覆盖式写入

- 导出：`services/backupService.exportBackupText` 导出**全部档案**（只导当前档案会让另一个号悄悄丢数据），导出前自校验。
- 导入：`prepareImportText`（校验 + 归一化，不写库）→ 用户确认五项计数（档案 / 勾选记录 / 自建条目 / 已隐藏 / 自定义排序）→ 手动输入「导入」二字 → `applyImportText` 写库并整库重载。
- 校验：`domain/backup.validateBundle`（结构 + 归一化）、`summarize`（摘要）、`dataFreshness` / `STALE_DAYS`（快照新鲜度）、`MAX_BUNDLE_CHARS`（长度上限）。
- schema 版本不同**只警告不拒绝**（保留「试试看」的机会），结构不合格直接拒绝。
- 备份范围 = **全部档案的全部配置**：勾选、勾选日志、视图偏好、自建条目与排序、**寮时间、寄养任务**（后两项 2026-09-16 加入）。唯一的例外是设备级引导标记 `yys:onboarded` —— 它是"这台设备看过引导没有"，不是配置。

### 7.6 结界寄养

`domain/nurture`：填卡时间（`HH:mm`）后按 6 小时间隔派生最多 5 个收 / 续点，跨天标「明天 / 后天 / 日期」。任务态与计划态刻意分离（完成情况由 `pointStats` / `nextPendingPoint` 计算，计划态不背状态）。

**2026-09-16 起记录本身是档案级**（`yys:plans:{profileId}`）：原注释写"与玩哪个号无关"站不住 —— 结界卡的种类与时长因号而异（太鼓 / 斗鱼 / 美食卡，6h / 12h…），上卡时间自然不同。落盘由"直写 localStorage"改为走契约 `api.savePlans`（**异步 + 失败回滚**，形态与 `stores/view` 一致）；读路径并入首屏 `getBootstrap().plans`，壳层的「下一次该收」徽章不再自己读本机数据，因此也不会再闪现上一个号的寄养列表。
点模型（2026-09-15 重构）：`recordPoints` 输出 `[上卡点(index 0), 收/续点 1..n]`，第 k 点的预计时刻 = 前一点的「实际完成时间（`dones[k-1]`，没有就用它的预计时刻）」+ 6h。于是「记某个点完成」只把它**之后**的点往后挪、之前的点不动（早先那版整条重推会让用户以为任务被初始化了）；上卡点天然已完成且不接受改写，它由 `base` 决定。`baseTsOf` 是唯一的基准入口，展示 / 徽章 / `nextDue` 共用。

### 7.7 御魂与悬赏派生

- 御魂：`domain/yuhun.groupBySection` 按数据字典分组；`dungeonDay` / `resolveFollow` / `oldFollowInfo` 处理「按星期轮换 / 跟随八岐 / 固定掉落」三类模式；`WEEK_ORDER` 决定 7 日条顺序。
- 悬赏：`domain/bounty.buildBountyEntries` 做四表 join；`matchBounty` 空格分词取交集；`pinMatches` **只置顶 + 高亮，不过滤名单**（名单本身是可用集合）；`bountyUnion` / `fullCoverage` 算「一把刷完」的出处。

### 7.8 统计

统计页于 2026-09-15 整版改版（「周期进度条」→「月度日历 + 区间收益」），现在吃**两份**数据：

- **上方日历**：`domain/calendar.buildMonthGrid` 排版 + `domain/checkLog.dayCount` 取每天条数，按**当月单日最大值**相对分 4 档着色（类贡献图）；
- **下方区间收益**：`domain/stats.summarizeRangeGain(items, log, fromKey, toKey)` —— 输入是**勾选日志**而非 `checked`（后者只留最近一次，回答不了"近 7 天"），同一条目多天各完成一次就累计多次，因此没有"总量 / 已得 / 还差"。口径仍是只吃固定数值的 `gain`。

保留但**当前无页面消费**：`summarizeGain` / `PERIOD_META`（周期进度口径）与 `missGroups`（漏失分级），以及 `components/common/GainBar.tsx` / `ProgressBar.tsx` —— 都有单测保护，想恢复"周期进度条"时只改页面。

## 8. 数据录入流程（改数据的标准路径）

```text
1. 读 tools/templates/version-intake.md（录入清单与字段红线）
2. 草稿写入 tools/templates/new-items.draft.json
3. npm run db:check       # 枚举双轨 + 字段白名单 + 引用完整性
4. 校验通过后落到 src/db/ 对应文件
5. 更新 src/db/dataVersion.db.json 的版本行与快照说明（同步 meta.db.json 的 dataVersion）
6. npm run db:calibrate   # 生成核对报告，人工复核收益 / 截止日 / 时间窗 / 锚点
7. npm test && node tools/verify.js
```

历史教训（务必避免）：曾用正则从奖励文本反推奖励类型，结果子串重叠误判（「免费黑蛋礼包」→ 黑碎 + 黑蛋 + 达摩 + 碎片；「地域鬼王 皮肤券」→ 皮肤 + 券）。奖励类型一律逐条人工核定。

下一篇：`docs/03-conventions-and-tests.md`（强制约定、测试与工具）。
