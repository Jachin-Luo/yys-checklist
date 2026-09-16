import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRightLeft, Check } from 'lucide-react';
import CollapsibleSection from '../../components/common/CollapsibleSection';
import { SYNC_PARTS, defaultSyncKeys, describeKeys, type SyncPartKey } from '../../domain/sync';
import { syncToProfiles } from '../../services/profileSync';
import { aliveProfiles, useSessionStore } from '../../stores/session';
import { useUiStore } from '../../stores/ui';

type Tone = 'ok' | 'warn' | 'err';

/** 与 `ViewBar` 的筛选 chip 同一视觉语言，避免这页多出一套控件样式 */
const chip = (on: boolean) =>
  `cursor-pointer rounded-sm border px-2.5 py-1 text-sm transition-colors duration-120 ${
    on
      ? 'border-brand bg-brand-soft font-medium text-brand'
      : 'border-line bg-surface text-ink-2 hover:border-ink-4'
  }`;

/**
 * 「我的 · 同步到其他档案」（2026-09-16 用户需求）。
 *
 * 多个游戏档案常常共享同一批配置（同一个寮的时间、同样的寄养节奏、同样的自建条目），
 * 每开一个号重配一遍是纯浪费。这里让用户自己决定**同步哪些内容**、**同步给哪些档案**
 * —— 不自动、不全量，避免"我以为只改了 A，结果 B 也被改了"。
 *
 * 两条安全设计：
 *   1. **勾选内容默认只带最常用的两项**（寮时间 / 寄养任务），其余要用户主动勾；
 *   2. **执行前二次确认**，正文列明"哪几项"与"哪几个档案"，并说明目标档案会被覆盖。
 *
 * **勾选状态与勾选日志不在可同步清单里**，且不提供开关 —— 理由写在
 * `domain/sync.ts` 末尾（那是"进度"不是"配置"，整表覆盖会直接抹掉另一个号的记录）。
 */
export default function ProfileSyncSection() {
  const profiles = useSessionStore((s) => s.profiles);
  const session = useSessionStore((s) => s.session);
  const askConfirm = useUiStore((s) => s.askConfirm);

  const [targets, setTargets] = useState<string[]>([]);
  const [keys, setKeys] = useState<SyncPartKey[]>(defaultSyncKeys);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: Tone; text: string } | null>(null);

  const others = useMemo(
    () => aliveProfiles(profiles).filter((p) => p.id !== session?.profileId),
    [profiles, session?.profileId],
  );
  const nameOf = (id: string) => profiles.find((p) => p.id === id)?.name ?? id;

  const toggleTarget = (id: string) =>
    setTargets((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleKey = (key: SyncPartKey) =>
    setKeys((prev) => (prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]));

  const onSync = async () => {
    const ok = await askConfirm({
      title: '同步配置到其他档案',
      body: `将把「${describeKeys(keys)}」覆盖到 ${targets.length} 个档案（${targets
        .map(nameOf)
        .join('、')}）。目标档案的对应项会被替换，且不可撤销。`,
      confirmLabel: '同步',
    });
    if (!ok) return;

    setBusy(true);
    setMsg(null);
    const report = await syncToProfiles(targets, keys);
    setBusy(false);

    if (report.error) {
      setMsg({ tone: 'err', text: report.error });
      return;
    }
    if (report.failed.length) {
      setMsg({
        tone: 'warn',
        text: `已同步 ${report.succeeded.length} 个档案；${report.failed
          .map((f) => `${f.name}（${f.reason}）`)
          .join('、')} 失败。失败的档案可重试。`,
      });
      return;
    }
    setMsg({ tone: 'ok', text: `已同步到 ${report.succeeded.join('、')}。` });
  };

  return (
    <CollapsibleSection
      title="同步到其他档案"
      summary={`把本档案的配置复制给其他号 · 可选内容与目标`}
    >
      <div className="bg-surface-3 px-3 py-3">
        <p className="text-sm leading-relaxed text-ink-3">
          多个号在同一个寮、寄养节奏也相同时，不必逐个重配：在这里勾选要复制的内容与目标档案。
          <b className="text-ink-2">勾选记录与统计不会同步</b> —— 那是每个号各自的进度。
        </p>
      </div>

      <div className="px-3 py-3">
        {others.length ? (
          <>
            <p className="text-sm text-ink-2">
              同步到（当前档案：<b className="font-medium">{nameOf(session?.profileId ?? '')}</b>）
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {others.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={targets.includes(p.id)}
                  onClick={() => toggleTarget(p.id)}
                  className={chip(targets.includes(p.id))}
                >
                  {p.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setTargets(targets.length === others.length ? [] : others.map((p) => p.id))}
                className="cursor-pointer rounded-sm border border-line bg-surface px-2.5 py-1 text-sm text-ink-3 transition-colors duration-120 hover:border-ink-4"
              >
                {targets.length === others.length ? '全不选' : '全选'}
              </button>
            </div>

            <p className="mt-3.5 text-sm text-ink-2">同步内容</p>
            <div className="mt-1.5 space-y-1">
              {SYNC_PARTS.map((part) => {
                const on = keys.includes(part.key);
                return (
                  <button
                    key={part.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleKey(part.key)}
                    className={`flex w-full cursor-pointer items-start gap-2.5 rounded-sm border px-2 py-2 text-left transition-colors duration-120 ${
                      on ? 'border-brand-line bg-brand-soft/50' : 'border-line-faint hover:border-line'
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-sm border ${
                        on ? 'border-brand bg-brand text-white' : 'border-line bg-surface'
                      }`}
                    >
                      {on ? <Check size={11} strokeWidth={3} /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-lg text-ink">{part.label}</span>
                      <span className="block text-sm leading-relaxed text-ink-3">{part.desc}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={busy || !targets.length || !keys.length}
                onClick={() => void onSync()}
                className="inline-flex cursor-pointer items-center gap-1 rounded-sm bg-brand px-3 py-1.5 text-sm text-white transition-colors duration-120 hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowRightLeft size={12} strokeWidth={2.4} />
                {busy ? '同步中…' : `同步到 ${targets.length || 0} 个档案`}
              </button>
              {!keys.length ? <span className="text-sm text-warn">请至少选择一项内容</span> : null}
            </div>

            {msg ? (
              <p
                className={`mt-2 flex items-start gap-1.5 text-sm leading-relaxed ${
                  msg.tone === 'ok'
                    ? 'text-success-deep'
                    : msg.tone === 'warn'
                      ? 'text-warn'
                      : 'text-danger'
                }`}
              >
                {msg.tone === 'ok' ? (
                  <Check size={12} strokeWidth={2.6} className="mt-0.5 flex-none" />
                ) : (
                  <AlertTriangle size={12} strokeWidth={2.4} className="mt-0.5 flex-none" />
                )}
                {msg.text}
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-sm leading-relaxed text-ink-3">
            目前只有一个档案。在「档案管理」里新建小号后，才能把配置同步过去。
          </p>
        )}
      </div>
    </CollapsibleSection>
  );
}
