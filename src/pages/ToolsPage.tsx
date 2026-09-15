import { useEffect, useState, type ReactNode } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { Skeleton } from '../components/common/EmptyState';
import { useToolsStore, type ToolTab } from '../stores/tools';
import { useUiStore } from '../stores/ui';
import BountySection from './tools/BountySection';
import NurtureSection from './tools/NurtureSection';
import YuhunSection from './tools/YuhunSection';

/**
 * 工具页（设计文档 §9 S6）：御魂 / 悬赏 / 结界寄养 三段。
 *
 * **懒加载**：三段的主数据合计约 180 KB，不在首屏主包里（`api/mock/db.ts` 用动态 `import()`）。
 * 因此进页面时先出骨架屏，数据到了再替换 —— 这是设计文档认可的"骨架屏只用于懒加载"场景。
 *
 * **预取**：分段按钮 `onMouseEnter` 就发起加载。用户从"想点"到"点下去"通常有 100ms+，
 * 这点时间刚好把一个 mock 往返盖掉，实际体感是"点了就有"。
 *
 * **按需取**：寄养段零请求（纯本地），不为"统一"把三张表一次全拉。
 */
const TABS: ReadonlyArray<{ key: ToolTab; label: string; hint: string }> = [
  { key: 'yuhun', label: '御魂', hint: '副本轮换与掉落' },
  { key: 'bounty', label: '悬赏', hint: '式神出处反查' },
  { key: 'nurture', label: '结界寄养', hint: '6h 收续点' },
];

/** 只接受三个合法分段名 —— 跳转请求来自外部，不能盲信字符串 */
const isToolTab = (v?: string): v is ToolTab => v === 'yuhun' || v === 'bounty' || v === 'nurture';

export default function ToolsPage({ variant }: { variant: 'mobile' | 'desktop' }) {
  /* 壳层带分段跳过来时（如侧栏 / 头部常驻的结界卡徽章）初始就选中它 */
  const requestedTab = useUiStore((s) =>
    s.navRequest?.nav === 'tools' ? s.navRequest.section : undefined,
  );
  const clearNavRequest = useUiStore((s) => s.clearNavRequest);
  const [tab, setTab] = useState<ToolTab>(() => (isToolTab(requestedTab) ? requestedTab : 'yuhun'));
  const ensure = useToolsStore((s) => s.ensure);
  const loading = useToolsStore((s) => s.loading);
  const error = useToolsStore((s) => s.error);
  const yuhun = useToolsStore((s) => s.yuhun);
  const souls = useToolsStore((s) => s.souls);
  const bounty = useToolsStore((s) => s.bounty);

  useEffect(() => {
    void ensure(tab);
  }, [ensure, tab]);

  /* 标记是一次性的：本页消费后立刻清空，免得下次从别处进工具页又被带过去 */
  useEffect(() => {
    if (requestedTab) clearNavRequest();
  }, [requestedTab, clearNavRequest]);

  const ready = tab === 'yuhun' ? Boolean(yuhun && souls) : tab === 'bounty' ? Boolean(bounty) : true;
  const busy = loading === tab;

  let body: ReactNode;
  if (!ready && error) {
    /* 骨架屏不能掩盖错误：mock 的错误注入（?__fail=1）与真实网络故障都要显式呈现 */
    body = (
      <div className="mx-3 mt-3 rounded-md border border-danger-line bg-danger-soft px-3 py-3">
        <p className="flex items-center gap-1.5 text-lg text-danger">
          <AlertTriangle size={13} strokeWidth={2.2} />
          工具数据加载失败
        </p>
        <p className="mt-1 text-sm leading-relaxed text-ink-2">{error.message}</p>
        <button
          type="button"
          onClick={() => void ensure(tab)}
          className="mt-2 inline-flex cursor-pointer items-center gap-1 rounded-sm border border-danger-line bg-surface px-2 py-1 text-sm text-danger transition-colors duration-120 hover:bg-danger-soft"
        >
          <RotateCw size={11} strokeWidth={2.4} />
          重试
        </button>
      </div>
    );
  } else if (!ready) {
    /* 懒加载兜底：数据没到就出骨架屏（仅此与首屏两处允许出骨架屏） */
    body = <Skeleton rows={5} />;
  } else if (tab === 'yuhun' && yuhun && souls) {
    body = <YuhunSection yuhun={yuhun} souls={souls} variant={variant} />;
  } else if (tab === 'bounty' && bounty) {
    body = <BountySection bounty={bounty} />;
  } else {
    body = <NurtureSection />;
  }

  return (
    /* `mx-auto`：桌面内容容器上限 1024，本页上限 896 —— 不居中会整体贴左（与统计 / 我的两页同一口径） */
    <div className="mx-auto max-w-4xl">
      <div className="mx-3 mt-3 flex gap-1 rounded-md bg-surface-3 p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onMouseEnter={() => void ensure(t.key)}
            onFocus={() => void ensure(t.key)}
            onClick={() => setTab(t.key)}
            title={t.hint}
            className={`flex-1 cursor-pointer rounded-sm px-2 py-1.5 text-sm transition-colors duration-120 ${
              tab === t.key ? 'bg-surface text-ink shadow-sm' : 'text-ink-2 hover:text-ink'
            }`}
          >
            {t.label}
            {/* 预取/加载中的分段显式带一个呼吸点：hover 预取时用户能看到"这个已经在拿了" */}
            {loading === t.key ? (
              <span className="ml-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-brand align-middle" />
            ) : null}
          </button>
        ))}
      </div>

      <div aria-busy={busy} className={ready ? undefined : 'min-h-48'}>
        {body}
      </div>
    </div>
  );
}
