import { useState } from 'react';
import Icon from '../icons/Icon';
import { TOP_GAIN_KIND, type GainKind } from '../../domain/enums';
import { dictIndexOf, useItemStore } from '../../stores/items';
import { SHOW_KIND_FILTER, useViewStore } from '../../stores/view';

/**
 * 视图条（PC + 手机共用，仅排列方式不同 —— §8.3）。
 *
 * ## ⚠️ 2026-09-23 起整体下线（当前无可见输出）
 *
 * 用户决策「筛选这个功能暂时隐藏」，于是 `stores/view.SHOW_KIND_FILTER` 置为 `false`，
 * 本组件在 hooks 之后直接 `return null` —— 四个清单页仍在渲染它，但什么都不会出现。
 *
 * 为什么不是"把页面里的调用删掉"：那样恢复时要改 4 个页面 × 2 处，还容易漏一个；
 * 而且**关掉生效链路是必须的**（见那个开关的说明）—— 只隐藏控件却继续过滤，
 * 会把"清单莫名少几条"变成一个查不到原因、也清不掉的死角。
 * 恢复：把 `SHOW_KIND_FILTER` 改回 `true`，下面的两端形态立即生效。
 *
 * 已按产品决策**移除三个控件**：
 *   - 排序：不再让用户选 —— 默认痛感分，拖拽自定义顺序后直接接管；
 *   - 隐藏已完成（2026-09-24 整体删除）：已完成分区照常展示 ——「沉下去但仍在」
 *     （`card-done` + 划朱线）才是本项目对已完成的表达，不做"勾了就消失"。
 *     它当时已没有 UI、却仍在 `domain/sort.isVisible` 里生效，是隐患而非功能；
 *   - 痛感门槛（2026-09-15）：痛感收敛为「只作默认排序键」，不再是筛选维度。
 *
 * 只保留：按奖励类型筛选。
 *
 * ## 2026-09-23：两端排列方式分开
 *
 * 上一版两端都是"一整行 + 一条分隔线"，但移动端那一行里**只有一颗"筛选"按钮**
 * （高频 chip 在窄屏被隐藏了）—— 首屏白白少掉一行高度。现在：
 *
 * | 端 | 形态 | 理由 |
 * |---|---|---|
 * | PC | 整行：高频 6 类 chip 直接可见 + 可展开面板 | 宽度足够，chip 本身是高频操作 |
 * | 移动端 | **只有一颗入口按钮**，由页面塞进 `PageHead.action` | 窄屏放不下 chip，入口收进页头 |
 *
 * 移动端入口带**生效计数**（`筛选 · 2`）并在选中时变金：chip 被隐藏后，
 * 否则用户完全看不出"当前有筛选在生效" —— 这是列表"莫名少了几条"的经典成因。
 */
const chip = (on: boolean) =>
  `cursor-pointer rounded-sm border px-2 py-1 text-sm transition-colors duration-120 ${
    on
      ? 'border-line bg-gold-soft text-gold-hi'
      : 'border-line-soft bg-surface text-ink-2 hover:border-line'
  }`;

export default function ViewBar({ mode }: { mode: 'mobile' | 'desktop' }) {
  const view = useViewStore((s) => s.view);
  const setShowKinds = useViewStore((s) => s.setShowKinds);
  const meta = useItemStore((s) => s.meta);
  const [panelOpen, setPanelOpen] = useState(false);

  /* 总开关关闭 → 整条视图条不出内容。放在 hooks **之后**：一旦放到前面，
     eslint 的 rules-of-hooks 会判定"hook 被条件调用"。条件本身是模块级常量、
     不会在渲染间变化，所以放在这里与放在前面在运行时完全等价，只是过不了 lint。 */
  if (!SHOW_KIND_FILTER) return null;

  const kindLabels = dictIndexOf(meta, 'gainKind');
  const topKinds = TOP_GAIN_KIND as readonly GainKind[];
  const restKinds = [...kindLabels.keys()].filter(
    (k) => !topKinds.includes(k as GainKind),
  ) as GainKind[];
  const active = view.showKinds.length;

  const toggleKind = (k: GainKind) => {
    const has = view.showKinds.includes(k);
    void setShowKinds(has ? view.showKinds.filter((x) => x !== k) : [...view.showKinds, k]);
  };

  /* 展开面板两端共用一份；移动端把它做成 popover，不再往下推内容 */
  const panel = (
    <div className="rounded-sm border border-line-soft bg-surface-3 px-3 py-2 shadow-card">
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
      {active ? (
        <button
          type="button"
          onClick={() => void setShowKinds([])}
          className="mt-2 cursor-pointer text-sm text-gold-hi underline"
        >
          清空筛选（当前 {active} 类）
        </button>
      ) : null}
    </div>
  );

  const chevron = (
    <Icon
      name="chevron-down"
      size={12}
      className={`transition-transform duration-120 ${panelOpen ? 'rotate-180' : ''}`}
    />
  );

  /* ── 移动端：不占整行，只留一颗入口，由页面放进 `PageHead.action` ── */
  if (mode === 'mobile') {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setPanelOpen((v) => !v)}
          aria-expanded={panelOpen}
          className={`flex cursor-pointer items-center gap-1 rounded-sm border px-2 py-1 text-sm transition-colors duration-120 ${
            active
              ? 'border-line bg-gold-soft text-gold-hi'
              : 'border-line-soft bg-surface text-ink-2 hover:border-line'
          }`}
        >
          <Icon name="filter" size={12} />
          筛选{active ? ` · ${active}` : ''}
          {chevron}
        </button>
        {panelOpen ? (
          <div className="absolute right-0 top-full z-40 mt-1.5 w-[17rem] max-w-[78vw] animate-reveal">
            {panel}
          </div>
        ) : null}
      </div>
    );
  }

  /* ── PC：整行 ── */
  return (
    <div className="border-b border-line-soft bg-surface-2 px-3.5 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-serif text-sm tracking-wide text-ink-3">奖励类型</span>
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

        <button
          type="button"
          onClick={() => setPanelOpen((v) => !v)}
          aria-expanded={panelOpen}
          className="flex cursor-pointer items-center gap-1 rounded-sm border border-line-soft bg-surface px-2 py-1 text-sm text-ink-2 transition-colors duration-120 hover:border-line"
        >
          全部类型
          {chevron}
        </button>

        {view.pinned.length ? (
          <span className="text-sm text-ink-3">已置顶 {view.pinned.length} 条</span>
        ) : null}
      </div>

      {/* 入场动效只做位移（`animate-reveal`）—— 旧版的 `fade-in` 把 opacity 写进关键帧，
          动画一旦被冻结（截图 / 减少动效 / 扩展拦截）这块会永久不可见 */}
      {panelOpen ? <div className="mt-2 animate-reveal">{panel}</div> : null}
    </div>
  );
}
