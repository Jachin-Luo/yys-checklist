import { useRef, type KeyboardEvent } from 'react';
import BackToTop from '../common/BackToTop';
import NavContent from '../common/NavContent';
import NurtureBadge from '../common/NurtureBadge';
import ProfileSwitcher from '../common/ProfileSwitcher';
import ThemeToggle from '../common/ThemeToggle';
import Icon from '../icons/Icon';
import { NAV_ICON } from '../icons/navIcons';
import { Sigil, Texture } from '../ornament';
import { NAV_ITEMS, useUiStore } from '../../stores/ui';

/**
 * PC 端布局骨架 —— 2026-09-24 册页重设计（用户决议见 `uiRef/册页重设计_落地评估.md` §六）。
 *
 * **左侧常驻侧栏 → 顶部索引签**：正文拿到整幅宽度；选中签 `bg-surface` + `-mb-px`
 * 盖住顶栏的分隔线，与下方册页**相连**（签顶一道朱红短线标当前页）。
 * 结构：
 *
 *   顶栏（品牌印 + 索引签 ×7 + 右端：结界倒计时 · 账号切换 · 明暗）
 *   └ 册页（max-w-6xl 通栏单列，bg-surface，无顶边框、只圆下角 —— 相连的另一半）
 *
 * 三个按用户决议锁死的点：
 *   - **Tab 仍是 7 个**（移动端同样 7 格）——「更多」菜单不建，`NavKey` 契约不动；
 *   - **账号切换器与结界倒计时常驻顶栏右端** —— 切错号会勾错号，是全产品风险最高的
 *     操作，不收进任何菜单（参考稿顶栏没画它们，这是按决议追加的）；
 *   - **双列网格退役**：正文是通栏单册页，密度由行式账目承担（`CHECKLIST_GRID` 已改单列）。
 *
 * 细节：
 *   - 索引签支持 ←→ 键盘导航（参考稿自带）：在签之间走焦点并切页；
 *   - `useBreakpoint` 仍是唯一分流判据，本组件只在 ≥768px 渲染；
 *   - 御灵符装饰（`OfudaDeco`）随侧栏一起删除（用户决议 2）—— 页脚仪式感由
 *     各页的收束纹带承担。
 */
export default function DesktopShell() {
  const nav = useUiStore((s) => s.nav);
  const setNav = useUiStore((s) => s.setNav);
  /* 内容区的滚动容器 —— 回顶按钮监听它的 `scroll` 并由它执行回到顶部 */
  const scrollRef = useRef<HTMLElement>(null);

  /* 索引签的键盘导航：←→ 在签之间循环，焦点跟着走（参考稿 `.idx` 的 keydown 同款） */
  const onIdxKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const i = NAV_ITEMS.findIndex((n) => n.key === nav);
    const step = e.key === 'ArrowRight' ? 1 : NAV_ITEMS.length - 1;
    const next = NAV_ITEMS[(i + step) % NAV_ITEMS.length];
    setNav(next.key);
    e.currentTarget.querySelector<HTMLButtonElement>(`[data-nav="${next.key}"]`)?.focus();
  };

  return (
    <div className="flex h-full flex-col">
      {/* 顶栏：底纹铺在头里（与移动端顶栏同一手法）；索引签与册页之间只隔这条 border-b */}
      <header className="relative z-20 flex-none border-b border-line-soft bg-panel/90 backdrop-blur-sm">
        <Texture dots />
        <div className="relative z-10 mx-auto flex h-16 w-full max-w-6xl items-end gap-5 px-5">
          {/* 品牌：朱印 + 刊名（参考稿 `.masthead`） */}
          <div className="flex flex-none items-center gap-2.5 pb-2.5">
            <Sigil />
            <span className="flex flex-col leading-tight">
              <b className="font-serif text-base tracking-label text-ink">囤囤鼠大作战</b>
              <i className="not-italic text-2xs tracking-label text-ink-3">阴阳师任务账</i>
            </span>
          </div>

          {/* 索引签：选中签 bg-surface + -mb-px 盖住分隔线，与册页连成一体。
              ⚠️ 这一格必须有收缩许可（min-w-0 + overflow-x-auto，**不是 flex-none**）：
              768–1023px 时"品牌 + 7 签 + 右端三件套"放不下，它是唯一让位的元素；
              滚动条本体由 `.genso-tabs` 隐藏（theme.css，滚动能力保留）。
              `md` 档只显示图标（文字 hidden，读屏由 aria-label 承担）、`lg` 起恢复
              图标 + 文字 —— 按 7×70px 的签宽估算，这个宽度段不收文字就放得下 */}
          <nav
            role="tablist"
            aria-label="页面导航"
            onKeyDown={onIdxKeyDown}
            className="genso-tabs ml-auto flex min-w-0 items-end gap-0.5 self-end overflow-x-auto"
          >
            {NAV_ITEMS.map(({ key, label }) => {
              const active = nav === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  data-nav={key}
                  aria-selected={active}
                  aria-label={label}
                  onClick={() => setNav(key)}
                  className={`relative -mb-px flex flex-none cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-t-sm border border-b-0 px-3 pb-2.5 pt-2 text-sm transition-colors duration-150 ease-genso ${
                    active
                      ? 'border-line-soft bg-surface text-ink'
                      : 'border-transparent text-ink-3 hover:bg-surface/60 hover:text-ink'
                  }`}
                >
                  {/* 选中签的额束：签顶一道朱红短线（参考稿 `.idx button::before`） */}
                  {active ? (
                    <i className="absolute left-1/2 top-0 h-0.5 w-4.5 -translate-x-1/2 rounded-b-full bg-crimson" />
                  ) : null}
                  <Icon name={NAV_ICON[key]} size={15} className={active ? 'text-gold-hi' : ''} />
                  <span className="hidden lg:inline">{label}</span>
                </button>
              );
            })}
          </nav>

          {/* 右端：结界倒计时 · 账号切换 · 明暗（用户决议 4：常驻，不进任何菜单） */}
          <div className="flex flex-none items-center gap-2 pb-2.5">
            <NurtureBadge compact />
            <ProfileSwitcher compact />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* 册页：通栏单列（用户决议 5，双列退役）。与顶栏相连 —— 无顶边框、只圆下角；
          min-h-full 让短内容页也保持整册形态。回顶按钮锚在这一层 */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <main ref={scrollRef} className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col px-5">
            <div className="flex flex-1 flex-col rounded-b-lg border-x border-b border-line-soft bg-surface shadow-pop">
              <div className="flex-1 px-6 pb-12 pt-6 md:px-9">
                <NavContent variant="desktop" />
              </div>
            </div>
          </div>
        </main>
        <BackToTop target={scrollRef} className="bottom-7 right-7" />
      </div>
    </div>
  );
}
