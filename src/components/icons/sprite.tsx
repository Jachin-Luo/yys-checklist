/**
 * 和风图标库 —— 全站**唯一**的图标定义处（挂一次，全站 `<use>` 引用）。
 *
 * ## 2026-09-24 按参考稿重设计（`uiRef/囤囤鼠大作战_和风图标集.html`）
 *
 * 起因是 `docs/05-icon-inventory.md` 那份槽位清单里的结论：有些图形与它旁边的中文
 * 不是一回事（统计借晴明纹、设置借达摩、置顶借实心五芒星、一键日常与"工具"抢金槌）。
 * 本版原则是参考稿开头那句：**语义优先、和风其次** ——
 *
 *   - **有动作含义的槽位**（删除 / 新增 / 编辑 / 工具 / 设置）图形必须一眼读出动作，
 *     和风化在这里是有害的；
 *   - **内容语义槽位**（每日 / 每周 / 每月 / 限时 / 一次性 / 版本）才交给阴阳师器物，
 *     它们靠约定学习、不承担识别压力，但**轮廓必须彼此分得开**（14px 下也不混）。
 *
 * 相对上一版的 7 枚新增（`ema` 绘马 / `nobori` 幟 / `chart` 柱状 / `setting` 双滑杆 /
 * `makimono` 卷物 / `done` 环勾 / `pin` 图钉）、3 枚重画（`star5` `rhomb` 统一到 24 坐标系、
 * `restore` 改双环、`kanazuchi` 收细），并把 `suzu` 改派给「一键日常」。1 枚删除：
 * `sensu`（团扇，那个分区早已不存在，留着会让下一个找图的人以为它在被用）。
 *
 * ## 2026-09-24 第二轮：参考稿同日追加的「⑧ 本轮复审」
 *
 * 上一轮只重设计了"与中文对不上"的槽位，其余 44 枚沿用了原样。参考稿同日的 ⑧ 区把那 44 枚
 * **逐枚量化**：按「24 视野 + 半线宽」算包围盒（查越界）、算包围盒中心到 (12,12) 的距离（查偏心）、
 * 同尺度光栅化后两两比剪影 IoU（查撞图），最后人眼复核 —— 结论 16 枚有问题，本项目落地 **15 枚**
 * （第 16 枚 `sensu` 上一轮已删）。逐枚的「问题 → 处置」写在各 `<symbol>` 上方的注释里：
 *
 *   - **P0 · 看得出错（6 枚）**：`seimei`（画的其实是空心五角星，与 `star5` 同族剪影）、
 *     `ema` / `koyomi`（两枚的形对调了，剪影重合度 0.453）、`daruma`（读成鬼脸 / 骷髅）、
 *     `ofuda`（符尾越出 24 视野 1.05，17px 下被裁成平口 —— 全集唯一真被切掉的图）、
 *     `sensu`（已删）；
 *   - **P1 · 重心或笔画（9 枚）**：`ougi`（重心下坠 2.4，全集最重）、`chart`（下坠 2.2）、
 *     `suzu`（高悬 1.8）、`kanazuchi` / `hako` / `chochin`（下坠 0.9~1.2）、
 *     `torii`（顶部多余竖线 + 额束位置错）、`shimenawa`（波浪左右各越界 0.05）、
 *     `refresh`（环口仅 26°，与「环勾」剪影重合度 0.593 → 开到 80° 后降到 0.463）；
 *   - **P2 · 一致性打磨（1 枚）**：`kasane`（重心左偏 0.7）。
 *
 * ⚠️ 复审里有两类**被量化指标误报、经人眼复核确认无需改**，记在这里免得下次有人又去"修"：
 *   - 实心星 / 实心菱（`star5` / `rhomb`）：墨迹质心本就落在形心，它们的"点"天然顶到上缘，
 *     按包围盒判会误判为偏高；
 *   - 三角 / 鸟居 / 柱状（`alert` / `torii` / `chart`）：这类"横长笔画集中在一处"的形，
 *     质心天然偏向横画（偏移 2.4–3.0），但包围盒是居中的 —— 按质心改会把整族带歪。
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
 * 少数纯符号（五芒星 / 菱形 / 图钉的钮 / 设置滑钮）用 `fill="currentColor"`，
 * 因为它们的语义就是"实心印记"。
 */
