import { useRef } from 'react';
import BackToTop from '../common/BackToTop';
import NavContent from '../common/NavContent';
import NurtureBadge from '../common/NurtureBadge';
import ProfileSwitcher from '../common/ProfileSwitcher';
import ThemeToggle from '../common/ThemeToggle';
import Icon from '../icons/Icon';
import { NAV_ICON } from '../icons/navIcons';
import { Sigil, Texture } from '../ornament';
import { NAV_ITEMS, useUiStore, type NavKey } from '../../stores/ui';

/**
 * 每个页签在应用栏里的**眉批**（页名下方的小字）。
 *
 * 册页稿的移动端应用栏 = 品牌印 + **页名** + 眉批（则①「页名进应用栏」：桌面题头那种
 * 大标题在掌上吃掉首屏）。眉批只放**静态定位语**，不放动态数字 —— 页内的分组头与
 * 汇总条已经各自带计数，应用栏再放一份等于同一屏说两遍；日期类信息在 `PageHead`
 * 的金券条里（它本来就按页传参）。
 */
const EYEBROW: Record<NavKey, string> = {
  today: '每日自查',
  week: '每周自查',
  month: '每月自查',
  limited: '活动与版本',
  stats: '账簿 · 只记固定收益',
  tools: '结界寄养 / 御魂 / 悬赏',
  me: '观感 / 委托 / 账号 / 数据',
};

/**
 * 手机端布局骨架 —— 2026-09-24 册页重设计（用户决议见 `uiRef/册页重设计_落地评估.md` §六）。
 * 应用栏（品牌印 + 当前页名 + 眉批 + 右端三件套）→ 册页内容区（账目行）→ 底部固定 Tab ×7。
 * 只做排列：数据来自 stores，业务规则在 domain。
 *
 * 与上一版的差异：
 *   - **页名进应用栏**（则①）：应用栏只占 56px，正文首屏多出两条账目；页内的大题头
 *     由 `PageHead` 在移动端退化为金券条/筛选行（见该组件）；
 *   - **账号切换与结界倒计时常驻右上角**（用户决议 4）—— 切错号会勾错号，不收进任何菜单；
 *   - **Tab 仍是 7 格**（用户决议 3）——「更多」菜单不建，`NavKey` 契约不动；
 *   - 内容区底色 = 册页 + 菱形网格纹，账目行直接铺在上面，不再一条一张卡。
 *
 * 保留的既有决策与修复（勿回退）：
 *   1. `safe-top` / `safe-x` / `safe-bottom`：`viewport-fit=cover` 下必须自己让开刘海与指示条；
 *   2. 底部 Tab 的点击热区给到按钮本身（`py` 加在按钮上）；
 *   3. 视口高度用 `dvh`（见 `styles/base.css`），地址栏伸缩时底栏不被推出可视区；
 *   4. 导航位置保持底部、选中签的额束朱线留在签顶（2026-09-23 用户决策）。
 */
export default function MobileShell() {
  const nav = useUiStore((s) => s.nav);
  const setNav = useUiStore((s) => s.setNav);
  /* 内容区的滚动容器 —— 回顶按钮监听它的 `scroll` 并由它执行回到顶部 */
  const scrollRef = useRef<HTMLElement>(null);

  return (
    <div className="flex h-full flex-col">
      {/* ⚠️ 这里不能有 `overflow-hidden`：顶栏里的 `ProfileSwitcher` 下拉（absolute）会被裁掉。
          应用栏收成 54px 单行（则①）：品牌印 + **当前页名** + 眉批；右端三件套按用户决议 4
          常驻 —— 结界倒计时 · 账号切换 · 明暗（切错号会勾错号，不收进任何菜单）。
          排布把更窄的倒计时放在最左，避免账号切换器被挤到换行 */}
      <header className="safe-top safe-x relative z-20 flex-none border-b border-line-soft bg-panel/90 backdrop-blur-sm">
        <Texture dots />
        <div className="relative z-10 flex h-14 items-center gap-2.5">
          <Sigil className="h-7 w-7 flex-none text-sm" />
          <span className="flex min-w-0 flex-1 flex-col leading-tight">
            <b className="truncate font-serif text-base tracking-label text-ink">
              {NAV_ITEMS.find((n) => n.key === nav)?.label ?? NAV_ITEMS[0].label}
            </b>
            <i className="truncate not-italic text-2xs tracking-label text-ink-3">{EYEBROW[nav]}</i>
          </span>
          {/* 没有待收/待续的点时组件自己返回 null，右侧自然留空，不占位 */}
          <NurtureBadge compact />
          <ProfileSwitcher compact />
          <ThemeToggle compact />
        </div>
      </header>

      {/* 内容区 + 回顶按钮。**回顶按钮锚在这一层**（`relative`），不是 `fixed` 到视口：
          它的"底"就是底栏的顶（`bottom-2` = 比底栏高 8px，参考稿集成场景里量过的那个值），
          于是底栏高度、iOS 安全区怎么变都不用改魔数。 */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        {/* ⚠️ 用 `flex-1 min-h-0` 而不是 `h-full`：百分比高度要靠父级"已解析的高度"才成立，
            而这一层的高度是 flex 算法给的 —— 走 flex 就完全不依赖那条链路。
            `min-h-0` 是列向 flex 的收缩许可，没有它子项不肯收缩、`overflow-y-auto` 会失效 */}
        <main
          ref={scrollRef}
          className="genso-texture min-h-0 flex-1 overflow-y-auto bg-surface"
        >
          <NavContent variant="mobile" />
        </main>
        <BackToTop target={scrollRef} className="bottom-2 right-4" />
      </div>

      {/* 底部 Tab：七格（用户决议 3）。选中态 = 朱红字 + 签顶朱线（册页稿 `.tab` 同款）；
          上一版的金色底轨随册页稿退役 —— 分层改由顶/底两条细线与底纹承担 */}
      <nav className="safe-bottom grid flex-none grid-cols-7 border-t border-line-soft bg-panel/95 pt-0 backdrop-blur-sm">
        {NAV_ITEMS.map(({ key, label }) => {
          const active = nav === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setNav(key)}
              aria-current={active ? 'page' : undefined}
              className={`relative flex cursor-pointer flex-col items-center gap-1 pb-2 pt-2 text-2xs tracking-wide transition-colors duration-150 ease-genso ${
                active ? 'text-crimson-hi' : 'text-ink-3 hover:text-ink-2'
              }`}
            >
              {/* 选中签的额束朱线（2026-09-23 用户决策：导航位置与选中指示不变） */}
              {active ? (
                <i className="absolute left-1/2 top-0 h-0.5 w-5 -translate-x-1/2 rounded-b-full bg-crimson-hi" />
              ) : null}
              <Icon name={NAV_ICON[key]} size={20} className={active ? '' : 'opacity-70'} />
              {label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
