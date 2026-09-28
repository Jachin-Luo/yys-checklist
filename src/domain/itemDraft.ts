/**
 * 条目草稿 → 条目字段（录入 / 编辑的**唯一映射处**）。
 *
 * 为什么放 domain 而不是 `api/mock/adapter`：这是**数据规则**（哪些字段留、空值怎么算、
 * 数值什么算"没填"），不是 IO。分层铁律与 `sanitizePlans` 同一条 —— 接真实后端时，
 * 这段规则前端仍要用来做提交前的归一，后端也得按同一口径存。
 *
 * 两条归一规则（2026-09-28 抽出时定）：
 *   - **空白字符串一律归 `undefined`**：表单里的空输入框给的是 `''`，直接落库会在 JSON 里
 *     留下一串 `""`，而 `it.note ? …` 这类判断又会把 `''` 当"没填" —— 两份事实必然漂移。
 *   - **`gain` 只留三币种里大于 0 的有限数**：`0` 的语义是"没有这个收益"，与缺省同义；
 *     留着会让 `GainBadges` 渲染出 "+0"。
 */
import type { Gain, Item, ItemDraft, SubItem } from '../api/types';
import { GAIN_CURRENCY } from './enums';

/** 空白字符串 → undefined（顺带 trim：用户手打的尾随空格不该进库） */
const opt = (v?: string): string | undefined => {
  const t = (v ?? '').trim();
  return t || undefined;
};

/** 固定收益：只留三币种里的正数；一个都没有 → undefined（= 纯浮动收益） */
export function cleanGain(gain?: Gain): Gain | undefined {
  if (!gain) return undefined;
  const out: Gain = {};
  for (const c of GAIN_CURRENCY) {
    const v = gain[c];
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) out[c] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * 子步骤 → 落库形状：空白串归 `undefined`、`gain` 走同一把尺子（只留正数）。
 *
 * 只留"逐次可能不同"的那几个字段 —— 周期 / 时间 / 入口 / 截止一律继承父条目，
 * 子步骤上出现它们就是无法表达的脏数据（一张卡只有一个周期）。
 * `id` 是唯一必留项：它关联已勾状态与勾选日志，且**生成后不复用**。
 */
export function cleanSubItem(c: SubItem): SubItem {
  const out: SubItem = { id: c.id };
  const note = opt(c.note);
  if (note) out.note = note;
  const condition = opt(c.condition);
  if (condition) out.condition = condition;
  const gainNote = opt(c.gainNote);
  if (gainNote) out.gainNote = gainNote;
  const timeNote = opt(c.timeNote);
  if (timeNote) out.timeNote = timeNote;
  if (c.gainKind?.length) out.gainKind = [...c.gainKind];
  const gain = cleanGain(c.gain);
  if (gain) out.gain = gain;
  return out;
}

/**
 * 草稿 → 条目字段（`id` 与 `origin` 由调用方给：新增生成新 id、编辑沿用原 id）。
 *
 * ⚠️ 编辑走的是**整体覆盖**而不是字段合并：表单把每个字段都渲染了一遍，
 * 用户清空某个框就是要清掉那个字段。若按"草稿里有值才覆盖"来合并，
 * 清空就永远清不掉（这正是编辑功能最容易留的坑）。
 */
export function applyDraft(draft: ItemDraft): Omit<Item, 'id' | 'origin'> {
  return {
    name: draft.name.trim(),
    cycle: draft.cycle,
    start: opt(draft.start),
    deadline: opt(draft.deadline),
    until: opt(draft.until),
    time: opt(draft.time),
    timeEnd: opt(draft.timeEnd),
    path: opt(draft.path),
    condition: opt(draft.condition),
    note: opt(draft.note),
    gainNote: opt(draft.gainNote),
    /* 空的 gainKind 归 undefined 而不是留 `[]`：`[]` 与"没有奖励类型"在数据上是两回事，
       而所有消费者（`KindBadges` 的 `kinds.length`、筛选的 `includes`）都只认后者 */
    gainKind: draft.gainKind.length ? [...draft.gainKind] : undefined,
    gain: cleanGain(draft.gain),
    /* 空（没有 / 空数组）= 单条条目（不留 `[]`：`isGroup` 只看长度，留空数组等于给自己埋一个
       "是不是多次任务"的歧义，且 `diffPatch` 会把 `[]` 与"没写"算成两种状态） */
    children: draft.children?.length ? draft.children.map(cleanSubItem) : undefined,
  };
}

/**
 * 条目 → 草稿。用途有两个：
 *   - 编辑表单的初值（`ItemForm` 内部按字段取，这里给需要构造草稿的调用方用）；
 *   - **「还原默认」那一键**：从种子条目反推一份草稿提交上去，
 *     与种子的差异自然为空 `null` → 改写被删掉，条目回到随包发布的样子
 *     （`domain/itemPatch.diffPatch` 的"改回原样即无改写"由此闭环）。
 */
export function draftFromItem(it: Item): ItemDraft {
  return {
    name: it.name,
    cycle: it.cycle,
    gainKind: it.gainKind ?? [],
    start: it.start,
    deadline: it.deadline,
    until: it.until,
    time: it.time,
    timeEnd: it.timeEnd,
    path: it.path,
    condition: it.condition,
    note: it.note,
    gainNote: it.gainNote,
    gain: it.gain,
    children: (it.children ?? []).map((c) => ({ ...c })),
  };
}
