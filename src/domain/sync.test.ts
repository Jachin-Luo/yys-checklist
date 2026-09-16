import { describe, expect, it } from 'vitest';
import type { ItemOverrides, ViewPrefs } from '../api/types';
import { SYNC_PARTS, applyParts, defaultSyncKeys, describeKeys, type SyncSource } from './sync';

/**
 * 档案间配置同步的合并规则。
 *
 * 这里没有 IO，所以用例全部围绕两件事：
 *   1. **清单**里有什么、默认勾什么（产品口径）；
 *   2. `applyParts` 是**字段级**接管还是**整表**接管（这是最容易改错的地方 ——
 *      用户只勾「一键日常覆盖」时，目标档案的筛选与置顶绝不该被动）。
 */

const view = (patch: Partial<ViewPrefs> = {}): ViewPrefs => ({
  profileId: 'p',
  sortBy: 'weight',
  showKinds: [],
  minWeight: 0,
  hideDone: false,
  pinned: [],
  updatedAt: '',
  ...patch,
});

const overrides = (patch: Partial<ItemOverrides> = {}): ItemOverrides => ({
  profileId: 'p',
  custom: [],
  hidden: [],
  order: [],
  updatedAt: '',
  ...patch,
});

const source: SyncSource = {
  guildTime: { daily_daoguan: '20:00' },
  plans: [{ id: 'n_src', base: '08:00', n: 2, started: true, createdAt: 1 }],
  view: view({ showKinds: ['jade'], hideDone: true, pinned: ['daily_sign'], autoSet: ['daily_pet'], coverMode: 'hide' }),
  overrides: overrides({
    custom: [{ id: 'c1', name: '自建', cycle: 'daily', gainKind: [], origin: 'custom' }],
    order: ['c1', 'daily_sign'],
    hidden: ['daily_pet'],
  }),
};

const target: SyncSource = {
  guildTime: { weekly_banquet: '21:00' },
  plans: [],
  view: view({ showKinds: ['soul'], hideDone: false, pinned: ['daily_pet'], autoSet: [], coverMode: 'dim' }),
  overrides: overrides({ hidden: ['daily_other'] }),
};

describe('SYNC_PARTS：可同步内容清单', () => {
  it('默认只勾最常用的两项（寮时间 / 寄养任务），其余要用户主动选', () => {
    expect(defaultSyncKeys()).toEqual(['guildTime', 'plans']);
  });

  it('清单里不存在勾选状态与勾选日志 —— 那是每个号的进度，不是配置', () => {
    const keys = SYNC_PARTS.map((p) => p.key);
    expect(keys).not.toContain('checked');
    expect(keys).not.toContain('log');
  });

  it('describeKeys 按清单顺序输出中文串（不按传入顺序）', () => {
    expect(describeKeys(['plans', 'guildTime'])).toBe('寮时间、结界寄养任务');
  });
});

describe('applyParts：整表接管 vs 字段级接管', () => {
  it('只勾寮时间 → 补丁里只有 guildTime，其余键不出现（调用方据此跳过写入）', () => {
    const patch = applyParts(source, target, ['guildTime']);
    expect(Object.keys(patch)).toEqual(['guildTime']);
    expect(patch.guildTime).toEqual({ daily_daoguan: '20:00' });
  });

  it('只勾寄养任务 → 计划整表替换', () => {
    const patch = applyParts(source, target, ['plans']);
    expect(patch.plans).toHaveLength(1);
    expect(patch.plans?.[0].id).toBe('n_src');
  });

  it('只勾一键日常覆盖 → 目标的筛选 / 隐藏已完成 / 置顶**原样保留**', () => {
    const patch = applyParts(source, target, ['autoDaily']);
    expect(patch.view?.autoSet).toEqual(['daily_pet']);
    expect(patch.view?.coverMode).toBe('hide');
    /* 这三个字段没被勾，必须还是目标自己的值 */
    expect(patch.view?.showKinds).toEqual(['soul']);
    expect(patch.view?.hideDone).toBe(false);
    expect(patch.view?.pinned).toEqual(['daily_pet']);
  });

  it('勾了一键日常 + 显示偏好 → 两者合并在同一个 view 补丁里', () => {
    const patch = applyParts(source, target, ['autoDaily', 'viewPrefs']);
    expect(patch.view?.autoSet).toEqual(['daily_pet']);
    expect(patch.view?.showKinds).toEqual(['jade']);
    expect(patch.view?.pinned).toEqual(['daily_sign']);
  });

  it('只勾自建条目 → 连 order 一起带（只带条目不带走顺序会把新条目全排到末尾）', () => {
    const patch = applyParts(source, target, ['customItems']);
    expect(patch.overrides?.custom).toHaveLength(1);
    expect(patch.overrides?.order).toEqual(['c1', 'daily_sign']);
    /* hidden 没勾 → 保留目标自己的 */
    expect(patch.overrides?.hidden).toEqual(['daily_other']);
  });

  it('autoSet 的 undefined 原样传递（= 跟随数据默认，与"显式空数组"语义相反）', () => {
    const noCustom = { ...source, view: view({ autoSet: undefined }) };
    const patch = applyParts(noCustom, target, ['autoDaily']);
    expect(patch.view?.autoSet).toBeUndefined();
    /* 若这里被写成 `?? []`，就会变成"用户显式关掉了全部覆盖项"，与本意相反 */
  });

  it('补丁是深一层拷贝：之后改源不影响已生成的补丁（跨档案串数据最难排查）', () => {
    const patch = applyParts(source, target, ['plans', 'customItems', 'guildTime']);
    source.plans[0].base = '23:00';
    source.overrides.custom[0].name = '改过了';
    source.guildTime.daily_daoguan = '23:30';

    expect(patch.plans?.[0].base).toBe('08:00');
    expect(patch.overrides?.custom[0].name).toBe('自建');
    expect(patch.guildTime?.daily_daoguan).toBe('20:00');
  });

  it('未勾选任何项 → 空补丁', () => {
    expect(applyParts(source, target, [])).toEqual({});
  });

  it('目标档案的相关分片不会被就地修改（同步是"写入"，不是"改内存"）', () => {
    const before = JSON.stringify(target);
    applyParts(source, target, ['autoDaily', 'customItems', 'hidden']);
    expect(JSON.stringify(target)).toBe(before);
  });
});
