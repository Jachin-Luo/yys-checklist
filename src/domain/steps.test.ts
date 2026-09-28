/**
 * 子步骤单测。锁定四条口径：
 *   ① 单条条目的一切行为与旧版一致（步数 1、步骤 id 就是自己）
 *   ② 进度 = 真实已完成的步数（不是另记的计数）
 *   ③ 只要有一步没做完，整张卡就不算完成（不会"半张卡"）
 *   ④ 子步骤缺省继承父、写了才覆盖（`stepView` 是唯一实现处）
 */
import { describe, expect, it } from 'vitest';
import {
  currentStepIndex, doneSteps, isCardDone, isGroup,
  stepIds, stepTotal, stepView,
} from './steps';
import type { Item } from '../api/types';

const mk = (over: Partial<Item>): Item => ({
  id: 'x', name: '条目', cycle: 'daily', origin: 'preset', ...over,
});

/** 三步的地域鬼王：收益写在父（三步相同），门槛写在子（逐次不同） */
const DEMON: Item = mk({
  id: 'daily_demon_lord',
  name: '地域鬼王',
  gain: { jade: 20 },
  gainKind: ['jade'],
  gainNote: '每只 20 勾',
  children: [
    { id: 'daily_demon_lord_1', note: '难度拉 1 级就能拿' },
    { id: 'daily_demon_lord_2', note: '需声望 2000' },
    { id: 'daily_demon_lord_3', note: '需声望 10000' },
  ],
});

const done = (...ids: string[]) => (id: string) => ids.includes(id);

describe('单条条目：行为与旧版一致', () => {
  const solo = mk({ id: 'solo' });

  it('不是多次任务，步数恒为 1，步骤 id 就是自己', () => {
    expect(isGroup(solo)).toBe(false);
    expect(stepTotal(solo)).toBe(1);
    expect(stepIds(solo)).toEqual(['solo']);
  });

  it('勾选与否就是整张卡的完成与否', () => {
    expect(isCardDone(solo, done())).toBe(false);
    expect(isCardDone(solo, done('solo'))).toBe(true);
  });
});

describe('stepIds / stepTotal', () => {
  it('步骤 id 是子步骤 id 列表（勾选态按这些 id 走）', () => {
    expect(isGroup(DEMON)).toBe(true);
    expect(stepIds(DEMON)).toEqual([
      'daily_demon_lord_1', 'daily_demon_lord_2', 'daily_demon_lord_3',
    ]);
    expect(stepTotal(DEMON)).toBe(3);
  });

  it('空 children 视同单条（不写比写空数组干净，但两者都不能崩）', () => {
    expect(isGroup(mk({ id: 'empty', children: [] }))).toBe(false);
    expect(stepIds(mk({ id: 'empty', children: [] }))).toEqual(['empty']);
  });
});

describe('doneSteps / isCardDone：进度是真实步数', () => {
  it('勾一步算一步', () => {
    expect(doneSteps(DEMON, done())).toBe(0);
    expect(doneSteps(DEMON, done('daily_demon_lord_1'))).toBe(1);
    expect(doneSteps(DEMON, done('daily_demon_lord_1', 'daily_demon_lord_2'))).toBe(2);
  });

  it('做了一半不算完成 —— 整张卡仍留在待做段', () => {
    expect(isCardDone(DEMON, done('daily_demon_lord_1'))).toBe(false);
    expect(isCardDone(DEMON, done('daily_demon_lord_1', 'daily_demon_lord_2'))).toBe(false);
    expect(isCardDone(DEMON, done(...stepIds(DEMON)))).toBe(true);
  });
});

describe('currentStepIndex：当前步', () => {
  it('指向第一个未完成的步', () => {
    expect(currentStepIndex(DEMON, done())).toBe(0);
    expect(currentStepIndex(DEMON, done('daily_demon_lord_1'))).toBe(1);
  });

  it('全做完了退回最后一步 —— 满段后卡面仍读得到那一步的说明', () => {
    expect(currentStepIndex(DEMON, done(...stepIds(DEMON)))).toBe(2);
  });
});

describe('stepView：缺省继承父、写了才覆盖', () => {
  it('没写的字段取父的', () => {
    const v = stepView(DEMON, 1);
    expect(v.gain).toEqual({ jade: 20 });
    expect(v.gainKind).toEqual(['jade']);
    expect(v.gainNote).toBe('每只 20 勾');
    expect(v.name).toBe('地域鬼王');
  });

  it('写了的字段盖住父的 —— 每步显示自己的门槛', () => {
    expect(stepView(DEMON, 0).note).toBe('难度拉 1 级就能拿');
    expect(stepView(DEMON, 1).note).toBe('需声望 2000');
    expect(stepView(DEMON, 2).note).toBe('需声望 10000');
  });

  it('视图 id 是子步骤 id（勾选要用它；排序 / 隐藏请用父 id）', () => {
    expect(stepView(DEMON, 1).id).toBe('daily_demon_lord_2');
  });

  it('子步骤也能覆盖奖励 —— 逐次收益不同时各算各的', () => {
    const mixed = mk({
      id: 'p',
      gain: { jade: 10 },
      children: [
        { id: 'p_1' },
        { id: 'p_2', gain: { jade: 30 }, gainNote: '第二次翻倍' },
      ],
    });
    expect(stepView(mixed, 0).gain).toEqual({ jade: 10 });
    expect(stepView(mixed, 1).gain).toEqual({ jade: 30 });
    expect(stepView(mixed, 1).gainNote).toBe('第二次翻倍');
  });

  it('单条条目返回它自己', () => {
    const solo = mk({ id: 'solo', note: '只有一步' });
    expect(stepView(solo, 0)).toBe(solo);
  });
});
