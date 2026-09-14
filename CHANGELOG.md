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

### 修改

- `README.md` 追加「开发者文档」一节，指向 `AGENTS.md` 与 `docs/`（只加索引，不复述正文）
- `.gitignore` 忽略 IDE 目录 `.codebuddy/`

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
