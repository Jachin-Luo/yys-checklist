import { useRef } from 'react';
import BackToTop from '../common/BackToTop';
import NavContent from '../common/NavContent';
import NurtureBadge from '../common/NurtureBadge';
import ProfileSwitcher from '../common/ProfileSwitcher';
import ThemeToggle from '../common/ThemeToggle';
import Icon from '../icons/Icon';
import { NAV_ICON } from '../icons/navIcons';
import { Texture } from '../ornament';
import { NAV_ITEMS, useUiStore } from '../../stores/ui';

/**
 * 手机端布局骨架（设计文档 §8.3）。
 * 顶部应用栏（标题 / 副标题 / 账号切换 / 结界卡倒计时） → 单列内容区 → 底部固定 Tab。
 * 只做排列：数据来自 stores，业务规则在 domain。
 *
 * 2026-09-11 三处真机问题修正（保留）：
 *   1. `safe-top` / `safe-x` / `safe-bottom`：`index.html` 开了 `viewport-fit=cover`，
 *      但此前全库零 `env(safe-area-inset-*)` —— 刘海与 Home 指示条区会压住标题行与 Tab；
 *   2. 底部 Tab 的点击热区：`button{padding:0}` 重置 + 原先 `pt-1.5/pb-2` 加在 **nav 容器**上，
 *      于是每个 Tab 的可点区域只有一行文字（约 16px 高），远低于 24px 最低标准；
 *      现在把 `py-2` 给到按钮本身（约 33px）；
 *   3. 视口高度改用 `dvh`（见 `styles/base.css`），地址栏伸缩时底部 Tab 不再被推出可视区。
 *
 * 2026-09-23 换肤（**导航位置保持不变** —— 用户决策：这几颗按钮留在底部）：
 *   把参考稿的"符纸签"横过来用 —— 底轨仍是顶部一条金线，选中签的**额束朱线移到签顶**、
 *   底部菱形节点移到签底，于是同一套造型在底部 Tab 上成立，而不必把 Tab 搬到面板顶部。
 *   另：顶栏铺底纹、标题改衬线。
 *
 * 2026-09-23 顶栏重排（用户要求，两排）：
 *   ①「徽记 + 标题「囤囤鼠」⋯ 明暗切换（纯图标）+ 账号切换」—— 明暗退成日月图标把横向空间让出来，
 *      账号切换保留文字：切错号会直接导致勾错号，是本产品最容易犯的错；
 *   ②「副标题「阴阳师任务清单」⋯ 结界卡倒计时」。
 *
 * 品牌锁定的字号层级（2026-09-23 修正）：主标题 `text-2xl`(19px) 衬线 + `tracking-title`，
 * 副标题 `text-2xs`(10px) + `tracking-label`。第一版把主标题写成 `text-lg`(14.5px)，
 * 比页面标题（`PageHead` 的 `text-xl` 16px）还小，与 12px 的副标题只差 2.5px，
 * 而副标题有六个字、主标题只有三个 —— 结果就是用户反馈的"主标题和副标题一样大"。
 * 现在主/副差 1.9 倍，且两个字号都取自全站既有声部（`tracking-title` 给主标题、
 * `tracking-label` 给标签，见 `tailwind.config.ts` 的字距说明），没有为品牌另造一级字号。
 *
 * 去掉顶栏的「今日 X 项待做」与 2px 进度轨（用户要求）：
 *   这两个是**每个页面各自都有的信息**（今日页的统计条、各页分组头的底轨），顶栏再挂一份
 *   等于同一屏里说两遍，而且顶栏那份只能看不能点。腾出的位置按用户要求放**副标题**。
 *   顶栏自此只回答"我在哪、我是谁、下一个时间点是什么"，进度一律交给页面自己 ——
 *   这也是参考稿「一屏只留一个视觉重心」的延伸。
 */
