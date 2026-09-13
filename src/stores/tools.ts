import { create } from 'zustand';
import { api } from '../api';
import type { BountyDb, SoulsDb, YuhunDb } from '../api/types';

/**
 * 工具页主数据缓存（设计文档 §3.3 懒加载 / §7.3）。
 *
 * 三张表合计约 180 KB，**不进首屏主包**：`api/mock/db.ts` 用动态 `import()` 拉，
 * 只有进工具页才下载。本 store 负责"进页面时按分段要数据"，并做三件组件不该管的事：
 *
 *   1. **并发去重**：hover 预取与点击几乎同时发生，不去重就是两次网络请求
 *   2. **缓存复用**：切分段来回切不重复请求（数据是只读主数据，不会失效）
 *   3. **按需取**：御魂段要 `yuhun + souls`（卡片要显示二件套效果），悬赏段只要 `bounty`，
 *      寄养段**零请求**（纯本地数据）。不为"统一"把三张表一次性全拉。
 */
export type ToolTab = 'yuhun' | 'bounty' | 'nurture';

interface ToolsState {
  yuhun: YuhunDb | null;
  souls: SoulsDb | null;
  bounty: BountyDb | null;
  /** 正在加载的分段（null = 空闲）—— 按分段而不是布尔，免得预取把当前分段的骨架屏带出来 */
  loading: ToolTab | null;
  error: Error | null;
  /** 幂等：已有数据直接返回，加载中返回同一个 Promise */
  ensure: (tab: ToolTab) => Promise<void>;
}

/** 分段 -> 进行中的请求。放在模块级而不是 state：它不需要参与渲染 */
const inflight = new Map<ToolTab, Promise<void>>();

export const useToolsStore = create<ToolsState>((set, get) => ({
  yuhun: null,
  souls: null,
  bounty: null,
  loading: null,
  error: null,

  ensure: (tab) => {
    if (tab === 'nurture') return Promise.resolve();

    const s = get();
    const ready = tab === 'yuhun' ? Boolean(s.yuhun && s.souls) : Boolean(s.bounty);
    if (ready) return Promise.resolve();
    const running = inflight.get(tab);
    if (running) return running;

    const job = (async () => {
      set({ loading: tab, error: null });
      try {
        if (tab === 'yuhun') {
          /* 两次请求**并行**：souls 与 yuhun 无依赖关系，串行会白等一个往返 */
          const [yuhun, souls] = await Promise.all([api.getYuhun(), api.getSouls()]);
          set({ yuhun, souls });
        } else {
          set({ bounty: await api.getBounty() });
        }
      } catch (e) {
        console.error(`[tools] ${tab} 数据加载失败`, e);
        set({ error: e as Error });
      } finally {
        set({ loading: null });
        inflight.delete(tab);
      }
    })();

    inflight.set(tab, job);
    return job;
  },
}));
