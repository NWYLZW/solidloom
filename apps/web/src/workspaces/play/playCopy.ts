import type { EditorLocale } from "../editor/editorCopy";
import type { NavigationFirstPersonAvatarMode } from "../../navigationAvatar";

interface FirstPersonAvatarModeCopy {
  description: string;
  label: string;
}

export const playCopyByLocale: Record<EditorLocale, {
  backToMenu: string;
  appearance: string;
  appearanceDescription: string;
  audio: string;
  audioDescription: string;
  audioMuted: string;
  audioMutedDescription: string;
  audioVolume: string;
  camera: string;
  cameraDescription: string;
  cameraMode: string;
  character: string;
  characterDescription: string;
  characterClassicSkin: string;
  characterImport: string;
  characterImportedSkin: string;
  characterPreview: string;
  characterReset: string;
  characterSceneSkin: string;
  characterSessionHint: string;
  characterSkin: string;
  characterSkinInvalid: string;
  characterSkinList: string;
  characterSlimSkin: string;
  firstPersonAvatar: string;
  firstPersonAvatarDescription: string;
  firstPersonAvatarModes: Record<NavigationFirstPersonAvatarMode, FirstPersonAvatarModeCopy>;
  general: string;
  generalDescription: string;
  language: string;
  loading: string;
  menu: string;
  menuDescription: string;
  missing: string;
  resume: string;
  returnWorkshop: string;
  runtime: string;
  settings: string;
  theme: string;
  themeDark: string;
  themeLight: string;
  themeSystem: string;
}> = {
  "zh-CN": {
    backToMenu: "返回菜单",
    appearance: "画面",
    appearanceDescription: "调整运行视图的外观和显示方式。",
    audio: "声音",
    audioDescription: "控制场景媒体和开发者接入的声音。",
    audioMuted: "静音",
    audioMutedDescription: "关闭本次游览中的全部声音输出。",
    audioVolume: "主音量",
    camera: "镜头",
    cameraDescription: "选择游览时使用的视角。",
    cameraMode: "视角模式",
    character: "角色",
    characterDescription: "选择已有皮肤，或导入自己的 64×64 PNG 皮肤。",
    characterClassicSkin: "默认 Classic",
    characterImport: "导入皮肤",
    characterImportedSkin: "导入的皮肤",
    characterPreview: "角色三维预览",
    characterReset: "恢复场景皮肤",
    characterSceneSkin: "场景皮肤",
    characterSessionHint: "皮肤修改仅应用于本次游览。",
    characterSkin: "角色外观",
    characterSkinInvalid: "请选择不超过 256 KB 的有效 64×64 PNG 皮肤。",
    characterSkinList: "可用皮肤",
    characterSlimSkin: "默认 Slim",
    firstPersonAvatar: "第一人称角色",
    firstPersonAvatarDescription: "控制第一人称下身体和主手的显示方式。",
    firstPersonAvatarModes: {
      automatic: { label: "自动", description: "平视显示右下角主手，低头逐渐显示身体。" },
      hands: { label: "仅手部", description: "只显示右下角随移动摆动的主手。" },
      body: { label: "身体感知", description: "显示除头部以外的躯干、手臂和双腿。" },
      hidden: { label: "隐藏", description: "不显示自己的角色或主手。" },
    },
    general: "通用",
    generalDescription: "调整语言等通用运行偏好。",
    language: "语言",
    loading: "正在载入场景",
    menu: "菜单",
    menuDescription: "继续游览或调整本次体验。",
    missing: "场景不存在或本地服务不可用",
    resume: "继续游戏",
    returnWorkshop: "前往工坊",
    runtime: "运行视图",
    settings: "设置",
    theme: "外观模式",
    themeDark: "深色",
    themeLight: "浅色",
    themeSystem: "跟随系统",
  },
  en: {
    backToMenu: "Back to menu",
    appearance: "Graphics",
    appearanceDescription: "Adjust the appearance and presentation of the runtime view.",
    audio: "Audio",
    audioDescription: "Control scene media and developer-provided audio.",
    audioMuted: "Mute",
    audioMutedDescription: "Disable all audio output for this play session.",
    audioVolume: "Master volume",
    camera: "Camera",
    cameraDescription: "Choose the camera used while exploring.",
    cameraMode: "Camera mode",
    character: "Character",
    characterDescription: "Choose an existing skin or import your own 64×64 PNG skin.",
    characterClassicSkin: "Default Classic",
    characterImport: "Import skin",
    characterImportedSkin: "Imported skin",
    characterPreview: "3D character preview",
    characterReset: "Restore scene skin",
    characterSceneSkin: "Scene skin",
    characterSessionHint: "Skin changes apply to this play session only.",
    characterSkin: "Character appearance",
    characterSkinInvalid: "Choose a valid 64×64 PNG skin no larger than 256 KB.",
    characterSkinList: "Available skins",
    characterSlimSkin: "Default Slim",
    firstPersonAvatar: "First-person character",
    firstPersonAvatarDescription: "Control how your body and main hand appear in first person.",
    firstPersonAvatarModes: {
      automatic: { label: "Automatic", description: "Show the main hand at the lower right and reveal the body while looking down." },
      hands: { label: "Hand only", description: "Show only the main hand at the lower right, animated with movement." },
      body: { label: "Body awareness", description: "Show the torso, arms, and legs without the head." },
      hidden: { label: "Hidden", description: "Hide your character and main hand." },
    },
    general: "General",
    generalDescription: "Adjust language and other general runtime preferences.",
    language: "Language",
    loading: "Loading scene",
    menu: "Menu",
    menuDescription: "Resume or adjust this play session.",
    missing: "Scene not found or local service unavailable",
    resume: "Resume",
    returnWorkshop: "Go to workshop",
    runtime: "Runtime view",
    settings: "Settings",
    theme: "Appearance mode",
    themeDark: "Dark",
    themeLight: "Light",
    themeSystem: "Follow system",
  },
};
