/**
 * 控件配方（圆润版）—— 全站按钮 / 输入框 / 选项行 / 浮层的**唯一来源**。
 *
 * ## 为什么把类串抽到这里
 *
 * 2026-09-24 参考稿换成 `uiRef/囤囤鼠大作战_控件样式示例.html`（圆润版，28 类控件）。
 * 上一轮的教训是：同一颗"主按钮"在 40 个文件里各写一遍，参考稿一改就要改 40 处，
 * 而且必然漏掉几个（`ConfirmDialog` 与 `ProfilePickDialog` 的弹层材质就是这么漏的）。
 * 所以这一轮把参考稿的**控件规格**固化成这里的常量，组件只负责选配方、不再自己拼样式。
 *
 * ## 与参考稿的对应关系（改这里的值前请先读参考稿对应小节）
 *
 * | 本文件 | 参考稿 | 关键规格 |
 * | --- | --- | --- |
 * | `btn.pri` | §6 `.btn.pri` | 朱红渐变实心 + 暖白字 + 朱红落影；hover 抬 1px |
 * | `btn.sec` | §6 `.btn.sec` | 金描边 + 填充底 + 金字（上一轮的主按钮降为次级） |
 * | `btn.out` | §6 `.btn.out` | 卡片底 + 描边 + 卡片投影 |
 * | `btn.ghost` | §6 `.btn.ghost` | 无框，hover 才出填充底 |
 * | `btn.dan` | §6 `.btn.dan` | 朱红渐变（比 pri 浅，用于"删除存档"这类不可逆动作） |
 * | `btn.danger` | §6 的描边变体 | 细朱红描边 + 朱红字（次级危险动作，不抢注意力） |
 * | `field` | §8 `.wt` | 高 36 / 圆角 14 / 填充底；`focus-within` 出 3px 淡环 |
 * | `option` | §10 `.opt` | 选项行：填充底 + 描边，选中转 `fill-2` + 淡环 |
 * | `chip` | §10 `.chip` | 胶囊形筛选标签 |
 * | `tag` | §10 `.tag` | 小号方角标签（`rounded-xs`），给"自建 / 默认 / 只读"这类中文短标记 |
 * | `popover` | §9 `.sel-p` | 浮层：`panel-2` 底 + 强描边 + `shadow-pop` |
 * | `cardBox` | §13 `.fl` | `solid` 实体卡 / `group` 填充分组 |
 * | `badge` | §12 `.badge` | 计数徽章（等宽数字 + 胶囊） |
 *
 * ## 四条纪律
 *
 * 1. **不许在组件里另写一套按钮**。需要新形态先来这里加一档，否则参考稿再改又会漏。
 * 2. **尺寸档要能覆盖**：圆角与内缩**只在尺寸档里出现**，`base` 里一份都不放 ——
 *    否则 `base` 的 `rounded-md` 会盖掉 `sm`/`lg` 档的 `rounded-sm`/`rounded-lg`
 *    （Tailwind 生成顺序里 `rounded-md` 在后），`h-7` 的控件会顶着 14px 圆角。
 * 3. 尺寸只取 `md` / `sm` / `lg` 三档（对应参考稿 38 / 30 / 46px，在 Tailwind 的
 *    间距阶上落成 36 / 28 / 44px）。**不要**在调用点写 `h-8 px-5` 这类临时值。
 * 4. 这里是纯类串，不含任何 React —— 便于被页面、弹层共用。
 */

/** 尺寸档：所有控件共用同一套高度与圆角节奏（"留白跟着角走"落在这里） */
const size = {
  md: 'h-9 rounded-md px-4 text-sm',
  sm: 'h-7 rounded-sm px-3 text-xs',
  lg: 'h-11 rounded-lg px-6 text-lg',
} as const;

