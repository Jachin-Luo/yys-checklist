import { create } from 'zustand';
import { api } from '../api';
import type { DataScope } from '../api/contract';
import { addEntry, pruneDays, removeEntrySince, type LogDays } from '../domain/checkLog';
import { mergeChecked, periodStartOf, type ResetCtx } from '../domain/reset';
import { useItemStore } from './items';
import { useSessionStore } from './session';

/**
 * 勾选状态（设计文档 §7.3 / E-02）。
 * 落盘键：`yys:state:{profileId}`（当前周期状态）+ `yys:checklog:{profileId}`（历史日志）。
 * **每次勾选走增量 `setChecked`**，不做整表 save。
 * 乐观更新：先改本地，失败回滚并提示。
 *
 * ## 为什么勾选要顺带维护日志（2026-09-15）
 *
 * `checked` 每条只保留**最近一次**勾选时间戳（周期重置靠它比对），回答不了"哪天做过什么"；
 * 统计页的日历与「近 N 天收益」要的正是后者。两者是同一动作的两个侧面，
 * 因此在这里一起乐观更新、一起落盘 —— 分开写迟早出现"勾了但日历没记"。
 */
interface CheckState {
  checked: Record<string, number>;
  /** 勾选日志（按日期分桶的历史事实；周期重置不清它） */
  log: LogDays;
  loading: boolean;
  error: Error | null;
  /**
   * 首屏 / 切号时灌入（`useBootstrap` 是唯一生产调用点）。
   * `log` 省略 = 空日志：只有测试与降级路径会省略 —— 生产路径必须带上，
   * 否则会出现"勾了但日历没记"（日志与 checked 是同一份用户数据的两个侧面）。
   */
  applyChecked: (checked: Record<string, number>, log?: LogDays) => void;
  toggle: (itemId: string) => Promise<void>;
  /** 批量乐观更新；逐条提交，仅回滚未保存项，保留已经成功的记录 */
  setMany: (ids: string[], at: number | null) => Promise<void>;
  /** 一键日常入口的双向级联：已勾 → 全部取消；未勾 → 全部勾选（同一时间戳） */
  toggleWithCascade: (hubId: string, coveredIds: string[]) => Promise<void>;
  /**
   * 跨账号勾选（清单长按，2026-09-16）：把**一组**条目同时写进若干**其他账号**。
   *
   * 收数组而不是单条，是因为一键日常入口卡要**级联**（勾入口即勾它覆盖的全部条目）。
   * 跨账号路径必须与当前账号的范围一致，否则目标账号会出现"入口已完成、被覆盖项没勾"
   * 的不一致状态 —— 那是统计口径上最难被发现的坏数据。普通条目的数组长度为 1。
   *
   * 返回**写失败的账号 id**（空数组 = 全部成功）—— 部分失败不抛出：
   * 已成功的那些不该被回滚，UI 要如实告诉用户"其中 N 个没写成功"。
   */
  toggleInProfiles: (itemIds: string[], profileIds: string[]) => Promise<string[]>;
  clearAll: () => Promise<void>;
}

interface CheckMutation {
  /** null clears the entire shard; an array changes only those items. */
  ids: string[] | null;
  at: number | null;
}

let generation = 0;
let saved: Record<string, number> = {};
let pending: CheckMutation[] = [];
let writeQueue: Promise<void> = Promise.resolve();

function resetTracking(checked: Record<string, number>): void {
  generation += 1;
  saved = checked;
  pending = [];
}

function isCurrentScope(scope: DataScope): boolean {
  const session = useSessionStore.getState().session;
  return session?.userId === scope.userId && session.profileId === scope.profileId;
}

function currentPeriod(checked: Record<string, number>): Record<string, number> {
  const { meta, items } = useItemStore.getState();
  return meta ? mergeChecked(checked, items, new Date(), meta) : checked;
}

