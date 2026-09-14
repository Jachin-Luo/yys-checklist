# 02 · 数据层与领域逻辑

> 对应数据版本：`2026.09.13-十周年勾玉查漏` ｜ 事实核对日期：2026-09-14
> 本文回答：**数据长什么样、从哪来、到哪去、规则写在哪个函数里**。
> 本文只描述结构与规模，不逐条罗列条目明细 —— 明细以 `src/db/*.db.json` 为唯一真值。

## 1. 数据边界：`src/api/`

### 1.1 契约 `src/api/contract.ts`

只定义形状，不含实现。两个导出：

- `DataScope`：`{ userId, profileId }` —— **显式双参数**，所有用户数据方法都要求它，Mock 用 `assertScope` 做越权校验。
- `ApiClient`：30 个方法，分五组：

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
| `BootstrapPayload` | 首屏聚合载荷（meta + items + session + state + view + overrides） |
| `ItemDraft` / `ProfileDraft` | 新增/编辑入参 |
| `UserDataBundle` | 备份载体（导入导出用） |
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
| `state(profileId)` | `yys:state:{profileId}` | 该档案的勾选状态 |
| `view(profileId)` | `yys:view:{profileId}` | 该档案的视图偏好 |
| `ovr(profileId)` | `yys:ovr:{profileId}` | 该档案的条目覆盖层（隐藏 / 自建 / 自定义顺序 / 一键日常配置） |

设备级键（不挂档案，定义在 `services/localStore.ts` 的 `DEVICE_KEY`）：`yys:guildTime`、`yys:onboarded`、`yys:plans`。

**分片是硬约束**：勾选一条只重写 `yys:state:{profileId}`，其他档案分片不受影响；由 `api/mock/contract.test.ts` 的「分片写入验证」用例守护。

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
| `items.db.json` | `items: Item[]` | **75 条**常驻模板（每日 36 / 每周 29 / 每月 4 / 版本 5 / 赛季 1） |
| `limited.db.json` | `items: Item[]` | **16 条**活动期条目（到期自动下线） |
| `yuhun.db.json` | `dungeons[]`、`dayTips[]`、`excluded[]` | 副本 **11**、日提示 **10**、排除项 **8** |
| `souls.db.json` | `rows: SoulRow[]` | **70** 种御魂（`effect2` 70 条；`effect4` 57 条，13 种首领御魂无四件套） |
| `bounty.db.json` | `shikigami[]`、`spots[]`、`shikigamiSpots[]`、`shikigamiClues[]` | 式神 **39**、地点 **64**、出处关系 **148**、线索词 **116** |
| `meta.db.json` | `meta`、`dicts[]`、`sortOptions[]`、`viewDefaults` | 字典 **50** 行（cycle 7 + gainKind 18 + weekday 7 + yuhunSection 5 + spotKind 6 + soulCategory 7）、排序选项 5 |
| `users.db.json` | `users`、`profiles`、`states`、`viewPrefs`、`itemOverrides`、`sessions` | 各 1 条（`u_local` / `p_main`） |
| `dataVersion.db.json` | `versions: VersionRow[]` | **7** 条（对应 meta / items / limited / yuhun / bounty / souls / users） |

常驻 + 活动总计 **91 条**条目。

`meta` 关键字段：`version`（应用版本，如 `1.4.0`）、`dataVersion`（如 `2026.09.13-十周年勾玉查漏`）、`resetHour`（= 0）、`periods`（版本 / 赛季锚点）。

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
| `stats.ts` | `StatPeriod`、`GainSummary` / `GainRow` / `GainReport`、`periodItems`、`summarizeGain`、`MissLevel` / `MissItem` / `MissGroup`、`missGroups`、`PERIOD_META` | 三口径统计与漏失分级（只吃 `gain`） |
| `autoDaily.ts` | `hubItem`、`isAutoDailyCandidate`、`dataDefaultAutoSet`、`effectiveAutoSet`、`isCovered`、`hiddenByCover`、`cascadeTargets`、`cascadeBatch` | 一键日常覆盖集合与级联 |
| `backup.ts` | `MAX_BUNDLE_CHARS`(4_000_000)、`STALE_DAYS`(45)、`BundleSummary`、`ValidateResult`、`summarize`、`validateBundle`、`Freshness`、`dataFreshness`、`serializeBundle`、`parseBundleText` | 备份文本的校验、归一化与新鲜度 |
| `guildTime.ts` | `GuildTimePrefs`、`isValidHm`、`guildTimeTargets`、`configuredCount`、`applyGuildTime`、`applyGuildTimeAll`、`withGuildTime` | 寮时间在展示层叠加（**不写回主数据**） |
| `nurture.ts` | `NURTURE_HOURS`(6)、`MAX_NURTURE_N`(5)、`NurtureRecord` / `NurturePoint`、`isHM` / `normalizeHM` / `nowHM`、`nurturePoints`、`nextPointIndex`、`pointStats`、`nurtureId`、`makeNurture`、`sortNurture` | 结界寄养 6 小时收 / 续点派生 |
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

