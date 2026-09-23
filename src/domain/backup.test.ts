/**
 * 备份校验测试。核心不是"能通过合法文件"，而是**畸形 / 敌意输入不会流进用户数据分片**：
 * 备份是用户手上的外部数据，可能来自旧版本、被手工改过、或干脆选错了文件。
 *
 * 注意：这里的构造器刻意**不打 `UserDataBundle` 类型** —— 要造的就是畸形数据，
 * 而 `validateBundle` 的入参本来就是 `unknown`（未经信任的 JSON）。
 */
import { describe, expect, it } from 'vitest';
import type { UserDataBundle } from '../api/types';
import {
  dataFreshness,
  MAX_BUNDLE_CHARS,
  parseBundleText,
  serializeBundle,
  STALE_DAYS,
  summarize,
  validateBundle,
} from './backup';

const NOW = new Date(2026, 8, 10);

const profile = (id: string, name: string, sort: number) => ({
  id,
  userId: 'u_local',
  name,
  isDefault: sort === 1,
  sort,
  archived: false,
  createdAt: '',
  updatedAt: '',
});

const row = (profileId: string, checked: Record<string, unknown> = {}) => ({
  profileId,
  state: { userId: 'u_local', profileId, checked, updatedAt: '2026-09-10T00:00:00.000Z' },
  view: { profileId, sortBy: 'weight', showKinds: [], minWeight: 0, hideDone: false, pinned: [], updatedAt: '' },
  overrides: { profileId, custom: [], hidden: [], order: [], updatedAt: '' },
});

const bundle = (patch: Record<string, unknown> = {}) => ({
  schemaVersion: '1.4.0',
  exportedAt: '2026-09-10T06:00:00.000Z',
  profiles: [profile('p_main', '大号', 1)],
  data: [row('p_main', { daily_sign: 1, daily_pet: 2 })],
  ...patch,
});

describe('validateBundle：拒绝畸形输入', () => {
  it('非对象 → 拒绝，且提示是给用户看的', () => {
    const notObj = validateBundle(null, '1.4.0');
    expect(notObj.ok).toBe(false);
    if (!notObj.ok) expect(notObj.error).toContain('不是一个 JSON 对象');
    expect(validateBundle([], '1.4.0').ok).toBe(false);
  });

  it('缺 schemaVersion / profiles 不是数组 → 拒绝', () => {
    expect(validateBundle({ profiles: [] }, '1.4.0').ok).toBe(false);
    expect(validateBundle({ schemaVersion: '1.0.0', profiles: 'x' }, '1.4.0').ok).toBe(false);
  });
});

