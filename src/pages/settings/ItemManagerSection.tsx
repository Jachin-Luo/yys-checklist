import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, ChevronUp, GripVertical, Plus, RotateCcw, Trash2, Undo2 } from 'lucide-react';
import type { Item } from '../../api/types';
import type { Cycle, GainKind } from '../../domain/enums';
import { CYCLE, GAIN_KIND } from '../../domain/enums';
import { buildComparator, effectiveSortBy, moveBefore, moveWithinGroup, seedOrder } from '../../domain/sort';
import CollapsibleSection from '../../components/common/CollapsibleSection';
import { dictIndexOf, useItemStore } from '../../stores/items';
import { useUiStore } from '../../stores/ui';
import { useViewStore } from '../../stores/view';

/** 可录入的周期（日常 / 周常 / 每月 / 版本 / 限时 / 一次性） */
const CYCLE_OPTIONS = CYCLE.filter((c) => c !== 'season');
const DEADLINE_RE = /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2})?$/;

/* 去掉 `outline-none`，焦点环交给 `styles/base.css` 的全局 `:focus-visible`
   （这个 app 里有 `<select>` 复用同一份类，可见焦点提示此前最弱） */
const inputCls =
  'w-full rounded-sm border border-line bg-surface px-2 py-1.5 text-lg text-ink transition-colors duration-120 focus:border-brand disabled:opacity-50';

const btnCls =
  'cursor-pointer rounded-sm border border-line px-2 py-1 text-sm text-ink-2 transition-colors duration-120 hover:border-ink-4 disabled:cursor-not-allowed disabled:opacity-50';

/**
 * 「我的 · 条目管理」（F20 条目自定义）。
 *
 * 这里同时也是**自定义排序的唯一入口**：排序控件已按产品决策取消，
 * 一旦用户在此调整顺序，`order` 非空 → `effectiveSortBy` 判定为 custom → 直接接管默认痛感排序。
 *
 * **列表按周期分组展示、调序也限制在组内**（本轮按用户要求改）：
 * 分组依据就是条目自身的 `cycle`（组间顺序取 `dicts.cycle` 的 sort —— 每日 → 每周 → … → 一次性），
 * 这样"在排序界面里看到的分类"和"条目自己的分类"永远一致。
 * 分组**按需展开**（2026-09-14 用户要求）：点周期名才展开该组、同一时刻最多一个组展开；
 * 有搜索词时强制展开全部命中分组，否则搜到的东西会被藏在收起的分组里。
 * 下方「已隐藏的预设条目」用同一套分组口径（周期 → 字典顺序），展开状态与上方独立。
 * 跨组调序被禁用而非静默无效：列表已按周期切开，跨组移动在界面上看不出任何变化，
 * 让按钮"点了没反应"比禁用更让人困惑（`domain/sort.moveWithinGroup` 的注释有详细说明）。
 *
 * 卡内分割约定（与「我的」页其它分区一致）：
 *   **配置 / 新增 / 操作** 类子块用 `bg-surface-3` 底，**展示 / 列表** 保持白底，两者之间加 `border-t`。
 */
