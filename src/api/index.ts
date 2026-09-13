/**
 * **唯一切换点**：mock | http（设计文档 §5.4）。
 *
 * 业务代码永远只 `import { api } from '@/api'`，不关心实现来自 JSON 还是网络。
 * 换后端时只改这一个文件 + 环境变量。
 */
import type { ApiClient } from './contract';
import { MockApi } from './mock/adapter';
import { HttpApi } from './http/adapter';

const mode = import.meta.env.VITE_API_MODE ?? 'mock';

export const api: ApiClient =
  mode === 'http'
    ? new HttpApi(import.meta.env.VITE_API_BASE_URL ?? '/api')
    : new MockApi();

export type { ApiClient, DataScope } from './contract';
