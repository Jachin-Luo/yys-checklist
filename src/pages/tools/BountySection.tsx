import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import type { BountyDb } from '../../api/types';
import { bountyUnion, buildBountyEntries, fullCoverage, pinMatches } from '../../domain/bounty';

/**
 * 悬赏封印查询（S6）。
 *
 * 两条并存的取用路径：
 *   1. **全量直选**：完整名单（39 个式神）**始终在**，点击即勾选 —— 大部分悬赏本来就显示式神名，
 *      用户往往是"我手上正好有这几个"，从列表里点比先想关键词再搜更快
 *   2. **搜索反查**：只有「神秘妖怪」才需要按特征词反查 —— 空格分词取交集（游戏一次给两个线索）
 *
 * **搜索不过滤名单，只做置顶 + 高亮**（2026-09-10 按用户反馈改）。
 * 原实现把不匹配的 38 个滤掉，后果是"想边搜边顺手挑别的"做不到 ——
 * 名单是常驻的可用集合，不该被一个辅助查询动作收走。因此：
 *   - 匹配项 → **前置**（`pinMatches`）并染品牌色
 *   - 其余项 → 保持在原位，仅**弱化**（opacity），仍可点击勾选
 *   - 搜索时若一个都没匹配上，在名单上方给一行提示，而不是把名单换成空态
 *
 * **名单渲染成标签云**（2026-09-10 再按用户要求压缩）：39 个名字换行铺满，
 * 不再套「带边框的滚动容器」——
 *   - 名字本来就是 2–3 字，做成整行列表等于每行浪费 80% 宽度；
 *   - 嵌套滚动区在手机上很难操作（外层页面也会跟着滚），标签云全量铺开后不需要滚；
 *   - 线索与出处收进 `title`（悬停/长按可见），不占任何行高。
 *
 * 并集区解决的是另一个高频问题：一次接了好几个悬赏，想知道"哪个副本能一把刷完"——
 * 能全收的出处置顶并高亮，一眼可判。
 */
