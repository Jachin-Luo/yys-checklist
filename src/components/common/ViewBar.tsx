import { useState } from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { TOP_GAIN_KIND, type GainKind } from '../../domain/enums';
import { dictIndexOf, useItemStore } from '../../stores/items';
import { useViewStore } from '../../stores/view';

/** 痛感门槛选项（K1：默认 0 = 不过滤，避免冷启动整页空白） */
const MIN_WEIGHT_OPTIONS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 0, label: '全部' },
  { value: 20, label: '≥20' },
  { value: 30, label: '≥30' },
];

const chip = (on: boolean) =>
  `cursor-pointer rounded-sm border px-2 py-1 text-sm transition-colors duration-120 ${
    on ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-surface text-ink-2 hover:border-ink-4'
  }`;

/**
 * 视图条（PC + 手机共用，仅排列方式不同 —— §8.3）。
 *
 * 已按产品决策**移除两个控件**：
 *   - 排序：不再让用户选 —— 默认痛感分，拖拽自定义顺序后直接接管（`domain/sort.effectiveSortBy`）；
 *   - 隐藏已完成：暂时不需要，已完成分区照常展示（字段与 `isVisible` 逻辑保留，随时可恢复）。
 *
 * 保留：按奖励类型筛选（高频 6 类 chip + 可展开面板）、痛感门槛。
 */
export default function ViewBar({ mode }: { mode: 'mobile' | 'desktop' }) {
  const view = useViewStore((s) => s.view);
  const setShowKinds = useViewStore((s) => s.setShowKinds);
  const setMinWeight = useViewStore((s) => s.setMinWeight);
  const meta = useItemStore((s) => s.meta);
  const [panelOpen, setPanelOpen] = useState(false);

  const kindLabels = dictIndexOf(meta, 'gainKind');
  const topKinds = TOP_GAIN_KIND as readonly GainKind[];
  const restKinds = [...kindLabels.keys()].filter(
    (k) => !topKinds.includes(k as GainKind),
  ) as GainKind[];

  const toggleKind = (k: GainKind) => {
    const has = view.showKinds.includes(k);
    void setShowKinds(has ? view.showKinds.filter((x) => x !== k) : [...view.showKinds, k]);
  };

  return (
    <div className="border-b border-line-soft bg-surface px-3.5 py-2">
      <div className="flex flex-wrap items-center gap-2">
        {mode === 'desktop' ? (
          <>
            <span className="text-sm text-ink-3">奖励类型</span>
            {topKinds.map((k) => (
              <button
                key={k}
                type="button"
                className={chip(view.showKinds.includes(k))}
                onClick={() => toggleKind(k)}
              >
                {kindLabels.get(k)?.label ?? k}
              </button>
            ))}
          </>
        ) : null}

        <button
          type="button"
          onClick={() => setPanelOpen((v) => !v)}
          className="flex cursor-pointer items-center gap-1 rounded-sm border border-line bg-surface px-2 py-1 text-sm text-ink-2 transition-colors duration-120 hover:border-ink-4"
        >
          {mode === 'mobile' ? <SlidersHorizontal size={12} /> : null}
          筛选
          <ChevronDown
            size={12}
            className={panelOpen ? 'rotate-180 transition-transform duration-120' : 'transition-transform duration-120'}
          />
        </button>

        {mode === 'desktop' && view.pinned.length ? (
          <span className="text-sm text-ink-3">已置顶 {view.pinned.length} 条</span>
        ) : null}
      </div>

      {panelOpen ? (
        <div className="mt-2 animate-fade-in rounded-md border border-line-soft bg-surface-3 px-3 py-2">
          <p className="text-sm text-ink-3">奖励类型（数量浮动，不折算）</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {[...topKinds, ...restKinds].map((k) => (
              <button
                key={k}
                type="button"
                className={chip(view.showKinds.includes(k))}
                onClick={() => toggleKind(k)}
              >
                {kindLabels.get(k)?.label ?? k}
              </button>
            ))}
          </div>
          <p className="mt-2.5 text-sm text-ink-3">痛感门槛（低于此值不显示）</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {MIN_WEIGHT_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                className={chip(view.minWeight === o.value)}
                onClick={() => void setMinWeight(o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