describe('validateBundle：结构与归一化', () => {
  it('合法文件通过，并给出摘要', () => {
    const r = validateBundle(bundle(), '1.4.0');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings).toEqual([]);
    expect(r.summary).toEqual({
      profiles: 1, checked: 2, custom: 0, hidden: 0, order: 0, logDays: 0, guildTime: 0, plans: 0,
    });
  });

  /* 旧备份（2026-09-15 之前导出的）没有 log 字段 —— 那是真实情况，不该当成文件损坏 */
  it('缺 log 字段 → 归一成空日志，而不是判为不合格', () => {
    const r = validateBundle(bundle(), '1.4.0');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.bundle.data[0].log.days).toEqual({});
  });

  it('日志里的畸形条目被丢弃，合法项保留', () => {
    const r = validateBundle(
      bundle({
        data: [
          {
            ...row('p_main', { daily_sign: 1 }),
            log: {
              profileId: 'p_main',
              userId: 'u_local',
              days: { '2026-09-10': ['a', 'a', 42, null], 'not-a-day': ['b'], '2026-13-40': ['c'] },
              updatedAt: '',
            },
          },
        ],
      }),
      '1.4.0',
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    /* 去重 + 丢弃非字符串项 */
    expect(r.bundle.data[0].log.days['2026-09-10']).toEqual(['a']);
    /* 键只做形状校验（`YYYY-MM-DD`），不校验日历合法性 —— 保持这一层是纯形状归一化 */
    expect(r.bundle.data[0].log.days['not-a-day']).toBeUndefined();
    expect(r.bundle.data[0].log.days['2026-13-40']).toEqual(['c']);
  });

  it('不同 schemaVersion 通过但**必须警告**（不能静默让用户以为没问题）', () => {
    const r = validateBundle(bundle({ schemaVersion: '1.2.0' }), '1.4.0');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings[0]).toContain('1.2.0');
    expect(r.warnings[0]).toContain('1.4.0');
  });

  it('缺 id/userId 的账号行被跳过并警告', () => {
    const r = validateBundle(bundle({ profiles: [profile('p_main', '大号', 1), { name: '没有 id 的坏行' }] }), '1.4.0');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.bundle.profiles).toHaveLength(1);
    expect(r.warnings.some((w) => w.includes('缺少 id/userId'))).toBe(true);
  });

  it('勾选记录里的非数字值被丢弃（畸形数据不进分片）', () => {
    const dirty = bundle({
      data: [{ ...row('p_main'), state: { userId: 'u_local', profileId: 'p_main', checked: { ok: 1, bad: 'oops', alsoBad: null, nan: Number.NaN }, updatedAt: '' } }],
    });
    const r = validateBundle(dirty, '1.4.0');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.bundle.data[0].state.checked).toEqual({ ok: 1 });
  });

  it('对不上账号的数据行被跳过并警告', () => {
    const r = validateBundle(bundle({ data: [row('p_main'), row('p_ghost')] }), '1.4.0');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.bundle.data.map((d) => d.profileId)).toEqual(['p_main']);
    expect(r.warnings.some((w) => w.includes('对不上'))).toBe(true);
  });

  it('**所有**数据行都对不上 → 拒绝（文件多半已损坏）', () => {
    const r = validateBundle(bundle({ data: [row('p_ghost')] }), '1.4.0');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('损坏');
  });

  it('空账号列表通过但给出提醒（导入后什么都不会变）', () => {
    const r = validateBundle(bundle({ profiles: [], data: [] }), '1.4.0');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings.some((w) => w.includes('没有任何账号'))).toBe(true);
  });

  it('归一化只保留已知字段（不留 schemaVersion 之外的野字段）', () => {
    const r = validateBundle({ ...bundle(), 恶意字段: { a: 1 } }, '1.4.0');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Object.keys(r.bundle).sort()).toEqual(['data', 'exportedAt', 'profiles', 'schemaVersion']);
  });

  it('时间戳只透传、不发明（领域层保持纯函数）', () => {
    const r = validateBundle(bundle(), '1.4.0');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.bundle.data[0].state.updatedAt).toBe('2026-09-10T00:00:00.000Z');
    /* 缺 updatedAt 时留空串，由写入方（mock 的 shard 保存）自己盖时间 */
    const noStamp = validateBundle(bundle({ data: [{ ...row('p_main'), state: { userId: 'u', profileId: 'p_main', checked: { a: 1 } } }] }), '1.4.0');
    expect(noStamp.ok).toBe(true);
    if (noStamp.ok) expect(noStamp.bundle.data[0].state.updatedAt).toBe('');
  });
});

