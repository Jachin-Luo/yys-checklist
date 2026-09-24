/**
 * 账号间配置同步 —— 纯函数，无 IO（分层铁律见设计文档 §2）。
 *
 * ## 为什么需要它（2026-09-16 用户需求）
 *
 * 多个游戏账号往往共享同一批配置：同一个寮的时间点、同样的寄养节奏、
 * 同样的"玩不玩一键日常"偏好、同样的自建条目。每开一个号都重配一遍是纯浪费。
 *
 * 设置页提供「同步到其他账号」，由用户自己决定**同步哪些内容**、**同步给哪些账号**
 * —— 不自动、不全量，避免"我以为只改了 A，结果 B 也被改了"。
 *
 * ## 本文件只管三件事（不碰 IO）
 *
 *   1. 定义可同步的**内容清单**（`SYNC_PARTS`）—— 数组顺序即 UI 展示顺序；
 *   2. 给出「把 source 的某几项盖到 target 上」的**合并规则**（`applyParts`）；
 *   3. 说明**为什么勾选状态不在清单里**（见文件末尾）。
 *
 * 真正读目标账号、写目标账号的编排在 `services/profileSync`。
 */
import type { GuildTimePrefs, ItemOverrides, NurturePlans, ViewPrefs } from '../api/types';

export type SyncPartKey =
  | 'guildTime'
  | 'plans'
  | 'autoDaily'
  | 'customItems'
  | 'hidden'
  | 'viewPrefs';

export interface SyncPart {
  key: SyncPartKey;
  label: string;
  /** 一句话说明"同步这一项会发生什么"，出现在设置页的复选框下方 */
  desc: string;
  /** 默认是否勾选。只把「多号几乎必定相同」的两项设成默认，其余交给用户主动选择 */
  byDefault: boolean;
}

/**
 * 可同步内容清单。数组顺序 = 设置页展示顺序。
 *
 * 默认勾选的只有前两项：寮时间（同一个寮，最典型）与寄养任务（两号节奏相同时一键铺开）。
 * 其余默认不勾 —— 它们是"可能想同步"而不是"几乎一定相同"，
 * 默认勾上会让用户在一次盲操作里覆盖掉别的账号的个性化配置。
 */
export const SYNC_PARTS: readonly SyncPart[] = [
  {
    key: 'guildTime',
    label: '寮时间',
    desc: '道馆 / 宴会 / 退治 / 阴界等集体活动的时间。多个号在同一个寮时最常用。',
    byDefault: true,
  },
  {
    key: 'plans',
    label: '结界寄养任务',
    desc: '把当前账号的寄养任务 / 计划整表复制过去（含已记的收卡点）。两号节奏相同时省事。',
    byDefault: true,
  },
  {
    key: 'autoDaily',
    label: '一键日常覆盖',
    desc: '「哪些条目算被一键日常覆盖」以及覆盖后的显示方式（弱化 / 隐藏）。',
    byDefault: false,
  },
  {
    key: 'customItems',
    label: '自建条目与排序',
    desc: '自己新建的条目，以及清单的自定义顺序。',
    byDefault: false,
  },
  {
    key: 'hidden',
    label: '隐藏的条目',
    desc: '被你隐藏起来的预设条目清单。不同号的取舍可能不同，故默认不同步。',
    byDefault: false,
  },
  {
    key: 'viewPrefs',
    label: '清单显示偏好',
    desc: '奖励类型筛选、置顶条目与卡片信息密度。偏个人口味，故默认不同步。',
    byDefault: false,
  },
];

/** 源账号（或目标账号）在同步中可能被读写的那几份数据 */
export interface SyncSource {
  guildTime: GuildTimePrefs;
  plans: NurturePlans;
  view: ViewPrefs;
  overrides: ItemOverrides;
}

/** 要写回目标账号的补丁：**只含被勾选的项**，未勾的键不出现（调用方据此跳过写入） */
export interface SyncPatch {
  guildTime?: GuildTimePrefs;
  plans?: NurturePlans;
  view?: ViewPrefs;
  overrides?: ItemOverrides;
}

export const defaultSyncKeys = (): SyncPartKey[] =>
  SYNC_PARTS.filter((p) => p.byDefault).map((p) => p.key);