export default function ItemManagerSection() {
  const items = useItemStore((s) => s.items);
  const presetItems = useItemStore((s) => s.presetItems);
  const overrides = useItemStore((s) => s.overrides);
  const meta = useItemStore((s) => s.meta);
  const loadPreset = useItemStore((s) => s.loadPreset);
  const addItem = useItemStore((s) => s.addItem);
  const hideItem = useItemStore((s) => s.hideItem);
  const restoreItem = useItemStore((s) => s.restoreItem);
  const removeItem = useItemStore((s) => s.removeItem);
  const saveOrder = useItemStore((s) => s.saveOrder);
  const resetLibrary = useItemStore((s) => s.resetLibrary);
  const pinned = useViewStore((s) => s.view.pinned);
  const askConfirm = useUiStore((s) => s.askConfirm);

  const [query, setQuery] = useState('');
  /** 当前展开的周期分组（`null` = 全部收起）；同一时刻最多展开一个组 */
  const [openGroup, setOpenGroup] = useState<Cycle | null>(null);
  /** 「已隐藏」区的展开分组：与上方列表独立维护，展开一侧不会带着另一侧一起动 */
  const [openHiddenGroup, setOpenHiddenGroup] = useState<Cycle | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [name, setName] = useState('');
  const [cycle, setCycle] = useState<Cycle>('daily');
  const [kinds, setKinds] = useState<GainKind[]>([]);
  const [deadline, setDeadline] = useState('');

  useEffect(() => {
    void loadPreset();
  }, [loadPreset]);

  const order = overrides?.order ?? [];
  const orderKey = order.join(',');
  const seed = useMemo(() => seedOrder(items, pinned), [items, pinned]);
  const kindLabels = dictIndexOf(meta, 'gainKind');
  const cycleLabels = dictIndexOf(meta, 'cycle');

  /** 当前生效顺序（全量），搜索框只做过滤，不改顺序 */
  const ordered = useMemo(() => {
    /* 用 orderKey 还原一份数组，避免把 `order` 引用写进依赖（它每次渲染都是新数组） */
    const orderList = orderKey ? orderKey.split(',') : [];
    const list = [...items].sort(
      buildComparator({ sortBy: effectiveSortBy(orderList), pinned: [...pinned], order: orderList }),
    );
    const q = query.trim();
    return q ? list.filter((it) => it.name.includes(q)) : list;
  }, [items, orderKey, query, pinned]);

  /** 按周期分组：组间取字典 sort，组内保持当前生效顺序 */
  const groups = useMemo(() => {
    /* 字典索引在 memo 内部建：`dictIndexOf` 每次调用都返回新 Map，
       写进依赖会导致这个 memo 每渲染必重算（等于没有 memo） */
    const rankOf = dictIndexOf(meta, 'cycle');
    /* key 用 `Cycle` 而不是 `string`：`openGroup` 是按周期 key 存的联合类型，
       用 string 会在 `setOpenGroup(g.cycle)` 处丢失字面量类型 */
    const map = new Map<Cycle, Item[]>();
    for (const it of ordered) {
      const list = map.get(it.cycle);
      if (list) list.push(it);
      else map.set(it.cycle, [it]);
    }
    return [...map.entries()]
      .map(([key, list]) => ({ cycle: key, list }))
      .sort((a, b) => (rankOf.get(a.cycle)?.sort ?? 999) - (rankOf.get(b.cycle)?.sort ?? 999));
  }, [ordered, meta]);

  /* `filter(Boolean)` 不会缩窄类型，改用类型谓词去掉 `undefined` —— 否则下游到处要写 `it!`，
     非空断言一多就没人再核对它是否真的有值 */
  const hiddenItems = useMemo(
    () =>
      (overrides?.hidden ?? [])
        .map((id) => presetItems.find((it) => it.id === id))
        .filter((it): it is Item => Boolean(it)),
    [overrides, presetItems],
  );

  /** 已隐藏条目也按周期分组（与上方列表同一口径：组间取字典 sort，组内保持隐藏顺序） */
  const hiddenGroups = useMemo(() => {
    const rankOf = dictIndexOf(meta, 'cycle');
    const map = new Map<Cycle, Item[]>();
    for (const it of hiddenItems) {
      const list = map.get(it.cycle);
      if (list) list.push(it);
      else map.set(it.cycle, [it]);
    }
    return [...map.entries()]
      .map(([key, list]) => ({ cycle: key, list }))
      .sort((a, b) => (rankOf.get(a.cycle)?.sort ?? 999) - (rankOf.get(b.cycle)?.sort ?? 999));
  }, [hiddenItems, meta]);

  const hiddenCount = overrides?.hidden.length ?? 0;
  const customCount = overrides?.custom.length ?? 0;

  /* 有搜索词时强制展开全部命中分组：否则"搜到了、却在收起的分组里"等于搜不到 */
  const searching = query.trim().length > 0;

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setFormError('请填写条目名称');
      return;
    }
    if (trimmed.length < 2 || trimmed.length > 24) {
      setFormError('名称长度需在 2–24 字之间');
      return;
    }
    if (deadline && !DEADLINE_RE.test(deadline.trim())) {
      setFormError('截止日格式应为 YYYY-MM-DD 或 YYYY-MM-DD HH:mm');
      return;
    }
    setFormError('');
    setBusy(true);
    const created = await addItem({
      name: trimmed,
      cycle,
      gainKind: kinds,
      deadline: deadline.trim() || undefined,
    });
    setBusy(false);
    if (!created) {
      setFormError('保存失败，请检查网络或 mock 状态后重试');
      return;
    }
    setName('');
    setKinds([]);
    setDeadline('');
  };

  /** 组内 ▲▼：组边界不动作 */
  const moveInGroup = (group: Item[], id: string, dir: -1 | 1) => {
    void saveOrder(
      moveWithinGroup(
        order,
        group.map((x) => x.id),
        id,
        dir,
        seed,
      ),
    );
  };

  /** 拖放：只接受同组落点，跨组落点直接忽略（界面按周期切开，跨组移动看不见效果） */
  const dropOn = (target: Item) => {
    const from = dragId ? items.find((x) => x.id === dragId) : undefined;
    setDragId(null);
    if (!from || from.id === target.id || from.cycle !== target.cycle) return;
    void saveOrder(moveBefore(order, from.id, target.id, seed));
  };

  return (
    <CollapsibleSection
      title="条目管理"
      summary={`共 ${items.length} 条 · 自建 ${customCount} · 隐藏 ${hiddenCount}`}
      aside={
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            const ok = await askConfirm({
              title: '恢复默认条目库？',
              body: '将清空全部自建条目、已隐藏记录与自定义顺序。此操作不可撤销。',
              confirmLabel: '恢复默认',
              tone: 'danger',
            });
            if (ok) void resetLibrary();
          }}
          className={`flex items-center gap-1 ${btnCls}`}
        >
          <RotateCcw size={12} strokeWidth={2} />
          恢复默认
        </button>
      }
    >
      {/* ── 添加自建条目（新增区，浅底与下方列表区分） ── */}
      <div className="bg-surface-3 px-3 py-3">
        <p className="text-sm text-ink-3">添加自建条目</p>
        <div className="mt-2 flex flex-col gap-2 md:flex-row">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="条目名称（2–24 字，如：寮宴会提醒）"
            aria-label="条目名称"
            className={inputCls}
          />
          <select
            value={cycle}
            onChange={(e) => setCycle(e.target.value as Cycle)}
            aria-label="周期"
            className={`${inputCls} md:w-32`}
          >
            {CYCLE_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {cycleLabels.get(c)?.label ?? c}
              </option>
            ))}
          </select>
          <input
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            placeholder="截止日（可选）2026-10-06 23:59"
            aria-label="截止日"
            className={`${inputCls} md:w-56`}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            className="flex cursor-pointer items-center justify-center gap-1 rounded-sm bg-brand px-3 py-1.5 text-sm text-white transition-colors duration-120 hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={12} strokeWidth={2.4} />
            添加
          </button>
        </div>

        <p className="mt-2 text-sm text-ink-3">奖励类型（可多选，只标类型不填数值）</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {GAIN_KIND.map((k) => {
            const on = kinds.includes(k);
            return (
              <button
                key={k}
                type="button"
                onClick={() => setKinds(on ? kinds.filter((x) => x !== k) : [...kinds, k])}
                className={`cursor-pointer rounded-sm border px-2 py-1 text-sm transition-colors duration-120 ${
                  on ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-surface text-ink-2 hover:border-ink-4'
                }`}
              >
                {kindLabels.get(k)?.label ?? k}
              </button>
            );
          })}
        </div>
        {formError ? <p className="mt-2 text-sm text-danger">{formError}</p> : null}
      </div>

      {/* ── 搜索 + 排序说明 ── */}
      <div className="flex flex-wrap items-center gap-2 border-t border-line-faint px-3 py-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索条目名称"
          aria-label="搜索条目"
          className={`${inputCls} md:w-56`}
        />
        <span className="text-sm text-ink-3">
          按<b className="font-medium text-ink-2">周期分组</b>展示：点周期名展开该组，
          拖动或点 ▲▼ 只在组内调整 —— 顺序一旦调整，会直接接管默认的痛感排序
        </span>
      </div>

      {/* ── 分组列表（组 = 条目自身的周期分类） ── */}
      <div className="border-t border-line-faint px-3 py-2">
        {groups.length ? (
          groups.map((g) => {
            /* 分组按需展开（2026-09-14 用户要求）：常驻全展开会让 6 个组、90+ 条条目
               一次铺满好几屏，改某一条得先滚很久；现在点哪个周期才展开哪个 */
            const expanded = searching || openGroup === g.cycle;
            return (
              <div key={g.cycle} className="pb-2 last:pb-0">
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setOpenGroup(expanded ? null : g.cycle)}
                  className="flex w-full cursor-pointer items-baseline gap-2 rounded-sm px-1 pb-1 pt-2 text-left text-sm text-ink-3 transition-colors duration-120 hover:text-ink-2"
                >
                  <ChevronRight
                    size={13}
                    strokeWidth={2.4}
                    className={`flex-none self-center transition-transform duration-120 ${
                      expanded ? 'rotate-90' : ''
                    }`}
                  />
                  <b className="font-medium text-ink-2">{cycleLabels.get(g.cycle)?.label ?? g.cycle}</b>
                  <span>{g.list.length} 条</span>
                </button>

                {(expanded ? g.list : []).map((it, idx) => (
                  <div
                    key={it.id}
                    draggable
                    onDragStart={() => setDragId(it.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => dropOn(it)}
                    className="flex items-center gap-2 rounded-sm px-1 py-1.5 transition-colors duration-120 hover:bg-surface-3"
                  >
                    <GripVertical size={14} className="flex-none cursor-grab text-line" />
                    <div className="flex flex-none flex-col">
                      <button
                        type="button"
                        aria-label={`在「${cycleLabels.get(g.cycle)?.label ?? g.cycle}」内上移：${it.name}`}
                        title="在本周期内上移"
                        disabled={idx === 0}
                        onClick={() => moveInGroup(g.list, it.id, -1)}
                        className="cursor-pointer text-ink-4 transition-colors duration-120 hover:text-ink-2 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <ChevronUp size={13} strokeWidth={2.2} />
                      </button>
                      <button
                        type="button"
                        aria-label={`在「${cycleLabels.get(g.cycle)?.label ?? g.cycle}」内下移：${it.name}`}
                        title="在本周期内下移"
                        disabled={idx === g.list.length - 1}
                        onClick={() => moveInGroup(g.list, it.id, 1)}
                        className="cursor-pointer text-ink-4 transition-colors duration-120 hover:text-ink-2 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <ChevronDown size={13} strokeWidth={2.2} />
                      </button>
                    </div>
                    <span className="min-w-0 flex-1 truncate text-lg text-ink">{it.name}</span>
                    {it.origin === 'custom' ? (
                      <span className="flex-none rounded-sm bg-brand-soft px-1.5 py-0.5 text-xs text-brand">自建</span>
                    ) : null}
                    {it.origin === 'custom' ? (
                      <button
                        type="button"
                        title={`删除自建条目：${it.name}（不可恢复）`}
                        aria-label={`删除自建条目：${it.name}`}
                        onClick={async () => {
                          const ok = await askConfirm({
                            title: `删除自建条目「${it.name}」？`,
                            body: '自建条目是真删（预设条目才可以只隐藏），此操作不可恢复。',
                            confirmLabel: '永久删除',
                            tone: 'danger',
                          });
                          if (ok) void removeItem(it.id);
                        }}
                        className="flex-none cursor-pointer rounded-sm p-1 text-ink-4 transition-colors duration-120 hover:text-danger"
                      >
                        <Trash2 size={13} strokeWidth={2} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        title={`隐藏预设条目：${it.name}（可恢复）`}
                        aria-label={`隐藏预设条目：${it.name}`}
                        onClick={() => void hideItem(it.id)}
                        className="flex-none cursor-pointer rounded-sm border border-line px-2 py-0.5 text-sm text-ink-2 transition-colors duration-120 hover:border-ink-4"
                      >
                        隐藏
                      </button>
                    )}
                  </div>
                ))}
              </div>
            );
          })
        ) : (
          <p className="px-1 py-3 text-sm text-ink-3">没有匹配「{query.trim()}」的条目。</p>
        )}
      </div>

      {/* ── 已隐藏的预设条目（操作区，浅底）：同样按周期分组、按需展开 ── */}
      {hiddenItems.length ? (
        <div className="border-t border-line-faint bg-surface-3 px-3 py-3">
          <p className="text-sm text-ink-3">
            已隐藏的预设条目 · {hiddenItems.length} 条（只隐藏不销毁，随时可恢复；点周期名展开该组）
          </p>
          <div className="mt-1.5">
            {hiddenGroups.map((g) => {
              const expanded = openHiddenGroup === g.cycle;
              return (
                <div key={g.cycle}>
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setOpenHiddenGroup(expanded ? null : g.cycle)}
                    className="flex w-full cursor-pointer items-baseline gap-2 rounded-sm px-1 pb-1 pt-1.5 text-left text-sm text-ink-3 transition-colors duration-120 hover:text-ink-2"
                  >
                    <ChevronRight
                      size={13}
                      strokeWidth={2.4}
                      className={`flex-none self-center transition-transform duration-120 ${
                        expanded ? 'rotate-90' : ''
                      }`}
                    />
                    <b className="font-medium text-ink-2">{cycleLabels.get(g.cycle)?.label ?? g.cycle}</b>
                    <span>{g.list.length} 条</span>
                  </button>

                  {(expanded ? g.list : []).map((it) => (
                    <div key={it.id} className="flex items-center gap-2 px-1 py-1.5">
                      <span className="min-w-0 flex-1 truncate text-lg text-ink-3">{it.name}</span>
                      <button
                        type="button"
                        title={`恢复预设条目：${it.name}`}
                        aria-label={`恢复预设条目：${it.name}`}
                        onClick={() => void restoreItem(it.id)}
                        className={`flex items-center gap-1 bg-surface ${btnCls}`}
                      >
                        <Undo2 size={12} strokeWidth={2} />
                        恢复
                      </button>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <p className="border-t border-line-faint bg-surface-3 px-3 py-2 text-sm leading-relaxed text-ink-3">
        删除预设只会隐藏（可恢复）；只有自建条目才允许真删。新添加的条目会排到末尾，不打乱已有顺序。
      </p>
    </CollapsibleSection>
  );
}
