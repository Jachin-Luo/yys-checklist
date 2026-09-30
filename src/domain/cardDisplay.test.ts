import { describe, expect, it } from 'vitest';
import {
  CARD_FIELDS,
  CARD_PRESETS,
  CARD_SCOPES,
  DEFAULT_CARD_DISPLAY,
  effectiveCardByScope,
  effectiveCardDisplay,
  hiddenFieldCount,
  matchPreset,
} from './cardDisplay';

/**
 * 卡片字段显示偏好。
 *
 * 四条要锁住的东西：
 *   ① **默认 = 全部显示**（引入这个功能不改变任何人的现有观感）；
 *   ② 外部数据里的畸形值不会把 UI 卡死（只接受布尔，其余回落默认）；
 *   ③ 预设与逐项开关**是同一份数据**（改了任一项就不再匹配任何预设）；
 *   ④（2026-09-30）**按页面四套，且四页互不干扰** —— 今日切「简要」不能顺手把限时也改瘦，
 *      那正是用户提这个需求要避免的事。四页各持独立对象是④的实现细节，也是它最容易出错的地方。
 */
describe('effectiveCardDisplay：单页归一化', () => {
  it('缺省（老数据没有 card 字段）→ 全部显示', () => {
    expect(effectiveCardDisplay(undefined)).toEqual(DEFAULT_CARD_DISPLAY);
    expect(effectiveCardDisplay(null)).toEqual(DEFAULT_CARD_DISPLAY);
    expect(hiddenFieldCount(effectiveCardDisplay(undefined))).toBe(0);
  });

  it('只给了部分字段 → 给的按给的，缺的补默认', () => {
    const card = effectiveCardDisplay({ path: false, note: false });
    expect(card.path).toBe(false);
    expect(card.note).toBe(false);
    expect(card.tags).toBe(true);
    expect(card.gain).toBe(true);
  });

  it('非布尔值被忽略（备份文件是外部数据，畸形的 card 不该把清单卡死）', () => {
    const card = effectiveCardDisplay({
      path: 'yes' as unknown as boolean,
      note: 0 as unknown as boolean,
    });
    expect(card.path).toBe(true);
    expect(card.note).toBe(true);
  });
});

describe('effectiveCardByScope：按页面四套（2026-09-30）', () => {
  it('缺省 → 四页各一套「全部显示」', () => {
    const all = effectiveCardByScope(undefined);
    expect(Object.keys(all).sort()).toEqual(CARD_SCOPES.map((s) => s.key).sort());
    for (const s of CARD_SCOPES) expect(all[s.key]).toEqual(DEFAULT_CARD_DISPLAY);
  });

  it('四页各持独立对象 —— 改一页不会连坐另外三页，两次调用之间也不共享', () => {
    const a = effectiveCardByScope();
    a.today.note = false;
    expect(a.limited.note).toBe(true);
    expect(a.week.note).toBe(true);

    const b = effectiveCardByScope();
    expect(b.today).not.toBe(a.today);
    expect(b.limited).not.toBe(a.limited);
  });

  it('只给了一部分页 → 给的按给的，缺的页补默认', () => {
    const all = effectiveCardByScope({ limited: { path: false, condition: false, note: false } });
    expect(all.limited.path).toBe(false);
    expect(all.limited.note).toBe(false);
    expect(all.limited.tags).toBe(true);
    expect(all.today).toEqual(DEFAULT_CARD_DISPLAY);
  });

  it('旧的单份形状被忽略（用户 2026-09-30：“无需兼容之前的”）—— 四页全默认，且不抛错', () => {
    const legacy = CARD_PRESETS[1].value as unknown as Record<string, never>;
    const all = effectiveCardByScope(legacy);
    for (const s of CARD_SCOPES) expect(all[s.key]).toEqual(DEFAULT_CARD_DISPLAY);
  });

  it('某一页里的畸形值只影响那一页，其余页照常', () => {
    const all = effectiveCardByScope({ week: { note: 'yes' as unknown as boolean } });
    expect(all.week.note).toBe(true);
    expect(all.month).toEqual(DEFAULT_CARD_DISPLAY);
  });
});

describe('CARD_SCOPES：四个作用范围', () => {
  it('恰好是四个清单页（页签文字与导航同名页一致）', () => {
    expect(CARD_SCOPES.map((s) => s.key)).toEqual(['today', 'week', 'month', 'limited']);
    expect(CARD_SCOPES.map((s) => s.label)).toEqual(['今日', '本周', '本月', '限时']);
  });
});

describe('matchPreset：预设只是“一次设六项”的快捷键', () => {
  it('三档预设各自都能被匹配到', () => {
    for (const preset of CARD_PRESETS) {
      expect(matchPreset(preset.value)).toBe(preset.key);
    }
  });

  it('默认值就是「完整」档', () => {
    expect(matchPreset(DEFAULT_CARD_DISPLAY)).toBe('full');
  });

  it('改任意一项后不再匹配任何预设（UI 据此不高亮，避免“预设说 A、开关说 B”）', () => {
    const modified = { ...CARD_PRESETS[2].value, note: false };
    expect(matchPreset(modified)).toBeNull();
  });
});

describe('CARD_FIELDS：逐项开关清单', () => {
  it('开关必须覆盖 CardDisplay 的全部字段 —— 加渲染块时要同步加开关，否则它成了“怎么也关不掉”的例外', () => {
    expect(CARD_FIELDS.map((f) => String(f.key)).sort()).toEqual(
      Object.keys(DEFAULT_CARD_DISPLAY).sort(),
    );
  });

  it('不含名称 / 勾选 / 置顶 —— 它们是卡片的身份与交互，不是内容', () => {
    const keys = CARD_FIELDS.map((f) => String(f.key));
    for (const forbidden of ['name', 'checked', 'pinned']) expect(keys).not.toContain(forbidden);
  });

  it('hiddenFieldCount 数出被关掉的项（设置页摘要用）', () => {
    expect(hiddenFieldCount(DEFAULT_CARD_DISPLAY)).toBe(0);
    expect(hiddenFieldCount({ ...DEFAULT_CARD_DISPLAY, note: false, path: false })).toBe(2);
    expect(hiddenFieldCount(CARD_PRESETS[0].value)).toBe(6);
  });

  it('「简要」档 = 保留徽章、去掉三行长文本（这是用户最常切的一档）', () => {
    const brief = CARD_PRESETS.find((p) => p.key === 'brief')?.value;
    expect(brief).toEqual({ tags: true, gain: true, kinds: true, path: false, condition: false, note: false });
  });
});
