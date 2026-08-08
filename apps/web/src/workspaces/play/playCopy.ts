import type { EditorLocale } from "../editor/editorCopy";
import type { NavigationFirstPersonAvatarMode } from "../../navigationAvatar";

interface FirstPersonAvatarModeCopy {
  description: string;
  label: string;
}

export const playCopyByLocale: Record<EditorLocale, {
  back: string;
  camera: string;
  cameraDescription: string;
  closeSettings: string;
  firstPersonAvatar: string;
  firstPersonAvatarDescription: string;
  firstPersonAvatarModes: Record<NavigationFirstPersonAvatarMode, FirstPersonAvatarModeCopy>;
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
    firstPersonAvatar: "第一人称角色",
    firstPersonAvatarDescription: "控制第一人称下身体和主手的显示方式。",
    firstPersonAvatarModes: {
      automatic: { label: "自动", description: "平视显示右下角主手，低头逐渐显示身体。" },
      hands: { label: "仅手部", description: "只显示右下角随移动摆动的主手。" },
      body: { label: "身体感知", description: "显示除头部以外的躯干、手臂和双腿。" },
      hidden: { label: "隐藏", description: "不显示自己的角色或主手。" },
    },
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
    firstPersonAvatar: "First-person character",
    firstPersonAvatarDescription: "Control how your body and main hand appear in first person.",
    firstPersonAvatarModes: {
      automatic: { label: "Automatic", description: "Show the main hand at the lower right and reveal the body while looking down." },
      hands: { label: "Hand only", description: "Show only the main hand at the lower right, animated with movement." },
      body: { label: "Body awareness", description: "Show the torso, arms, and legs without the head." },
      hidden: { label: "Hidden", description: "Hide your character and main hand." },
    },
    loading: "Loading scene",
    missing: "Scene not found or local service unavailable",
    runtime: "Runtime view",
    settings: "Settings",
  },
};