export default function BountySection({ bounty }: { bounty: BountyDb }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  const entries = useMemo(() => buildBountyEntries(bounty), [bounty]);
  const searching = query.trim().length > 0;

  /** 搜索只重排 + 标记，**不删行**（规则在 domain/bounty.pinMatches，有单测） */
  const rows = useMemo(() => pinMatches(entries, query), [entries, query]);

  const hitCount = searching ? rows.filter((r) => r.hit).length : 0;

  const union = useMemo(() => bountyUnion(entries, selected), [entries, selected]);
  const fulls = fullCoverage(union);

  const nameOf = (id: string) => entries.find((e) => e.id === id)?.name ?? id;
  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div className="pb-6">
      {/* ── 搜索（辅助手段，不是必经路径） ── */}
      <div className="mx-3.5 mt-3 flex items-center gap-2 rounded-md border border-line bg-surface px-2.5 py-2">
        <Search size={13} strokeWidth={2.2} className="flex-none text-ink-4" />
        {/* 去掉 `outline-none`：此前它把默认焦点环也去掉了，而这里又没有 `focus:` 类 ——
            键盘聚焦后完全没有视觉变化。现在焦点环由 `styles/base.css` 的全局 `:focus-visible` 提供 */}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜式神名或特征：大天狗 / 羽毛 扇"
          aria-label="搜索式神或特征"
          className="min-w-0 flex-1 bg-transparent text-lg text-ink placeholder:text-ink-4"
        />
        {query ? (
          <button
            type="button"
            aria-label="清空搜索"
            onClick={() => setQuery('')}
            className="flex-none cursor-pointer text-ink-4 transition-colors duration-120 hover:text-ink-2"
          >
            <X size={13} strokeWidth={2.2} />
          </button>
        ) : null}
        <span className="flex-none text-sm text-ink-3">
          {searching ? `匹配 ${hitCount} / ${entries.length}` : `${entries.length} 个式神`}
        </span>
      </div>

      <p className="mx-3 mt-1.5 text-sm text-ink-3">
        可直接勾选，不必先搜索；搜索只把匹配项<b className="text-ink-2">置顶并标出</b>。
      </p>

      <section className="mt-2">
        {searching && hitCount === 0 ? (
          <p className="mx-3 mb-1 rounded-sm bg-warn-soft px-2 py-1.5 text-sm leading-relaxed text-warn">
            没有匹配「{query.trim()}」的式神 —— 名单仍在下面，可以直接挑。
          </p>
        ) : null}

        {/* 标签云：名字换行铺开，不套滚动容器（详见文件头注释） */}
        <div className="mx-3 flex flex-wrap gap-1.5">
          {rows.map((e) => {
            const on = selected.includes(e.id);
            /* 线索与出处放 title：不占任何行高，但信息不丢（悬停 / 长按可见） */
            const detail = [
              e.clues.length ? `线索：${e.clues.join(' / ')}` : '',
              `${e.spots.length} 处 · ${e.spots.map((s) => s.name).join('、')}`,
            ]
              .filter(Boolean)
              .join('\n');
            /* 三态：已勾选（实心）> 搜索命中（品牌描边）> 其余（描边；搜索时弱化） */
            const tone = on
              ? 'border-brand bg-brand text-white'
              : e.hit
                ? 'border-brand bg-brand-soft font-medium text-brand'
                : searching
                  ? 'border-line bg-surface text-ink-3 opacity-55 hover:opacity-100'
                  : 'border-line bg-surface text-ink-2 hover:border-ink-4';
            return (
              <button
                key={e.id}
                type="button"
                title={detail}
                aria-pressed={on}
                aria-label={`${on ? '取消勾选' : '勾选'}：${e.name}`}
                onClick={() => toggle(e.id)}
                className={`cursor-pointer rounded-xl border px-2 py-0.5 text-sm transition-colors duration-120 ${tone}`}
              >
                {e.name}
              </button>
            );
          })}
        </div>
      </section>

      {/* ── 已选 + 并集推荐 ── */}
      {selected.length ? (
        <section className="mt-3">
          <div className="flex items-baseline justify-between px-3.5 pb-1">
            <span className="text-sm text-ink-3">
              已选 {selected.length} 个 · 共同出处 {union.length} 处
            </span>
            <button
              type="button"
              onClick={() => setSelected([])}
              className="cursor-pointer text-sm text-ink-3 transition-colors duration-120 hover:text-danger"
            >
              清空选择
            </button>
          </div>

          <div className="mx-3 flex flex-wrap gap-1">
            {selected.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => toggle(id)}
                className="cursor-pointer rounded-xl bg-brand-soft px-2 py-0.5 text-sm text-brand transition-colors duration-120 hover:bg-brand hover:text-white"
              >
                {nameOf(id)} ×
              </button>
            ))}
          </div>

          {fulls.length ? (
            <div className="mx-3 mt-2 rounded-md bg-success/10 px-3 py-2 text-sm leading-relaxed text-success-deep">
              <b>有戏：</b>
              {fulls.map((f) => f.name).join('、')} 能一次刷完全部 {selected.length} 个悬赏。
            </div>
          ) : selected.length > 1 ? (
            <div className="mx-3 mt-2 rounded-md bg-warn-soft px-3 py-2 text-sm leading-relaxed text-warn">
              <b>没有一本全收：</b>这几个式神没有共同出处，只能分开刷。优先刷覆盖最多的那个。
            </div>
          ) : null}

          <div className="mx-3 mt-2 overflow-hidden rounded-md border border-line-soft bg-surface">
            {union.map((r) => {
              const hot = r.full && r.hits.length > 1;
              return (
                <div
                  key={r.spotId}
                  className={`flex items-start gap-2 border-b border-line-faint px-3 py-2 last:border-0 ${hot ? 'bg-success/10' : ''}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className={`block text-lg ${hot ? 'font-medium text-success-deep' : 'text-ink'}`}>{r.name}</span>
                    <span className="mt-0.5 block truncate text-sm text-ink-3">
                      {r.kind}
                      {r.hits.length ? ` · ${r.hits.map((h) => `${h.name}×${h.count}`).join('、')}` : ''}
                    </span>
                  </span>
                  <span className={`flex-none text-sm ${hot ? 'text-success-deep' : 'text-ink-3'}`}>
                    {r.full ? '全收' : `${r.hits.length}/${selected.length}`}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