/** 在本地 checked 上批量套用，用于乐观更新与回滚 */
function applyMany(
  prev: Record<string, number>,
  ids: readonly string[],
  at: number | null,
): Record<string, number> {
  const next = { ...prev };
  for (const id of ids) {
    if (at === null) delete next[id];
    else next[id] = at;
  }
  return next;
}

function applyMutation(
  checked: Record<string, number>,
  mutation: CheckMutation,
): Record<string, number> {
  return mutation.ids === null ? {} : applyMany(checked, mutation.ids, mutation.at);
}

/** 计算周期起点所需的上下文（与 `currentPeriod` 同一份来源） */
function resetCtx(): ResetCtx {
  const { meta } = useItemStore.getState();
  return { resetHour: meta?.resetHour ?? 0, periods: meta?.periods ?? {} };
}

/**
 * 勾选动作 → 新的日志。规则本身（幂等、周期回退、修剪）在 `domain/checkLog`，这里只做编排：
 *   - **勾选**：在完成时刻所属的那天记一条；
 *   - **取消**：按该条目的**周期起点**回退 —— "本周期未完成"不等于"历史上从没完成过"，
 *     上个月真做过的那次保留；找不到条目（已删除 / 历史 id）时退回"移除它的全部记录"；
 *   - **清空全部勾选**（`ids === null`）：日志一并清空 —— 用户按「清空勾选」时预期的是
 *     "当作没做过"，留着日历痕迹会让口径自相矛盾。
 */
function logAfter(log: LogDays, mutation: CheckMutation): LogDays {
  const now = new Date();
  if (mutation.ids === null) return {};
  const items = useItemStore.getState().items;
  let next = log;
  for (const id of mutation.ids) {
    if (mutation.at === null) {
      const item = items.find((it) => it.id === id);
      next = removeEntrySince(next, id, item ? periodStartOf(item, now, resetCtx()) : 0);
    } else {
      next = addEntry(next, id, mutation.at);
    }
  }
  return pruneDays(next, now);
}

