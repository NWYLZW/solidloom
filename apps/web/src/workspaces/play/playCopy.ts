import type { EditorLocale } from "../editor/editorCopy";

export const playCopyByLocale: Record<EditorLocale, {
  back: string;
  camera: string;
  cameraDescription: string;
  closeSettings: string;
  loading: string;
  missing: string;
  runtime: string;
  settings: string;
}> = {
  "zh-CN": {
    back: "返回工作台",
    camera: "镜头",
    cameraDescription: "选择游览时使用的视角。",
    closeSettings: "关闭设置",
    loading: "正在载入场景",
    missing: "场景不存在或本地服务不可用",
    runtime: "运行视图",
    settings: "设置",
  },
  en: {
    back: "Back to workspace",
    camera: "Camera",
    cameraDescription: "Choose the camera used while exploring.",
    closeSettings: "Close settings",
    loading: "Loading scene",
    missing: "Scene not found or local service unavailable",
    runtime: "Runtime view",
    settings: "Settings",
  },
};
