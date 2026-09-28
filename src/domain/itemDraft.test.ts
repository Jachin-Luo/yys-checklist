/**
 * 条目草稿归一（`domain/itemDraft`）—— 新增与编辑共用的那两条规则。
 *
 * 这两条都属"错了不报错、只是悄悄难看"的一类：
 *   ① 空白串落库 → JSON 里一串 `""`，而渲染层按真值判断又会当它没填；
 *   ② `gain` 留 0 → 徽章上会渲染出「+0」。
 */
import { describe, expect, it } from 'vitest';
import { applyDraft, cleanGain } from './itemDraft';

const draft = (over: Partial<Parameters<typeof applyDraft>[0]> = {}) => ({
  name: '测试条目',
  cycle: 'daily' as const,
  gainKind: [],
  ...over,
});

describe('applyDraft：草稿 → 条目字段', () => {
  it('空白字符串一律归 undefined（去掉尾随空格）', () => {
    const out = applyDraft(draft({ name: '  签到  ', note: '   ', path: ' 町中 → 庭院 ' }));
    expect(out.name).toBe('签到');
    expect(out.note).toBeUndefined();
    expect(out.path).toBe('町中 → 庭院');
  });

  it('空的 gainKind 归 undefined（不是空数组）', () => {
    expect(applyDraft(draft({ gainKind: [] })).gainKind).toBeUndefined();
    expect(applyDraft(draft({ gainKind: ['jade'] })).gainKind).toEqual(['jade']);
  });

  it('整体覆盖：草稿没给的字段就是"清掉"，不会保留上一次的值', () => {
    /* 这是编辑功能的关键语义 —— 表单把每个字段都渲染了一遍，用户清空即删除。
       若换成"草稿有值才覆盖"的合并写法，清空就永远清不掉 */
    const edited = applyDraft(draft({ name: '改名后', deadline: undefined, until: undefined }));
    expect(edited.deadline).toBeUndefined();
    expect(edited.until).toBeUndefined();
    expect(edited.name).toBe('改名后');
  });
});

describe('cleanGain：只留三币种里的正数', () => {
  it('0 / 负数 / 非有限数 / 未知币种一律剔除', () => {
    expect(cleanGain({ jade: 20, blackFrag: 0, blueTicket: -1 })).toEqual({ jade: 20 });
    expect(cleanGain({ jade: Number.NaN })).toBeUndefined();
    expect(cleanGain({})).toBeUndefined();
    expect(cleanGain()).toBeUndefined();
  });
});
