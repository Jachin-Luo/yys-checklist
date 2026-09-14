# AGENTS.md — 交接约定与导航

> 本文件写给在本仓库工作的 AI 助手与开发者。**开工前先读本文件**，再按末尾「文档索引」按需深入。
>
> 对应数据版本：`2026.09.13-十周年勾玉查漏` ｜ 事实核对日期：2026-09-14 ｜ 详细文档见 `docs/`

## 这个项目是什么

阴阳师奖励查漏清单：**纯手动勾选**的自查工具，不登录、不读取游戏账号或游戏内数据、不模拟点击。
技术栈：React 18 · TypeScript（严格模式）· Vite 5 · Tailwind CSS 3 · Zustand 5 · Vitest 2；无 UI 框架依赖。

保存与数据都在当前浏览器的 `localStorage`（按档案分片），默认走本地 Mock API，不需要后端。

---

## 一、红线（改动前必须理解，违反即视为实现错误）

### 1. 分层铁律

```text
页面只管排列 → store 管状态 → domain 管纯函数规则 → api 契约管数据访问
```

- 页面（`src/pages/`）不直连种子文件、不写业务规则。
- 合并、重置、排序、统计等规则只写在 `src/domain/`，必须是可单测的纯函数。
- Mock 适配器（`src/api/mock/`）只做 IO 与合并调用，**不含合并规则本身**。
- 数据访问只有一条出口：`import { api } from '@/api'`。

### 2. 种子 JSON 只能被一个文件 import

`src/db/*.db.json` **只允许** `src/api/mock/db.ts` 引用。
`eslint.config.js` 里 `no-restricted-imports`（`JSON_BAN`，error 级）拦截 `**/db/*.db.json`、`**/db/*.json`、`@/db/*`，唯一豁免 `src/api/mock/db.ts`。
需要新数据 → 在 `db.ts` 加载 → 经 `domain/merge` 合并 → 经契约暴露。

### 3. localStorage 只有一个出口

全应用读写 `localStorage` 的地方只有 `src/services/localStore.ts`（`read` / `write` / `remove` / `DEVICE_KEY` / `NS`）。
Mock 的分片键由 `src/api/mock/persist.ts` 封装（`KEY` / `removeProfileShards`），它再导出 `localStore` 的方法，业务代码不得自己调 `window.localStorage`。

### 4. 口径纪律（动统计 / 勾选 / 显示逻辑前必读）

| 纪律 | 含义 | 落点 |
| --- | --- | --- |
| 只统计固定数值 | 浮动收益（只有类型没有数值）不进分子分母 | `domain/stats.ts` `summarizeGain` |
| 覆盖 / 隐藏只影响渲染 | 绝不影响统计与漏失口径 | `domain/stats.ts`、`hooks/useChecklist.ts` |
| 漏失只列事实 | 不折算、不估算 | `domain/stats.ts` `missGroups` |
| 统计忽略「隐藏已完成」 | 统计直接吃原始勾选状态 | `pages/StatsPage.tsx` |
| 时间只提示不限制勾选 | 到期条目在**数据层**过滤，不在渲染层判 | `domain/reset.ts` `activeItems`、`domain/countdown.ts` |
| 单一数据出口 | 页面不直连种子，一律 store → api 契约 | `src/api/index.ts` / `src/api/contract.ts` |

### 5. 枚举双轨，改一侧必须同步另一侧

`src/domain/enums.ts` 的字面量联合类型（`CYCLE` / `GAIN_KIND` / `SORT_BY` / `DICT_TYPE` …）与 `src/db/meta.db.json` 的 `dicts` 是同一事实的两份编码，由 `npm run db:check`（`tools/build.js` 的 `PAIRS` 双向校验）强制对齐。
**改任一侧都要同步另一侧并跑 `npm run db:check`**。

### 6. 不要「复活」已移除的东西

- 已删除的条目字段：`value`（主观档）、`time2`、`source`、`reward`、`entry`、`action`。奖励文本字段是整体移除的，不要因为「看起来方便」而加回来。
- 浏览器提醒能力已于 2026-09-11 整体下线（`yys:notify` / `yys:reminded` 键已删）。

### 7. 不要用正则从奖励文本反推奖励类型

历史反面教材：曾用正则把「免费黑蛋礼包」标成黑碎 + 黑蛋 + 达摩 + 碎片，把「地域鬼王 皮肤券」拆成皮肤 + 券（子串重叠误判）。
奖励类型一律**逐条人工核定**，数据录入遵守 `tools/templates/version-intake.md`。

### 8. 每次改动都要留下变更记录

