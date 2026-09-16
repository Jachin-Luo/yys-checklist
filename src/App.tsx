import { useEffect } from 'react';
import ConfirmDialog from './components/common/ConfirmDialog';
import OnboardingDialog from './components/common/OnboardingDialog';
import ProfilePickDialog from './components/common/ProfilePickDialog';
import SaveErrorNotice from './components/common/SaveErrorNotice';
import DesktopShell from './components/desktop/DesktopShell';
import MobileShell from './components/mobile/MobileShell';
import { useBootstrap } from './hooks/useBootstrap';
import { useBreakpoint } from './hooks/useBreakpoint';
import { usePeriodRefresh } from './hooks/usePeriodRefresh';
import { useDeviceStore } from './stores/device';
import { useUiStore } from './stores/ui';

/** 首屏错误边界：把契约层抛出的错误显式呈现，而不是白屏 */
function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center bg-surface-2 px-6">
      <div className="max-w-md rounded-lg border border-danger-line bg-surface px-5 py-4">
        <h1 className="text-xl font-medium text-danger">数据加载失败</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">{message}</p>
        <p className="mt-2 text-sm text-ink-3">
          若地址带 <code className="rounded-sm bg-surface-3 px-1">?__fail=1</code> 即 mock 错误注入，去掉即可。
        </p>
      </div>
    </div>
  );
}

/**
 * 双套结构（设计文档 §8.3）：`useBreakpoint` 是唯一分流判据，
 * 只切渲染树，不重置数据（数据在 store 中，天然保留）。
 *
 * 设备级偏好（寮时间 / 引导标记）在挂载时从本机读一次；冷启动引导在
 * 「数据就绪 + 标记缺失」时才出现（`OnboardingDialog` 内部判定）。
 * 二次确认弹窗挂在顶层，调用方只需 `await askConfirm(...)`。
 *
 * 2026-09-11：原先这里还挂了 `useReminderEngine()`（提醒引擎，挂顶层以便应用一开着就工作），
 * 随 S7 提醒能力一并移除。
 */
export default function App() {
  useBootstrap();
  usePeriodRefresh();
  const hydrate = useDeviceStore((s) => s.hydrate);
  const breakpoint = useBreakpoint();
  const error = useUiStore((s) => s.bootstrapError);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (error) return <ErrorScreen message={error.message} />;

  return (
    <>
      {breakpoint === 'mobile' ? <MobileShell /> : <DesktopShell />}
      <SaveErrorNotice />
      <OnboardingDialog />
      <ConfirmDialog />
      {/* 跨档案勾选的选择器（清单长按触发）：与确认框同一位置，
          调用点只 `await askPick({...})`，不必各自维护弹层状态 */}
      <ProfilePickDialog />
    </>
  );
}
