import {
  BarChart3,
  CalendarClock,
  CheckSquare,
  Hammer,
  Settings,
  Sparkles,
} from 'lucide-react';
import NavContent from '../common/NavContent';
import ProfileSwitcher from '../common/ProfileSwitcher';
import { NAV_ITEMS, useUiStore, type NavKey } from '../../stores/ui';

const ICONS: Record<NavKey, typeof CheckSquare> = {
  today: CheckSquare,
  week: CalendarClock,
  limited: Sparkles,
  stats: BarChart3,
  tools: Hammer,
  me: Settings,
};

/**
 * PC 端布局骨架（设计文档 §8.3）：左侧固定导航 + 右侧多列栅格。
 * 与手机端共享数据层、状态层、domain 与 common 原子件，只改排列方式。
 */
export default function DesktopShell() {
  const nav = useUiStore((s) => s.nav);
  const setNav = useUiStore((s) => s.setNav);

  return (
    <div className="flex h-full bg-surface-2">
      <aside className="flex w-56 flex-none flex-col border-r border-line-soft bg-surface px-3 py-4">
        <div className="px-2">
          <h1 className="text-xl font-medium text-ink">阴阳师查漏清单</h1>
          <p className="mt-1 text-sm text-ink-3">纯手动记录 · 不读取游戏数据</p>
        </div>

        <nav className="mt-5 flex flex-col gap-1">
          {NAV_ITEMS.map(({ key, label }) => {
            const Icon = ICONS[key];
            const active = nav === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setNav(key)}
                aria-current={active ? 'page' : undefined}
                className={`flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-lg transition-colors duration-120 ${
                  active
                    ? 'bg-brand-soft font-medium text-brand'
                    : 'text-ink-2 hover:bg-surface-3'
                }`}
              >
                <Icon size={16} strokeWidth={2} />
                {label}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto rounded-md border border-line-soft bg-surface-3 px-2.5 py-2">
          <p className="text-sm text-ink-3">当前档案</p>
          <div className="mt-1">
            <ProfileSwitcher direction="up" />
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl">
          <NavContent variant="desktop" />
        </div>
      </main>
    </div>
  );
}