任何改动完成后，先在根目录 `CHANGELOG.md` 的 `[Unreleased]` 区追加条目：按「新增 / 修改 / 修复 / 移除 / 数据」选分组，写清**改了什么**（每条一行，不写动机、不复制 `docs/` 正文）。
数据类改动（条目库、枚举、数据版本号）必须同时登记到「数据」分组。
发版时才把 `[Unreleased]` 整段归入新的版本小节并补日期；版本号以 `package.json` 的 `version` 与 `src/db/meta.db.json` 的 `meta.version` 为准，本记录只引用不发明。
未修复的问题与待办写在 `docs/04-handover-guide.md` 的路线图一节，**不要**写进 `CHANGELOG.md` 的修复分组。

### 9. 开发阶段不做历史数据兼容（2026-09-14 起）

项目尚未正式发布给真实用户，**所有改动只需保证「全新初始状态」正确**：

- 不必为旧版本 `localStorage` 分片或旧备份文本写迁移 / 降级逻辑；
- 不必为「某个 id 曾经合法、现在不再合法」设计兼容路径；
- 数据模型可以随时改字段、删字段，不用考虑线上已有数据。

**唯一例外（仍要保留的廉价防御）**：过滤「当前运行期就可能出现」的非法输入 —— 例如某档案的配置里引用了已被删除 / 已下线的条目 id。这类过滤只有一两行，去掉换来的却是运行期异常，不值得省。

### 10. 提交身份要显式指定（本机未配置 git user）

本机**没有**配置 `user.name` / `user.email`，git 会按系统账户推断出 `Luo <ykluok@isoftstone.com>`，与仓库历史（`Jachin-Luo <Jachin-Luo@users.noreply.github.com>`）不一致。

**不要修改 git 配置**（`git config user.*`），提交时显式指定即可 —— `--author` 只管 author，committer 要靠环境变量：

```powershell
$env:GIT_AUTHOR_NAME = "Jachin-Luo"; $env:GIT_AUTHOR_EMAIL = "Jachin-Luo@users.noreply.github.com"
$env:GIT_COMMITTER_NAME = "Jachin-Luo"; $env:GIT_COMMITTER_EMAIL = "Jachin-Luo@users.noreply.github.com"
git commit --message="..."
```

提交后用 `git log -1 --format='A:%an <%ae> | C:%cn <%ce>'` 复核一眼。

---

## 二、常用命令

```bash
npm ci                    # 按 lockfile 安装（Node 18+，实测 Node 22）
npm run dev               # 开发服务，默认 http://localhost:5173/
npm test                  # vitest run，单元测试（19 文件 / 251 用例）
npm run lint              # eslint
npm run build             # tsc -b && vite build
npm run db:check          # 数据校验 + 枚举双轨对齐，产物 reports/data-check.md
npm run db:calibrate      # 数据核对报告，产物 reports/pending-review.*、reports/calibration.md
node tools/verify.js      # 一键验收：tsc + eslint + vitest + build + db:check，产物 reports/verify-<date>.md
```

`reports/` 已被 `.gitignore` 忽略，可随时重跑生成。

---

## 三、改动后的自检

| 改了什么 | 至少跑什么 |
| --- | --- |
| 任何改动 | 在 `CHANGELOG.md` 的 `[Unreleased]` 区追加一条（选分组、写清改了什么） |
| `src/db/*.db.json`、`src/domain/enums.ts` | `npm run db:check` |
| `src/domain/**`、`src/stores/**`、`src/api/**` | `npm test`（必要时补测试） |
| 页面 / 组件 | `npm run lint` + `npm run build` |
| 准备提交前 | `node tools/verify.js` |

---

## 四、文档索引

| 文档 | 内容 |
| --- | --- |
| `docs/README.md` | 文档总索引、按角色的推荐阅读路径、文档时效与更新约定 |
| `docs/01-architecture.md` | 目录逐层职责、启动到首屏的渲染链路、导航机制、8 个 store 的职责与依赖方向、双布局差异 |
| `docs/02-data-and-domain.md` | 数据契约、Mock 适配器与分片持久化、8 个 db.json 结构与规模、14 个 domain 模块导出表、特殊机制（一键日常 / 寮时间 / 备份 / 寄养 / 御魂 / 悬赏） |
| `docs/03-conventions-and-tests.md` | 分层约束的强制手段、口径纪律逐条落点、测试体系与写法、数据录入流程、工具脚本、常见坑 |
| `docs/04-handover-guide.md` | 环境准备、6 类改动任务手册、未完成项与路线图、问题排查、「不要这样做」清单 |

面向玩家的功能说明、FAQ、数据说明与免责在根目录 `README.md`；本文件与 `docs/` 只讲开发所需的事实，不重复玩家向内容。
