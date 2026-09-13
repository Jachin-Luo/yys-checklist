# yys-checklist

阴阳师奖励查漏清单。手动记录完成状态，不读取游戏账号或游戏内数据。

## 功能

- 今日、本周、限时活动及一次性条目清单，按周期重置完成状态。
- 多档案、自建条目、筛选排序、统计和数据备份。
- 御魂、悬赏资料查询及结界寄养计划。
- 桌面和手机布局。

## 本地运行

使用 Node.js 20 LTS 或更高版本。

```bash
git clone https://github.com/Jachin-Luo/yys-checklist.git
cd yys-checklist
npm ci
npm run dev
```

开发服务默认端口为 `5173`，访问终端输出的实际地址。

## 检查与构建

```bash
npm test
npm run lint
npm run build
npm run db:check
```

一次运行类型检查、Lint、单测、构建和数据校验：

```bash
node tools/verify.js
```

构建结果位于 `dist/`，可通过 `npm run preview` 在本地预览。验证报告生成到 `reports/`，不提交到仓库。

## 数据与结构

项目使用 React、TypeScript、Vite、Tailwind CSS 和 Zustand。

默认运行本地 Mock API，不需要登录或后端服务。用户勾选、档案和偏好保存在当前浏览器的 `localStorage`；清理站点数据前请先导出备份。HTTP Adapter 尚未实现。

```text
src/api/       数据契约与适配器
src/db/        当前游戏条目和资料种子
src/domain/    周期、排序、统计等领域逻辑
src/stores/    应用状态
src/pages/     页面
src/components/ 界面组件
tools/         数据校验与验收工具
```

游戏条目中的时间与奖励信息可能随版本变化，以游戏内实际内容为准。