export default function IconSprite() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
    >
      <defs>
        {/* ═══ A1 · 基础印记 ═══
            star5 / rhomb 原版用微型 viewBox（-1.2 -1.2 2.4 2.4），经 `<use>` 拟合后
            会几乎撑满容器，与其余"24 视野 + 2~3 单位留白"的符号缩放不一致 —— 本版统一。 */}

        {/* 晴明纹 · 五芒星（描边）：品牌徽记 / 全站印记源头。
            【复审重画】原画的是「空心五角星」（十顶点轮廓）—— 与 star5 属同一族剪影，
            既不晴明纹也不徽记，读者只会把它读成"实心星的描边版"；且体量 21.8×21.1 为全集最大、
            重心下坠 1.46、底缘墨迹顶到 24 视野边。本版改为一笔连星的**真·五芒星（桔梗印）**：
            五个外顶点按 144° 步进连成自交五角、圆半径 8.6 —— 与 star5 的分界从此是「线 vs 面」。 */}
        <symbol
          id="g-seimei"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <path d="M12,3.8 L17.05,19.36 L3.82,9.74 L20.18,9.74 L6.95,19.36 Z" />
        </symbol>

        {/* 实心五角星 · 稀有度（统一到 24 坐标系） */}
        <symbol id="g-star5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12,4.6 L13.66,9.71 L19.04,9.71 L14.69,12.87 L16.35,17.99 L12,14.83 L7.65,17.99 L9.31,12.87 L4.96,9.71 L10.34,9.71 Z" />
        </symbol>

        {/* 实心菱形 · 聚合卡进度格 / 明暗切换钮（统一到 24 坐标系） */}
        <symbol id="g-rhomb" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12,4.6 L17.33,12 L12,19.4 L6.67,12 Z" />
        </symbol>

        {/* 六点柄 · 拖拽排序 */}
        <symbol id="g-grip" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9.4" cy="6.8" r="1.35" />
          <circle cx="14.6" cy="6.8" r="1.35" />
          <circle cx="9.4" cy="12" r="1.35" />
          <circle cx="14.6" cy="12" r="1.35" />
          <circle cx="9.4" cy="17.2" r="1.35" />
          <circle cx="14.6" cy="17.2" r="1.35" />
        </symbol>

        {/* ═══ A2 · 周期器物（内容语义 → 和风承担）═══ */}

        {/* 绘马 · 每日 / 今日页【复审重画】五角木牌（顶脊与牌身同宽）+ 挂绳 + 菱纹 = 一日一愿。
            上一版是「宽檐 + 窄身 + 菱窗」，剪影读成"房子 / 邮筒"，与 koyomi 的重合度 0.453
            （两枚在周期组里互相冒充）。本版回到绘马本形，与历札的分界是
            「尖顶 + 挂绳 + 菱纹」vs「平顶 + 挂环 + 日期格」。 */}
        <symbol
          id="g-ema"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <path d="M12,2.8 V5.0" />
          <path d="M7,8.6 L12,5 L17,8.6 V19.8 A1.6,1.6 0 0 1 15.4,21.4 H8.6 A1.6,1.6 0 0 1 7,19.8 Z" />
          <path d="M12,12.6 L13.8,14.9 L12,17.2 L10.2,14.9 Z" />
        </symbol>

        {/* 折扇 · 每周 / 每周条目：扇骨七日一折，展开即一周。
            【复审校正】上一版枢轴在 22.2、由 4 骨 + 两条外缘曲线构成，包围盒 6.15–22.65、
            重心下坠 2.4（全集最严重），落进底栏后扇轴几乎坐到底线、比左右六位低半格。
            本版换成参考稿的扇骨画法（5 骨 + 1 大弧，枢轴 20.2、整体上移 1.6，重心回 12.8）。 */}
        <symbol
          id="g-ougi"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinecap="round"
        >
          <path d="M12,20.2 L2.5,8.9" />
          <path d="M12,20.2 L6.9,6.3" />
          <path d="M12,20.2 L12,5.4" />
          <path d="M12,20.2 L17.1,6.3" />
          <path d="M12,20.2 L21.5,8.9" />
          <path d="M2.5,8.9 A14.8,14.8 0 0 1 21.5,8.9" />
        </symbol>

        {/* 历札 · 每月 / 本月页【复审重画】挂历牌：平顶牌身 + 顶环 + 表头分割线 + 四个日期格。
            上一版是「尖顶 + 两条横线」，17px 下读成"吊牌 / 门牌"—— 而那个尖顶正是绘马该有的形
            （两枚的形当初对调了）。本版与绘马彻底分开：历札是「平顶 + 挂环 + 日期格」，
            绘马是「尖顶 + 挂绳 + 菱纹」（两者剪影重合度 0.453 → 见 ema 的注）。 */}
        <symbol
          id="g-koyomi"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <circle cx="12" cy="3.4" r="1.15" />
          <path d="M12,4.55 V6.2" />
          <path d="M5.6,6.2 H18.4 V20 A1.5,1.5 0 0 1 16.9,21.5 H7.1 A1.5,1.5 0 0 1 5.6,20 Z" />
          <path d="M5.6,9.6 H18.4" />
          <circle cx="9.4" cy="12.8" r="0.85" fill="currentColor" stroke="none" />
          <circle cx="14.6" cy="12.8" r="0.85" fill="currentColor" stroke="none" />
          <circle cx="9.4" cy="16.9" r="0.85" fill="currentColor" stroke="none" />
          <circle cx="14.6" cy="16.9" r="0.85" fill="currentColor" stroke="none" />
        </symbol>

        {/* 提灯 · 限时 / 活动：挂起即开场，节庆与活动共用。
            【复审校正】原底绳一路伸到 y=22.6（墨迹 23.45），重心下坠 0.9 ——
            与「御灵符」并排时垂穗比符尾还低；本版收短到 21.5 并整体上移 0.4（重心回 12.1）。 */}
        <symbol
          id="g-chochin"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <path d="M8.4,2.7 H15.6" />
          <path d="M9.2,4.9 H14.8 L17.4,8.9 V14.9 L14.8,19.1 H9.2 L6.6,14.9 V8.9 Z" />
          <path d="M12,2.7 V4.9" />
          <path d="M7.4,11.9 H16.6" />
          <path d="M12,19.1 V21.5" />
        </symbol>

        {/* 御灵符 · 一次性 / 页边封印：贴一次即封印，不做第二次。
            【复审修缺】原符尾尖端落在 y=24.2 —— **已越出 24 视野**，加上 1.7 线宽后墨迹到 25.05，
            17px 下尖端被裁成平口（全集唯一一枚真被切掉的图）。本版收短符身到 21.6 并整体上移，
            墨迹 1.35–22.45、重心回 11.9。 */}
        <symbol
          id="g-ofuda"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <path d="M7.7,2.2 H16.3 V18.6 L12,21.6 L7.7,18.6 Z" />
          <path d="M12,6 V17" />
          <path d="M8.8,9.2 H15.2" />
          <path d="M9.8,13.2 H14.2" />
        </symbol>

        {/* 幟（のぼり）· 版本 / 赛季【新】旗杆 + 立旗 + 旗面文字。
            初版画的是御币（币柄 + 左右折纸垂），17px 下折纸与币柄挤成一束、整体读成一把伞 ——
            器物的"折叠细节"在小尺寸必糊，改取轮廓更强的立帜。 */}
        <symbol
          id="g-nobori"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <path d="M6.4,2.8 V21.2" />
          <path d="M6.4,5 H18.6 V13.4 H6.4" />
          <path d="M10,9.2 H15.2" />
        </symbol>

        {/* ═══ A3 · 页面导航 ═══ */}

        {/* 柱状 · 统计【新】三柱 + 基线：唯一语义，不再借晴明纹（那是品牌徽记本身）。
            【复审校正】原基线 y=19.8、最高柱只到 8.6（包围盒 7.75–20.65、重心下坠 2.2）——
            导航七位并排时明显比左右低半格；本版抬高基线到 19、最高柱到 5.4（重心回 12.2）。 */}
        <symbol
          id="g-chart"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinecap="round"
        >
          <path d="M4.4,19 H19.6" />
          <path d="M7.8,19 V12.2" />
          <path d="M12,19 V5.4" />
          <path d="M16.2,19 V9.2" />
        </symbol>

        {/* 金槌 · 工具（从此只表"工具"，不再兼"一键日常" —— 那一处改派给 suzu）。
            【复审校正】原包围盒 4.95–21.45、重心下坠 1.2 —— 与「设置」并排时锤头浮在上面、
            柄端压到底线；本版整体上移 1.2（锤头上沿 4.6、柄端 19.4，重心回 12）。 */}
        <symbol
          id="g-kanazuchi"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <path d="M7.4,4.6 H16.6 A1.8,1.8 0 0 1 18.4,6.4 V9 A1.8,1.8 0 0 1 16.6,10.8 H7.4 A1.8,1.8 0 0 1 5.6,9 V6.4 A1.8,1.8 0 0 1 7.4,4.6 Z" />
          <path d="M12,10.8 V19.4" />
        </symbol>

        {/* 双滑杆 · 设置【新】两轨两钮。
            为何不用齿轮：齿形在 17px 下会糊成一圈噪点（违反铁律二），滑轨的线 + 实心钮
            在小尺寸下边界依然干净，是"设置"在 17px 内唯一读得出来的画法。 */}
        <symbol
          id="g-setting"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinecap="round"
        >
          <path d="M7.4,5.4 V18.6" />
          <path d="M16.6,5.4 V18.6" />
          <path
            d="M5.5,7.9 H9.3 A1.7,1.7 0 0 1 9.3,11.3 H5.5 A1.7,1.7 0 0 1 5.5,7.9 Z"
            fill="currentColor"
            stroke="none"
          />
          <path
            d="M14.7,12.7 H18.5 A1.7,1.7 0 0 1 18.5,16.1 H14.7 A1.7,1.7 0 0 1 14.7,12.7 Z"
            fill="currentColor"
            stroke="none"
          />
        </symbol>

        {/* ═══ B1 · 字段（条目内的小标记）═══ */}

        {/* 鸟居 · 入口 path。
            本版**收敛为单一含义**：今日页已改由绘马承担，空态大图仍用它（一座无人通过的入口）。
            【复审校正】原顶笠木之上多出一根竖线（`M12,6.2 V3.4`）—— 17px 下读成"旗杆 / 天线"；
            且额束画在贯的下方，而真实鸟居的额束在岛木与贯之间。本版去掉顶竖线、把额束移回
            两梁之间，并整体上移 0.6（原包围盒下坠 0.7）。 */}
        <symbol
          id="g-torii"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinecap="round"
        >
          <path d="M2.4,4.4 H21.6" />
          <path d="M4,7.6 H20" />
          <path d="M5.6,7.6 L6.8,19.6" />
          <path d="M18.4,7.6 L17.2,19.6" />
          <path d="M12,4.4 V7.6" />
        </symbol>

        {/* 锁 · 条件 condition：未达条件不得参与 */}
        <symbol
          id="g-joumae"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <path d="M8.4,10.6 V7.8 A3.6,3.6 0 0 1 15.6,7.8 V10.6" />
          <path d="M6.6,10.6 H17.4 A1.4,1.4 0 0 1 18.8,12 V19 A1.4,1.4 0 0 1 17.4,20.4 H6.6 A1.4,1.4 0 0 1 5.2,19 V12 A1.4,1.4 0 0 1 6.6,10.6 Z" />
        </symbol>

        {/* 折角纸 · 备注 note：一页附注 */}
        <symbol
          id="g-fumi"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <path d="M6.4,3.4 H14.6 L18.2,7 V19.4 A1.6,1.6 0 0 1 16.6,21 H6.4 A1.6,1.6 0 0 1 4.8,19.4 V5 A1.6,1.6 0 0 1 6.4,3.4 Z" />
          <path d="M14.4,3.4 V7.2 H18.2" />
          <path d="M8.6,11.8 H15.4" />
          <path d="M8.6,15.6 H13.4" />
        </symbol>

        {/* 时计 · 时间窗 / 寮时间 */}
        <symbol
          id="g-tokei"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinecap="round"
        >
          <circle cx="12" cy="13.2" r="7.4" />
          <path d="M12,9 V13.4 L15.2,15.4" />
          <path d="M12,3.2 V5.8" />
        </symbol>

        {/* 卷物 · 数据快照 / 数据版本【新】纸身 + 左右卷轴。
            原用「纸（fumi）」，与「备注」撞图 —— 一卷为一版，故立此一枚。 */}
        <symbol
          id="g-makimono"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <path d="M9.6,6.2 H14.4 V17.8 H9.6 Z" />
          <path d="M9.6,6.2 L6.6,7.8 V16.2 L9.6,17.8" />
          <path d="M14.4,6.2 L17.4,7.8 V16.2 L14.4,17.8" />
        </symbol>

        {/* ═══ B2 · 状态 ═══ */}

        {/* 裸勾 · 即时反馈「成功 / 已保存」：说完就走 */}
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

        {/* 三角警示 · 失败 / 危险 / 临期（通用共识，保持原样） */}
        <symbol
          id="g-alert"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <path d="M12,3.6 L21.2,20.2 H2.8 Z" />
          <path d="M12,9.6 V14.4" />
          <path d="M12,17.4 V17.5" />
        </symbol>

        {/* 环勾 · 已完成【新】圆环 + 对勾 = 盖印。
            原用「铃（suzu）」，而铃是**提示**（摇铃 = 叫你注意），不是完成。
            与裸勾的分工：裸勾 = 一次性反馈；环勾 = 长期驻留的状态标记（组头 / 条目角标）。 */}
        <symbol
          id="g-done"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <circle cx="12" cy="12" r="8.2" />
          <path d="M7.9,12.3 L10.7,15.1 L16.1,9.4" />
        </symbol>

        {/* 沙漏 · 结界寄养倒计时：漏完即到期 */}
        <symbol
          id="g-sunabochi"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <path d="M7.4,4.4 H16.6" />
          <path d="M7.4,19.6 H16.6" />
          <path d="M8.6,4.4 V7.6 L15.4,16.4 V19.6" />
          <path d="M15.4,4.4 V7.6 L8.6,16.4 V19.6" />
        </symbol>

        {/* 达摩（愿 | 缘）· 全清 / 达成（语义收窄：原兼「设置」，现只表"有愿 / 愿成"）。
            【复审重画】上一版读成"鬼脸 / 骷髅"：环眼半径 2.1 过大、嘴里只剩一道小勾，
            整张脸立起来像 emoji —— 且它是全集墨量最重的一枚。本版回到不倒翁本形：
            底重顶圆的坐姿 + 两道眉 + 两只小圆眼，去掉嘴。 */}
        <symbol
          id="g-daruma"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <path d="M12,2.6 C16.2,2.6 20.2,8 20.2,14.4 C20.2,18.9 16.6,21.4 12,21.4 C7.4,21.4 3.8,18.9 3.8,14.4 C3.8,8 7.8,2.6 12,2.6 Z" />
          <path d="M7.5,10.5 C8.2,9.7 9.6,9.7 10.3,10.5" />
          <path d="M13.7,10.5 C14.4,9.7 15.8,9.7 16.5,10.5" />
          <circle cx="8.9" cy="13.4" r="1.25" />
          <circle cx="15.1" cy="13.4" r="1.25" />
        </symbol>

        {/* 图钉 · 置顶【新】圆帽 + 针 + 挡片。
            原用实心五芒星，而那本质是晴明纹的实心版 —— 置顶要的是"钉住"这个动作，不是徽记。 */}
        <symbol
          id="g-pin"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <path d="M10.3,4 H13.7 A1.7,1.7 0 0 1 13.7,7.4 H10.3 A1.7,1.7 0 0 1 10.3,4 Z" />
          <path d="M12,7.4 V20.4" />
        </symbol>

        {/* ═══ C1 · 操作（通用隐喻，维持现状；只拉开回转三兄弟）═══ */}

        {/* 昇雲箭 · 回到顶部【新 · 2026-09-24】云拱托起一支箭，箭尾刚接进云里 ——
            「从页面底部升回顶部」这件事，和风里最省字的说法就是「昇」。
            出自独立稿 `uiRef/囤囤鼠大作战_回到顶部按钮.html`（该稿把它与另外 4 个候选
            放在同一尺度上比过，按"先看 17px 还能不能认、再看像不像和风器物"定稿）。
            改这枚之前先读该稿第 ④ 节的解剖表，三条要害都在数值上：
              - **云拱是一条对称贝塞尔**，不是波浪拼贴 —— 17px 下它才是一条干净的拱，而不是三坨墨；
              - 箭羽末端 15.2 与云脊 15.5 之间留 **0.3 空隙**：箭是"坐在云上"、不是"插进云里"，
                差这 0.3，整枚的气质从「落」变回「昇」；
              - 云脚（4.8 / 19.2, 20.6）**不封口** —— 一封口就立刻读成"倒置的伞 / 碗"，
                与图标集里团扇那类"面"的图形撞车。
            bbox x 4.8–19.2 · y 3.2–20.6 · 中心 (12, 11.9)：与画布中心差 0.1，可按包围盒对齐。 */}
        <symbol
          id="g-ascend"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <path d="M12,3.2 L14.2,8.4 L12,10.6 L9.8,8.4 Z" />
          <path d="M12,10.6 V15.2" />
          <path d="M12,13.0 L9.9,15.2" />
          <path d="M12,13.0 L14.1,15.2" />
          <path d="M4.8,20.6 C4.8,17.4 8.0,15.5 12,15.5 C16.0,15.5 19.2,17.4 19.2,20.6" />
        </symbol>

        {/* 加号 · 新建 / 添加 */}
        <symbol
          id="g-plus"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinecap="round"
        >
          <path d="M12,5.4 V18.6" />
          <path d="M5.4,12 H18.6" />
        </symbol>

        {/* 屑笼 · 删除。同时接管「清空配置」（那处原来显示的是"恢复"的图，语义完全相反） */}
        <symbol
          id="g-trash"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
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
          strokeWidth={1.7}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <path d="M4.6,19.4 L4.9,15.7 L16.2,4.4 A1.7,1.7 0 0 1 18.6,4.4 L19.6,5.4 A1.7,1.7 0 0 1 19.6,7.8 L8.3,19.1 Z" />
          <path d="M4.6,19.4 L8.3,19.1" />
          <path d="M14.6,6 L18,9.4" />
        </symbol>

        {/* 箱 · 归档
            【复审校正】原包围盒 4.95–21.45、重心下坠 1.1，箱底几乎压线；
            本版整体上移 1（盖沿 4.8、箱底 19.4）。 */}
        <symbol
          id="g-hako"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <path d="M4.6,4.8 H19.4 V8.4 H4.6 Z" />
          <path d="M5.8,8.4 V18 A1.4,1.4 0 0 0 7.2,19.4 H16.8 A1.4,1.4 0 0 0 18.2,18 V8.4" />
          <path d="M10.2,12.4 H13.8" />
        </symbol>

        {/* 人 · 账号 / 用户 */}
        <symbol
          id="g-hito"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinecap="round"
        >
          <circle cx="12" cy="8.2" r="3.6" />
          <path d="M4.8,20.4 A7.2,7.2 0 0 1 19.2,20.4" />
        </symbol>

        {/* 叠纸 · 多账号 / 复制 / 管理账号
            【复审校正】两张纸并排时包围盒左 3.6 右 19.0 —— 重心左偏 0.7，
            与「账号 · 人」并排时不居中；本版整体右移 0.7，回到左右对称。 */}
        <symbol
          id="g-kasane"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <path d="M9.3,6.4 H18.3 A1.4,1.4 0 0 1 19.7,7.8 V19.2 A1.4,1.4 0 0 1 18.3,20.6 H9.3 A1.4,1.4 0 0 1 7.9,19.2 V7.8 A1.4,1.4 0 0 1 9.3,6.4 Z" />
          <path d="M5.7,16.8 A1.4,1.4 0 0 1 4.3,15.4 V4.2 A1.4,1.4 0 0 1 5.7,2.8 H13.7" />
        </symbol>

        {/* 神乐铃 · 一键日常【改派】摇铃开工 = 一次做完今日全部。
            原用「金槌」，与「工具」导航撞图 —— 锤归工具，铃归仪式。
            【复审校正】原柄头球 r=1.6 顶到 y=0.95（上方只剩 1 单位留白、下方空 4.5，高悬 1.8），
            且球过大让主干读成一串；本版收球到 r=1.45 并整体下移 0.5（重心回 11.97）。 */}
        <symbol
          id="g-suzu"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <circle cx="12" cy="5.6" r="1.45" />
          <path d="M12,7.05 V8.2" />
          <path d="M6.4,17.2 C6.4,12 8.8,8.2 12,8.2 C15.2,8.2 17.6,12 17.6,17.2 Z" />
          <path d="M4.4,17.2 H19.6" />
          <path d="M12,17.4 V19.8" />
        </symbol>

        {/* 开弧 · 撤销【重画】只留一段 U 形开弧 + 左箭头，不留任何闭环。
            三兄弟的间距就此拉开：撤销 = 开弧 / 刷新 = 单环 / 恢复 = 双环。 */}
        <symbol
          id="g-undo"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <path d="M9.2,13.6 L4.6,9 L9.2,4.4" />
          <path d="M4.6,9 H15.2 A4.86,4.86 0 0 1 20.06,13.86 A4.86,4.86 0 0 1 15.2,18.72 H11.2" />
        </symbol>

        {/* 双环 · 恢复 / 恢复默认【重画】两段弧（上、下）+ 两个折角 =「可逆」的双向回转。
            原版与「刷新」互为镜像、只在方向上不同，扫一眼分不开；现在缺口数不同（两处 vs 一处）。 */}
        <symbol
          id="g-restore"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <path d="M18.34,9.04 A7,7 0 0 0 5.66,9.04" />
          <path d="M5.66,14.96 A7,7 0 0 0 18.34,14.96" />
          <path d="M18.34,5.2 V9.04" />
          <path d="M5.66,18.8 V14.96" />
        </symbol>

        {/* 单环 · 刷新 / 重新生成（顺时针回转）。
            【复审校正】原环口只有约 26°，14px 下环体闭合成圆 —— 与「环勾 done（已完成）」
            的剪影重合度 0.593，两枚在工具区并排时会互相冒充。本版把缺口开到 **80°**
            （14px 下约 6.4px 空档）、箭头移到开口顶端顺向指出，重合度降到 0.463：
            从此「刷新」是开口 C 环、「已完成」是闭环带勾。 */}
        <symbol
          id="g-refresh"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <path d="M19.73,14.87 A8,8 0 1 1 15.38,5.55" />
          <path d="M13.98,3.13 L15.38,5.55 L12.62,6.04" />
        </symbol>

        {/* 双直箭头 · 同步 */}
        <symbol
          id="g-sougo"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
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
          strokeWidth={1.7}
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
          strokeWidth={1.7}
          strokeLinecap="round"
        >
          <path d="M4.6,7.6 H19.4" />
          <path d="M7.4,12 H16.6" />
          <path d="M10.2,16.4 H13.8" />
        </symbol>

        {/* 叉 · 关闭 / 清空输入 */}
        <symbol
          id="g-close"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinecap="round"
        >
          <path d="M6.4,6.4 L17.6,17.6" />
          <path d="M17.6,6.4 L6.4,17.6" />
        </symbol>

        {/* 折角 · 展开 / 折叠（三个方向） */}
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
          strokeWidth={1.7}
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
          strokeWidth={1.7}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <path d="M20.4,14.6 A9,9 0 1 1 9.4,3.6 A8.2,8.2 0 0 0 20.4,14.6 Z" />
        </symbol>

        {/* ═══ C2 · 装饰 ═══ */}

        {/* 注连绳 · 收束横幅（本版"启用"：此前定义后无人调用，页内一直走 ornament 的内联 SVG。
            内联那份是可变宽的横幅画法，这枚是 24 格里的单枚符号，两者用途不同） */}
        <symbol
          id="g-shimenawa"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          {/* 【复审校正】波浪原自 x=0.8 到 23.2，加 1.7 线宽后左右各越出 24 视野 0.05 ——
              横幅拉伸时两端被切；本版收进 1.4–22.6（振幅与相位不变）。 */}
          <path d="M1.4,7.6 C4.4,10.2 8.4,5 12,7.6 C15.6,10.2 19.6,5 22.6,7.6" />
          <path d="M5.4,9.6 V15" />
          <path d="M11,10.4 V16" />
          <path d="M16.6,9.6 V15" />
          <path d="M7.6,10.4 V17" />
          <path d="M13.2,11.2 V17.8" />
          <path d="M18.8,10.4 V17" />
        </symbol>

        {/* 团扇（sensu）已于本版删除：那个分区早已不存在，留着会让下一个找图的人以为它在被用 */}
      </defs>
    </svg>
  );
}
