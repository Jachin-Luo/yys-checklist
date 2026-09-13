/**
 * 模拟延迟与错误注入（设计文档 §5.3）。
 *
 * 延迟是**故意**加的：如果 mock 是瞬时的，你会写出没有 loading 态、没有竞态处理的 UI，
 * 接真实后端那天全线崩溃。
 *
 * ⚠️ 延迟函数**必须响应 `signal.aborted`** —— 否则 `useApi` 的 AbortSignal 取消形同虚设（§7.2）。
 */

export class ApiError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

/** 主数据读：0–30 ms */
const MAIN_MAX = 30;
/** 写操作：80–150 ms */
const WRITE_MIN = 80;
const WRITE_MAX = 150;

/** 可被 AbortSignal 中断的延时 */
export function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export function mainDelay(signal?: AbortSignal): Promise<void> {
  return delay(Math.floor(Math.random() * MAIN_MAX), signal);
}

export function writeDelay(signal?: AbortSignal): Promise<void> {
  return delay(WRITE_MIN + Math.floor(Math.random() * (WRITE_MAX - WRITE_MIN)), signal);
}

/**
 * 错误注入：`?__fail=1`（URL 开关）或 `VITE_API_FAIL=1`（环境变量）。
 * 用于验证 UI 的 error 分支，而不是"假设它不会错"。
 */
function failFlag(): string | null {
  const env = import.meta.env?.VITE_API_FAIL;
  if (env) return String(env);
  if (typeof window !== 'undefined' && window.location) {
    return new URLSearchParams(window.location.search).get('__fail');
  }
  return null;
}

export function injectFailure(method: string): void {
  const flag = failFlag();
  if (!flag) return;
  throw new ApiError('E_MOCK_FAIL', `[mock] 注入错误：${method}（flag=${flag}）`);
}
