import { registerSW } from 'virtual:pwa-register';
import { usePwaStore } from '../stores/pwa';

/**
 * Service Worker 的注册与更新（2026-09-29）。
 *
 * ## 为什么用 `virtual:pwa-register` 而不是手写 `navigator.serviceWorker.register`
 *
 * 它是 vite-plugin-pwa 对 workbox-window 的封装，已经处理了两段最容易写错的时序：
 *   1. 新 SW 装好进入 `waiting` → 通知页面"有新版"（工作的 SW 仍在跑，不会中途换掉）；
 *   2. 发 `SKIP_WAITING` → 等新 SW **接管控制权** → 再刷新页面。
 * 手写时极容易在 `controllerchange` 上抢跑（刷新早于接管，页面又转回旧版本）。
 *
 * ## 更新时机：交给用户（用户 2026-09-29 拍板）
 *
 * 应用**不会**静默刷新。发现新版只把 `needRefresh` 置位，设置页据此把「检查更新」
 * 换成「重启更新」——何时换版本由用户点。
 *
 * ⚠️ 有一件事页面代码关不掉，别把它当成"违约"：浏览器**自身**会在导航时校验一次
 * `sw.js`（规范行为）。那是几百字节的字节比对、**不含任何用户数据**；断网时该请求
 * 静默失败，照旧用缓存版本，不影响使用。所谓"仅更新时联网"，指的就是这一类请求。
 */
let updateSW: ((reloadPage?: boolean) => Promise<void>) | null = null;
let registration: ServiceWorkerRegistration | null = null;
/**
 * 本次「检查更新」是否真的发现了新版。
 * `updatefound` 是同步派发、`update()` 是异步 resolve —— 用标记记录，而不是靠
 * "等一小会儿再看 store"，后者是在猜时序，慢网下必然出错。
 */
let foundOnCheck = false;

/** 应用启动时调一次（`App.tsx`）。开发态由插件给出空实现，不会注册 SW。 */
export function initPwa(): void {
  if (!usePwaStore.getState().supported) return;
  updateSW = registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, reg) {
      registration = reg ?? null;
      usePwaStore.getState().setRegistered(Boolean(reg));
      /* 每次注册都挂上：`update()` 触发的那次安装也会走到这里 */
      reg?.addEventListener('updatefound', () => {
        foundOnCheck = true;
      });
    },
    onNeedRefresh() {
      usePwaStore.getState().setNeedRefresh(true);
    },
    onOfflineReady() {
      usePwaStore.getState().setOfflineReady(true);
    },
    /**
     * 注册失败**不弹错**：SW 只是"可安装 + 离线"的增益，应用本身照常能用。
     * 非 HTTPS、隐私模式、企业策略、老浏览器都会让注册失败 —— 这些都不该打断用户。
     */
    onRegisterError() {},
  });
}

export type CheckResult = 'update' | 'latest' | 'error';

/**
 * 用户主动检查更新。
 * `latest` / `error` 都是一次性反馈（由调用方短暂提示），`update` 则要等
 * `onNeedRefresh` 把 `needRefresh` 置位后由 UI 切换成「重启更新」。
 */
export async function checkForUpdate(): Promise<CheckResult> {
  if (!registration) return 'error';
  foundOnCheck = false;
  try {
    await registration.update();
  } catch {
    return 'error';
  }
  return foundOnCheck ? 'update' : 'latest';
}

/** 应用已下载的新版本：让新 SW 接管并刷新页面 */
export function applyUpdate(): void {
  void updateSW?.(true);
}
