import { useEffect, useState } from 'react';

/**
 * 双套结构的唯一分流判据（设计文档 §8.3）。
 *
 * 约定：
 *   - 只有本 hook 读屏幕宽度，其余任何地方禁止直接读 `window.innerWidth` ——
 *     否则断点值会分裂成多个魔数；
 *   - 挂载前用 `matchMedia` 同步取初值，避免"先渲染桌面再跳手机"的闪烁；
 *   - 首帧结果缓存在模块级变量，同一次会话内多处调用不重复求值。
 *
 * 断点 768px，与 Tailwind 的 `md` 对齐。
 */
export type Breakpoint = 'mobile' | 'desktop';

const QUERY = '(min-width: 768px)';

function readBreakpoint(): Breakpoint {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'desktop';
  }
  return window.matchMedia(QUERY).matches ? 'desktop' : 'mobile';
}

let firstFrame: Breakpoint | null = null;

export function useBreakpoint(): Breakpoint {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>(() => {
    if (firstFrame === null) firstFrame = readBreakpoint();
    return firstFrame;
  });

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const onChange = () => {
      const next: Breakpoint = mql.matches ? 'desktop' : 'mobile';
      firstFrame = next;
      setBreakpoint(next);
    };
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return breakpoint;
}