export const btn = {
  /** 骨架：只放所有按钮共有的东西（**不含圆角与内缩**，见纪律 2） */
  base: 'inline-flex flex-none cursor-pointer items-center justify-center gap-2 font-medium tracking-wide transition-all duration-220 ease-genso disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none',
  md: size.md,
  sm: size.sm,
  lg: size.lg,
  /** 主按钮：朱红渐变实心。**同一屏最多一颗**。
      2026-09-24 册页稿：渐变两端换用 `crimson-btn(-hi)`（与主题朱红分家 ——
      暗版主题朱红太亮，白字只有 2.86:1，按钮另取深一档），且不再描边 */
  pri: 'border-0 bg-gradient-to-b from-crimson-btn-hi to-crimson-btn text-on-crimson shadow-cta hover:-translate-y-px active:translate-y-0 active:scale-95',
  /** 次级按钮：金描边 + 填充底 */
  sec: 'border border-line bg-fill text-gold-hi hover:bg-fill-2 hover:text-ink',
  /** 描边按钮：卡片底（弹层里的"取消"用它） */
  out: 'border border-line bg-surface text-ink shadow-card hover:bg-surface-hi',
  /** 幽灵按钮 */
  ghost: 'text-ink-2 hover:bg-fill hover:text-ink',
  /** 不可逆动作（弹层里那颗确认）：朱红渐变，比主按钮浅一档 */
  dan: 'border-0 bg-gradient-to-b from-crimson-btn-hi to-crimson-btn text-on-crimson shadow-cta hover:-translate-y-px active:translate-y-0',
  /** 次级危险动作（列表行内的删除）：细朱红描边，不抢注意力 */
  danger: 'border border-crimson-soft text-crimson hover:bg-crimson/10',
} as const;

/** 输入框外壳（参考稿 §8：外壳持边框，内层 input 无边框，前后缀共用一条圆角边） */
export const field = {
  base: 'flex w-full items-center gap-2 border bg-fill transition-colors duration-220 ease-genso focus-within:bg-fill-2 focus-within:shadow-ring',
  md: 'h-9 rounded-md px-3.5',
  sm: 'h-8 rounded-sm px-3',
  /** 文本域：外壳不固定高度、顶对齐（参考稿 `.wt.area`） */
  area: 'items-start rounded-md px-3.5 py-3',
  /** 内层 input / textarea：无边框、透明底，占满剩余宽度 */
  input: 'min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-ink-4 focus:outline-none',
  /** 前后缀文字（单位 / 只读值） */
  affix: 'flex-none font-mono text-sm text-ink-4',
  /** 框内图标 */
  icon: 'flex-none text-ink-4',
} as const;

/**
 * 单元素输入框（册页稿 `.inp`）—— 表单行里的裸 `<input>` / `<select>` / `<textarea>`。
 *
 * 与 `field` 的分工：`field` 是「外壳 + 内层 input」的双层结构（前后缀 / 图标 / 焦点环走外壳），
 * 给弹层与搜索框用；表单行里的单个控件用这一支，不必为每个输入框多套一层 DOM。
 * 规格取册页稿 `.inp`：纸底 + 细描边 + `rounded-xs`(8px) + 13px 正文，聚焦时描边转金。
 *
 * ⚠️ 为什么要有它（2026-09-28）：此前各处表单自己拼 `rounded-sm … text-lg …
 * focus:border-gold-hi` —— 而 `rounded-sm` 现在是 **11px**、`text-lg` 是 **14.5px**，
 * 于是小方块被塞进大字与大圆角，同一排里还比旁边的按钮高一截（用户反馈"输入框感觉很奇怪"）。
 * 规格收进配方后，改一处即全站一致，也免得下一个人再凭手感拼一遍。
 */
