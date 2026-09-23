/**
 * 和风图标库 —— 全站**唯一**的图标定义处（挂一次，全站 `<use>` 引用）。
 *
 * ## 为什么要自建而不是继续用 lucide
 *
 * 上一版用的是 lucide-react（26 个图标名 / ~50 处引用）。它的笔法是"几何 + 统一线宽"，
 * 与朱印语言（衬线标题、金线、符札、器物单色描边）不是同一套东西 ——
 * 混用会让画面同时出现两种"手的痕迹"。所以整体换成自绘的和风符号集，
 * 并随之移除 `lucide-react` 依赖。
 *
 * ## 绘制铁律（参考稿 §3.5，均为 17px 尺度实测得出）
 *
 *   1. `viewBox` 统一 24×24；`fill="none"`、`stroke="currentColor"`、**线宽 ≥1.5px**
 *      （1.4px 在小尺寸下会被抗锯齿磨成灰色虚线）；
 *   2. **线条总数 ≤7 条**，**内部纹理 ≤2 条** —— 超过就在 17px 下粘连成噪点；
 *   3. **砍掉所有器官与纹路细节**：认不出的就不是 icon，是噪点；
 *   4. 器物类**只做单色描边线稿，不做填充色块**（有体积感的是插画，不是图标）；
 *   5. 颜色一律 `currentColor` —— 换肤与状态着色由调用方的 `text-*` 类决定；
 *   6. 不做「方框 + 内含符号」的印章构图（参考稿铁律一）。
 *
 * 少数纯符号（五芒星 / 菱形）用 `fill="currentColor"`，因为它们的语义就是"实心印记"。
 */
