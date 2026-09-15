import { useEffect } from 'react';
import { RotateCcw } from 'lucide-react';
import CheckBox from '../../components/common/CheckBox';
import CollapsibleSection from '../../components/common/CollapsibleSection';
import { dataDefaultAutoSet, isAutoDailyCandidate } from '../../domain/autoDaily';
import { useAutoDaily } from '../../hooks/useAutoDaily';
import { useItemStore } from '../../stores/items';
import { useUiStore } from '../../stores/ui';

/**
 * 「我的 · 一键日常」分区。
 *
 * 解决的是原型遗留缺口：`autoSet` 在原型里是刷新即丢的内存变量，
 * 而设计文档 §4.6 的 viewPrefs 字段清单里没有承载它的字段（原型 `toggle()` 也无法勾选入口）。
 * 这里把它落成按档案分片的 `ViewPrefs.autoSet`，并明确两条语义：
 *   1. 覆盖集合是**配置**，勾选状态是**状态** —— 单独取消某条被覆盖项的勾选，不会把它移出覆盖集合；
 *   2. 显示方式（弱化 / 隐藏）**只影响列表**，不影响统计与漏失口径；
 *   3. 候选只含**官方一键日常会覆盖的条目**（数据里标了 `autoDaily` 的常驻每日）——
 *      斗技、逢魔之时、地域鬼王、寮活动等官方不代做的任务不在可选范围，也不会被入口级联勾选
 *      （2026-09-14 修正：此前候选放宽到全部常驻每日，勾了会让级联把它们标成已完成）。
 *
 * 卡内分割（两部分底色不同，一眼分清改的是"怎么显示"还是"覆盖哪些"）：
 *   上半 = 显示方式（配置），下半 = 覆盖集合（清单）。
 */
export default function AutoDailySection() {
  const items = useItemStore((s) => s.items);
  const { coveredSet, coveredCount, coverMode, setCovered, setCoverMode, resetAutoSet } =
    useAutoDaily();

  const candidates = items.filter(isAutoDailyCandidate);
  const dataDefaultCount = dataDefaultAutoSet(items).length;

  /* 今日页入口卡的「去设置」跳过来时自动展开自己 —— 标记是一次性的，消费后立即清空 */
  const requested = useUiStore((s) => s.navRequest?.section === 'autoDaily');
  const clearNavRequest = useUiStore((s) => s.clearNavRequest);
  useEffect(() => {
    if (!requested) return;
    clearNavRequest();
    /* 等展开后的布局生效再滚，否则会按收起时的高度算位置、滚不到实处 */
    requestAnimationFrame(() => {
      document.getElementById('auto-daily-section')?.scrollIntoView({
        block: 'start',
        behavior: 'smooth',
      });
    });
  }, [requested, clearNavRequest]);

  return (
    <CollapsibleSection
      id="auto-daily-section"
      defaultOpen={requested}
      title="一键日常覆盖"
      summary={`已覆盖 ${coveredCount} 项 · 数据默认 ${dataDefaultCount} 项`}
      aside={
        <button
          type="button"
          onClick={() => void resetAutoSet()}
          className="flex cursor-pointer items-center gap-1 rounded-sm border border-line px-2 py-1 text-sm text-ink-2 transition-colors duration-120 hover:border-ink-4"
        >
          <RotateCcw size={12} strokeWidth={2} />
          恢复数据默认
        </button>
      }
    >
      {/* ── 显示方式（配置） ── */}
      <div className="bg-surface-3 px-3 py-3">
        <p className="text-sm text-ink-3">被覆盖项的显示方式（只影响列表，不影响统计口径）</p>
        <div className="mt-2 flex gap-1.5">
          {([['dim', '弱化保留'], ['hide', '从列表隐藏']] as const).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => void setCoverMode(mode)}
              className={`cursor-pointer rounded-sm border px-2.5 py-1 text-sm transition-colors duration-120 ${
                coverMode === mode
                  ? 'border-brand bg-brand-soft text-brand'
                  : 'border-line bg-surface text-ink-2 hover:border-ink-4'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── 覆盖集合（清单） ── */}
      <div className="px-3 py-3">
        <p className="text-sm text-ink-3">
          覆盖集合 · 只列出官方一键日常会覆盖的 {candidates.length} 条，勾选入口时会一并勾选它们
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-3">
          取消某一条的勾选不会把它移出覆盖集合 —— 覆盖集合是配置，勾选是状态。
          其它每日任务（斗技、逢魔之时、地域鬼王、寮活动等）官方不会代做，因此不在可选范围内，
          也不会被入口级联勾选。
        </p>

        <div className="mt-2.5 grid grid-cols-1 gap-0.5 md:grid-cols-2">
          {candidates.map((it) => {
            const covered = coveredSet.has(it.id);
            return (
              <div
                key={it.id}
                className="flex items-center gap-2 rounded-sm px-1 py-1.5 transition-colors duration-120 hover:bg-surface-3"
              >
                <CheckBox
                  checked={covered}
                  size="sm"
                  onToggle={() => setCovered(it.id, !covered)}
                  label={`${covered ? '取消覆盖' : '设为覆盖'}：${it.name}`}
                />
                <button
                  type="button"
                  onClick={() => setCovered(it.id, !covered)}
                  title={it.name}
                  className="min-w-0 flex-1 cursor-pointer truncate text-left text-lg text-ink"
                >
                  {it.name}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </CollapsibleSection>
  );
}
