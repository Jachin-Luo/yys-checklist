/**
 * 预设条目的**字段改写**（`ItemPatch`）—— 应用与求差，纯函数。
 *
 * 两条规则就是这个文件的全部内容：
 *   1. `applyPatch`：稀疏覆盖。键不存在 = 不动；`null` = 清空；有值 = 覆盖。
 *   2. `diffPatch`：拿草稿与**种子原值**比一遍，只留真正变了的字段；
 *      完全没变 → `null`（不写改写，"编辑回原样"就是没改过）。
 *
 * 为什么求差要对着**种子**而不是"当前生效值"：改写永远是"在种子上盖一层"，
 * 对着生效值求差会把上一次改写的字段也算进来，越改越厚、且还原不回去。
 *
 * 为什么放 domain：这是数据规则（哪些字段可改、怎么合并、空值什么语义），
 * 与 `itemDraft` / `merge` 同一层；Mock 只负责读写分片。
 */
import type { Gain, Item, ItemDraft, ItemPatch, SubItem } from '../api/types';
import { applyDraft, cleanGain } from './itemDraft';
import { CYCLE, GAIN_KIND, type GainKind } from './enums';

/**
 * 可改写字段白名单 —— **故意写死**，不是 `keyof Item`。
 * `id` / `origin` 不可改（关联勾选与日志）；`days`（只在某几天适用）、
 * `isGuildTime`、`autoDaily` 属于预设的进阶规则，各有专属分区在管（见 `ItemDraft` 的说明），
 * 表单不收集它们，这里也不允许被改写 —— 白名单是这条边界唯一的执行点。
 */
const PATCH_FIELDS = [
  'name',
  'cycle',
  'start',
  'deadline',
  'until',
  'time',
  'timeEnd',
  'path',
  'condition',
  'note',
  'gainNote',
  'gainKind',
  'gain',
  'children',
] as const;

/**
 * 比较两个字段值是否相同（只用于本文件的小数组 / 小对象：`gainKind` 与 `gain`）。
 * 数组按**内容集合**比、忽略顺序：`gainKind` 是集合语义，顺序不同不算改动 ——
 * 否则"点两下标签换个顺序"就会凭空产生一条改写。
 */
const same = (a: unknown, b: unknown): boolean => {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && [...a].sort().join('\u0000') === [...b].sort().join('\u0000');
  }
  return JSON.stringify(a) === JSON.stringify(b);
};

/**
 * 应用改写。没有改写时**返回原对象**（引用不变）——
 * `mergeItems` 每次 reload 都会跑一遍，没被改写的那些条目不该产生新引用
 * （上游有按引用做的 memo）。
 */
export function applyPatch(item: Item, patch?: ItemPatch | null): Item {
  if (!patch) return item;
  /* 空壳改写（理论上不该出现：`diffPatch` 无差异时给的是 null、写库时会把键删掉）
     也走"原样返回"，免得整条被复制出一个新引用 */
  if (!Object.keys(patch).length) return item;
  const out = { ...item } as Record<string, unknown>;
  for (const k of PATCH_FIELDS) {
    if (!(k in patch)) continue;
    const v = (patch as Record<string, unknown>)[k];
    /* `null` = 清空：删键而不是写 null —— `it.note ? …` 这类判断与 JSON 输出都按"缺省"处理 */
    if (v === null) delete out[k];
    else out[k] = v;
  }
  return out as unknown as Item;
}

/**
 * 草稿 vs **种子原值** → 改写。
 *
 * 返回 `null` 表示"没有任何差异"（含用户又改回原样的情况）—— 调用方据此
 * **删掉**已存的改写，而不是留一份全 `undefined` 的空壳。
 */
export function diffPatch(seed: Item, draft: ItemDraft): ItemPatch | null {
  const next = applyDraft(draft) as Record<string, unknown>;
  const base = seed as unknown as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const k of PATCH_FIELDS) {
    const b = next[k];
    /* 子步骤是**有序**的（第 k 步就是第 k 步，换个顺序就是另一回事），
       不能走 `same` 里"忽略顺序的集合比较" —— 那是给 `gainKind` 用的 */
    const eq = k === 'children'
      ? (x: unknown, y: unknown) => JSON.stringify(x) === JSON.stringify(y)
      : same;
    if (eq(base[k], b)) continue;
    /* 草稿里"没填"（`undefined`）在改写里必须落成 `null`：那正是"清空"的表达 */
    patch[k] = b === undefined ? null : b;
  }
  return Object.keys(patch).length ? (patch as ItemPatch) : null;
}

/** 该 id 是否被改写过（UI 用它标「已改写」、并决定要不要给「还原默认」） */
export function hasPatch(patches: Record<string, ItemPatch> | undefined, id: string): boolean {
  return Boolean(patches && patches[id]);
}