describe('summarize', () => {
  it('跨账号求和', () => {
    const b = bundle({
      profiles: [profile('a', 'A', 1), profile('b', 'B', 2)],
      data: [
        row('a', { x: 1, y: 2 }),
        { ...row('b', { z: 3 }), overrides: { profileId: 'b', custom: [{ id: 'c1' }], hidden: ['h1'], order: ['o1'], updatedAt: '' } },
      ],
    });
    expect(summarize(b as unknown as UserDataBundle)).toEqual({
      profiles: 2, checked: 3, custom: 1, hidden: 1, order: 1, logDays: 0, guildTime: 0, plans: 0,
    });
  });

  it('空 bundle 不抛错', () => {
    const b = bundle({ profiles: [], data: [] });
    expect(summarize(b as unknown as UserDataBundle)).toEqual({
      profiles: 0, checked: 0, custom: 0, hidden: 0, order: 0, logDays: 0, guildTime: 0, plans: 0,
    });
  });

  /* 勾选日志（2026-09-15 纳入备份）：天数进摘要 —— 用户靠它判断"这份备份里带了多少历史" */
  it('统计勾选日志覆盖的天数', () => {
    const withLog = bundle({
      profiles: [profile('p_main', '大号', 1), profile('p_x', '小号', 2)],
      data: [
        {
          ...row('p_main', { daily_sign: 1 }),
          log: {
            profileId: 'p_main',
            userId: 'u_local',
            days: { '2026-09-09': ['a'], '2026-09-10': ['a', 'b'] },
            updatedAt: '',
          },
        },
        row('p_x', {}),
      ],
    });
    expect(summarize(withLog as unknown as UserDataBundle).logDays).toBe(2);
  });

  /* 寮时间与寄养任务（2026-09-16 纳入备份）：此前它们是设备级、根本不进备份，
     导致"清理浏览器数据后导入"会**永久丢失** —— 清 localStorage 时设备级键一起没了，
     而备份里没有副本。这一组用例锁住"从 bundle 进摘要 / 进出参"这条链路。 */
  it('统计寮时间条数与寄养任务数', () => {
    const withExtras = bundle({
      data: [
        {
          ...row('p_main', { x: 1 }),
          guildTime: { daily_daoguan: '20:00', weekly_banquet: '20:30' },
          plans: [{ id: 'n_1', base: '08:00', hours: 12, delay: 5, started: true, createdAt: 1 }],
        },
      ],
    });
    const s = summarize(withExtras as unknown as UserDataBundle);
    expect(s.guildTime).toBe(2);
    expect(s.plans).toBe(1);
  });

  it('寮时间 / 寄养记录的归一化：畸形项被丢弃（宁可少几条，也不能让坏数据进递推）', () => {
    const raw = bundle({
      data: [
        {
          ...row('p_main', { x: 1 }),
          guildTime: { daily_daoguan: '20:00', daily_bad: '25:00', daily_num: 42 },
          plans: [
            { id: 'n_ok', base: '08:00', hours: 12, delay: 5, started: true, createdAt: 1, dones: { 1: 100, 0: 5 } },
            { id: 'n_bad_base', base: '99:99', hours: 6, delay: 0, started: true, createdAt: 1 },
            { id: 'n_bad_hours', base: '08:00', hours: 99, delay: 0, started: true, createdAt: 1 },
            /* 延迟缺失 → 按 0 处理（不丢整条）；离谱 → 夹紧 */
            { id: 'n_no_delay', base: '08:00', hours: 12, started: true, createdAt: 1 },
            { nope: true },
          ],
        },
      ],
    });
    const r = validateBundle(raw, '1.4.0');
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.bundle.data[0].guildTime).toEqual({ daily_daoguan: '20:00' });
    expect(r.bundle.data[0].plans.map((p) => p.id)).toEqual(['n_ok', 'n_no_delay']);
    expect(r.bundle.data[0].plans[0].delay).toBe(5);
    /* 缺失的 `delay` 归一成 0，而不是把整条记录丢掉 */
    expect(r.bundle.data[0].plans[1].delay).toBe(0);
    /* 点序号 0（上卡点）不是合法的完成记录键：上卡点天然已完成，不接受单独记录 */
    expect(r.bundle.data[0].plans[0].dones).toEqual({ 1: 100 });
  });

  it('旧备份缺 guildTime / plans 字段 → 归一成空值，不判为文件损坏', () => {
    const r = validateBundle(bundle(), '1.4.0');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.bundle.data[0].guildTime).toEqual({});
    expect(r.bundle.data[0].plans).toEqual([]);
  });
});

