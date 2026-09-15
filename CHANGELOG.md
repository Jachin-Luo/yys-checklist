# 变更记录

> 本文件记录 yys-checklist 的所有变更，是改动的唯一流水入口。
>
> - 格式参照 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。
> - 版本号与 `package.json` 的 `version`、`src/db/meta.db.json` 的 `meta.version` 保持一致（当前 `1.4.0`），本文件只引用不发明。
> - 分组固定五类：**新增** / **修改** / **修复** / **移除** / **数据**（数据 = 条目库、枚举、数据版本号）。
> - 日常改动只追加到 `[Unreleased]`；发版时把该区整体归入新的版本小节并补日期，`[Unreleased]` 重新置空。
> - 仓库暂无 git tag，因此不写版本比较链接。
> - 每条一行，只写「改了什么」，不预设动机、不复制 `docs/` 正文；待办与未修复项记在 `docs/04-handover-guide.md` 的路线图一节，不写进本文件的修复分组。

## [Unreleased]

### 新增

- 交接文档体系：`AGENTS.md`（红线与命令速查）、`docs/README.md`（文档索引与更新约定）、`docs/01-architecture.md`（架构与渲染链路）、`docs/02-data-and-domain.md`（数据层与领域逻辑）、`docs/03-conventions-and-tests.md`（强制约定、测试与工具链）、`docs/04-handover-guide.md`（上手步骤与改动任务手册）
- 「本月」页：月常条目从「本周」页拆出、独立成一级页面（导航 7 项：今日 / 本周 / 本月 / 限时 / 统计 / 工具 / 我的）—— 两者刷新口径不同（周一 0 点 vs 每月 1 日 0 点）。`useChecklist` 新增 `'month'` 目标（`'week'` 不再含月常），`domain/dateLabel` 新增 `monthRangeLabel`（含单测）；移动端底部 Tab 由 `grid-cols-6` 改为 `grid-cols-7`，桌面侧栏补 `CalendarDays` 图标，`NavContent` 增加分派分支
- 勾选日志 `CheckLog`：新增 `yys:checklog:{profileId}` 分片，按 `YYYY-MM-DD` 分桶记录当日勾选的条目（幂等、保留 90 天），**周期重置不清它**，只有取消勾选才按该条目的周期起点回退（`domain/checkLog` + `stores/check.logAfter`，均带单测）。它是"哪天做过什么"的唯一来源 —— `checked` 只留每条最近一次。随备份导出 / 导入（`UserDataBundle.data[].log`；旧备份缺该字段时归一成空日志），契约新增 `saveCheckLog`（31 个方法），`getBootstrap` 的 payload 增加 `log`
- 统计页整版改版（`pages/StatsPage.tsx`）：上方「月度日历」按**当月单日最大值**相对分档着色、点某天即选中；下方「时间区间收益」为 近 7 天（默认）/ 近 30 天 / 本月，点日历切成单日、再点一次（或按「返回近 7 天」）回到快捷区间。区间收益走新增的 `domain/stats.summarizeRangeGain`（输入是勾选日志 —— 同一条目多天完成即累计多次，因此无「总量 / 还差」），日历排版走新增的 `domain/calendar`（周一起始、固定 6 行、含前后补位格）。原「本日 / 本周 / 本月进度条」与 `GainBar` / `ProgressBar` 保留待恢复但已无消费方

### 修改

- 壳层常驻「下一个结界卡收/续点」徽章（`components/common/NurtureBadge.tsx`）：桌面侧栏底部与移动端头部、紧挨档案切换器；每 60s 自己走时，到点显示「该收卡了」，点击直接跳到工具页的「结界寄养」分段。取点规则落在 domain（`nextDue` / `dueText`，带单测）；`stores/ui` 的一次性跳转标记由 `sectionRequest` 泛化为 `navRequest`（页面 + 分区），今日页「去设置」同步改用；移动端为紧凑形态（仅「图标 + 剩多久」）与档案切换器同一行，桌面端保留完整时刻
- `README.md` 追加「开发者文档」一节，指向 `AGENTS.md` 与 `docs/`（只加索引，不复述正文）
- `.gitignore` 忽略 IDE 目录 `.codebuddy/`
- 条目管理的周期分组由「常驻全展开」改为**按需展开**：点周期名才展开该组（同一时刻最多一组），有搜索词时强制展开全部命中分组 —— 90+ 条条目不再一次铺满好几屏