export default function IconSprite() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
    >
      <defs>
        {/* ───────────── 基础符号（印记） ───────────── */}

        {/* 晴明纹 · 五芒星（描边）：主徽记 / 统计 / 设置 */}
        <symbol
          id="g-seimei"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <path d="M12,3.73 L14.46,11.12 L22.03,11.12 L15.96,18.34 L18.34,23.18 L12,18.51 L5.66,23.18 L8.04,18.34 L1.97,11.12 L9.54,11.12 Z" />
        </symbol>

        {/* 五芒星（实心）：置顶 / 稀有度 */}
        <symbol id="g-star5" viewBox="-1.2 -1.2 2.4 2.4" fill="currentColor">
          <path d="M0,-1 L0.5878,0.809 L-0.9511,-0.309 L0.9511,-0.309 L-0.5878,0.809 Z" />
        </symbol>

        {/* 菱形（实心）：进度格 / 页面标识 */}
        <symbol id="g-rhomb" viewBox="-1.2 -1.2 2.4 2.4" fill="currentColor">
          <path d="M0,-1 L0.72,0 L0,1 L-0.72,0 Z" />
        </symbol>

        {/* ───────────── 和风器物（参考稿 §3.5 原样移植） ───────────── */}

        {/* 鸟居 · 副本 / 结界 / 日常委托 */}
        <symbol
          id="g-torii"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
        >
          <path d="M2,6.2 H22" />
          <path d="M3.6,9.4 H20.4" />
          <path d="M5.4,9.4 L6.6,22" />
          <path d="M18.6,9.4 L17.4,22" />
          <path d="M12,9.6 V14.4" />
          <path d="M12,6.2 V3.4" />
        </symbol>

        {/* 御灵符（竖符纸）· 悬赏封印 / 一次性 */}
        <symbol
          id="g-ofuda"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <path d="M7.4,2.4 H16.6 V20.4 L12,24.2 L7.4,20.4 Z" />
          <path d="M12,6.4 V17.6" />
          <path d="M8.6,9.4 H15.4" />
          <path d="M9.6,13.4 H14.4" />
        </symbol>

        {/* 提灯（紙灯籠）· 活动 / 限时 */}
        <symbol
          id="g-chochin"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <path d="M8.4,3.2 H15.6" />
          <path d="M9.2,5.4 H14.8 L17.4,9.4 V15.4 L14.8,19.6 H9.2 L6.6,15.4 V9.4 Z" />
          <path d="M12,3.2 V5.4" />
          <path d="M7.4,12.4 H16.6" />
          <path d="M12,19.6 V22.6" />
        </symbol>

        {/* 注连绳 + 纸垂 · 收束横幅 / 空状态 */}
        <symbol
          id="g-shimenawa"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <path d="M0.8,7.6 C4,10 8,5.4 12,7.6 C16,9.8 20,5.4 23.2,7.6" />
          <path d="M5.4,9.6 V15" />
          <path d="M11,10.4 V16" />
          <path d="M16.6,9.6 V15" />
          <path d="M7.6,10.4 V17" />
          <path d="M13.2,11.2 V17.8" />
          <path d="M18.8,10.4 V17" />
        </symbol>

        {/* 团扇 · 觉醒材料 */}
        <symbol
          id="g-sensu"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
        >
          <path d="M12,21.6 V11" />
          <path d="M12,21.6 C6.2,20.6 3.4,15.4 3.2,8.2" />
          <path d="M12,21.6 C17.8,20.6 20.6,15.4 20.8,8.2" />
          <path d="M3.2,8.2 C7.4,4.6 16.6,4.6 20.8,8.2" />
          <path d="M8.4,20.6 L5.4,8.2" />
          <path d="M15.6,20.6 L18.6,8.2" />
        </symbol>

        {/* 达摩（愿 | 缘）· 设置 / 完成度 */}
        <symbol
          id="g-daruma"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <path d="M12,2.4 C17,2.4 20.4,8 20.4,14.4 C20.4,19.6 16.6,22.2 12,22.2 C7.4,22.2 3.6,19.6 3.6,14.4 C3.6,8 7,2.4 12,2.4 Z" />
          <circle cx="8.9" cy="12.6" r="2.1" />
          <circle cx="15.1" cy="12.6" r="2.1" />
          <path d="M12,15.6 C11.2,16.6 11.2,18 12,18.6" />
        </symbol>

        {/* 铃（神樂鈴）· 提示 / 已完成 */}
        <symbol
          id="g-suzu"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <circle cx="12" cy="3.4" r="1.6" />
          <path d="M12,5 V6.4" />
          <path d="M6.4,15.6 C6.4,10.4 8.8,6.6 12,6.6 C15.2,6.6 17.6,10.4 17.6,15.6 Z" />
          <path d="M4.4,15.6 H19.6" />
          <path d="M12,15.8 V18.6" />
        </symbol>

        {/* 折扇（扇骨展开）· 周常 */}
        <symbol
          id="g-ougi"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
        >
          <path d="M12,22.2 V14.6" />
          <path d="M12,22.2 L5.2,18.6" />
          <path d="M12,22.2 L18.8,18.6" />
          <path d="M5.2,18.6 C3.6,12.8 6.8,6.6 12,4.2" />
          <path d="M18.8,18.6 C20.4,12.8 17.2,6.6 12,4.2" />
          <path d="M8.6,20.4 L8.2,12.6" />
          <path d="M15.4,20.4 L15.8,12.6" />
        </symbol>

        {/* ───────────── 后补符号（同一套笔法） ───────────── */}

        {/* 历札（悬签）· 本月 / 版本赛季 */}
        <symbol
          id="g-koyomi"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <path d="M12,2.6 L7.4,6.6 H16.6 Z" />
          <path d="M7.4,6.6 V20.4 A1.6,1.6 0 0 0 9,22 H15 A1.6,1.6 0 0 0 16.6,20.4 V6.6" />
          <path d="M10.4,11 H13.6" />
          <path d="M10.4,15.4 H13.6" />
        </symbol>

        {/* 金槌 · 工具 */}
        <symbol
          id="g-kanazuchi"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <path d="M7.6,5.6 H16.4 A1.6,1.6 0 0 1 18,7.2 V10.4 A1.6,1.6 0 0 1 16.4,12 H7.6 A1.6,1.6 0 0 1 6,10.4 V7.2 A1.6,1.6 0 0 1 7.6,5.6 Z" />
          <path d="M12,12 V20.8" />
          <path d="M10.6,14.8 H13.4" />
        </symbol>

        {/* 纸（文）· 备注 / 说明 */}
        <symbol
          id="g-fumi"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <path d="M6.4,3.4 H14.6 L18.2,7 V19.4 A1.6,1.6 0 0 1 16.6,21 H6.4 A1.6,1.6 0 0 1 4.8,19.4 V5 A1.6,1.6 0 0 1 6.4,3.4 Z" />
          <path d="M14.4,3.4 V7.2 H18.2" />
          <path d="M8.6,11.8 H15.4" />
          <path d="M8.6,15.6 H13.4" />
        </symbol>

        {/* 叠纸 · 多账号 / 复制 / 管理账号 */}
        <symbol
          id="g-kasane"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <path d="M8.6,6.4 H17.6 A1.4,1.4 0 0 1 19,7.8 V19.2 A1.4,1.4 0 0 1 17.6,20.6 H8.6 A1.4,1.4 0 0 1 7.2,19.2 V7.8 A1.4,1.4 0 0 1 8.6,6.4 Z" />
          <path d="M5,16.8 A1.4,1.4 0 0 1 3.6,15.4 V4.2 A1.4,1.4 0 0 1 5,2.8 H13" />
        </symbol>

        {/* 锁 · 参与条件 */}
        <symbol
          id="g-joumae"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <path d="M8.4,10.6 V7.8 A3.6,3.6 0 0 1 15.6,7.8 V10.6" />
          <path d="M6.6,10.6 H17.4 A1.4,1.4 0 0 1 18.8,12 V19 A1.4,1.4 0 0 1 17.4,20.4 H6.6 A1.4,1.4 0 0 1 5.2,19 V12 A1.4,1.4 0 0 1 6.6,10.6 Z" />
        </symbol>

        {/* 人 · 账号 / 用户 */}
        <symbol
          id="g-hito"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
        >
          <circle cx="12" cy="8.2" r="3.6" />
          <path d="M4.8,20.4 A7.2,7.2 0 0 1 19.2,20.4" />
        </symbol>

        {/* 箱 · 归档 */}
        <symbol
          id="g-hako"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <path d="M4.6,5.8 H19.4 V9.4 H4.6 Z" />
          <path d="M5.8,9.4 V19 A1.4,1.4 0 0 0 7.2,20.4 H16.8 A1.4,1.4 0 0 0 18.2,19 V9.4" />
          <path d="M10.2,13.4 H13.8" />
        </symbol>

        {/* 屑笼 · 删除 */}
        <symbol
          id="g-trash"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
        >
          <path d="M4.8,7.4 H19.2" />
          <path d="M9.4,7.4 V5.2 A1.2,1.2 0 0 1 10.6,4 H13.4 A1.2,1.2 0 0 1 14.6,5.2 V7.4" />
          <path d="M7,7.4 L8,19.6 A1.4,1.4 0 0 0 9.4,20.9 H14.6 A1.4,1.4 0 0 0 16,19.6 L17,7.4" />
        </symbol>

        {/* 笔 · 编辑 */}
        <symbol
          id="g-fude"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <path d="M4.6,19.4 L4.9,15.7 L16.2,4.4 A1.7,1.7 0 0 1 18.6,4.4 L19.6,5.4 A1.7,1.7 0 0 1 19.6,7.8 L8.3,19.1 Z" />
          <path d="M4.6,19.4 L8.3,19.1" />
          <path d="M14.6,6 L18,9.4" />
        </symbol>

        {/* 对勾 · 完成 / 选中 */}
        <symbol
          id="g-check"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <path d="M5.4,12.6 L10.2,17.4 L18.6,6.8" />
        </symbol>

        {/* 三角警示 · 危险 / 临期 */}
        <symbol
          id="g-alert"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <path d="M12,3.6 L21.2,20.2 H2.8 Z" />
          <path d="M12,9.6 V14.4" />
          <path d="M12,17.4 V17.5" />
        </symbol>

        {/* 时计 · 时间窗 / 开放时间 */}
        <symbol
          id="g-tokei"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
        >
          <circle cx="12" cy="13.2" r="7.4" />
          <path d="M12,9 V13.4 L15.2,15.4" />
          <path d="M12,3.2 V5.8" />
        </symbol>

        {/* 沙漏 · 结界寄养倒计时 */}
        <symbol
          id="g-sunabochi"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <path d="M7.4,4.4 H16.6" />
          <path d="M7.4,19.6 H16.6" />
          <path d="M8.6,4.4 V7.6 L15.4,16.4 V19.6" />
          <path d="M15.4,4.4 V7.6 L8.6,16.4 V19.6" />
        </symbol>

        {/* 卷物 · 撤销 */}
        <symbol
          id="g-undo"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <path d="M9.2,13.6 L4.6,9 L9.2,4.4" />
          <path d="M4.6,9 H15.2 A4.86,4.86 0 0 1 20.06,13.86 A4.86,4.86 0 0 1 15.2,18.72 H11.2" />
        </symbol>

        {/* 顺 / 逆时针回转 · 刷新 / 恢复默认 */}
        <symbol
          id="g-refresh"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <path d="M20.4,12 A8.4,8.4 0 1 1 12,3.6 C14.35,3.6 16.6,4.54 18.29,6.16 L20.4,8.2" />
          <path d="M20.4,3.4 V8.2 H15.6" />
        </symbol>

        <symbol
          id="g-restore"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <path d="M3.6,12 A8.4,8.4 0 1 0 12,3.6 C9.65,3.6 7.4,4.54 5.71,6.16 L3.6,8.2" />
          <path d="M3.6,3.4 V8.2 H8.4" />
        </symbol>

        {/* 双箭头 · 同步 */}
        <symbol
          id="g-sougo"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <path d="M4.6,9.2 H19.4" />
          <path d="M16.6,6.4 L19.4,9.2 L16.6,12" />
          <path d="M19.4,15 H4.6" />
          <path d="M7.4,12.2 L4.6,15 L7.4,17.8" />
        </symbol>

        {/* 放大镜 · 搜索 */}
        <symbol
          id="g-search"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
        >
          <circle cx="10.8" cy="10.8" r="6" />
          <path d="M15.4,15.4 L20.4,20.4" />
        </symbol>

        {/* 筛（三线递减）· 筛选 */}
        <symbol
          id="g-filter"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
        >
          <path d="M4.6,7.6 H19.4" />
          <path d="M7.4,12 H16.6" />
          <path d="M10.2,16.4 H13.8" />
        </symbol>

        {/* 加号 · 新增 */}
        <symbol
          id="g-plus"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
        >
          <path d="M12,5.4 V18.6" />
          <path d="M5.4,12 H18.6" />
        </symbol>

        {/* 叉 · 关闭 */}
        <symbol
          id="g-close"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
        >
          <path d="M6.4,6.4 L17.6,17.6" />
          <path d="M17.6,6.4 L6.4,17.6" />
        </symbol>

        {/* 拖柄 · 排序 */}
        <symbol id="g-grip" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9.4" cy="6.6" r="1.15" />
          <circle cx="14.6" cy="6.6" r="1.15" />
          <circle cx="9.4" cy="12" r="1.15" />
          <circle cx="14.6" cy="12" r="1.15" />
          <circle cx="9.4" cy="17.4" r="1.15" />
          <circle cx="14.6" cy="17.4" r="1.15" />
        </symbol>

        {/* 折角 · 展开折叠（三个方向） */}
        <symbol
          id="g-chevron-down"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <path d="M6.6,9.4 L12,14.8 L17.4,9.4" />
        </symbol>

        <symbol
          id="g-chevron-up"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <path d="M6.6,14.6 L12,9.2 L17.4,14.6" />
        </symbol>

        <symbol
          id="g-chevron-right"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <path d="M9.4,6.6 L14.8,12 L9.4,17.4" />
        </symbol>

        {/* 日 / 月 · 明暗主题（移动端只用图标，见 `ThemeToggle` 的 `compact`）
            日 = 圆 + 四道芒（只取四个正方向：八道芒在 14px 下会糊成一圈毛边，线条数也超限） */}
        <symbol
          id="g-sun"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
        >
          <circle cx="12" cy="12" r="4.4" />
          <path d="M12,2.6 V5" />
          <path d="M12,19 V21.4" />
          <path d="M2.6,12 H5" />
          <path d="M19,12 H21.4" />
        </symbol>

        {/* 月 = 弦月（外大弧 + 内小弧合成，单条路径）。半径取 8.2 而非 7.2：
            两端点距离 15.56，半径小于一半会被浏览器强制放大，弧线形状就不受控了 */}
        <symbol
          id="g-moon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <path d="M20.4,14.6 A9,9 0 1 1 9.4,3.6 A8.2,8.2 0 0 0 20.4,14.6 Z" />
        </symbol>
      </defs>
    </svg>
  );
}