- 实现在 `domain/weight.weightOf` / `cycleRank`，图例由 `WEIGHT_LEGEND` 提供。
- 一键日常入口恒排第 0 位：`domain/sort.buildComparator` 的前置特判，**不参与上面的比较**。
- 排序优先级：星标置顶 > （自定义顺序若已调过则接管）> 痛感分；同分兜底依次为截止日 → 周期 → 自定义顺序。
- 可见性：`domain/sort.isVisible`（奖励类型筛选 + 痛感门槛 + 隐藏已完成 + 一键日常覆盖导致隐藏）。

### 7.3 一键日常：配置 ≠ 状态

- 集合语义：`domain/autoDaily.effectiveAutoSet`（未配置时回落到 `dataDefaultAutoSet` 的数据默认集合）。
- `hubItem` 取唯一入口条目（`isAutoHub`）；`isCovered` / `hiddenByCover` 只影响渲染。
- 级联：`cascadeTargets` / `cascadeBatch` 计算入口勾选时要一起勾上的条目；`stores/check.toggleWithCascade` 执行。
- **关键约束**：单独取消某个被覆盖项的勾选，不会把它移出覆盖集合 —— 避免「状态变化偷偷改配置」。显示方式（弱化 / 隐藏）只影响列表渲染，**不影响统计与漏失口径**。
- 候选范围（2026-09-14 收窄）：只有**常驻每日 + 数据里标了 `autoDaily`** 的条目可被覆盖（当前 14 条）。斗技、逢魔之时、地域鬼王、寮活动等官方不代做的每日任务既不出现在配置界面，也不会被级联勾选 —— 否则点入口会把玩家没做的任务标成已完成。旧配置中混入的此类 id 会在 `effectiveAutoSet` 归一化时自动失效。

### 7.4 寮时间：展示层叠加

各寮活动时间自定，写死即错。数据里的时间只是参考值，用户配置（`stores/device.guildTime`，设备级）在展示层经 `domain/guildTime.applyGuildTimeAll` 叠加。它属于「设备 / 人」的属性 —— 换号不用重配，换手机才需要。

### 7.5 备份：文本载体 + 覆盖式写入

- 导出：`services/backupService.exportBackupText` 导出**全部档案**（只导当前档案会让另一个号悄悄丢数据），导出前自校验。
- 导入：`prepareImportText`（校验 + 归一化，不写库）→ 用户确认五项计数（档案 / 勾选记录 / 自建条目 / 已隐藏 / 自定义排序）→ 手动输入「导入」二字 → `applyImportText` 写库并整库重载。
- 校验：`domain/backup.validateBundle`（结构 + 归一化）、`summarize`（摘要）、`dataFreshness` / `STALE_DAYS`（快照新鲜度）、`MAX_BUNDLE_CHARS`（长度上限）。
- schema 版本不同**只警告不拒绝**（保留「试试看」的机会），结构不合格直接拒绝。

### 7.6 结界寄养

`domain/nurture`：填卡时间（`HH:mm`）后按 6 小时间隔派生最多 5 个收 / 续点，跨天标「明天 / 后天 / 日期」。任务态与计划态刻意分离（`points` 的状态由 `pointStats` / `nextPointIndex` 计算，计划态不背状态）。

### 7.7 御魂与悬赏派生

- 御魂：`domain/yuhun.groupBySection` 按数据字典分组；`dungeonDay` / `resolveFollow` / `oldFollowInfo` 处理「按星期轮换 / 跟随八岐 / 固定掉落」三类模式；`WEEK_ORDER` 决定 7 日条顺序。
- 悬赏：`domain/bounty.buildBountyEntries` 做四表 join；`matchBounty` 空格分词取交集；`pinMatches` **只置顶 + 高亮，不过滤名单**（名单本身是可用集合）；`bountyUnion` / `fullCoverage` 算「一把刷完」的出处。

### 7.8 统计

`domain/stats.summarizeGain` 只累加带固定数值的 `gain`（勾玉 / 黑碎 / 蓝票），口径定义在 `PERIOD_META`。
`missGroups`（按痛感分级列漏失条目名、不折算不估算）仍保留在 domain 层并有单测保护，但自 2026-09-14 起**没有页面消费它** —— 统计页只展示三条收益进度条。

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
