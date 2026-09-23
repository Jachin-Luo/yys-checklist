import { useState } from 'react';
import Icon from '../../components/icons/Icon';
import CollapsibleSection from '../../components/common/CollapsibleSection';
import type { Profile } from '../../api/types';
import { aliveProfiles, useSessionStore } from '../../stores/session';
import { useUiStore } from '../../stores/ui';

interface FormState {
  name: string;
  server: string;
  channel: string;
  uid: string;
  level: string;
}

const EMPTY: FormState = { name: '', server: '', channel: '', uid: '', level: '' };

/* 去掉 `outline-none`：它把浏览器默认焦点环一起去掉了，只剩 1px 边框变色。
   焦点环现在由 `styles/base.css` 的全局 `:focus-visible` 统一提供 */
const inputCls =
  'w-full rounded-sm border border-line bg-surface px-2 py-1.5 text-lg text-ink transition-colors duration-120 focus:border-gold-hi disabled:opacity-50';

const btn =
  'cursor-pointer rounded-sm border border-line px-2 py-1 text-sm text-ink-2 transition-colors duration-120 hover:border-line disabled:cursor-not-allowed disabled:opacity-50';

/**
 * 「设置 · 账号」分区（大号 / 小号，设计文档 §6.4）。
 *
 * 四条边界一个都不能少：
 *   ① 删除走二次确认，且**必须保留至少一个未归档账号**（禁删最后一个）
 *   ② 归档同理受限，且归档当前账号时自动切到 sort 最小的存活账号
 *   ③ 归档的账号**不出现在切换器**，但在本区可「恢复」
 *   ④ 同名账号允许，靠 `server` + `channel` 区分（不做唯一性约束）
 *
 * 卡内分割：编辑表单是**操作区**（浅底），账号列表是**展示区**（白底），两者之间由表单自带的
 * `border-b` 隔开 —— 与「条目管理」一致：改的和看的必须一眼分得清。
 */