/**
 * 生成写回目标账号的补丁。
 *
 * 合并语义分两种，别混：
 *   - **整表接管**（`guildTime` / `plans`）：目标账号的该项被源账号完全替换；
 *   - **字段级接管**（`view` / `overrides`）：只替换被勾选的那几个字段，
 *     同分片内的其他字段保持目标账号自己的值。
 *
 * 第二种是关键：用户只勾「一键日常覆盖」时，目标账号的**筛选与置顶不该被动**。
 * 所以这里从 `target` 起手做浅拷贝，再把源字段盖上去，而不是直接用 `source.view`。
 *
 * 所有返回的对象都是**新对象/深一层拷贝**：同步是"把 A 铺到 B"，
 * 若把源的引用直接塞进目标，之后改源会让目标跟着变（跨账号串数据最难排查）。
 */
export function applyParts(
  source: SyncSource,
  target: SyncSource,
  keys: readonly SyncPartKey[],
): SyncPatch {
  const pick = new Set(keys);
  const patch: SyncPatch = {};

  if (pick.has('guildTime')) patch.guildTime = { ...source.guildTime };
  if (pick.has('plans')) {
    /* `dones` 是嵌套对象：只做一层浅拷贝会让补丁与原记录共享它 ——
       之后给源记完成，会"隔着补丁改到目标账号的数据"（跨账号串数据最难排查） */
    patch.plans = source.plans.map((r) => ({
      ...r,
      ...(r.dones ? { dones: { ...r.dones } } : {}),
    }));
  }

  if (pick.has('autoDaily') || pick.has('viewPrefs')) {
    const view = { ...(patch.view ?? target.view) };
    if (pick.has('autoDaily')) {
      /* `autoSet` 的 `undefined` 是有意义的取值（= 跟随数据默认），必须原样带过去，
         不能写成 `?? []` —— 那会变成"用户显式关掉了全部覆盖项"，语义完全相反 */
      view.autoSet = source.view.autoSet ? [...source.view.autoSet] : undefined;
      view.coverMode = source.view.coverMode;
    }
    if (pick.has('viewPrefs')) {
      view.showKinds = [...source.view.showKinds];
      view.pinned = [...source.view.pinned];
      /* 卡片信息密度也属于"清单显示偏好"：多号对"卡片要多详细"的偏好通常一致 */
      view.card = source.view.card ? { ...source.view.card } : undefined;
    }
    patch.view = view;
  }

  if (pick.has('customItems') || pick.has('hidden')) {
    const ov = { ...(patch.overrides ?? target.overrides) };
    if (pick.has('customItems')) {
      ov.custom = source.overrides.custom.map((it) => ({ ...it }));
      /* `order` 与 `custom` 是同一件事（"我的条目长什么样"）的两半：
         只复制条目不复制顺序，用户会看到新条目全被排到末尾 */
      ov.order = [...source.overrides.order];
    }
    if (pick.has('hidden')) ov.hidden = [...source.overrides.hidden];
    patch.overrides = ov;
  }

  return patch;
}

/** 勾选内容的中文串，用于确认弹窗正文（"将同步：寮时间、结界寄养任务"） */
export function describeKeys(keys: readonly SyncPartKey[]): string {
  const pick = new Set(keys);
  return SYNC_PARTS.filter((p) => pick.has(p.key))
    .map((p) => p.label)
    .join('、');
}

/*
 * ## 为什么「勾选状态 / 勾选日志」不在可同步清单里
 *
 * 它们是**每个号独立的进度**，不是配置 —— 同步会把另一个号的记录直接抹掉：
 *   1. `state.checked` 是整表覆盖语义，把 A 的勾选铺到 B 等于"替 B 勾了一堆没做过的事"；
 *   2. `log.days` 会污染统计页的日历与「近 N 天收益」，让 B 的历史凭空多出记录。
 * 用户按「同步到其他账号」时预期的是"省掉重复配置"，绝不包括"把进度也搬过去"。
 * 因此这一项**不提供勾选**，并在设置页写明原因，而不是做成"危险的默认不勾"。
 *
 * 如果哪天真要跨账号复制进度，正确形态是用户在清单里**长按某一条**、明确指定
 * "这条也算到那些号上"（见 `stores/check.toggleInProfiles`）——
 * 逐条、可见、可撤销，而不是一次整表覆盖。
 */
