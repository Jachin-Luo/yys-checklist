import { useEffect, useState } from 'react';
import Icon from '../icons/Icon';
import CollapsibleSection from '../common/CollapsibleSection';
import { btn, input, tx } from '../common/controls';
import type { BundleSummary } from '../../domain/backup';
import { copyText } from '../../services/clipboard';
import { applyImportText, exportBackupText, prepareImportText } from '../../services/backupService';

/**
 * 「设置 · 数据备份」（设计文档 §9 S7 导入导出）。
 *
 * **载体是 JSON 文本，靠复制粘贴传递**（设计决策）：
 * 换设备时最自然的动作是"把这段字发给自己" —— 微信 / 备忘录 / 邮件都行，
 * 不必先下载文件、再想办法把文件挪到另一台设备、再在文件选择器里把它找出来。
 *
 * 两条安全性设计：
 *   1. 导出**全部账号**，不只当前账号 —— 只导当前账号会让另一个号悄悄丢掉；
 *   2. 导入是**覆盖式写操作**：必须先看摘要、再手动输入「导入」二字才可执行。
 *      勾选记录是用户唯一无法重建的数据，误触一次的代价无法接受。
 *
 * 卡内分割：上半是**操作区**（页签 + 文本域 + 按钮），下半是**结果区**（提示 / 校验摘要 /
 * 覆盖确认），用边框与浅底分开 —— 覆盖确认是危险操作，不能和普通提示混在一片里。
 */
type Tone = 'ok' | 'warn' | 'err';
type Mode = 'export' | 'import';

interface Pending {
  text: string;
  warnings: string[];
  summary: BundleSummary;
}

const CONFIRM_WORD = '导入';

/* 行内小按钮走 `btn` 配方的小号档 —— 原先本文件自己拼了一份（`px-2 py-1 text-sm`），
   与同页走配方的同款小按钮差着一档字号；`btn.out` 是"描边按钮"那一支 */
const rowBtn = `${btn.base} ${btn.sm} ${btn.out}`;

/* 文本域走配方（`controls.input` 的 `area` + `code` 形态）：可拉伸、等宽、填充底 ——
   备份正文是 JSON，代码块的底与字体要与普通输入框区分开（`code` 里的 `bg-surface-3`
   与 `base` 的 `bg-surface` 同属性，靠它在色板里更靠后而生效） */
const area = `mt-1.5 ${input.base} ${input.area} ${input.code}`;

function SummaryChips({ summary }: { summary: BundleSummary }) {
  const cells: Array<[string, number]> = [
    ['账号', summary.profiles],
    ['勾选记录', summary.checked],
    ['日志天数', summary.logDays],
    ['自建条目', summary.custom],
    ['已隐藏', summary.hidden],
    ['自定义排序', summary.order],
    /* 2026-09-16：这两项此前是设备级、根本不进备份；列出来是为了让"备份是全量的"可见 */
    ['寮时间', summary.guildTime],
    ['寄养任务', summary.plans],
  ];
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {cells.map(([label, value]) => (
        <span key={label} className={`rounded-sm bg-surface px-1.5 py-0.5 ${tx.label} text-ink-2`}>
          {label} <b className="font-medium text-ink">{value}</b>
        </span>
      ))}
    </div>
  );
}

function Message({ msg }: { msg: { tone: Tone; text: string } }) {
  const color = msg.tone === 'ok' ? 'text-success-deep' : msg.tone === 'warn' ? 'text-warn' : 'text-danger';
  return (
    <p className={`flex items-start gap-1.5 ${tx.message} ${color}`}>
      {msg.tone === 'ok' ? (
        <Icon name="check" size={12} className="mt-0.5 flex-none" />
      ) : (
        <Icon name="alert" size={12} className="mt-0.5 flex-none" />
      )}
      {msg.text}
    </p>
  );
}