export default function ProfileSection() {
  const session = useSessionStore((s) => s.session);
  const profiles = useSessionStore((s) => s.profiles);
  const saving = useSessionStore((s) => s.saving);
  const error = useSessionStore((s) => s.error);
  const switchProfile = useSessionStore((s) => s.switchProfile);
  const createProfile = useSessionStore((s) => s.createProfile);
  const updateProfile = useSessionStore((s) => s.updateProfile);
  const archiveProfile = useSessionStore((s) => s.archiveProfile);
  const restoreProfile = useSessionStore((s) => s.restoreProfile);
  const deleteProfile = useSessionStore((s) => s.deleteProfile);
  const askConfirm = useUiStore((s) => s.askConfirm);

  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [formError, setFormError] = useState('');

  const alive = aliveProfiles(profiles);
  const archived = profiles.filter((p) => p.archived);
  const canRemove = alive.length > 1;

  const startCreate = () => {
    setEditing('new');
    setForm(EMPTY);
    setFormError('');
  };

  const startEdit = (p: Profile) => {
    setEditing(p.id);
    setForm({
      name: p.name,
      server: p.server ?? '',
      channel: p.channel ?? '',
      uid: p.uid ?? '',
      level: p.level === undefined ? '' : String(p.level),
    });
    setFormError('');
  };

  const submit = async () => {
    const name = form.name.trim();
    if (name.length < 1 || name.length > 12) {
      setFormError('账号名称需在 1–12 字之间');
      return;
    }
    const rawLevel = form.level.trim();
    const level = rawLevel ? Number(rawLevel) : undefined;
    if (level !== undefined && (!Number.isFinite(level) || level < 0 || level > 100)) {
      setFormError('等级应为 0–100 之间的数字');
      return;
    }
    const patch = {
      name,
      server: form.server.trim() || undefined,
      channel: form.channel.trim() || undefined,
      uid: form.uid.trim() || undefined,
      level,
    };

    if (editing === 'new') {
      const created = await createProfile(patch);
      if (!created) {
        setFormError('新建失败，请稍后重试');
        return;
      }
    } else if (editing) {
      await updateProfile(editing, patch);
    }
    setEditing(null);
  };

  const onArchive = async (p: Profile) => {
    const isCurrent = p.id === session?.profileId;
    const ok = await askConfirm({
      title: `归档「${p.name}」？`,
      body: isCurrent
        ? '它是当前账号 —— 归档后会自动切换到另一个存活账号。数据都会保留，随时可恢复。'
        : '归档后不再出现在顶部切换器，但数据完整保留，随时可恢复。',
      confirmLabel: '归档',
    });
    if (ok) await archiveProfile(p.id);
  };

  const onDelete = async (p: Profile) => {
    const ok = await askConfirm({
      title: `删除「${p.name}」？`,
      body: '该账号的勾选记录、视图偏好与自建条目会一并删除，且不可恢复。建议改用「归档」。',
      confirmLabel: '永久删除',
      tone: 'danger',
    });
    if (ok) await deleteProfile(p.id);
  };

  const form_ = editing ? (
    <div className="border-b border-line-faint bg-surface-3 px-3 py-3">
      <p className="text-sm text-ink-3">{editing === 'new' ? '新建账号' : '编辑账号'}</p>
      <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="账号名称（必填，如：大号）"
          aria-label="账号名称"
          className={inputCls}
        />
        <input
          value={form.server}
          onChange={(e) => setForm({ ...form, server: e.target.value })}
          placeholder="区服（如：网易官服）"
          aria-label="区服"
          className={inputCls}
        />
        <input
          value={form.channel}
          onChange={(e) => setForm({ ...form, channel: e.target.value })}
          placeholder="渠道（如：iOS）"
          aria-label="渠道"
          className={inputCls}
        />
        <input
          value={form.uid}
          onChange={(e) => setForm({ ...form, uid: e.target.value })}
          placeholder="游戏 UID（可选）"
          aria-label="游戏 UID"
          className={inputCls}
        />
        <input
          value={form.level}
          onChange={(e) => setForm({ ...form, level: e.target.value })}
          placeholder="等级（可选，0–100）"
          aria-label="等级"
          className={inputCls}
        />
      </div>
      {formError ? <p className="mt-2 text-sm text-danger">{formError}</p> : null}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => void submit()}
          className="cursor-pointer rounded-sm border border-line bg-gold-soft px-3 py-1.5 text-sm text-gold-hi transition-colors duration-120 hover:border-gold-hi disabled:opacity-50"
        >
          {editing === 'new' ? '创建' : '保存'}
        </button>
        <button type="button" onClick={() => setEditing(null)} className={btn}>
          取消
        </button>
      </div>
    </div>
  ) : null;

  const row = (p: Profile, isAlive: boolean) => {
    const active = p.id === session?.profileId;
    const meta = [p.server, p.channel, p.uid ? `UID ${p.uid}` : '', p.level ? `Lv.${p.level}` : '']
      .filter(Boolean)
      .join(' · ');
    return (
      <div key={p.id} className="flex flex-wrap items-center gap-2 border-b border-line-faint px-3 py-2.5 last:border-0">
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className={`truncate text-lg ${active ? 'font-medium text-ink' : 'text-ink'}`}>{p.name}</span>
            {active ? <Icon name="check" size={13} className="flex-none text-gold" /> : null}
            {p.isDefault ? (
              <span className="flex-none rounded-sm bg-surface-3 px-1.5 py-0.5 text-xs text-ink-3">默认</span>
            ) : null}
          </span>
          <span className="mt-0.5 block truncate text-sm text-ink-3">{meta || '未填区服'}</span>
        </span>

        {isAlive && !active ? (
          <button type="button" onClick={() => void switchProfile(p.id)} className={btn}>
            切换
          </button>
        ) : null}
        <button type="button" onClick={() => startEdit(p)} className={`flex items-center gap-1 ${btn}`}>
          <Icon name="fude" size={12} />
          编辑
        </button>
        {isAlive ? (
          <button
            type="button"
            disabled={!canRemove}
            onClick={() => void onArchive(p)}
            title={canRemove ? '归档（可恢复）' : '至少要保留一个账号'}
            className={`flex items-center gap-1 ${btn}`}
          >
            <Icon name="hako" size={12} />
            归档
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void restoreProfile(p.id)}
            className={`flex items-center gap-1 ${btn}`}
          >
            <Icon name="restore" size={12} />
            恢复
          </button>
        )}
        <button
          type="button"
          disabled={isAlive && !canRemove}
          onClick={() => void onDelete(p)}
          title={isAlive && !canRemove ? '至少要保留一个账号' : '永久删除'}
          className="flex cursor-pointer items-center gap-1 rounded-sm border border-danger-line px-2 py-1 text-sm text-danger transition-colors duration-120 hover:bg-danger-soft disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Icon name="trash" size={12} />
          删除
        </button>
      </div>
    );
  };

  return (
    <CollapsibleSection
      title="游戏账号"
      summary={`存活 ${alive.length} 个${archived.length ? ` · 已归档 ${archived.length} 个` : ''}`}
      aside={
        <button
          type="button"
          disabled={saving}
          onClick={startCreate}
          className="flex cursor-pointer items-center gap-1 rounded-sm border border-line px-2 py-1 text-sm text-ink-2 transition-colors duration-120 hover:border-line disabled:opacity-50"
        >
          <Icon name="plus" size={12} />
          新建账号
        </button>
      }
    >
      {form_}

      <div className="px-0">
        {alive.map((p) => row(p, true))}
        {archived.map((p) => row(p, false))}
      </div>

      {error ? <p className="bg-surface-3 px-3 pb-2 text-sm text-danger">{error.message}</p> : null}
    </CollapsibleSection>
  );
}
