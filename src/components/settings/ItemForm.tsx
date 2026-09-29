import { useState, type ReactNode } from 'react';
import type { Gain, Item, ItemDraft, SubItem } from '../../api/types';
import { newId } from '../../domain/ids';
import type { Cycle, GainCurrency, GainKind } from '../../domain/enums';
import { CYCLE, GAIN_CURRENCY, GAIN_KIND } from '../../domain/enums';
import { parseTs } from '../../domain/countdown';
import Icon from '../icons/Icon';
import Modal from '../common/Modal';
import { btn, chip, input, tx } from '../common/controls';

/**
 * 条目表单（**新建 / 编辑共用一份**），以**弹层**形态出现（2026-09-28）。
 *
 * ## 为什么是弹层而不是常驻表单
 *
 * 原先"新建"常驻在列表顶部、"编辑"长在那一行上：两者都占着版面，而「条目管理」这一页
 * 的主用途是调顺序 / 增删 / 找东西 —— 表单只在真要填的时候出现才对。
 * 表单本身也长（11 个字段），常驻会把首屏吃掉大半。
 *
 * ## 为什么两种模式共用一份
 *
 * 编辑最容易出的错是"两边字段不一样"：新增能填截止日、编辑不能改；或者编辑漏了某个字段，
 * 一保存就把原值抹掉（整体覆盖语义下，**漏渲染 = 删字段**）——所以字段清单只写一遍。
 *
 * 初值来自 `Item`（编辑）或空（新建），提交时归一交给 `domain/itemDraft.applyDraft` ——
 * 表单只负责"把用户看到的每个字段收上来 + 校验格式"，不承担数据规则。
 *
 * ## 字段分组与说明
 *
 * - **常驻**：名称 / 周期 / 起始 / 截止 / 归档 / 奖励类型 / 固定收益 —— 这七项决定
 *   条目在清单里怎么排、什么时候提示、算不算收益，是"填一条"的最小完整集。
 * - **「更多字段」折叠**：入口 / 条件 / 备注 / 收益说明 / 开放时间 —— 都是描述性文字，
 *   不填也能用；编辑带这类内容的条目时**自动展开**，免得看起来像字段丢了。
 * - **每个字段下方一句说明**（`Row` 的 `hint`）：用户要的就是"填的时候知道这一栏是干什么的"。
 *
 * ## 校验（只拦"填错"，不拦"没填"）
 *
 * 日期/时刻格式、名称长度、起始 ≤ 截止 ≤ 归档、开放时间先后、收益数值非负。
 * 除名称外全部可留空 —— 一条自建条目只填名字与周期也必须能存。
 */

/** 日期：`YYYY-MM-DD` 或 `YYYY-MM-DD HH:mm`（与 `parseTs` 认的写法一致） */
const DATE_RE = /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2})?$/;
/** 时刻：`HH:mm` */
const HM_RE = /^\d{2}:\d{2}$/;

const CURRENCY_LABEL: Record<GainCurrency, string> = {
  jade: '勾玉',
  blackFrag: '黑碎',
  blueTicket: '蓝票',
};

/** 行标签定宽（4 字中文在 12px 下约 48px，56px 留一点余量）；字档取 `tx.label` */
const LABEL = `w-14 flex-none ${tx.label} text-ink-2`;

const num2str = (v?: number): string => (typeof v === 'number' ? String(v) : '');

/**
 * 表单行：定宽标签 + 控件 + **字段说明**（2026-09-28 用户要的就是这个 ——
 * "创建 / 编辑时的说明"：填的那一刻就要知道这一栏是干什么的、留空会怎样）。
 *
 * 说明文字放在 `<label>` 内部：读屏会把「字段名 + 说明」连着念出来
 * （等于自带一份 `aria-describedby`），不必为每行造 id 关联；视觉上它落在控件下方、
 * 左缘与控件对齐 —— 与控件同起一条线，看起来是"这一栏的注解"而不是另一栏。
 *
 * ⚠️ 因此**别再往 `children` 里塞 `<label>`**（label 套 label 是非法结构）：
 * 一行多个控件时给每个控件写 `aria-label`，外层用 `<span>`（`固定收益` 那行就是这么做的）。
 */
