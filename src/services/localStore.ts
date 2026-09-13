/**
 * 本机 localStorage 字节层 —— **全应用唯一读写 localStorage 的地方**（设计文档 §2 铁律）。
 * Mock Adapter 的用户数据分片、以及设备级偏好，都只经由这里落盘。
 *
 * 两类键必须分开理解：
 *   - **用户数据分片**（`yys:state|view|ovr:{profileId}` 等）：属于用户数据模型，经 `ApiClient` 契约读写，
 *     后期接后端要上传（见 `api/mock/persist.ts`）；
 *   - **设备级键**（本文件 `DEVICE_KEY`）：**不属于用户数据模型** —— 不随档案走、不上后端、
 *     在 mock 与 http 两种模式下行为完全一致（寮时间、引导标记、结界寄养计划都属此类）。
 *
 * 2026-09-11：随 `S7 提醒能力` 整体下线，`yys:notify`（通知开关）与 `yys:reminded`
 * （已提醒事件标记）两个键一并删除。旧版本残留在用户本机的值不再有任何读取点，无害。
 */

export const NS = 'yys';

/** 设备级键：本机偏好，不参与契约、不随档案、不上传 */
export const DEVICE_KEY = {
  /** 寮时间：各寮自定，必须可配（需求 §5-D3） */
  guildTime: `${NS}:guildTime`,
  /** 冷启动引导完成标记（一次性） */
  onboarded: `${NS}:onboarded`,
  /** 结界寄养任务 / 计划（纯前端本地数据，S6 用） */
  plans: `${NS}:plans`,
} as const;

function storage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch (e) {
    console.error('[localStore] localStorage 不可用（隐私模式？）', e);
    return null;
  }
}

export function read<T>(key: string): T | null {
  const ls = storage();
  if (!ls) return null;
  try {
    const raw = ls.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch (e) {
    console.error(`[localStore] 读取失败，按缺失处理：${key}`, e);
    return null;
  }
}

export function write<T>(key: string, value: T): void {
  const ls = storage();
  if (!ls) throw new Error('浏览器本地存储不可用，请检查存储权限后重试。');
  try {
    ls.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`[localStore] 写入失败：${key}`, e);
    const full = e instanceof Error
      && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED');
    throw new Error(full
      ? '本地存储空间不足，请释放空间后重试。'
      : '无法写入本地存储，请检查浏览器存储权限后重试。');
  }
}

export function remove(key: string): void {
  const ls = storage();
  if (!ls) throw new Error('浏览器本地存储不可用，请检查存储权限后重试。');
  try {
    ls.removeItem(key);
  } catch (e) {
    console.error(`[localStore] 删除失败：${key}`, e);
    throw new Error('无法更新本地存储，请检查浏览器存储权限后重试。');
  }
}