export default function MobileShell() {
  const nav = useUiStore((s) => s.nav);
  const setNav = useUiStore((s) => s.setNav);
  /* 内容区的滚动容器 —— 回顶按钮监听它的 `scroll` 并由它执行回到顶部 */
  const scrollRef = useRef<HTMLElement>(null);

  return (
    <div className="flex h-full flex-col">
      {/* ⚠️ 同 `DesktopShell` 的 aside：**这里不能有 `overflow-hidden`**，
          否则顶栏里的 `ProfileSwitcher` 下拉（absolute + 向下弹）会被裁掉。 */}
      <header className="safe-top safe-x relative flex-none border-b border-line bg-surface-3 pb-3">
        <Texture dots />
        <div className="relative z-10">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Icon name="seimei" size={16} className="flex-none text-crimson" />
              <h1 className="min-w-0 truncate font-serif text-2xl tracking-title text-ink">囤囤鼠</h1>
            </div>
            {/* 明暗切换在移动端退成纯图标（日月），把横向空间让给标题与账号切换 ——
                账号切换是本产品风险最高的控件（切错号就会勾错号），文字不能省 */}
            <ThemeToggle compact />
            <ProfileSwitcher compact />
          </div>
          {/* 副标题占据了原「今日 X 项待做」的位置（用户要求）；右侧仍是结界卡倒计时 */}
          <div className="mt-1 flex items-center justify-between gap-2">
            {/* `min-w-0`：flex 子项默认 `min-width:auto` 不肯收缩，窄屏配长徽章时会顶出容器 */}
            <p className="min-w-0 truncate text-2xs tracking-label text-ink-3">阴阳师任务清单</p>
            {/* 没有待收/待续的点时组件自己返回 null，右侧自然留空，不占位 */}
            <NurtureBadge compact />
          </div>
        </div>
      </header>

      {/* 内容区 + 回顶按钮。**回顶按钮锚在这一层**（`relative`），不是 `fixed` 到视口：
          它的"底"就是底栏的顶（`bottom-2` = 比底栏高 8px，参考稿集成场景里量过的那个值），
          于是底栏高度、iOS 安全区怎么变都不用改魔数。 */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        {/* ⚠️ 用 `flex-1 min-h-0` 而不是 `h-full`：百分比高度要靠父级"已解析的高度"才成立，
            而这一层的高度是 flex 算法给的 —— 走 flex 就完全不依赖那条链路。
            `min-h-0` 是列向 flex 的收缩许可，没有它子项不肯收缩、`overflow-y-auto` 会失效 */}
        <main ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
          <NavContent variant="mobile" />
        </main>
        <BackToTop target={scrollRef} className="bottom-2 right-4" />
      </div>

      {/* 底部 Tab：位置不变。金色底轨把七片签串在同一根轴上 */}
      <nav className="safe-bottom grid flex-none grid-cols-7 border-t border-line-soft bg-surface-3 pt-0">
        {NAV_ITEMS.map(({ key, label }) => {
          const active = nav === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setNav(key)}
              aria-current={active ? 'page' : undefined}
              className={`relative flex cursor-pointer flex-col items-center gap-1 pb-2 pt-2.5 text-2xs tracking-wide transition-colors duration-150 ease-genso ${
                active ? 'bg-surface text-gold-hi' : 'text-ink-3 hover:text-ink-2'
              }`}
            >
              {/* 选中签的额束朱线（保留：圆润版没有动"导航位置与选中指示"这条用户决策） */}
              {active ? (
                <i className="absolute left-1/2 top-0 h-0.5 w-5 -translate-x-1/2 rounded-full bg-crimson" />
              ) : null}
              <Icon name={NAV_ICON[key]} size={16} className={active ? '' : 'opacity-70'} />
              {label}
              {/* 2026-09-24 圆润版**移除了签底那颗描边小菱形**：菱形是方正语言的角饰，
                  在圆润版里没有对应物，留着只会在圆角底栏边上多出一枚孤立的尖角 */}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