function Row({
  label,
  hint,
  children,
  group = false,
}: {
  label: string;
  hint: ReactNode;
  children: ReactNode;
  /**
   * `true` = 这一行是**一组控件**（多选标签、多个数值框），外层用 `<div>` 包。
   * 不能用 `<label>`：包住的话点"字段名"会去激活**组里第一个**控件
   * （点「奖励类型」四个字就勾上了勾玉），而且 label 套 label 是非法结构。
   * 分组语义另由内层的 `role="group" aria-label` 承担。
   */
  group?: boolean;
}) {
  const Tag = group ? 'div' : 'label';
  return (
    <Tag className="flex items-start gap-3">
      <span className={`${LABEL} pt-2.5`}>{label}</span>
      <span className="min-w-0 flex-1">
        {children}
        {/* 字段说明走 `tx.note`（11px）—— 此前这里是 `text-2xs`（10px），
            而 10px 的中文笔画会糊（`uiRef/囤囤鼠大作战_UI审查意见.md` 记过一笔，
            项目此前已把字号整档上抬过）。阶梯的地板就是 11px，见 `controls.tx` */}
        <span className={`mt-0.5 block ${tx.note} text-ink-3`}>{hint}</span>
      </span>
    </Tag>
  );
}

/**
 * 子步骤的**表单态**：数值框必须存字符串（否则 "12." 这类打了一半的状态输不进去），
 * 提交时才转成 `SubItem`（数字 + 留空即继承本条）。
 */
interface SubDraft {
  id: string;
  condition: string;
  note: string;
  timeNote: string;
  gainNote: string;
  jade: string;
  blackFrag: string;
  blueTicket: string;
}

/**
 * 子步骤 id 生成后**不再复用**：删掉中间一步时，其余步的已勾状态不能跟着错位。
 *
 * id 的合法字符集收口在 `domain/ids` —— 此前这里直接 `nanoid(6)`，默认字母表含大写与 `-`，
 * 与 id 规则不符，结果是"存进去 14 步、读出来 3 步"（见 `domain/ids` 的说明）。
 */
const newSubId = () => newId('sub');

/** 空白一步：id 现生成，其余留空（留空 = 继承本条，见 `SubItem` 的说明） */
const blankSub = (): SubDraft => ({
  id: newSubId(),
  condition: '',
  note: '',
  timeNote: '',
  gainNote: '',
  jade: '',
  blackFrag: '',
  blueTicket: '',
});

const subDraftOf = (c: SubItem): SubDraft => ({
  id: c.id,
  condition: c.condition ?? '',
  note: c.note ?? '',
  timeNote: c.timeNote ?? '',
  gainNote: c.gainNote ?? '',
  jade: num2str(c.gain?.jade),
  blackFrag: num2str(c.gain?.blackFrag),
  blueTicket: num2str(c.gain?.blueTicket),
});

interface FormState {
  name: string;
  cycle: Cycle;
  start: string;
  deadline: string;
  until: string;
  path: string;
  condition: string;
  note: string;
  gainNote: string;
  time: string;
  timeEnd: string;
  kinds: GainKind[];
  jade: string;
  blackFrag: string;
  blueTicket: string;
  /** 子步骤（多次任务）；空数组 = 单条条目 */
  subs: SubDraft[];
}

