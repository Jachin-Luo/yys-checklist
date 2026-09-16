import { describe, expect, it } from 'vitest';
import {
  CARD_FIELDS,
  CARD_PRESETS,
  DEFAULT_CARD_DISPLAY,
  effectiveCardDisplay,
  hiddenFieldCount,
  matchPreset,
} from './cardDisplay';

/**
 * 卡片字段显示偏好。
 *
 * 三条要锁住的东西：
 *   ① **默认 = 全部显示**（引入这个功能不改变任何人的现有观感）；
 *   ② 外部数据里的畸形值不会把 UI 卡死（只接受布尔，其余回落默认）；
 *   ③ 预设与逐项开关**是同一份数据**（改了任一项就不再匹配任何预设）。
 */
describe('effectiveCardDisplay：归一化', () => {
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

describe('matchPreset：预设只是"一次设六项"的快捷键', () => {
  it('三档预设各自都能被匹配到', () => {
    for (const preset of CARD_PRESETS) {
      expect(matchPreset(preset.value)).toBe(preset.key);
    }
  });

  it('默认值就是「完整」档', () => {
    expect(matchPreset(DEFAULT_CARD_DISPLAY)).toBe('full');
  });

  it('改任意一项后不再匹配任何预设（UI 据此不高亮，避免"预设说 A、开关说 B"）', () => {
    const modified = { ...CARD_PRESETS[2].value, note: false };
    expect(matchPreset(modified)).toBeNull();
  });
});

describe('CARD_FIELDS：逐项开关清单', () => {
  it('开关必须覆盖 CardDisplay 的全部字段 —— 加渲染块时要同步加开关，否则它成了"怎么也关不掉"的例外', () => {
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
