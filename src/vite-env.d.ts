/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 数据通道选择：mock（本期默认）| http（后期接后端）—— 设计文档 §5.4 */
  readonly VITE_API_MODE?: 'mock' | 'http';
  /** Http Adapter 的基地址，如 /api */
  readonly VITE_API_BASE_URL?: string;
  /** 注入错误码用于验证 error 分支（Mock 行为约定，§5.3） */
  readonly VITE_API_FAIL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