export const input = {
  base: 'w-full rounded-xs border border-line bg-surface text-base text-ink transition-colors duration-120 placeholder:text-ink-4 focus:border-gold-line disabled:opacity-50',
  /** 常规档：与 `btn.md` 同高（`h-9` = 36px）—— 同一排里不会一高一矮 */
  md: 'h-9 px-2.5',
  /** 紧凑档：列表行内的小输入（如删除前的确认词） */
  sm: 'h-7 px-2 text-sm',
  /** 多行文本域（`.inp` 的 area 形态）：不固定高度、可纵向拉伸、内容顶对齐 */
  area: 'resize-y px-2.5 py-2 leading-relaxed',
  /** 代码 / JSON 文本块：填充底 + 等宽（备份分区用） */
  code: 'bg-surface-3 font-mono',
  /** 数值 / 日期 / 时刻：等宽，位数对齐 */
  num: 'font-mono',
} as const;

/** 筛选 chip（参考稿 §10 `.chip`：胶囊形） */
export const chip = {
  base: 'inline-flex flex-none cursor-pointer items-center gap-1.5 rounded-full border text-sm transition-colors duration-150 ease-genso',
  md: 'h-7 px-3.5',
  sm: 'h-6 px-2.5 text-xs',
  /** 未选：填充底 + 淡描边 */
  off: 'border-line bg-fill text-ink-2 hover:bg-fill-2 hover:text-ink',
  /** 选中（金） */
  on: 'border-line bg-gold-soft text-gold-hi',
  /** 选中（朱红，用于"危险 / 已过期"这类筛选） */
  onRed: 'border-crimson-soft bg-crimson/10 text-crimson',
} as const;

/** 小号文本标签（参考稿 §10 `.tag`）：中文短标记用这一支，不要用 `badge`（那是等宽数字的） */
export const tag = {
  /**
   * 规格：`h-5`（20px）+ `px-2` + `rounded-xs` + 11px 字 + 字距 .02em。
   *
   * ⚠️ 2026-09-28 之前这一档**少了高度与纵向内缩** —— 那时全站没有任何调用点
   * （「自建 / 默认 / 已改写 / 日常覆盖」这些徽章都在分区里各拼一份），
   * 于是没人发现：没有 `h-*` 也没有 `py-*` 的标签会缩成"一行字高"，比旁边的行名还矮。
   * 设置页排版统一时它第一次被真正用上，缺的这两样才暴露出来。
   *
   * 高度取 **20px** 而不是参考稿 `.tag` 的 23px（用户 2026-09-28 定）：徽章挂在条目行的行尾，
   * 比行名（14.5px）高一截会把整行顶起来 —— 取与行名同量级的一档，行高不因此变化。
   */
  base: 'inline-flex h-5 flex-none items-center gap-1 rounded-xs border px-2 text-xs tracking-wide',
  /** 中性 */
  mute: 'border-line bg-fill-2 text-ink-2',
  /** 金（自建 / 默认 / 高亮标记） */
  gold: 'border-line bg-gold-soft text-gold-hi',
  /** 朱红（日常覆盖 / 冲突标记） */
  red: 'border-crimson-soft bg-crimson/10 text-crimson',
  /** 靛蓝（进行中） */
  active: 'border-state-active/40 bg-state-active/10 text-state-active',
} as const;

/**
 * 选项行（参考稿 §10 `.opt`）：单选 / 多选的整行形态。
 *
 * 尺寸档与 `btn` / `input` 同一条纪律（圆角与内缩**只在尺寸档里**，`base` 一份都不放）——
 * 2026-09-29 加 `sm` 时才补上这层：原来内缩写在 `base` 里，浮层里的列表想要紧凑一档，
 * 就只能去和 `base` 的 `px-3.5 py-2.5` 打架，而同属性类名相撞由 Tailwind 生成顺序决胜，不能赌。
 */
