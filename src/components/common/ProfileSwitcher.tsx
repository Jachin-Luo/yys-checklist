import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Settings2, UserRound } from 'lucide-react';
import { aliveProfiles, useSessionStore } from '../../stores/session';
import { useUiStore } from '../../stores/ui';

/**
 * 档案切换器（设计文档 §8.3 / §6.4；替换 M1 的只读 `ProfileBadge`）。
 *
 * 顶部常驻显示当前档案 —— 用户忘记自己在哪个号就会勾错号，这是本产品最容易犯的错。
 * **已归档档案不出现在这里**（归档 = 收起来；要恢复去「我的 → 档案」）。
 */
/**
 * `direction`：下拉展开方向。默认 `down`（移动端头部在视口顶部，向下正确）；
 * 桌面侧栏把切换器放在**底部卡片**（mt-auto 顶到视口下缘），向下会溢出视口 ——
 * 而 `base.css` 的 `html,body{overflow:hidden}`（双滚动条修复）会把溢出裁掉，必须向上弹。
 */
export default function ProfileSwitcher({
  compact = false,
  direction = 'down',
}: {
  compact?: boolean;
  direction?: 'down' | 'up';
}) {
  const session = useSessionStore((s) => s.session);
  const profiles = useSessionStore((s) => s.profiles);
  const switchProfile = useSessionStore((s) => s.switchProfile);
  const setNav = useUiStore((s) => s.setNav);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  const alive = aliveProfiles(profiles);
  const current = profiles.find((p) => p.id === session?.profileId);
  const region = [current?.server, current?.channel].filter(Boolean).join(' · ');

  /* 点击外部关闭 —— 下拉不关会让"以为已经切号了"的情况发生 */
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div ref={boxRef} className="relative min-w-0">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        title={region ? `${current?.name ?? '未选择档案'} · ${region}` : current?.name}
        className="flex max-w-full cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl border border-line bg-surface px-2.5 py-1 text-sm text-ink-2 transition-colors duration-120 hover:border-ink-4"
      >
        <UserRound size={12} strokeWidth={2.2} className="flex-none text-ink-3" />
        <span className="truncate">{current?.name ?? '未选择档案'}</span>
        {!compact && region ? <span className="truncate text-ink-3">{region}</span> : null}
        <ChevronDown size={12} strokeWidth={2} className="flex-none text-ink-4" />
      </button>

      {open ? (
        /* `max-h` + 自身滚动：档案多时列表会超出视口，而「管理档案」在列表最后 —— 够不到就等于没有。
           展开方向按 `direction`：桌面侧栏底部用 up（bottom-full mb-1）+ **left-0 左对齐** ——
           触发钮距视口左缘仅约 22px，右对齐会让 224px 宽的列表向左溢出屏幕被 overflow:hidden 裁掉；
           left-0 后从触发钮左缘向右伸进主内容区，完整可见。移动端头部在视口右侧，保持 right-0 */
        <div
          role="listbox"
          className={`absolute z-40 max-h-[60vh] w-56 overflow-y-auto rounded-md border border-line bg-surface shadow-lg ${
            direction === 'up' ? 'bottom-full mb-1 left-0' : 'mt-1 right-0'
          }`}
        >
          {alive.map((p) => {
            const active = p.id === session?.profileId;
            const meta = [p.server, p.channel].filter(Boolean).join(' · ');
            return (
              <button
                key={p.id}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  setOpen(false);
                  void switchProfile(p.id);
                }}
                className={`flex w-full cursor-pointer items-center gap-2 border-b border-line-faint px-3 py-2 text-left transition-colors duration-120 last:border-0 ${
                  active ? 'bg-brand-soft' : 'hover:bg-surface-3'
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-lg text-ink">{p.name}</span>
                  <span className="block truncate text-sm text-ink-3">
                    {meta || '未填区服'}
                    {p.isDefault ? ' · 默认' : ''}
                  </span>
                </span>
                {active ? <span className="flex-none text-sm text-brand">当前</span> : null}
              </button>
            );
          })}

          {alive.length <= 1 ? (
            <p className="border-b border-line-faint px-3 py-2 text-sm leading-relaxed text-ink-3">
              只有这一个档案。可在下方「管理档案」里新建大号 / 小号。
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setNav('me');
            }}
            className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-sm text-ink-2 transition-colors duration-120 hover:bg-surface-3"
          >
            <Settings2 size={12} strokeWidth={2} />
            管理档案
          </button>
        </div>
      ) : null}
    </div>
  );
}
