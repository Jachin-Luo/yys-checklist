/**
 * 预设字段改写（`domain/itemPatch`）—— 三条规则各钉一组用例：
 *   ① `applyPatch` 稀疏覆盖：键不存在 = 不动、`null` = 清空、有值 = 覆盖；
 *   ② `diffPatch` 对着**种子**求差：没变 → `null`，空值落成 `null`；
 *   ③ `sanitizePatches` 挡外部脏值（非法周期 / 未知奖励类型 / 非字符串）。
 */
import { describe, expect, it } from 'vitest';
import type { Item } from '../api/types';
import { draftFromItem } from './itemDraft';
import { applyPatch, diffPatch, hasPatch, sanitizeChildren, sanitizePatches } from './itemPatch';
import { newId } from './ids';

const seed: Item = {
  id: 'p1',
  name: '每日签到',
  cycle: 'daily',
  origin: 'preset',
  path: '庭院 → 签到小纸人',
  note: '月度累计另有奖励',
  gainKind: ['gold', 'jade'],
  autoDaily: true,
};

describe('applyPatch：稀疏覆盖', () => {
  it('没有改写 / 空壳改写 → 原对象原样返回（引用不变，供上游 memo 用）', () => {
    expect(applyPatch(seed, undefined)).toBe(seed);
    expect(applyPatch(seed, null)).toBe(seed);
    expect(applyPatch(seed, {})).toBe(seed);
  });

  it('有值则覆盖、null 则清空（删键而不是写 null）、未出现的键保持原值', () => {
    const out = applyPatch(seed, { name: '我的签到', note: null });
    expect(out.name).toBe('我的签到');
    expect(out.note).toBeUndefined();
    /* 清空是**删键**：`it.note ? …` 这类判断与 JSON 输出都要按"缺省"处理 */
    expect('note' in out).toBe(false);
    expect(out.path).toBe(seed.path);
    /* 白名单之外的字段（一键日常标记）不受改写影响 */
    expect(out.autoDaily).toBe(true);
    /* 不改动入参 */
    expect(seed.name).toBe('每日签到');
    expect(seed.note).toBe('月度累计另有奖励');
  });
});

describe('diffPatch：对着种子求差', () => {
  it('草稿与种子完全一致 → null（"编辑回原样"就是没改过）', () => {
    expect(diffPatch(seed, draftFromItem(seed))).toBeNull();
  });

  it('只留变了的字段；草稿里没填的落成 null（= 清空）', () => {
    const patch = diffPatch(seed, { ...draftFromItem(seed), name: '改名', note: undefined });
    expect(patch).toEqual({ name: '改名', note: null });
  });

  it('gainKind 是集合语义：顺序不同不算改动', () => {
    expect(diffPatch(seed, { ...draftFromItem(seed), gainKind: ['jade', 'gold'] })).toBeNull();
  });
});

describe('sanitizePatches：外部字节的净化', () => {
  it('丢掉非法周期 / 未知奖励类型 / 非字符串值；保留合法项与 null', () => {
    const out = sanitizePatches({
      p1: { cycle: 'monthly', name: '改名', note: null, gainKind: ['jade', '不存在'], gain: { jade: 20, 鬼: 3, bad: -1 }, 乱键: 'x' },
      p2: { cycle: 'once' }, // 已删除的周期：整条被过滤
      p3: { name: 42 }, // 值类型不对：过滤
      p4: '不是对象',
    });
    expect(out).toEqual({
      p1: { cycle: 'monthly', name: '改名', note: null, gainKind: ['jade'], gain: { jade: 20 } },
    });
  });

  it('非法输入与非对象一律给 undefined（缺席 = 没有改写）', () => {
    expect(sanitizePatches(undefined)).toBeUndefined();
    expect(sanitizePatches([])).toBeUndefined();
    expect(sanitizePatches({ p1: {} })).toBeUndefined();
  });
});

describe('sanitizeChildren：子步骤表的净化（2026-09-28）', () => {
  it('id 写法不合规 → **归一**而不是丢弃', () => {
    /* 丢弃就是那个真 bug 的形状：表单用 `nanoid(6)` 生成 `sub_DvBaJW`（默认字母表含大写与 `-`），
       写进分片是 14 步、读回来被丢成 3 步，界面上表现为"加了子步骤没生效"且没有任何提示 */
    const out = sanitizeChildren([
      { id: 'sub_DvBaJW' },
      { id: 'sub_ab-cd' },
      { id: 'ok_1' },
    ]);
    expect(out.map((s) => s.id)).toEqual(['sub_dvbajw', 'sub_ab_cd', 'ok_1']);
  });

  it('没有 id / 归一后撞车 → 才丢（这两种没有安全的补救办法）', () => {
    expect(
      sanitizeChildren([{ note: '没有 id' }, { id: 'sub_A' }, { id: 'sub_a' }]).map((s) => s.id),
    ).toEqual(['sub_a']);
  });

  it('超过 31 步截断（进度格上限）；只留 SubItem 允许的字段', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ id: `s_${i}` }));
    expect(sanitizeChildren(many)).toHaveLength(31);
    expect(sanitizeChildren([{ id: 's_1', cycle: 'daily', note: '留', 乱键: '丢' }])[0]).toEqual({
      id: 's_1',
      note: '留',
    });
  });
});

describe('newId：生成的 id 必须合规则（domain/ids）', () => {
  it('500 个 id 全部只含小写字母 / 数字 / 下划线，且互不重复', () => {
    const ids = Array.from({ length: 500 }, () => newId('sub'));
    for (const id of ids) expect(id).toMatch(/^sub_[a-z0-9_]+$/);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('hasPatch：UI 用它标「已改写」', () => {
  it('只在确有该 id 的改写时为真', () => {
    expect(hasPatch({ p1: { name: 'x' } }, 'p1')).toBe(true);
    expect(hasPatch({ p1: { name: 'x' } }, 'p2')).toBe(false);
    expect(hasPatch(undefined, 'p1')).toBe(false);
  });
});