- 「已隐藏的预设条目」区同样按周期分组展示、按需展开（展开状态与上方列表独立），恢复按钮补上 `aria-label`

- PC 端左下角的档案切换器改用 `compact`（与移动端头部一致，只显示档案名）—— 侧栏只有 224px，带区服时区服会被截断，反而看不全

- PC 侧栏左下角的「当前档案」标签与档案切换器改为同一行（原先竖排两行，224px 宽的卡片里空白过多）

- 限时页的截止徽章原先独占卡片右侧一列，把内容区压窄、导致下方备注提前换行（而备注最长的条目恰好都带 deadline）：改为渲染在标题行内，内边距与同行徽章统一为 `py-0.5`

- 周期刷新口径更正：每日与周常都是 **0 点**刷新（此前按 05:00 推算，`meta.resetHour` 5 → 0，`meta.resetNote` 同步改写）；版本 / 赛季仍按开服锚点，锚点即版本上线当日维护完成的时刻（通常 9:00）。本周页的重置提示移到限时页的「版本 / 赛季」分区，README 中「为什么不 0 点重置」的 FAQ 按新口径改写

- 补充开发阶段约定（`AGENTS.md` 红线第 9 条 + `docs/03` 第 8 节）：项目尚未发布，改动**不必考虑历史数据兼容**（旧分片、旧备份、已失效 id 都不必写迁移路径），但仍保留「运行期就会出现」的廉价防御（不存在的 id 过滤、已下线键清理、越权校验）

- 统一措辞（纯注释与用例名）：`domain/autoDaily` 及相关用例里「兼容旧配置」的说法改为「已失效 id / 运行期脏数据」—— 这些过滤防的是**运行期**情况（条目被删、活动条目下线），不是跨版本兼容，按新约定容易被误删

- 开发依赖升级：`vite` 5 → 8、`vitest` 2 → 5、`@vitejs/plugin-react` 4 → 5（`npm audit` 5 个漏洞清零；构建、单测、数据校验已验证通过）
- AGENTS.md 增加「提交身份要显式指定」约定（红线第 10 条）：本机未配置 git user，提交时用环境变量 + `--author` 指定 `Jachin-Luo <Jachin-Luo@users.noreply.github.com>`，不改 git 配置；同时修正了本轮两次提交的身份

- 今日页一键日常入口卡右侧按钮由「去完成」改为「去设置」：原按钮与「点整张卡」效果完全重复，现在点击跳到「我的 · 一键日常覆盖」并自动展开该分区（`stores/ui` 新增一次性跳转标记 `sectionRequest`，`CollapsibleSection` 支持 `id` 锚点）

- 结界寄养的完成记录改为**逐点**：上卡时刻也作为一个点显示在任务里（index 0，只读），每个收/续点可点选并单独「记完成 / 改时间 / 取消完成」；第 k 点的预计时刻 = 前一点的「实际完成时间（没有就用它的预计时刻）」+ 6h，因此记完成只让它**之后**的点顺延、之前的点不动 —— 取代此前「一个按钮把整条任务重推」的做法（那种做法看起来像把任务初始化了）。数据层以 `NurtureRecord.dones` 取代 `lastDoneAt`，`pointStats` 改为「已完成 / 待收」，取点统一走 `recordPoints`（展示、徽章、`nextDue` 共用），`hmToDate` 供输入解析，带单测

### 修复

- 统计 / 工具 / 我的三个页面在桌面端内容整体贴左：三页各设了宽度上限（统计 768 / 工具 896 / 我的 672），但容器没有 `mx-auto`，在 1024 的桌面内容容器里左对齐、右侧空出大片留白。三页容器补 `mx-auto`，并同步修正 `DesktopShell` 与 `StatsPage` 中「居中职责只在 Shell 一层」的注释口径

- 「我的」页展开折叠分区时页面横向错位一下：`main` 是唯一内层滚动容器，展开内容使高度跨过"是否需要滚动"的阈值时，滚动条（全局宽度 8px）出现 / 消失会让可用宽度变化，内部的 `mx-auto` 容器随之重新居中。给滚动容器加 `scrollbar-gutter: stable`（`src/styles/base.css`），槽位常驻、宽度恒定

