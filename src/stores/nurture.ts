import { create } from 'zustand';
import { api } from '../api';
import type { NurturePlans } from '../api/types';
import { clearPointDone, makeNurture, markPointDone, type NurtureRecord } from '../domain/nurture';
import { useSessionStore } from './session';

/**
 * 结界寄养任务 / 计划。
 *
 * ## 2026-09-16：由设备级升为账号级（用户决策）
 *
 * 原来的理由是"寄养是这台设备的操作节奏提醒、与玩哪个号无关"—— 这条站不住：
 * 结界卡的种类与时长因号而异（太鼓 / 斗鱼 / 美食卡，6h / 12h…），上卡时间自然也不同，
 * 切号后看到同一个寄养列表更像 bug。改账号级同时满足了"所有配置项均可备份"。
 *
 * 落盘键：`yys:plans:{profileId}`；读路径：首屏 `getBootstrap().plans`
 * （壳层的「下一次该收」徽章曾自己读 localStorage，现在跟着首屏一起下来）。
 *
 * ## 写入是异步的（这是本次最需要留意的变化）
 *
 * 此前直接 `write(DEVICE_KEY.plans)` 同步落盘、失败只置 `error`；现在走 `api.savePlans`，
 * 形态与 `stores/view` 一致：**乐观更新 → 失败回滚 + 置 `error`**。
 * 因此所有 action 返回 `Promise`，调用点（`NurtureSection`）不需要 await 也能用，
 * 但**不要**再把它们的返回值当作同步结果。
 */
interface NurtureState {
  records: NurtureRecord[];
  error: Error | null;
  /** 首屏 / 切号时灌入（`useBootstrap` 是唯一生产调用点） */
  applyPlans: (records: NurturePlans) => void;
  /**
   * `hours` = 结界卡持续时间（小时），`delay` = 每次收/续延迟的分钟数。
   * 收/续点数由 `domain/nurture.pointCountOf(hours, delay)` 派生（延迟会被算进去）。
   */
  add: (base: string, hours: number, delay: number, started: boolean) => Promise<void>;
  /** 计划 → 任务（「开始」转正） */
  promote: (id: string) => Promise<void>;
  /** 记某个收/续点完成（`at` 省略 = 现在）；该点之后的点按它的实际时间递推 */
  markPoint: (id: string, index: number, at?: Date) => Promise<void>;
  /** 取消某个点的完成记录（点错了 / 想重记时间） */
  clearPoint: (id: string, index: number) => Promise<void>;
  remove: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
}

/**
 * 写入序号：**只有最新一次写入的失败才允许回滚**。
 *
 * 不加它会出现"旧写的失败赶在新写之后返回，把新状态一起抹掉"：
 *   `add B`（落盘失败，150ms 后 catch）→ 立刻 `add C`（成功落盘 [C,B,A]）→
 *   B 的 catch 把内存回滚成 [A]，而磁盘已经是 [C,B,A]。
 * 结果是内存与磁盘不一致，且用户看到"刚加的那条凭空消失"。
 *
 * 整表写语义下"最后一次成功 = 落盘内容"，所以只要保证回滚不落后于最新写入即可。
 * `resetNurtureMemory`（切号）也会 ++：让上一个账号在途的失败不再回滚到新账号上。
 */
let writeSeq = 0;

export const useNurtureStore = create<NurtureState>((set, get) => {
  const persist = async (records: NurtureRecord[]) => {
    const prev = get().records;
    const mine = ++writeSeq;
    set({ records, error: null });
    const { session } = useSessionStore.getState();
    if (!session) return;
    try {
      await api.savePlans({ userId: session.userId, profileId: session.profileId }, records);
    } catch (e) {
      console.error('[nurture] 保存失败，回滚', e);
      if (mine !== writeSeq) return;
      set({ records: prev, error: e as Error });
    }
  };

  return {
    records: [],
    error: null,

    applyPlans: (records) => set({ records, error: null }),

    add: (base, hours, delay, started) =>
      persist([makeNurture(base, hours, started, new Date(), delay), ...get().records]),

    promote: (id) =>
      persist(get().records.map((r) => (r.id === id ? { ...r, started: true } : r))),

    markPoint: (id, index, at = new Date()) =>
      persist(get().records.map((r) => (r.id === id ? markPointDone(r, index, at) : r))),

    clearPoint: (id, index) =>
      persist(get().records.map((r) => (r.id === id ? clearPointDone(r, index) : r))),

    remove: (id) => persist(get().records.filter((r) => r.id !== id)),

    clearAll: () => persist([]),
  };
});

/**
 * 切号时清空内存态（由 `useBootstrap` 调用）。
 * 不清的话，新账号的首屏聚合返回前会显示**旧账号**的寄养记录，
 * 而徽章上的"下一次该收"正是最容易让人立刻行动的信息，错一帧就可能白跑一趟。
 */
export const resetNurtureMemory = (): void => {
  /* ++ 让在途写入的失败不再回滚到新账号上（见 `writeSeq` 的注释） */
  writeSeq += 1;
  useNurtureStore.setState({ records: [], error: null });
};
