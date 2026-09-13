import { useMemo } from 'react';
import type { DataScope } from '../api';
import { useSessionStore } from '../stores/session';

/**
 * 一行拿到当前 `DataScope`（设计文档 §5.1）。
 * 调用方不用手工拼 —— 从 session store 取，且引用稳定（避免作为 effect 依赖时反复触发）。
 */
export function useScope(): DataScope | null {
  const userId = useSessionStore((s) => s.session?.userId);
  const profileId = useSessionStore((s) => s.session?.profileId);
  return useMemo(
    () => (userId && profileId ? { userId, profileId } : null),
    [userId, profileId],
  );
}