- 一键日常的覆盖候选被放宽到「全部常驻每日」（35 条），斗技、逢魔之时、地域鬼王、寮活动、御魂副本等官方不会代做的任务也能勾进覆盖集合 —— 勾选入口时级联会把它们一并标成已完成，等于伪造进度。判定收窄为「常驻每日 + 数据标了 `autoDaily`」（现 14 条），与 README 的覆盖项口径一致；旧配置里混入的此类 id 在归一化时自动失效

- `tools/verify.js` 的单测命令由 `--reporter=basic` 改为 `--reporter=default`（vitest 5 移除了 basic reporter，原参数让验收在启动阶段报错、一个用例都跑不起来）

### 移除

- 统计页的「可量化条目」列表与「漏失明细」分区：前者与清单页重复（同一条目在今日页也能勾），后者只复述漏了哪些条目。`domain/stats.ts` 的 `periodItems` / `summarizeGain` 保留（有单测保护，随时可恢复；`missGroups` 已于 2026-09-15 删除，见下条）
- 痛感从「多用途」收敛为**只作默认排序键**（2026-09-15），四处一并移除：① `minWeight` 筛选门槛（`ViewBar` 的选项 chip、`domain/sort.isVisible` 的门槛判断、冷启动引导第三步的「首屏显示范围」选择）；② 今日页「本周高痛感还剩 N 项」警示条（此前被 `SHOW_WEEKLY_ALERT = false` 关着，连同 `useChecklist.weeklyHighWeightLeft` / `HIGH_WEIGHT` 一起删除）；③ `domain/stats.missGroups` 漏失分级（早已无页面消费）；④ `domain/weight.WEIGHT_LEGEND` 图例数据（本就无消费方）。`ViewPrefs.minWeight` / `viewDefaults.minWeight` 字段与 `stores/view.setMinWeight` 按 `sortBy` 的先例保留在数据层（不动契约形状），注释已标注废弃

### 数据

- 条目库划分口径收紧：`items.db.json` 只留**真正的常驻**（每日 36 / 每周 29 / 每月 4 = 69 条），把 5 条版本与 1 条赛季条目（版本活动爬塔积分、活动商店兑换、斗技赛季奖励、皮肤返场 / 限定兑换、寻契心缘商店、曜之阁·星光契兑换）移入 `limited.db.json`（16 → 22 条）—— 这些玩法并非每个版本都有，不属常驻。`cycle` 字段未改，因此页面归属（限时页的「版本 / 赛季」分区）、重置锚点（`meta.periods`）与统计口径均不受影响；`api/mock/db.ts`、`tools/build.js` 的双文件说明与 README / `docs/02` 的规模数字同步更新。条目总数仍为 91 条

> 本轮基线（记录起点）：`npm test` 19 个测试文件 / 251 个用例全绿；`npm run dev` 可访问 `http://localhost:5173/`；条目库数据版本 `2026.09.13-十周年勾玉查漏`。

## [1.4.0] - 2026-09-14

### 新增

- 首次公开发布：六个一级页面（今日 / 本周 / 限时 / 统计 / 工具 / 我的）
- 本地 Mock API 适配器 + 按档案分片的 `localStorage` 持久化（勾选 / 视图 / 覆盖层各自分片，勾一条只重写当前档案的状态分片）
- 多档案：新建、切换、归档、恢复、删除；档案级数据隔离
- 数据备份：导出为 JSON 文本、粘贴导入（结构校验 + 五项摘要确认 + 覆盖式写入）
- 工具资料三段懒加载：御魂副本轮换与掉落、悬赏封印出处反查、结界寄养 6 小时收续点
- 数据与验收脚本：`tools/build.js`、`tools/calibrate-report.js`、`tools/verify.js`

### 修改

- 重写 `README.md`：补充功能详解、数据规模、口径纪律与常见问题
- `.gitignore` 忽略本机部署脚本 `update.sh`

### 数据

- 条目库数据版本 `2026.09.13-十周年勾玉查漏`：常驻条目 75 条 + 活动期条目 16 条；另含御魂副本 11 个、御魂 70 种、悬赏式神 39 个
