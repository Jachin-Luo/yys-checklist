import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';
import './styles/base.css';
import './styles/theme.css';
import { useThemeStore } from './stores/theme';

const container = document.getElementById('root');
if (!container) {
  throw new Error('找不到 #root 挂载点');
}

/**
 * 应用入口。
 *
 * **PWA 打包（manifest + Service Worker + 安装图标）暂缓**，因此这里不做 SW 注册。
 * 2026-09-11：**提醒能力（`.ics` 日历导出 + 系统通知）在当前版本整体移除** ——
 * 于是也没有任何地方需要 Service Worker；将来若恢复提醒，两者会一起回来。
 *
 * 2026-09-23：换肤前**先在渲染之前**把 `data-theme` 写进 `<html>`。
 * 为什么不用 `index.html` 里的内联脚本读 localStorage：那会绕开
 * 「`localStore.ts` 是全应用唯一读写 localStorage 的地方」这条铁律。
 * 走 store 的 `hydrate()` 既守住分层，也保证暗版用户不会先看到一帧明版。
 */
useThemeStore.getState().hydrate();

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
