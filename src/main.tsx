import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';
import './styles/base.css';

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
 */
ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