/**
 * **id 归一**：转小写 + 不在 `[a-z0-9_]` 里的字符落 `_`（与 `domain/ids` 同一枚字母表）。
 *
 * 为什么是归一而不是丢弃：2026-09-28 修的那个 bug 正是"丢弃"造成的 ——
 * 表单用 `nanoid(6)` 生成 `sub_DvBaJW` 这种 id，写进分片是 14 步，读回来被丢成 3 步，
 * 界面上就是"加了步骤没生效"，且**没有任何提示**。
 *
 * 只有"压根没有 id"和"归一后撞车"才丢 —— 那两种没有安全的补救办法，
 * 而它们本来就不可能来自正常操作路径。
 */
function normalizeId(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
}

/**
 * 净化子步骤表 —— 与下面 `sanitizePatches` 同一个动机：它可能来自**备份文件**或被改坏的
 * 本机分片，不能被信任。
 *
 * 三条硬规矩：
 *   - `id` 必须**互不重复**：它关联已勾状态与勾选日志，撞了就是串台；
 *     写法不合规（大写 / 连字符）时**归一而不是丢弃** —— 见下面 `normalizeId`；
 *   - 只留 `SubItem` 允许的字段（周期 / 时间 / 入口 / 截止一律不收，那些继承父条目）；
 *   - 超过 31 步截断（进度格上限），空的文本归"没填"。
 *
 * 净空了就返回空数组 —— 空数组在草稿里的语义是"单条条目"，调用方据此决定要不要写键。
 */
export function sanitizeChildren(value: unknown[]): SubItem[] {
  const out: SubItem[] = [];
  const seen = new Set<string>();
  const text = (v: unknown): string | undefined =>
    typeof v === 'string' && v.trim() ? v.trim() : undefined;

  for (const raw of value.slice(0, 31)) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const src = raw as Record<string, unknown>;
    const id = normalizeId(typeof src.id === 'string' ? src.id : '');
    if (!id || seen.has(id)) continue;
    seen.add(id);

    const sub: SubItem = { id };
    const note = text(src.note);
    if (note) sub.note = note;
    const condition = text(src.condition);
    if (condition) sub.condition = condition;
    const gainNote = text(src.gainNote);
    if (gainNote) sub.gainNote = gainNote;
    const timeNote = text(src.timeNote);
    if (timeNote) sub.timeNote = timeNote;
    if (Array.isArray(src.gainKind)) {
      const kinds = src.gainKind.filter(
        (x): x is GainKind => typeof x === 'string' && (GAIN_KIND as readonly string[]).includes(x),
      );
      if (kinds.length) sub.gainKind = kinds;
    }
    const gain = cleanGain(src.gain as Gain | undefined);
    if (gain) sub.gain = gain;
    out.push(sub);
  }
  return out;
}

/**
 * 净化外部来的改写表 —— 两个来源都可能被改坏或来自别的版本：**本机分片的字节**、
 * **用户手上的备份文件**（与 `sanitizePlans` 同一动机，那种"读取入口归一"的做法）。
 *
 * 三条硬规矩：
 *   - 只留白名单字段（`PATCH_FIELDS`），其余键直接丢；
 *   - 值类型必须对得上：日期 / 文本要字符串、`gainKind` 要**已知枚举**、
 *     `cycle` 要**已知周期**、`gain` 只收正的有限数；
 *   - 净化后为空的改写整条丢掉（空壳与"没改写"是同一件事）。
 *
 * 尤其 `cycle`：非法周期会让条目在界面上**无家可归**（没有任何页面按它取数），
 * 这种值必须在入口就被挡掉，而不是等它渗进渲染层。
 */
export function sanitizePatches(value: unknown): Record<string, ItemPatch> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const out: Record<string, ItemPatch> = {};
  for (const [id, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!id || !raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const src = raw as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    for (const k of PATCH_FIELDS) {
      if (!(k in src)) continue;
      const v = src[k];
      if (v === null) {
        patch[k] = null; // 清空是个合法意图，保留
        continue;
      }
      if (k === 'cycle') {
        if (typeof v === 'string' && (CYCLE as readonly string[]).includes(v)) patch[k] = v;
        continue;
      }
      if (k === 'gainKind') {
        if (!Array.isArray(v)) continue;
        const kinds = v.filter(
          (x): x is GainKind => typeof x === 'string' && (GAIN_KIND as readonly string[]).includes(x),
        );
        if (kinds.length) patch[k] = kinds;
        continue;
      }
      if (k === 'gain') {
        if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
        /* 复用 `itemDraft.cleanGain`：只收三币种里的正数 —— 与"录入时怎么清洗"同一把尺子 */
        const gain = cleanGain(v as Gain);
        if (gain) patch[k] = gain;
        continue;
      }
      if (k === 'children') {
        if (!Array.isArray(v)) continue;
        const subs = sanitizeChildren(v);
        if (subs.length) patch[k] = subs;
        continue;
      }
      if (typeof v === 'string') patch[k] = v;
    }
    if (Object.keys(patch).length) out[id] = patch as ItemPatch;
  }
  return Object.keys(out).length ? out : undefined;
}