export default function ItemForm({
  mode,
  initial,
  busy,
  cycleLabels,
  kindLabels,
  onSubmit,
  onClose,
  onReset,
}: {
  mode: 'create' | 'edit';
  /** 编辑模式的原条目（新增模式不给） */
  initial?: Item;
  busy: boolean;
  /** 周期 / 奖励类型的字典标签（来自 `dictIndexOf`，单一来源） */
  cycleLabels: Map<string, { label: string }>;
  kindLabels: Map<string, { label: string }>;
  /** 返回 `true` 表示已保存（表单据此**自己关掉**弹层）；失败则把错误显示在表单里 */
  onSubmit: (draft: ItemDraft) => Promise<boolean>;
  /** 关闭弹层（取消 / Escape / 点遮罩 / 保存成功后） */
  onClose: () => void;
  /**
   * 「还原默认」—— 只对**被改写过的预设条目**给（`overrides.patches` 里有它时）。
   * 表单本身不关心"什么是改写"，只是把这一颗按钮渲染出来，语义与确认交给调用方
   * （调用方负责关掉弹层 —— 还原进程要走二次确认）。
   */
  onReset?: () => void;
}) {
  const [f, setF] = useState<FormState>(() => ({
    name: initial?.name ?? '',
    cycle: initial?.cycle ?? 'daily',
    start: initial?.start ?? '',
    deadline: initial?.deadline ?? '',
    until: initial?.until ?? '',
    path: initial?.path ?? '',
    condition: initial?.condition ?? '',
    note: initial?.note ?? '',
    gainNote: initial?.gainNote ?? '',
    time: initial?.time ?? '',
    timeEnd: initial?.timeEnd ?? '',
    kinds: initial?.gainKind ?? [],
    jade: num2str(initial?.gain?.jade),
    blackFrag: num2str(initial?.gain?.blackFrag),
    blueTicket: num2str(initial?.gain?.blueTicket),
    subs: (initial?.children ?? []).map(subDraftOf),
  }));
  /* 子步骤区：条目本来就是"N 次任务"时直接展开 —— 收起时那几步看不见，
     看起来像"步数被清掉了"，其实只是没显示（与「更多字段」同一条理由） */
  const [subsOpen, setSubsOpen] = useState(() => Boolean(initial?.children?.length));
  /* 编辑一条带描述性内容的条目时直接展开「更多字段」——
     收起状态下那几行是空白，看起来像"原来的备注没了"，其实只是没显示 */
  const [more, setMore] = useState(
    () =>
      Boolean(initial) &&
      Boolean(
        initial?.path ||
          initial?.condition ||
          initial?.note ||
          initial?.gainNote ||
          initial?.time ||
          initial?.timeEnd,
      ),
  );
  const [err, setErr] = useState('');
  /* 「直接设成 N 步」的输入：**独立一份字符串**，不跟着 `subs` 走 ——
     跟着走的话，用户点一次「加一步」就看到框里的数字自己变了，反而像出了问题 */
  const [bulk, setBulk] = useState('');
  const bulkN = Number(bulk.trim());
  const bulkOk = bulk.trim() !== '' && Number.isInteger(bulkN) && bulkN >= 0 && bulkN <= 31;
  const applyStepCount = () => {
    if (!bulkOk) return;
    setStepCount(bulkN);
    setBulk('');
  };

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setF((p) => ({ ...p, [k]: v }));

  const setSub = (i: number, patch: Partial<SubDraft>) =>
    setF((p) => ({ ...p, subs: p.subs.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  const addSub = () => setF((p) => ({ ...p, subs: [...p.subs, blankSub()] }));
  const removeSub = (i: number) =>
    setF((p) => ({ ...p, subs: p.subs.filter((_, j) => j !== i) }));

  /**
   * **直接设成 N 步**：要 14 步不必点 14 次「加一步」（2026-09-28 用户要求）。
   *
   * 只在**尾部**增减 —— 保留前 N 步（含每步已填的内容），不够的补空白、多出来的从尾部删。
   * 不从中间删：子步骤是**有序**的（第 k 步就是第 k 步），中间抽掉一步会让后面全部错位，
   * 而每步的 id 关联着已勾状态，错位等于"做过的那一步记到了别的一步上"。
   */
  const setStepCount = (n: number) =>
    setF((p) => {
      const subs = [...p.subs];
      while (subs.length > n) subs.pop();
      while (subs.length < n) subs.push(blankSub());
      return { ...p, subs };
    });

  /** 校验 + 组装草稿；返回字符串 = 校验没过（就是给用户看的那句话） */
  const build = (): ItemDraft | string => {
    const name = f.name.trim();
    if (!name) return '请填写条目名称';
    if (name.length < 2 || name.length > 24) return '名称长度需在 2–24 字之间';
    if (f.start.trim() && !DATE_RE.test(f.start.trim())) return '起始日格式应为 2026-10-01 或 2026-10-01 23:59';
    if (f.deadline.trim() && !DATE_RE.test(f.deadline.trim())) return '截止日格式应为 2026-10-01 或 2026-10-01 23:59';
    if (f.until.trim() && !DATE_RE.test(f.until.trim())) return '归档日格式应为 2026-10-01 或 2026-10-01 23:59';
    if (f.time.trim() && !HM_RE.test(f.time.trim())) return '开放时间格式应为 18:00';
    if (f.timeEnd.trim() && !HM_RE.test(f.timeEnd.trim())) return '开放结束格式应为 20:00';

    /* 顺序只在两端都填了、且都能解析时比 —— 日期串是"字典序即时间序"的，
       比时间戳只为顺手复用 `parseTs`（它同时处理带钟点与不带钟点两种写法） */
    const s = f.start.trim() ? parseTs(f.start.trim()) : null;
    const d = f.deadline.trim() ? parseTs(f.deadline.trim()) : null;
    const u = f.until.trim() ? parseTs(f.until.trim()) : null;
    if (s !== null && d !== null && s > d) return '截止日不能早于起始日';
    if (d !== null && u !== null && d > u) return '归档日不能早于截止日';
    if (s !== null && u !== null && s > u) return '归档日不能早于起始日';
    if (f.time.trim() && f.timeEnd.trim() && f.time.trim() >= f.timeEnd.trim()) {
      return '开放结束时间应晚于开始时间';
    }

    const gain: Gain = {};
    for (const c of GAIN_CURRENCY) {
      const raw = f[c].trim();
      if (!raw) continue;
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) return `${CURRENCY_LABEL[c]}数量应是不小于 0 的数字`;
      gain[c] = n;
    }

    /* 子步骤：留空即**继承本条**的奖励 / 条件 / 备注，写了才覆盖 */
    if (f.subs.length > 31) return '子步骤最多 31 步';
    const children: SubItem[] = [];
    for (const [i, s] of f.subs.entries()) {
      const subGain: Gain = {};
      for (const c of GAIN_CURRENCY) {
        const raw = s[c].trim();
        if (!raw) continue;
        const n = Number(raw);
        if (!Number.isFinite(n) || n < 0) return `第 ${i + 1} 步的${CURRENCY_LABEL[c]}数量应是不小于 0 的数字`;
        subGain[c] = n;
      }
      children.push({
        id: s.id,
        condition: s.condition.trim() || undefined,
        note: s.note.trim() || undefined,
        timeNote: s.timeNote.trim() || undefined,
        gainNote: s.gainNote.trim() || undefined,
        gain: Object.keys(subGain).length ? subGain : undefined,
      });
    }

    return {
      name,
      cycle: f.cycle,
      gainKind: f.kinds,
      start: f.start.trim() || undefined,
      deadline: f.deadline.trim() || undefined,
      until: f.until.trim() || undefined,
      time: f.time.trim() || undefined,
      timeEnd: f.timeEnd.trim() || undefined,
      path: f.path.trim() || undefined,
      condition: f.condition.trim() || undefined,
      note: f.note.trim() || undefined,
      gainNote: f.gainNote.trim() || undefined,
      gain,
      children,
    };
  };

  const submit = async () => {
    const draft = build();
    if (typeof draft === 'string') {
      setErr(draft);
      return;
    }
    setErr('');
    const ok = await onSubmit(draft);
    /* 成功就自己关掉 —— 关弹层的动作归表单：调用方已经通过 `onSubmit` 的返回值表达了结果，
       再让调用方另行调 `onClose` 就成了两处都要记得（漏一处就是"存了但弹层还杵着"） */
    if (ok) onClose();
    else setErr(mode === 'edit' ? '保存失败，请稍后重试' : '新建失败，请稍后重试');
  };

  return (
    /* 2026-09-28 起是**弹层**（用户要求"新建用弹窗，没必要常驻"，随后"编辑也改成弹窗"）：
       骨架在 `Modal`（遮罩 / 面板 / 标题 / 页脚 / 焦点管理），`scroll` 让长表单的主体自己滚、
       「保存」始终可见。此前它常驻在列表顶部（新建区）与行内（编辑），占掉一整块首屏，
       而这一页的主用途是调顺序 / 增删 / 找东西 —— 表单只在要填的时候出现才对
       （这与 `AGENTS` 的"点行展开"决议不冲突：那一条说的是清单卡，不是管理页的表单） */
    <Modal
      title={mode === 'edit' ? `编辑「${initial?.name ?? ''}」` : '新建条目'}
      icon={mode === 'edit' ? 'fude' : 'plus'}
      size="lg"
      scroll
      onClose={onClose}
      footer={
        <>
          {/* 顺序：还原（左）→ 取消 → 保存（右，主按钮）。
             保存走 `btn.pri`（朱红实心）—— 弹层自成一屏，"同一屏最多一颗主按钮"落在它身上 */}
          {onReset ? (
            <button
              type="button"
              disabled={busy}
              onClick={onReset}
              title="丢弃你对这条预设的全部改写，恢复随包发布的内容"
              className={`${btn.base} ${btn.md} ${btn.danger} mr-auto`}
            >
              还原默认
            </button>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className={`${btn.base} ${btn.md} ${btn.out}`}
          >
            取消
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            className={`${btn.base} ${btn.md} ${btn.pri}`}
          >
            <Icon name={mode === 'edit' ? 'check' : 'plus'} size={12} />
            {mode === 'edit' ? '保存' : '新建'}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3 pt-0.5">
        {/* 这次操作本身的口径（**字段级**说明在各行的 `hint` 里，2026-09-28 用户要的就是那个）：
            编辑是整体覆盖语义，"清空某个框就删掉那个字段"必须提前说清楚 ——
            否则用户会以为空框 = 保持原值 */}
        {mode === 'edit' ? (
          <p className={`${tx.note} text-ink-3`}>
            改完点保存。注意<b className="font-medium text-ink-2">清空某个框 = 删掉那个字段</b>
            （保存即生效）；名称与周期必须有值。
          </p>
        ) : (
          <p className={`${tx.note} text-ink-3`}>
            只有<b className="font-medium text-ink-2">名称</b>必填：填名称与周期就能存，
            其余留空即可。每栏下面的小字是它的用处。
          </p>
        )}

        <Row label="名称" hint="清单上显示的名字（2–24 字，必填）">
          <input
            value={f.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="如：寮宴会提醒"
            disabled={busy}
            className={`${input.base} ${input.md}`}
          />
        </Row>

        <Row label="周期" hint="决定它进哪一页、多久翻篇一次：每日→今日 / 每周→本周 / 每月→本月 / 限时→限时页">
          {/* 宽度由外层定宽盒给：`input.base` 自带 `w-full`，
              两个宽度类同时挂在控件上谁生效取决于样式表顺序，不能赌 */}
          <span className="block w-28">
            <select
              value={f.cycle}
              onChange={(e) => set('cycle', e.target.value as Cycle)}
              disabled={busy}
              className={`${input.base} ${input.md}`}
            >
              {CYCLE.map((c) => (
                <option key={c} value={c}>
                  {cycleLabels.get(c)?.label ?? c}
                </option>
              ))}
            </select>
          </span>
        </Row>

        <Row label="起始" hint="开始生效的那天；到日子才在卡片上提示「开启」">
          <input
            value={f.start}
            onChange={(e) => set('start', e.target.value)}
            placeholder="2026-10-01"
            disabled={busy}
            className={`${input.base} ${input.md} ${input.num}`}
          />
        </Row>

        <Row label="截止" hint="到点提醒去领（只是提醒，不会让条目消失）">
          <input
            value={f.deadline}
            onChange={(e) => set('deadline', e.target.value)}
            placeholder="2026-10-07 23:59"
            disabled={busy}
            className={`${input.base} ${input.md} ${input.num}`}
          />
        </Row>

        <Row label="归档" hint="这天过后自动从清单下线；常驻条目留空">
          <input
            value={f.until}
            onChange={(e) => set('until', e.target.value)}
            placeholder="2026-10-09"
            disabled={busy}
            className={`${input.base} ${input.md} ${input.num}`}
          />
        </Row>

        {/* 这一句讲的是**两个字段的组合**，挂在任何单行下都读不通，故单独一行 */}
        <p className={`${tx.note} text-ink-3`}>
          每日 / 每周 / 每月各按自己的周期翻篇（今日页只列每日、本周页只列每周、本月页只列每月）；
          <b className="font-medium text-ink-2">限时</b>进限时页、<b className="font-medium text-ink-2">不翻篇</b> ——
          勾上就一直勾着，要做几次就在下面加几步<b className="font-medium text-ink-2">子步骤</b>，要下线就填归档日。
          任何周期再填<b className="font-medium text-ink-2">截止日或归档日</b>，它就是<b className="font-medium text-ink-2">有期限的条目</b>：到归档日自动下线。
          两个日期都不填就是常驻。
        </p>

        <Row
          group
          label="奖励类型"
          hint="会掉哪些东西，可多选；数量浮动就只勾类型（有保底数值的填在下一行）"
        >
          <div role="group" aria-label="奖励类型（可多选）" className="flex flex-wrap gap-1.5">
            {GAIN_KIND.map((k) => {
              const on = f.kinds.includes(k);
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={on}
                  disabled={busy}
                  onClick={() => set('kinds', on ? f.kinds.filter((x) => x !== k) : [...f.kinds, k])}
                  className={`${chip.base} ${chip.sm} ${on ? chip.on : chip.off}`}
                >
                  {kindLabels.get(k)?.label ?? k}
                </button>
              );
            })}
          </div>
        </Row>

        <Row
          group
          label="固定收益"
          hint="每次必得的数值；留空 = 浮动收益，不计入统计页"
        >
          <div
            role="group"
            aria-label="固定收益（留空 = 浮动收益）"
            className="flex flex-wrap items-center gap-3"
          >
            {GAIN_CURRENCY.map((c) => (
              <span key={c} className="flex items-center gap-1.5">
                <span className={`${tx.label} text-ink-3`}>{CURRENCY_LABEL[c]}</span>
                {/* 定宽靠外层盒子给：`input.base` 自带 `w-full`，两个宽度类同时挂在 input 上
                    谁生效取决于样式表顺序，不能赌 */}
                <span className="w-20 flex-none">
                  <input
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    value={f[c]}
                    onChange={(e) => set(c, e.target.value)}
                    placeholder="—"
                    aria-label={`${CURRENCY_LABEL[c]}数量`}
                    disabled={busy}
                    className={`${input.base} ${input.md} ${input.num} text-center`}
                  />
                </span>
              </span>
            ))}
          </div>
        </Row>

        {/* 子步骤区：一件要做 N 次的事。条目本来就有子步骤时默认展开（见 `subsOpen` 的初值） */}
        <button
          type="button"
          aria-expanded={subsOpen}
          onClick={() => setSubsOpen((v) => !v)}
          className={`flex cursor-pointer items-center gap-1.5 self-start ${tx.label} text-ink-3 transition-colors duration-120 hover:text-ink`}
        >
          <Icon
            name="chevron-right"
            size={13}
            className={`flex-none transition-transform duration-120 ${subsOpen ? 'rotate-90' : ''}`}
          />
          子步骤（{f.subs.length ? `做 ${f.subs.length} 次` : '单条条目'}）
        </button>

        {subsOpen ? (
          <div className="flex flex-col gap-2">
            <p className={`${tx.note} text-ink-3`}>
              一件要做 N 次的事：清单上<b className="font-medium text-ink-2">只有一张卡</b>，
              点一下推进一格，卡面显示<b className="font-medium text-ink-2">当前这一步</b>的说明。
              每步可单独写<b className="font-medium text-ink-2">奖励 / 条件 / 备注 / 时间备注</b>，
              留空就跟着上面填的走 —— 周期、时间、入口、截止一律继承本条。
              <b className="font-medium text-ink-2">要几步直接填数字</b>，不必一步步加。
            </p>

            {f.subs.map((s, i) => (
              <div key={s.id} className="rounded-sm border border-line-soft bg-fill p-2.5">
                <div className="mb-1.5 flex items-center gap-2">
                  <span className={`${tx.label} text-gold-hi`}>第 {i + 1} 步</span>
                  <span className={`${tx.note} text-ink-4`}>留空即继承本条</span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => removeSub(i)}
                    aria-label={`删除第 ${i + 1} 步`}
                    title={`删除第 ${i + 1} 步`}
                    className="ml-auto flex-none cursor-pointer rounded-sm p-1 text-ink-4 transition-colors duration-120 hover:text-danger"
                  >
                    <Icon name="trash" size={12} />
                  </button>
                </div>
                <div className="flex flex-col gap-1.5">
                  <input
                    value={s.condition}
                    onChange={(e) => setSub(i, { condition: e.target.value })}
                    placeholder="条件（如：每周第二次）"
                    aria-label={`第 ${i + 1} 步的条件`}
                    disabled={busy}
                    className={`${input.base} ${input.sm}`}
                  />
                  <input
                    value={s.note}
                    onChange={(e) => setSub(i, { note: e.target.value })}
                    placeholder="备注（如：需声望 10000）"
                    aria-label={`第 ${i + 1} 步的备注`}
                    disabled={busy}
                    className={`${input.base} ${input.sm}`}
                  />
                  <input
                    value={s.timeNote}
                    onChange={(e) => setSub(i, { timeNote: e.target.value })}
                    placeholder="时间备注（如：多在周六）"
                    aria-label={`第 ${i + 1} 步的时间备注`}
                    disabled={busy}
                    className={`${input.base} ${input.sm}`}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    {GAIN_CURRENCY.map((c) => (
                      <span key={c} className="flex items-center gap-1.5">
                        <span className={`${tx.label} text-ink-3`}>{CURRENCY_LABEL[c]}</span>
                        <span className="w-16 flex-none">
                          <input
                            type="number"
                            min={0}
                            step="any"
                            inputMode="decimal"
                            value={s[c]}
                            onChange={(e) => setSub(i, { [c]: e.target.value } as Partial<SubDraft>)}
                            placeholder="—"
                            aria-label={`第 ${i + 1} 步的${CURRENCY_LABEL[c]}数量`}
                            disabled={busy}
                            className={`${input.base} ${input.sm} ${input.num} text-center`}
                          />
                        </span>
                      </span>
                    ))}
                    <span className="min-w-0 flex-1">
                      <input
                        value={s.gainNote}
                        onChange={(e) => setSub(i, { gainNote: e.target.value })}
                        placeholder="收益说明（如：每只 20 勾）"
                        aria-label={`第 ${i + 1} 步的收益说明`}
                        disabled={busy}
                        className={`${input.base} ${input.sm}`}
                      />
                    </span>
                  </div>
                </div>
              </div>
            ))}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={busy || f.subs.length >= 31}
                onClick={addSub}
                className={`${btn.base} ${btn.sm} ${btn.sec}`}
              >
                <Icon name="plus" size={12} />
                加一步
              </button>

              {/* 一步到位：填 14 → 一次生成 14 步（回车同效）。填 0 = 清空、退回单条条目，
                  按钮文案跟着变成「清空」，免得"输个 0 想试试"就把填好的每步内容抹掉。
                  上限 31 与校验同一枚尺子（`build` 与 `sanitizeChildren`） */}
              <span className={`${tx.note} text-ink-3`}>或一步到位：</span>
              <input
                type="number"
                min={0}
                max={31}
                value={bulk}
                onChange={(e) => setBulk(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  e.preventDefault();
                  applyStepCount();
                }}
                placeholder={String(f.subs.length || 1)}
                aria-label="子步骤数量（0 = 清空，最多 31）"
                disabled={busy}
                className={`${input.base} ${input.sm} ${input.num} w-16 text-center`}
              />
              <span className={`${tx.note} text-ink-3`}>步</span>
              <button
                type="button"
                disabled={busy || !bulkOk}
                onClick={applyStepCount}
                className={`${btn.base} ${btn.sm} ${btn.sec}`}
              >
                {bulkN === 0 ? '清空' : '应用'}
              </button>
            </div>
          </div>
        ) : null}

        <button
          type="button"
          aria-expanded={more}
          onClick={() => setMore((v) => !v)}
          className={`flex cursor-pointer items-center gap-1.5 self-start ${tx.label} text-ink-3 transition-colors duration-120 hover:text-ink`}
        >
          <Icon
            name="chevron-right"
            size={13}
            className={`flex-none transition-transform duration-120 ${more ? 'rotate-90' : ''}`}
          />
          更多字段（入口路径 / 条件 / 备注 / 收益说明 / 开放时间）
        </button>

        {more ? (
          <div className="flex flex-col gap-3">
            <Row label="入口" hint="游戏里从哪进，如 町中 → 商店（会显示在条目的入口行）">
              <input
                value={f.path}
                onChange={(e) => set('path', e.target.value)}
                placeholder="町中 → 商店"
                disabled={busy}
                className={`${input.base} ${input.md}`}
              />
            </Row>
            <Row label="条件" hint="做之前要先满足什么，如 需声望 2000">
              <input
                value={f.condition}
                onChange={(e) => set('condition', e.target.value)}
                placeholder="需先解锁 XX"
                disabled={busy}
                className={`${input.base} ${input.md}`}
              />
            </Row>
            <Row label="备注" hint="一句话说明；会显示在条目的备注行，可写多行">
              <textarea
                value={f.note}
                onChange={(e) => set('note', e.target.value)}
                placeholder="如：月度累计另有奖励；累计签到 10 天另给 30 勾"
                rows={2}
                disabled={busy}
                className={`${input.base} ${input.md} ${input.area}`}
              />
            </Row>
            <Row label="收益说明" hint="固定收益的口径，如 每只 20 勾（改了上面的数值，这里跟着改）">
              <input
                value={f.gainNote}
                onChange={(e) => set('gainNote', e.target.value)}
                placeholder="每只 20 勾"
                disabled={busy}
                className={`${input.base} ${input.md}`}
              />
            </Row>
            <Row group label="开放" hint="每天几点到几点能玩；只做提示，不限制勾选">
              <span className="flex flex-wrap items-center gap-2">
                <span className="w-24 flex-none">
                  <input
                    value={f.time}
                    onChange={(e) => set('time', e.target.value)}
                    placeholder="18:00"
                    aria-label="开放开始时间"
                    disabled={busy}
                    className={`${input.base} ${input.md} ${input.num} text-center`}
                  />
                </span>
                <span className={`${tx.label} text-ink-3`}>至</span>
                <span className="w-24 flex-none">
                  <input
                    value={f.timeEnd}
                    onChange={(e) => set('timeEnd', e.target.value)}
                    placeholder="20:00"
                    aria-label="开放结束时间"
                    disabled={busy}
                    className={`${input.base} ${input.md} ${input.num} text-center`}
                  />
                </span>
              </span>
            </Row>
          </div>
        ) : null}

        {err ? <p className={`${tx.message} text-danger`}>{err}</p> : null}
      </div>
    </Modal>
  );
}