export default function BackupSection() {
  const [mode, setMode] = useState<Mode>('export');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: Tone; text: string } | null>(null);

  const [exportText, setExportText] = useState('');
  const [exportSummary, setExportSummary] = useState<BundleSummary | null>(null);

  const [importText, setImportText] = useState('');
  const [pending, setPending] = useState<Pending | null>(null);
  const [typed, setTyped] = useState('');

  const onExport = async () => {
    setBusy(true);
    setMsg(null);
    const r = await exportBackupText();
    setBusy(false);
    if (!r.ok || !r.text) {
      setMsg({ tone: 'err', text: `导出失败：${r.error ?? '未知错误'}` });
      return;
    }
    setExportText(r.text);
    setExportSummary(r.summary ?? null);
    setMsg({ tone: 'ok', text: `已生成备份文本（${r.text.length} 个字符），复制后自行保存。` });
  };

  /* 切到导出页且还没生成过 → 直接生成，省掉一次点击 */
  useEffect(() => {
    if (mode === 'export' && !exportText && !busy) void onExport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const onCopy = async () => {
    const ok = await copyText(exportText);
    setMsg(
      ok
        ? { tone: 'ok', text: '已复制到剪贴板。粘贴到微信 / 备忘录 / 邮件里保存，换设备时再粘回来。' }
        : { tone: 'warn', text: '复制失败（浏览器限制）。请手动全选文本框内容后复制。' },
    );
  };

  const onValidate = async () => {
    setBusy(true);
    setMsg(null);
    setPending(null);
    const r = await prepareImportText(importText);
    setBusy(false);
    if (!r.ok || !r.summary) {
      setMsg({ tone: 'err', text: `无法导入：${r.error ?? '校验未通过'}` });
      return;
    }
    setPending({ text: importText, warnings: r.warnings ?? [], summary: r.summary });
    setTyped('');
  };

  const onConfirm = async () => {
    if (!pending) return;
    setBusy(true);
    setMsg(null);
    const r = await applyImportText(pending.text);
    setBusy(false);
    setPending(null);
    setTyped('');
    setMsg(
      r.ok
        ? {
            tone: 'ok',
            text: `导入完成${r.summary ? ` · ${r.summary.profiles} 个账号 / ${r.summary.checked} 条勾选记录` : ''}，列表已刷新。`,
          }
        : { tone: 'err', text: `导入失败：${r.error ?? '未知错误'}` },
    );
  };

  const exportPanel = (
    <>
      <p className={`${tx.note} text-ink-3`}>
        备份文本包含<b className="text-ink-2">全部账号的全部配置</b>：勾选记录、勾选日志、
        视图偏好、自建条目与排序、<b className="text-ink-2">寮时间、结界寄养任务</b>。
        复制后自行保存（发给自己 / 存备忘录都行），换设备或清理浏览器数据时粘回来即可恢复。
      </p>
      <textarea
        readOnly
        value={exportText}
        rows={6}
        spellCheck={false}
        aria-label="备份文本"
        placeholder={busy ? '正在生成…' : '点下面的「生成备份文本」'}
        className={area}
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!exportText}
          onClick={() => void onCopy()}
          className={`${btn.base} ${btn.sm} ${btn.sec}`}
        >
          <Icon name="kasane" size={11} />
          复制全部
        </button>
        <button type="button" disabled={busy} onClick={() => void onExport()} className={rowBtn}>
          <Icon name="refresh" size={11} />
          重新生成
        </button>
      </div>
    </>
  );

  const importPanel = (
    <>
      <p className={`${tx.note} text-ink-3`}>
        把之前保存的备份文本<b className="text-ink-2">整段粘贴</b>到下面，点「校验内容」。
        校验通过后会先给你看这份备份里有什么，确认后才会写入。
      </p>
      <textarea
        value={importText}
        onChange={(e) => {
          setImportText(e.target.value);
          /* 内容一变，之前那次校验的结论就作废了 */
          setPending(null);
        }}
        rows={6}
        spellCheck={false}
        aria-label="粘贴备份文本"
        placeholder="在此粘贴备份 JSON（Ctrl / ⌘ + V）"
        className={area}
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !importText.trim()}
          onClick={() => void onValidate()}
          className={rowBtn}
        >
          校验内容
        </button>
        <button
          type="button"
          disabled={!importText}
          onClick={() => {
            setImportText('');
            setPending(null);
            setMsg(null);
          }}
          className={rowBtn}
        >
          清空
        </button>
      </div>
    </>
  );

  return (
    <CollapsibleSection title="数据备份" summary="JSON 文本 · 复制粘贴 · 不上传">
      <div className="border-b border-line-faint px-3 py-2">
        <div className="flex gap-1 rounded-md bg-surface-3 p-1">
          {(
            [
              ['export', '导出备份'],
              ['import', '导入备份'],
            ] as Array<[Mode, string]>
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setMode(key);
                setMsg(null);
              }}
              /* 页签走 `Segmented` 的同档字号（12px = `text-sm`）但铺满整行 ——
                 `Segmented` 的胶囊轨道是 `flex-none` 单行，在这里会缩成一小截 */
              className={`flex-1 cursor-pointer rounded-sm px-2 py-1.5 text-sm transition-colors duration-120 ${
                mode === key ? 'bg-surface text-ink shadow-sm' : 'text-ink-2 hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── 操作区 ── */}
      <div className="px-3 py-3">{mode === 'export' ? exportPanel : importPanel}</div>

      {/* ── 结果区（提示 / 校验结论 / 覆盖确认） ── */}
      <div className="border-t border-line-faint bg-surface-3 px-3 py-3">
        {msg ? <Message msg={msg} /> : null}
        {exportSummary ? <SummaryChips summary={exportSummary} /> : null}

        {pending ? (
          <div className="mt-2 rounded-md border border-danger-line bg-danger-soft px-3 py-2">
            <p className={`${tx.message} text-danger`}>
              导入会<b>覆盖</b>当前全部账号的勾选记录、视图偏好、自建条目、寮时间与寄养任务，
              且不可撤销 —— 建议先切到「导出」留一份当前的。
            </p>
            <SummaryChips summary={pending.summary} />

            {pending.warnings.length ? (
              <ul className="mt-2 space-y-0.5">
                {pending.warnings.map((w) => (
                  <li key={w} className={`${tx.message} text-warn`}>
                    · {w}
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={`${tx.label} text-ink-2`}>输入「{CONFIRM_WORD}」以确认</span>
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                aria-label={`输入${CONFIRM_WORD}以确认`}
                placeholder={CONFIRM_WORD}
                /* 这一处**不套 `input` 配方**：它是危险动作的入口，聚焦要转朱红，而配方的
                   `focus:border-gold-line` 与 `focus:border-danger` 是**同属性、同变体**的两个类，
                   胜负由 Tailwind 的生成顺序定，不由 className 里的书写顺序定 ——
                   实测产物里 `.focus\:border-danger:focus`(偏移 32529) **早于**
                   `.focus\:border-gold-line:focus`(32758)，所以哪怕写在后面也赢不了，
                   反而会得到一个"看着像生效了、其实一直是金边"的静默失效。
                   规格（8px 圆角 / 紧凑档高度 / ink-4 占位色）与配方保持一致 */
                className="h-7 w-20 rounded-xs border border-line bg-surface px-2 text-sm text-ink transition-colors duration-120 placeholder:text-ink-4 focus:border-danger"
              />
              <button
                type="button"
                disabled={typed.trim() !== CONFIRM_WORD || busy}
                onClick={() => void onConfirm()}
                className={`${btn.base} ${btn.sm} ${btn.danger}`}
              >
                覆盖导入
              </button>
              <button
                type="button"
                onClick={() => {
                  setPending(null);
                  setTyped('');
                }}
                className={rowBtn}
              >
                取消
              </button>
            </div>
          </div>
        ) : null}

        <p className={`${tx.note} text-ink-3 ${msg || exportSummary || pending ? 'mt-2' : ''}`}>
          备份文本里也包含账号信息（名称 / 区服 / UID）。请妥善保管，不要随意分享。
          唯一的例外是<b className="text-ink-2">冷启动引导标记</b> —— 它属于"这台设备看过引导没有"的状态，
          不是配置，因此不随备份迁移：换设备后重看一次引导是正常的。
        </p>
      </div>
    </CollapsibleSection>
  );
}