export const option = {
  /** 骨架：不含圆角、内缩与描边 —— 那三样归尺寸档与状态档（见文件头纪律 2） */
  base: 'flex w-full cursor-pointer items-center gap-2.5 text-left transition-colors duration-220 ease-genso',
  /** 常规档：整行选项（账号选择这类"大点击目标"），参考稿 `.opt` 原规格 */
  md: 'rounded-md px-3.5 py-2.5',
  /**
   * 紧凑档：**浮层里的列表**（条目表单的奖励类型 18 项）。常规档一行 40px，
   * 200px 高的面板只放得下五行；这里 32px + 12px 字，同屏能看七行。
   */
  sm: 'h-8 rounded-sm px-3 text-sm',
  /**
   * 描边形态 —— 成组出现在弹层里的大行（账号选择 / 账号勾选）：行与行是**并列的卡片**，
   * 需要各自一圈框来分界，底色与描边都由行自己画。
   */
  off: 'border border-line bg-fill hover:bg-fill-2',
  on: 'border border-line bg-fill-2 shadow-ring',
  /**
   * 扁平形态 —— **浮层列表内**的行（下拉菜单）：外层浮层已经有描边、底色与阴影，
   * 行再画一圈框就是"盒子里套盒子"（用户 2026-09-29 反馈"选项外面还套了一层"）。
   * 分界改由 hover / 选中的底色承担：hover 填一档，选中转金（与 `chip.on` 同一套"选中=金"）。
   */
  flat: 'rounded-sm hover:bg-fill-2',
  flatOn: 'rounded-sm bg-gold-soft text-gold-hi',
} as const;

/** 浮层（参考稿 §9 `.sel-p` / §11 `.md-note` / `.pop-b`） */
export const popover =
  'rounded-lg border border-line bg-surface-3 p-1.5 shadow-pop animate-pop' as const;

/** 卡片 / 折叠分组外壳（参考稿 §13 `.fl`） */
export const cardBox = {
  /** 实体卡片：纯白卡片底 + 卡片投影 */
  solid: 'rounded-md bg-surface shadow-card',
  /** 折叠分组 / 内嵌块：填充底 + 描边（参考稿 `.fl` 用的就是这一支） */
  group: 'overflow-hidden rounded-lg border border-line bg-fill',
} as const;

/** 计数徽章（参考稿 §12 `.badge`：胶囊 + 等宽数字） */
export const badge = {
  base: 'inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1.5 font-mono text-2xs',
  red: 'bg-crimson text-on-crimson shadow-cta',
  gold: 'bg-gradient-to-b from-gold-hi to-gold text-on-gold',
  mute: 'bg-fill-3 text-ink-2',
} as const;

/**
 * 设置页（含全部折叠分区）的**文字阶梯** —— 2026-09-28 新增，与上面的控件配方同一条纪律：
 * **同一角色只有一条出口**，分区组件里不许再现拼 `text-sm` / `text-lg` / `text-xs`。
 *
 * ## 为什么要立它
 *
 * 设置页的文字是逐轮手写攒起来的，同一个角色漂成了好几种写法：
 *   - 「说明」：`SettingRow` 是 11px、多数分区是 12px、条目表单是 **10px**（CJK 在 10px 下笔画会糊，
 *     `uiRef/囤囤鼠大作战_UI审查意见.md` 记过一笔，项目此前已把字号整档上抬过）；
 *   - 「字段名」：卡片显示分区是衬线 13px、条目表单是正体 12px —— 同一页两张卡两种写法；
 *   - 「小节标题」一半 `ink-2` 一半 `ink-3`；「行名下沉态」两处各写一套。
 *
 * ## 口径取自哪
 *
 * `SettingRow` 2026-09-24 的那次改排（**正体 13px 半粗 + 说明 11px**）是全页最新、也覆盖最广的一套，
 * 且与参考稿的方向一致（`.sd` 说明 10.5px → 本项目抬到 11px 作地板）。
 * 折叠卡标题则保留参考稿的**衬线**（与分组头同一套语言）—— 两个形态两档是**用户 2026-09-28 定的**，
 * 不是漏改：见 `cardTitle` 的注释。
 *
 * ## ⚠️ 颜色**不烧进配方**
 *
 * 每个角色只给字号 / 字重 / 字距 / 行高，颜色由调用点补（`text-ink`、下沉态 `text-ink-3`、
 * 提示态 `text-warn` / `text-danger`…）。原因是同属性类名相撞时**由 Tailwind 的生成顺序决胜、
 * 不由 className 里的书写顺序决胜** —— 本仓库已经栽过两次（`input` 的 `w-full` 对 `w-28`、
 * `focus:border-danger` 对 `focus:border-gold-line`，两处都有注释记着）。配方里带一个颜色，
 * 调用点再补一个想覆盖它，就会得到一个"看着写对了、其实没生效"的静默失效。
 */