export const useCheckStore = create<CheckState>((set, get) => {
  const persist = async (mutation: CheckMutation) => {
    const { session } = useSessionStore.getState();
    if (!session) return;
    const scope = { userId: session.userId, profileId: session.profileId };
    const startedIn = generation;
    if (!pending.length) saved = get().checked;
    pending.push(mutation);
    const nextLog = logAfter(get().log, mutation);
    set({ checked: applyMutation(get().checked, mutation), log: nextLog, error: null });

    // Preserve request order while keeping every click immediately visible.
    const run = writeQueue.then(async () => {
      const results = mutation.ids === null
        ? await Promise.allSettled([Promise.resolve().then(() => api.clearAllChecked(scope))])
        : await Promise.allSettled(
          mutation.ids.map(async (id) => api.setChecked(scope, id, mutation.at)),
        );
      if (generation !== startedIn || !isCurrentScope(scope)) return;

      let error: Error | null = null;
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          error ??= result.reason instanceof Error ? result.reason : new Error(String(result.reason));
        } else {
          saved = mutation.ids === null ? {} : applyMany(saved, [mutation.ids[index]], mutation.at);
        }
      });

      // Rebase later clicks on confirmed writes, never on a failed optimistic snapshot.
      pending = pending.filter((entry) => entry !== mutation);
      const checked = pending.reduce(applyMutation, saved);
      if (error) console.error('[check] 写入失败，回滚未保存项', error);
      set({ checked: currentPeriod(checked), ...(error ? { error } : {}) });

      /* 日志整表落盘（体积小、频率与勾选一致）。它是派生数据：
         写入失败只影响统计页日历，不影响勾选本身，因此不阻塞也不回滚 ——
         下一次勾选会把整份日志重新写一遍，自动纠偏。 */
      await api
        .saveCheckLog(scope, {
          profileId: scope.profileId,
          userId: scope.userId,
          days: nextLog,
          updatedAt: new Date().toISOString(),
        })
        .catch((e) => console.error('[check] 日志落盘失败（仅影响统计页日历）', e));
    });
    writeQueue = run.catch(() => undefined);
    await run;
  };

  return {
    checked: {},
    log: {},
    loading: false,
    error: null,

    applyChecked: (checked, log = {}) => {
      resetTracking(checked);
      set({ checked, log, error: null });
    },

    toggle: async (itemId) => {
      const prev = get().checked[itemId];
      await get().setMany([itemId], prev === undefined ? Date.now() : null);
    },

    setMany: async (ids, at) => {
      if (ids.length) await persist({ ids: [...new Set(ids)], at });
    },

    toggleWithCascade: async (hubId, coveredIds) => {
      const isOn = get().checked[hubId] !== undefined;
      await get().setMany([hubId, ...coveredIds], isOn ? null : Date.now());
    },

    /**
     * 跨账号勾选。两条路径刻意不同：
     *
     *   - **当前账号**走 `setMany`（乐观更新 + 写队列 + 日志 + 失败回滚）；
     *   - **其他账号**只写盘：它们不在内存里，写进去也不会显示（切过去时 bootstrap 会读到），
     *     所以没有"乐观"可言，逐个 await 并收集失败。
     *
     * 目标账号的**日志必须一并维护**：勾选是"当天做过这件事"的历史事实，
     * 少了它目标账号的统计页日历会缺一格、近 N 天收益会少算。
     * 这正是契约新增 `getCheckLog` 的唯一动因（日志的常规读路径 `getBootstrap`
     * 只覆盖当前账号）。取消勾选时按**条目周期起点**回退，规则与当前账号完全一致
     * （`logAfter` 用的是同两个纯函数）。
     */
    toggleInProfiles: async (itemIds, profileIds) => {
      const { session } = useSessionStore.getState();
      if (!session) return [...profileIds];
      /* 整组共用**一个**时间戳，方向由**第一个 id** 决定 —— 一键日常级联时第一个是入口，
         与 `toggleWithCascade` 的判定口径完全一致（入口未勾 → 全勾；已勾 → 全取消） */
      const at = get().checked[itemIds[0]] === undefined ? Date.now() : null;
      await get().setMany(itemIds, at);

      const failed: string[] = [];
      const others = profileIds.filter((id) => id !== session.profileId);
      for (const profileId of others) {
        const scope = { userId: session.userId, profileId };
        try {
          for (const itemId of itemIds) {
            await api.setChecked(scope, itemId, at);
          }
          /* 日志按**整组**读一次、写一次（而不是每条各读写一遍）：批量勾选时只有 2 次请求 */
          const log = await api.getCheckLog(scope);
          const now = new Date();
          const items = useItemStore.getState().items;
          let days = log.days;
          for (const itemId of itemIds) {
            const item = items.find((it) => it.id === itemId);
            days = at === null
              /* 目标账号里找不到该条目（自建条目各账号不同）时回退到 0：
                 与 `logAfter` 的兜底一致 —— 宁可多留一条历史，也不误删别的周期记录 */
              ? removeEntrySince(days, itemId, item ? periodStartOf(item, now, resetCtx()) : 0)
              : addEntry(days, itemId, at);
          }
          await api.saveCheckLog(scope, {
            ...log,
            profileId,
            userId: session.userId,
            days: pruneDays(days, now),
            updatedAt: new Date().toISOString(),
          });
        } catch (e) {
          console.error(`[check] 跨账号写入失败 profileId=${profileId}`, e);
          failed.push(profileId);
        }
      }
      return failed;
    },

    clearAll: () => persist({ ids: null, at: null }),
  };
});

/** 切号时清空内存态（由 `useBootstrap` 调用）。**这是最要命的一项**：
 *  勾选是用户最直接的操作结果，若旧账号的勾选在新账号下显示一帧，用户会以为漏记/误记。
 *  日志同理 —— 它是同一份用户数据的历史面。 */
export const resetCheckMemory = (): void => {
  resetTracking({});
  useCheckStore.setState({ checked: {}, log: {}, error: null });
};

export const isChecked = (checked: Record<string, number>, itemId: string): boolean =>
  checked[itemId] !== undefined;
