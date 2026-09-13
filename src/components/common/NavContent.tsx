import LimitedPage from '../../pages/LimitedPage';
import MePage from '../../pages/MePage';
import StatsPage from '../../pages/StatsPage';
import TodayPage from '../../pages/TodayPage';
import ToolsPage from '../../pages/ToolsPage';
import WeekPage from '../../pages/WeekPage';
import { Skeleton } from './EmptyState';
import { useUiStore } from '../../stores/ui';

/**
 * 「当前页面」的唯一分派点 —— 手机与 PC 共用（两端只差 `variant` 的排列方式）。
 * 首屏加载中显示骨架屏（§3.3：骨架屏只用于首屏与懒加载，不用于掩盖多次异步往返）。
 */
export default function NavContent({ variant }: { variant: 'mobile' | 'desktop' }) {
  const nav = useUiStore((s) => s.nav);
  const loading = useUiStore((s) => s.bootstrapLoading);

  if (loading && nav !== 'me' && nav !== 'tools') {
    return (
      /* 骨架屏容器不再居中、也不再自己加内缩 —— Skeleton 内部就用 CHECKLIST_GRID，
         这样"骨架 → 内容"只换填充、不换几何，首屏没有形状跳动 */
      <div className="max-w-4xl">
        <Skeleton rows={5} />
      </div>
    );
  }

  switch (nav) {
    case 'today':
      return <TodayPage variant={variant} />;
    case 'week':
      return <WeekPage variant={variant} />;
    case 'limited':
      return <LimitedPage variant={variant} />;
    case 'stats':
      return <StatsPage />;
    case 'tools':
      return <ToolsPage variant={variant} />;
    case 'me':
    default:
      return <MePage />;
  }
}