export const tx = {
  /**
   * **折叠卡**标题（`CollapsibleSection`）：衬线 13px + 字距放宽，与分组头（`SectionTitle`）同一套语言。
   * 色补 `text-ink`（危险卡用 `text-crimson`）。
   *
   * ⚠️ 与下面的 `settingTitle` **故意不同档**（衬线 / 正体）。2026-09-28 统一排版时曾把两者并成一档，
   * 用户否掉并明确要"衬线卡名"：折叠卡是要展开看的**分区入口**，与平铺的设置行不是同一种东西。
   * 两者仍同**层级**（都是 13px），差的是字族 —— **别再"顺手统一"它们**。
   */
  cardTitle: 'font-serif text-base tracking-card',
  /**
   * **设置行**标题（`SettingRow`，平铺的"一行一事"）：正体 13px 半粗 + 字距放宽。
   * 参考稿 `.srow .tx b` 是 sans 600 —— 设置项是操作入口不是展品（衬线留给页面题名、分组名与收益数字）。
   */
  settingTitle: 'text-base font-semibold tracking-wide',
  /**
   * 卡内小节标题（「效果预览」「已隐藏 · 3 条」）、表单字段名、只读键值表的键。
   * 12px 中粗 + 字距放宽；色通常 `text-ink-2`（只读键值表的键压一档也行，但**字号字重必须走这里**）。
   */
  label: 'text-sm font-medium tracking-wide',
  /**
   * 卡内列表行名（条目 / 账号 / 可勾选项 / 字段名）。**13px**；
   * 色 `text-ink`，**下线态**（已隐藏 / 已归档 / 关掉的字段）降一档 `text-ink-3`。
   *
   * ⚠️ 2026-09-28 由 14.5px（`text-lg`）降到 13px，用户反馈"条目管理和一键日常覆盖中的条目文本
   * 字体怎么这么大"。降到 13px 有三个依据，不是单纯调小：
   *   - **清单卡的任务名就是 13px**（`ChecklistItem` 的 `text-base font-semibold tracking-card`，
   *     衬线半粗）—— 设置页的"行名"比真正的任务名还大，主次是反的；
   *   - 参考稿的任务名是 **13~13.5px**（`uiRef/册页重设计_落地评估.md` 的"决策点 F"里
   *     还留着"任务名要不要降到 13px"这个未决项，本页先按 13px 走）；
   *   - 与页内两个标题档（`cardTitle` / `settingTitle`）齐平，靠**字重与字族**分层
   *     （标题半粗或衬线，行名是正体常规），不必靠"更大一号"来区分。
   */
  rowName: 'text-base',
  /**
   * 说明 / 注脚 / 空态文案。11px + 行高放宽 —— 这是**中文的地板**，
   * 任何说明类文字都不许再用 `text-2xs`（10px）。色通常 `text-ink-3`。
   */
  note: 'text-xs leading-relaxed',
  /** 等宽小字（版本号 / 日期 / 时刻 / 计数）。11px；色 `text-ink-2`（弱化用 `text-ink-4`）。 */
  mono: 'font-mono text-xs',
  /**
   * 结果 / 校验提示（成功 / 警告 / 错误共用一档）。12px + 行高放宽 ——
   * 比 `note` 大一档是**故意的**：这些字要让人看见，注脚可以小、报错不行。色由调用点给。
   */
  message: 'text-sm leading-relaxed',
} as const;
