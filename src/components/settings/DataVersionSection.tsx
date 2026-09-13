import { Info } from 'lucide-react';
import CollapsibleSection from '../common/CollapsibleSection';
import { dataFreshness } from '../../domain/backup';
import { useItemStore } from '../../stores/items';

/**
 * 「我的 · 数据版本」（设计文档 §4.1 / §9 S7）。
 *
 * §4.1 把 `dataVersion` 的 UI 定位定为「**可选展示**」（需求 Q10：校核后再上 UI，
 * "防静默过期"是目标而非本期硬要求）。这里按"可选但有用"来做：
 * 把快照版本、结构版本、更新日、周期重置规则、版本/赛季锚点集中在一处 ——
 * 用户遇到"活动日期不对"时，第一个要确认的就是这组信息。
 *
 * **只提示、不阻断**：数据过期不等于功能坏了，旧快照照样能记录，只是要提醒以游戏内为准。
 * 收起状态下摘要直接给"快照版本 + 更新于何时"，不展开也能判断数据新不新。
 */
export default function DataVersionSection() {
  const meta = useItemStore((s) => s.meta);
  if (!meta) return null;

  const fresh = dataFreshness(meta.updated);
  const periods = [
    { label: '版本锚点', anchor: meta.periods.version },
    { label: '赛季锚点', anchor: meta.periods.season },
  ];

  const rows: Array<{ label: string; value: string; hint?: string; warn?: boolean }> = [
    { label: '数据快照', value: meta.dataVersion, hint: '随包发布的条目库快照，本期不做热更新' },
    { label: '数据结构版本', value: meta.version, hint: '备份文件的 schemaVersion 与它比对' },
    { label: '快照更新日', value: meta.updated, hint: fresh.text, warn: fresh.stale },
    {
      label: '周期重置',
      value: `每日 ${String(meta.resetHour).padStart(2, '0')}:00`,
      hint: meta.resetNote,
    },
    ...periods.flatMap(({ label, anchor }) => anchor ? [{
      label,
      value: `${anchor.key} · ${anchor.startAt.replace('T', ' ')}`,
      hint: anchor.note,
    }] : []),
  ];

  return (
    <CollapsibleSection
      title="数据版本"
      summary={fresh.stale ? `${meta.dataVersion} · ${fresh.text}（可能已过期）` : `${meta.dataVersion} · ${fresh.text}`}
      aside={<span className="text-sm text-ink-3">只读</span>}
    >
      <div>
        {rows.map((r) => (
          <div key={r.label} className="flex items-start gap-3 border-b border-line-faint px-3 py-2.5 last:border-0">
            <span className="flex-1 text-lg text-ink">
              {r.label}
              {r.hint ? (
                <small className={`mt-0.5 block text-sm font-normal ${r.warn ? 'text-warn' : 'text-ink-3'}`}>
                  {r.hint}
                </small>
              ) : null}
            </span>
            <span className="flex-none text-sm text-ink-2">{r.value}</span>
          </div>
        ))}
      </div>

      {fresh.stale ? (
        <p className="flex items-start gap-1.5 border-t border-line-faint bg-surface-3 px-3 py-2 text-sm leading-relaxed text-warn">
          <Info size={12} strokeWidth={2.2} className="mt-0.5 flex-none" />
          数据快照已超过 {fresh.days} 天未更新，活动时间与掉落可能已变化 —— 以游戏内说明为准。
        </p>
      ) : null}
    </CollapsibleSection>
  );
}
