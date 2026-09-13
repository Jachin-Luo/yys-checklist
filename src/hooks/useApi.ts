import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 异步取数 hook —— 竞态与卸载守卫（设计文档 §7.2）。
 *
 * **首屏不走本 hook**（首屏用 `useBootstrap`）：一次聚合请求，天然没有"多请求乱序"问题。
 * 本 hook 只用于**变更后重取单份数据**（如改完筛选只重取 view）。
 *
 * 必须处理的三类竞态（缺一即出 bug）：
 *   1. 快速切换档案 → 旧档案的数据才返回，覆盖新档案视图 → `AbortSignal` 取消前一次请求
 *      （Mock 的延迟函数必须响应 `signal.aborted`，见 `api/mock/latency.ts`）
 *   2. 同参数重复请求 → 连续两次 reload() 乱序返回，旧结果盖掉新结果 → 递增 `requestId`，只认最后一次
 *   3. 组件卸载后写状态 → React 警告 + 内存泄漏 → 卸载守卫：`abort()` + `requestId` 双重校验
 */
export interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  reload: () => void;
}

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

export function useApi<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  deps: unknown[],
  options: { enabled?: boolean } = {},
): UseApiResult<T> {
  const enabled = options.enabled ?? true;
  const [state, setState] = useState<ApiState<T>>({ data: null, loading: enabled, error: null });
  const requestIdRef = useRef(0);
  const [reloadTick, setReloadTick] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!enabled) {
      setState({ data: null, loading: false, error: null });
      return undefined;
    }
    const controller = new AbortController();
    const rid = ++requestIdRef.current;
    setState((s) => ({ ...s, loading: true }));

    fnRef.current(controller.signal)
      .then((result) => {
        if (rid === requestIdRef.current && !controller.signal.aborted) {
          setState({ data: result, loading: false, error: null });
        }
      })
      .catch((e: unknown) => {
        const error = e as Error;
        if (error?.name === 'AbortError') return; // 主动取消：不是错误
        if (rid === requestIdRef.current) setState({ data: null, loading: false, error });
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadTick, enabled]);

  const reload = useCallback(() => setReloadTick((t) => t + 1), []);
  return { ...state, reload };
}
