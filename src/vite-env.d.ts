/**
 * Vite 环境变量类型声明
 *
 * 让 import.meta.env 里的自定义变量（VITE_ 前缀）有类型提示。
 * 变量来源：构建时从 .env / .env.local 读取（见 .env.example）。
 * 注意：只有 VITE_ 前缀的变量才会暴露给客户端代码。
 */

/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 默认 Base URL（OpenAI 兼容接口） */
  readonly VITE_DEFAULT_BASE_URL?: string;
  /** 默认模型 */
  readonly VITE_DEFAULT_MODEL?: string;
  /** 默认 API Key（本地开发用，切勿提交到 git） */
  readonly VITE_DEFAULT_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
