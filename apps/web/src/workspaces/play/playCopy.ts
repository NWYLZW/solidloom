import type { EditorLocale } from "../editor/editorCopy";

export const playCopyByLocale: Record<EditorLocale, {
  back: string;
  loading: string;
  missing: string;
  runtime: string;
}> = {
  "zh-CN": {
    back: "返回工作台",
    loading: "正在载入场景",
    missing: "场景不存在或本地服务不可用",
    runtime: "运行视图",
  },
  en: {
    back: "Back to workspace",
    loading: "Loading scene",
    missing: "Scene not found or local service unavailable",
    runtime: "Runtime view",
  },
};
