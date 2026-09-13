import { create } from 'zustand';
import { makeNurture, type NurtureRecord } from '../domain/nurture';
import { DEVICE_KEY, read, write } from '../services/localStore';

/**
 * 结界寄养任务 / 计划（S6）。
 *
 * **设备级存储**（`yys:plans`，见 `services/localStore.ts` 的键说明）—— 不走契约、不随档案、不上后端。
 * 依据：设计文档 §3 的 7 库清单与 §5.2 契约方法都**没有**寄养表；
 * 寄养是"我手机上这台设备的操作节奏提醒"，与玩哪个号无关，因此与寮时间、通知开关同属设备级。
 *
 * 若将来后端要收这份数据，改动面是：契约加 `getPlans/savePlans` + 本文件换成 api 调用，
 * 组件不受影响（组件只见 store）。
 */
interface NurtureState {
  records: NurtureRecord[];
  hydrated: boolean;
  error: Error | null;
  /** 首次进工具页时读一次本机（懒加载，不必进首屏） */
  hydrate: () => void;
  add: (base: string, n: number, started: boolean) => void;
  /** 计划 → 任务（「开始」转正） */
  promote: (id: string) => void;
  remove: (id: string) => void;
  clearAll: () => void;
}

export const useNurtureStore = create<NurtureState>((set, get) => {
  const persist = (records: NurtureRecord[]) => {
    try {
      write(DEVICE_KEY.plans, records);
      set({ records, error: null });
    } catch (e) {
      set({ error: e as Error });
    }
  };

  return {
  records: [],
  hydrated: false,
  error: null,

  hydrate: () => {
    if (get().hydrated) return;
    set({ records: read<NurtureRecord[]>(DEVICE_KEY.plans) ?? [], hydrated: true });
  },

  add: (base, n, started) => {
    const next = [makeNurture(base, n, started, new Date()), ...get().records];
    persist(next);
  },

  promote: (id) => {
    const next = get().records.map((r) => (r.id === id ? { ...r, started: true } : r));
    persist(next);
  },

  remove: (id) => {
    const next = get().records.filter((r) => r.id !== id);
    persist(next);
  },

  clearAll: () => {
    persist([]);
  },
  };
});

/** 测试与「重置」用：清掉内存态（不动本机数据） */
export const resetNurtureMemory = (): void =>
  useNurtureStore.setState({ records: [], hydrated: false, error: null });