describe('dataFreshness', () => {
  it('今天 / N 天前', () => {
    expect(dataFreshness('2026-09-10', NOW)).toMatchObject({ days: 0, stale: false, text: '数据快照更新于 9/10（今天）' });
    expect(dataFreshness('2026-09-08', NOW)).toMatchObject({ days: 2, stale: false });
    expect(dataFreshness('2026-09-08', NOW).text).toContain('2 天前');
  });

  it('超过阈值转 stale 提示', () => {
    const old = new Date(NOW.getTime() - (STALE_DAYS + 5) * 86400000);
    const iso = `${old.getFullYear()}-${String(old.getMonth() + 1).padStart(2, '0')}-${String(old.getDate()).padStart(2, '0')}`;
    expect(dataFreshness(iso, NOW).stale).toBe(true);
    expect(dataFreshness(iso, NOW).days).toBe(STALE_DAYS + 5);
  });

  it('缺字段 / 格式非法 → 不报 stale，也不抛错', () => {
    expect(dataFreshness(undefined, NOW)).toEqual({ days: null, stale: false, text: '更新日期未知' });
    expect(dataFreshness('乱填', NOW).days).toBeNull();
  });
});

describe('serializeBundle / parseBundleText：复制粘贴的载体', () => {
  it('序列化成缩进 2 空格的 JSON，首尾可肉眼看出结构（便于发现粘贴被截断）', () => {
    const text = serializeBundle(bundle() as unknown as UserDataBundle);
    expect(text.startsWith('{\n  "schemaVersion"')).toBe(true);
    expect(text.trimEnd().endsWith('}')).toBe(true);
    expect(text.split('\n').length).toBeGreaterThan(5);
  });

  it('往返一致：序列化 → 解析 → 校验通过且摘要不变', () => {
    const text = serializeBundle(bundle() as unknown as UserDataBundle);
    const parsed = parseBundleText(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const r = validateBundle(parsed.value, '1.4.0');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.summary).toEqual({
        profiles: 1, checked: 2, custom: 0, hidden: 0, order: 0, logDays: 0, guildTime: 0, plans: 0,
      });
    }
  });

  it('空内容 / 只有空白 → 提示先粘贴', () => {
    for (const empty of ['', '   ', '\n\n']) {
      const r = parseBundleText(empty);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toContain('内容为空');
    }
  });

  it('粘贴被截断的 JSON → 给出可据以行动的原因，而不是抛 SyntaxError', () => {
    const truncated = serializeBundle(bundle() as unknown as UserDataBundle).slice(0, 60);
    const r = parseBundleText(truncated);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain('不是合法的 JSON');
      expect(r.error).toContain('粘贴不完整');
    }
  });

  it('粘错东西（超长）→ 拒绝并说明正常备份的量级', () => {
    const r = parseBundleText('x'.repeat(MAX_BUNDLE_CHARS + 1));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('粘错了');
  });

  it('合法 JSON 但不是对象时能解析出来，交给 validateBundle 拒绝', () => {
    const r = parseBundleText('123');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(validateBundle(r.value, '1.4.0').ok).toBe(false);
  });
});

describe('常量', () => {
  it('粘贴长度上限是 MB 字符量级（正常备份不到 100 KB）', () => {
    expect(MAX_BUNDLE_CHARS).toBeGreaterThanOrEqual(1024 * 1024);
  });
});

describe('与真实契约往返', () => {
  it('导出的真实 bundle 能通过校验，摘要与数据一致，且**零警告**', async () => {
    const { api } = await import('../api');
    const meta = await api.getMeta();
    const raw = await api.exportUserData({ userId: 'u_local', profileId: 'p_main' });
    const r = validateBundle(raw, meta.version);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings).toEqual([]);
    expect(r.summary.profiles).toBe(raw.profiles.length);
    expect(r.bundle.data).toHaveLength(raw.data.length);
  });
});
