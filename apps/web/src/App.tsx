import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Braces,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Cuboid,
  Cylinder,
  ExternalLink,
  FileBox,
  Folder,
  FolderMinus,
  FolderOpen,
  FolderTree,
  Languages,
  Layers3,
  Menu as MenuIcon,
  MessageSquareText,
  Monitor,
  Move3D,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Redo2,
  Rotate3D,
  Save,
  Scaling,
  Settings2,
  Slice,
  Sun,
  Undo2,
  Combine,
} from "lucide-react";
import type { BoxFeature, CylinderFeature, FeatureGroup, ModelFeature, ModelRecord, Unit, Vector3Tuple } from "@solidloom/shared";
import {
  ApiError,
  createModel,
  getHealth,
  getModel,
  listModels,
  replaceFeatureGraph,
  updateModel,
} from "./api";
import { Viewport3D, type TransformCommit, type TransformMode } from "./Viewport3D";
import { evaluateBoolean, evaluatePlaneCut, type BooleanOperation } from "./meshOperations";

type ServiceState = "checking" | "online" | "offline";
type Locale = "zh-CN" | "en";
type Theme = "light" | "dark" | "system";
type InspectorTab = "features" | "properties";
type SaveState = "idle" | "saving" | "saved" | "error";
type ObjectTool = Exclude<TransformMode, null> | "plane-cut" | "boolean";
type EditorHistorySnapshot = {
  content: Pick<ModelRecord, "description" | "featureGraph" | "name" | "unit">;
  expandedGroupIds: string[];
  inspectorTab: InspectorTab;
  selectedFeatureIds: string[];
  selectedGroupId: string | null;
};
type TreeMenuTarget =
  | { kind: "tree" }
  | { kind: "model"; modelId: string }
  | { kind: "feature"; featureId: string }
  | { kind: "selection"; featureIds: string[] }
  | { kind: "group"; groupId: string };

const copyByLocale = {
  "zh-CN": {
    pageTitle: "SolidLoom 建模工作台",
    untitledProject: "未命名项目",
    untitledModel: "未命名模型",
    noModel: "未选择模型",
    connecting: "连接中",
    serviceOnline: "本地服务已连接",
    serviceOffline: "本地服务离线",
    workspaceStatus: "工作台状态",
    currentPath: "当前位置",
    contextTools: "上下文工具",
    planned: "规划中",
    ready: "就绪",
    saving: "正在保存",
    saved: "更改已保存",
    unsaved: "有未保存更改",
    saveFailed: "保存失败",
    conflictReloaded: "模型已被其他操作修改，已载入最新修订",
    noSelection: "未选择对象",
    selectedModel: "已选择模型",
    units: "单位",
    undo: "撤销",
    redo: "重做",
    save: "保存",
    collapseLibrary: "折叠模型栏",
    expandLibrary: "展开模型栏",
    projectTree: "项目树",
    models: "模型",
    createModel: "新建模型",
    create: "创建",
    cancel: "取消",
    modelName: "模型名称",
    modelDescription: "模型说明",
    unit: "单位",
    revision: "修订",
    emptyModels: "暂无模型",
    collapseTree: "折叠全部",
    expandTree: "展开全部",
    resizeProjectTree: "调整项目树宽度",
    resizeInspectorWidth: "调整属性面板宽度",
    menu: "菜单",
    menuTitle: "工作台菜单",
    agentGuide: "智能体说明",
    apiDocs: "接口文档",
    language: "语言",
    theme: "主题",
    themeLight: "浅色",
    themeDark: "深色",
    themeSystem: "跟随系统",
    viewTools: "视图工具",
    rotate: "旋转",
    orthographic: "正交",
    viewportPreview: "参数化模型预览",
    viewRight: "右面",
    viewLeft: "左面",
    viewTop: "顶部",
    viewBottom: "底部",
    viewFront: "前面",
    viewBack: "后面",
    viewCube: "视图方向控制器",
    selectModelHint: "从项目树中选择模型，或通过右键菜单新建模型。",
    features: "特征",
    properties: "属性",
    featureGraph: "特征图",
    groups: "分组",
    createGroup: "新建分组",
    newGroup: "分组",
    moveToGroup: "移入分组",
    removeFromGroup: "移出分组",
    dissolveGroup: "解散分组",
    groupTransform: "分组变换",
    groupName: "分组名称",
    groupMembers: "成员",
    position: "位置",
    rotationLabel: "旋转",
    graphEmpty: "当前模型没有特征",
    add: "添加",
    cut: "切除",
    box: "长方体",
    cylinder: "圆柱体",
    parameters: "参数",
    width: "宽度",
    depth: "深度",
    height: "高度",
    radius: "半径",
    metadata: "模型信息",
    selectionSummary: "对象摘要",
    multipleSelection: "多选",
    selectedObjects: "已选择对象",
    size: "尺寸",
    volume: "体积",
    triangles: "三角形",
    mesh: "三角网格",
    moveTool: "移动",
    rotateTool: "旋转",
    scaleTool: "缩放",
    planeCutTool: "平面切割",
    booleanTool: "布尔运算",
    union: "并集",
    intersection: "交集",
    difference: "差集",
    execute: "执行",
    reset: "重置",
    keepPositive: "保留正方向",
    preserveSources: "保留原对象",
    offset: "偏移",
    selectedCount: "已选对象",
    meshResultNotice: "结果为可保存的三角网格；生产级 B-Rep 求值仍为规划中。",
    multiTransformHint: "拖动 3D 操纵器统一变换当前多选对象。",
    operationFailed: "几何运算失败",
    booleanResult: "布尔结果",
    cutResult: "切割结果",
    annotationAssist: "注释辅助",
    annotationAssistActive: "注释辅助已开启 · 点击对象框后再添加 Codex 页面注释",
    annotationFeature: "对象",
    annotationGroup: "分组",
    annotationPath: "对象路径",
    annotationMembers: "成员",
  },
  en: {
    pageTitle: "SolidLoom Modeling Workspace",
    untitledProject: "Untitled project",
    untitledModel: "Untitled model",
    noModel: "No model selected",
    connecting: "Connecting",
    serviceOnline: "Local service connected",
    serviceOffline: "Local service offline",
    workspaceStatus: "Workspace status",
    currentPath: "Current location",
    contextTools: "Context tools",
    planned: "Planned",
    ready: "Ready",
    saving: "Saving",
    saved: "Changes saved",
    unsaved: "Unsaved changes",
    saveFailed: "Save failed",
    conflictReloaded: "The model changed elsewhere; the latest revision was loaded",
    noSelection: "No object selected",
    selectedModel: "Selected model",
    units: "Units",
    undo: "Undo",
    redo: "Redo",
    save: "Save",
    collapseLibrary: "Collapse model library",
    expandLibrary: "Expand model library",
    projectTree: "Project tree",
    models: "Models",
    createModel: "Create model",
    create: "Create",
    cancel: "Cancel",
    modelName: "Model name",
    modelDescription: "Model description",
    unit: "Unit",
    revision: "Revision",
    emptyModels: "No models",
    collapseTree: "Collapse all",
    expandTree: "Expand all",
    resizeProjectTree: "Resize project tree width",
    resizeInspectorWidth: "Resize inspector width",
    menu: "Menu",
    menuTitle: "Workspace menu",
    agentGuide: "Agent guide",
    apiDocs: "API documentation",
    language: "Language",
    theme: "Theme",
    themeLight: "Light",
    themeDark: "Dark",
    themeSystem: "System",
    viewTools: "View tools",
    rotate: "Rotate",
    orthographic: "Orthographic",
    viewportPreview: "Parametric model preview",
    viewRight: "Right",
    viewLeft: "Left",
    viewTop: "Top",
    viewBottom: "Bottom",
    viewFront: "Front",
    viewBack: "Back",
    viewCube: "View orientation control",
    selectModelHint: "Select a model in the project tree, or create one from the context menu.",
    features: "Features",
    properties: "Properties",
    featureGraph: "Feature graph",
    groups: "Groups",
    createGroup: "Create group",
    newGroup: "Group",
    moveToGroup: "Move to group",
    removeFromGroup: "Remove from group",
    dissolveGroup: "Dissolve group",
    groupTransform: "Group transform",
    groupName: "Group name",
    groupMembers: "Members",
    position: "Position",
    rotationLabel: "Rotation",
    graphEmpty: "This model has no features",
    add: "Add",
    cut: "Cut",
    box: "Box",
    cylinder: "Cylinder",
    parameters: "Parameters",
    width: "Width",
    depth: "Depth",
    height: "Height",
    radius: "Radius",
    metadata: "Model information",
    selectionSummary: "Object summary",
    multipleSelection: "Multiple selection",
    selectedObjects: "Selected objects",
    size: "Size",
    volume: "Volume",
    triangles: "Triangles",
    mesh: "Triangle mesh",
    moveTool: "Move",
    rotateTool: "Rotate",
    scaleTool: "Scale",
    planeCutTool: "Plane cut",
    booleanTool: "Boolean",
    union: "Union",
    intersection: "Intersection",
    difference: "Difference",
    execute: "Execute",
    reset: "Reset",
    keepPositive: "Keep positive side",
    preserveSources: "Keep source objects",
    offset: "Offset",
    selectedCount: "Selected objects",
    meshResultNotice: "The result is a persistable triangle mesh; production B-Rep evaluation remains planned.",
    multiTransformHint: "Drag the 3D gizmo to transform the current multi-selection together.",
    operationFailed: "Geometry operation failed",
    booleanResult: "Boolean result",
    cutResult: "Cut result",
    annotationAssist: "Annotation assist",
    annotationAssistActive: "Annotation assist is active · Select an object target, then add a Codex page comment",
    annotationFeature: "Object",
    annotationGroup: "Group",
    annotationPath: "Object path",
    annotationMembers: "Members",
  },
} as const;

function readPreference<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const value = window.localStorage.getItem(key) as T | null;
    return value && allowed.includes(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function readNumberPreference(key: string, fallback: number, minimum: number, maximum: number): number {
  try {
    const storedValue = window.localStorage.getItem(key);
    if (storedValue === null) return fallback;
    const value = Number(storedValue);
    return Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, value)) : fallback;
  } catch {
    return fallback;
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function cloneModel(model: ModelRecord): ModelRecord {
  const clone = structuredClone(model);
  clone.featureGraph.groups ??= [];
  clone.featureGraph.features = clone.featureGraph.features.map((feature) => ({
    ...feature,
    scale: feature.scale ?? [1, 1, 1],
  }));
  clone.featureGraph.groups = clone.featureGraph.groups.map((group) => ({
    ...group,
    scale: group.scale ?? [1, 1, 1],
  }));
  return clone;
}

function comparableModel(model: ModelRecord | null): string {
  if (!model) return "";
  return JSON.stringify({
    name: model.name,
    description: model.description,
    unit: model.unit,
    featureGraph: model.featureGraph,
  });
}

function meshDimensions(feature: Extract<ModelFeature, { type: "mesh" }>): Vector3Tuple {
  const positions = feature.parameters.positions;
  const axes = [0, 1, 2].map((axis) => positions.filter((_, index) => index % 3 === axis));
  const scale = feature.scale ?? [1, 1, 1];
  return axes.map((values, axis) => (Math.max(...values) - Math.min(...values)) * Math.abs(scale[axis]!)) as Vector3Tuple;
}

function meshVolume(feature: Extract<ModelFeature, { type: "mesh" }>) {
  const { indices, positions } = feature.parameters;
  let signedVolume = 0;
  for (let index = 0; index < indices.length; index += 3) {
    const aIndex = indices[index]! * 3;
    const bIndex = indices[index + 1]! * 3;
    const cIndex = indices[index + 2]! * 3;
    const ax = positions[aIndex] ?? 0;
    const ay = positions[aIndex + 1] ?? 0;
    const az = positions[aIndex + 2] ?? 0;
    const bx = positions[bIndex] ?? 0;
    const by = positions[bIndex + 1] ?? 0;
    const bz = positions[bIndex + 2] ?? 0;
    const cx = positions[cIndex] ?? 0;
    const cy = positions[cIndex + 1] ?? 0;
    const cz = positions[cIndex + 2] ?? 0;
    signedVolume += ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx);
  }
  const scale = feature.scale ?? [1, 1, 1];
  return Math.abs(signedVolume / 6) * Math.abs(scale[0] * scale[1] * scale[2]);
}

export function App() {
  const [serviceState, setServiceState] = useState<ServiceState>("checking");
  const [models, setModels] = useState<ModelRecord[]>([]);
  const [savedModel, setSavedModel] = useState<ModelRecord | null>(null);
  const [draftModel, setDraftModel] = useState<ModelRecord | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [statusDetail, setStatusDetail] = useState("");
  const [activeInspectorTab, setActiveInspectorTab] = useState<InspectorTab>("features");
  const [selectedFeatureIds, setSelectedFeatureIds] = useState<string[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [activeObjectTool, setActiveObjectTool] = useState<ObjectTool | null>(null);
  const [annotationMode, setAnnotationMode] = useState(false);
  const [booleanOperation, setBooleanOperation] = useState<BooleanOperation>("union");
  const [cutRotation, setCutRotation] = useState<Vector3Tuple>([0, 0, 0]);
  const [cutOffset, setCutOffset] = useState(0);
  const [keepPositive, setKeepPositive] = useState(true);
  const [preserveSources, setPreserveSources] = useState(false);
  const [uniformScale, setUniformScale] = useState(true);
  const [operationError, setOperationError] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [creating, setCreating] = useState(false);
  const [libraryCollapsed, setLibraryCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [projectExpanded, setProjectExpanded] = useState(true);
  const [modelsExpanded, setModelsExpanded] = useState(true);
  const [expandedModelIds, setExpandedModelIds] = useState<string[]>([]);
  const [expandedGroupIds, setExpandedGroupIds] = useState<string[]>([]);
  const [libraryWidth, setLibraryWidth] = useState(() => readNumberPreference("solidloom.layout.libraryWidth.v1", 260, 180, 420));
  const [inspectorWidth, setInspectorWidth] = useState(() => readNumberPreference("solidloom.layout.inspectorWidth.v1", 294, 240, 480));
  const [treeMenu, setTreeMenu] = useState<{ x: number; y: number; target: TreeMenuTarget } | null>(null);
  const [locale, setLocale] = useState<Locale>(() => readPreference("solidloom.locale", ["zh-CN", "en"], "zh-CN"));
  const [theme, setTheme] = useState<Theme>(() => readPreference("solidloom.theme", ["light", "dark", "system"], "system"));
  const menuRef = useRef<HTMLDivElement>(null);
  const treeMenuRef = useRef<HTMLDivElement>(null);
  const resizeCleanupRef = useRef<(() => void) | null>(null);
  const draftModelRef = useRef<ModelRecord | null>(null);
  const undoStackRef = useRef<EditorHistorySnapshot[]>([]);
  const redoStackRef = useRef<EditorHistorySnapshot[]>([]);
  const [historySize, setHistorySize] = useState({ redo: 0, undo: 0 });
  draftModelRef.current = draftModel;
  const copy = copyByLocale[locale];
  const viewLabels = useMemo<[string, string, string, string, string, string]>(
    () => [copy.viewRight, copy.viewLeft, copy.viewTop, copy.viewBottom, copy.viewFront, copy.viewBack],
    [copy],
  );
  const isDirty = comparableModel(savedModel) !== comparableModel(draftModel);
  const featureGroups = useMemo(() => draftModel?.featureGraph.groups ?? [], [draftModel?.featureGraph.groups]);
  const selectedFeatures = !selectedGroupId
    ? draftModel?.featureGraph.features.filter((feature) => selectedFeatureIds.includes(feature.id)) ?? []
    : [];
  const selectedFeature = selectedFeatures.length === 1
    ? selectedFeatures[0]
    : null;
  const selectedGroup = selectedGroupId
    ? featureGroups.find((group) => group.id === selectedGroupId) ?? null
    : null;
  const selectedTransformTarget = selectedGroup ?? selectedFeature;
  const selectedViewportFeatureIds = useMemo(
    () => selectedGroup ? selectedGroup.featureIds : selectedFeatureIds,
    [selectedFeatureIds, selectedGroup],
  );
  const selectedOperationFeatures = useMemo(
    () => selectedViewportFeatureIds.flatMap((featureId) => {
      const feature = draftModel?.featureGraph.features.find((item) => item.id === featureId);
      return feature ? [feature] : [];
    }),
    [draftModel?.featureGraph.features, selectedViewportFeatureIds],
  );
  const transformMode: TransformMode = activeObjectTool === "translate"
    || activeObjectTool === "rotate"
    || activeObjectTool === "scale"
    ? activeObjectTool
    : null;
  const groupedFeatureIds = useMemo(
    () => new Set(featureGroups.flatMap((group) => group.featureIds)),
    [featureGroups],
  );
  const ungroupedFeatures = draftModel?.featureGraph.features.filter((feature) => !groupedFeatureIds.has(feature.id)) ?? [];
  const contextFeatureIds = treeMenu?.target.kind === "feature"
    ? [treeMenu.target.featureId]
    : treeMenu?.target.kind === "selection"
      ? treeMenu.target.featureIds
      : [];
  const contextGroupId = treeMenu?.target.kind === "group" ? treeMenu.target.groupId : null;
  const selectedFeatureGroup = selectedFeature
    ? featureGroups.find((group) => group.featureIds.includes(selectedFeature.id)) ?? null
    : null;
  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(locale === "zh-CN" ? "zh-CN" : "en-US", { maximumFractionDigits: 2 }),
    [locale],
  );
  const formatNumber = (value: number) => numberFormatter.format(value);
  const selectedFeatureSize = selectedFeature?.type === "box"
    ? `${formatNumber(selectedFeature.parameters.width * Math.abs(selectedFeature.scale?.[0] ?? 1))} × ${formatNumber(selectedFeature.parameters.depth * Math.abs(selectedFeature.scale?.[2] ?? 1))} × ${formatNumber(selectedFeature.parameters.height * Math.abs(selectedFeature.scale?.[1] ?? 1))} ${draftModel?.unit ?? "mm"}`
    : selectedFeature?.type === "cylinder"
      ? `⌀${formatNumber(selectedFeature.parameters.radius * 2 * Math.max(Math.abs(selectedFeature.scale?.[0] ?? 1), Math.abs(selectedFeature.scale?.[2] ?? 1)))} × ${formatNumber(selectedFeature.parameters.height * Math.abs(selectedFeature.scale?.[1] ?? 1))} ${draftModel?.unit ?? "mm"}`
      : selectedFeature?.type === "mesh"
        ? `${meshDimensions(selectedFeature).map(formatNumber).join(" × ")} ${draftModel?.unit ?? "mm"}`
        : "";
  const selectedFeatureVolume = selectedFeature?.type === "box"
    ? selectedFeature.parameters.width * selectedFeature.parameters.depth * selectedFeature.parameters.height * Math.abs((selectedFeature.scale?.[0] ?? 1) * (selectedFeature.scale?.[1] ?? 1) * (selectedFeature.scale?.[2] ?? 1))
    : selectedFeature?.type === "cylinder"
      ? Math.PI * selectedFeature.parameters.radius ** 2 * selectedFeature.parameters.height * Math.abs((selectedFeature.scale?.[0] ?? 1) * (selectedFeature.scale?.[1] ?? 1) * (selectedFeature.scale?.[2] ?? 1))
      : selectedFeature?.type === "mesh"
        ? meshVolume(selectedFeature)
        : 0;
  const selectedFeatureTriangles = selectedFeature?.type === "box"
    ? 12
    : selectedFeature?.type === "cylinder"
      ? 256
      : selectedFeature?.type === "mesh"
        ? Math.floor(selectedFeature.parameters.indices.length / 3)
        : 0;
  const statusPath = [
    { id: "project", label: copy.untitledProject },
    { id: "models", label: copy.models },
    ...(draftModel ? [{ id: `model-${draftModel.id}`, label: draftModel.name }] : []),
    ...(selectedGroup ? [{ id: `group-${selectedGroup.id}`, label: selectedGroup.name }] : []),
    ...(selectedFeatureGroup ? [{ id: `group-${selectedFeatureGroup.id}`, label: selectedFeatureGroup.name }] : []),
    ...(selectedFeature ? [{ id: `feature-${selectedFeature.id}`, label: selectedFeature.name }] : []),
    ...(selectedFeatures.length > 1 ? [{ id: "selection", label: `${copy.selectedObjects} ${selectedFeatures.length}` }] : []),
  ];

  const syncHistorySize = () => {
    setHistorySize({ redo: redoStackRef.current.length, undo: undoStackRef.current.length });
  };

  const clearHistory = () => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    syncHistorySize();
  };

  const captureHistorySnapshot = (model: ModelRecord): EditorHistorySnapshot => ({
    content: structuredClone({
      description: model.description,
      featureGraph: model.featureGraph,
      name: model.name,
      unit: model.unit,
    }),
    expandedGroupIds: [...expandedGroupIds],
    inspectorTab: activeInspectorTab,
    selectedFeatureIds: [...selectedFeatureIds],
    selectedGroupId,
  });

  const restoreHistorySnapshot = (snapshot: EditorHistorySnapshot) => {
    const current = draftModelRef.current;
    if (!current) return;
    const next = cloneModel({ ...current, ...structuredClone(snapshot.content) });
    draftModelRef.current = next;
    setDraftModel(next);
    setSelectedFeatureIds([...snapshot.selectedFeatureIds]);
    setSelectedGroupId(snapshot.selectedGroupId);
    setActiveInspectorTab(snapshot.inspectorTab);
    setExpandedGroupIds([...snapshot.expandedGroupIds]);
    setTreeMenu(null);
    setSaveState("idle");
    setStatusDetail("");
  };

  const updateDraftWithHistory = (update: (current: ModelRecord) => ModelRecord) => {
    const current = draftModelRef.current;
    if (!current) return;
    const next = update(current);
    if (comparableModel(current) === comparableModel(next)) return;
    undoStackRef.current.push(captureHistorySnapshot(current));
    if (undoStackRef.current.length > 100) undoStackRef.current.shift();
    redoStackRef.current = [];
    draftModelRef.current = next;
    setDraftModel(next);
    setSaveState("idle");
    setStatusDetail("");
    syncHistorySize();
  };

  const undo = () => {
    const current = draftModelRef.current;
    const previous = undoStackRef.current.pop();
    if (!current || !previous) return;
    redoStackRef.current.push(captureHistorySnapshot(current));
    restoreHistorySnapshot(previous);
    syncHistorySize();
  };

  const redo = () => {
    const current = draftModelRef.current;
    const next = redoStackRef.current.pop();
    if (!current || !next) return;
    undoStackRef.current.push(captureHistorySnapshot(current));
    restoreHistorySnapshot(next);
    syncHistorySize();
  };

  useEffect(() => {
    const handleHistoryShortcut = (event: KeyboardEvent) => {
      if ((!event.metaKey && !event.ctrlKey) || event.key.toLowerCase() !== "z") return;
      const target = event.target;
      if (target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || target instanceof HTMLSelectElement
        || (target instanceof HTMLElement && target.isContentEditable)) return;
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", handleHistoryShortcut);
    return () => window.removeEventListener("keydown", handleHistoryShortcut);
  }, [activeInspectorTab, expandedGroupIds, historySize.redo, historySize.undo, selectedFeatureIds, selectedGroupId]);

  useEffect(() => {
    const handleToolShortcut = (event: KeyboardEvent) => {
      const target = event.target;
      if (event.metaKey || event.ctrlKey || event.altKey
        || target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || target instanceof HTMLSelectElement
        || (target instanceof HTMLElement && target.isContentEditable)
        || selectedViewportFeatureIds.length === 0) return;
      const shortcut = event.key.toLowerCase();
      const mode = shortcut === "m" ? "translate" : shortcut === "r" ? "rotate" : shortcut === "s" ? "scale" : null;
      if (!mode) return;
      event.preventDefault();
      setOperationError("");
      setActiveObjectTool((current) => current === mode ? null : mode);
    };
    window.addEventListener("keydown", handleToolShortcut);
    return () => window.removeEventListener("keydown", handleToolShortcut);
  }, [selectedViewportFeatureIds.length]);

  useEffect(() => {
    if (selectedViewportFeatureIds.length === 0) setActiveObjectTool(null);
  }, [selectedViewportFeatureIds.length]);

  const applyModel = (model: ModelRecord, options: { preserveHistory?: boolean } = {}) => {
    const next = cloneModel(model);
    if (!options.preserveHistory) clearHistory();
    setSavedModel(next);
    const nextDraft = cloneModel(model);
    draftModelRef.current = nextDraft;
    setDraftModel(nextDraft);
    setSelectedGroupId((current) => next.featureGraph.groups?.some((group) => group.id === current) ? current : null);
    setSelectedFeatureIds((current) => {
      const existing = current.filter((featureId) => model.featureGraph.features.some((feature) => feature.id === featureId));
      return existing.length > 0 ? existing : model.featureGraph.features[0] ? [model.featureGraph.features[0].id] : [];
    });
    setExpandedModelIds((current) => current.includes(model.id) ? current : [...current, model.id]);
    setExpandedGroupIds((current) => [
      ...new Set([...current, ...(next.featureGraph.groups ?? []).map((group) => group.id)]),
    ]);
    setModels((current) => [model, ...current.filter((item) => item.id !== model.id)]);
    setSaveState("idle");
    setStatusDetail("");
  };

  useEffect(() => {
    Promise.all([getHealth(), listModels()])
      .then(([, modelList]) => {
        setModels(modelList.items);
        const firstModel = modelList.items[0];
        if (firstModel) {
          const normalized = cloneModel(firstModel);
          setSavedModel(normalized);
          setDraftModel(cloneModel(firstModel));
          setSelectedFeatureIds(firstModel.featureGraph.features[0] ? [firstModel.featureGraph.features[0].id] : []);
          setExpandedModelIds([firstModel.id]);
          setExpandedGroupIds((normalized.featureGraph.groups ?? []).map((group) => group.id));
        }
        setServiceState("online");
      })
      .catch(() => setServiceState("offline"));
  }, []);

  useEffect(() => {
    window.localStorage.setItem("solidloom.locale", locale);
    document.documentElement.lang = locale;
    document.title = copy.pageTitle;
  }, [copy.pageTitle, locale]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      document.documentElement.dataset.theme = theme === "system" ? (media.matches ? "dark" : "light") : theme;
    };
    window.localStorage.setItem("solidloom.theme", theme);
    applyTheme();
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem("solidloom.layout.libraryWidth.v1", String(libraryWidth));
  }, [libraryWidth]);

  useEffect(() => {
    window.localStorage.setItem("solidloom.layout.inspectorWidth.v1", String(inspectorWidth));
  }, [inspectorWidth]);

  useEffect(() => () => resizeCleanupRef.current?.(), []);

  useEffect(() => {
    const closeMenu = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
      if (treeMenuRef.current && !treeMenuRef.current.contains(event.target as Node)) setTreeMenu(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setTreeMenu(null);
        setCreateDialogOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeMenu);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeMenu);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const serviceLabel = serviceState === "checking"
    ? copy.connecting
    : serviceState === "online"
      ? copy.serviceOnline
      : copy.serviceOffline;

  const saveLabel = saveState === "saving"
    ? copy.saving
    : saveState === "saved"
      ? copy.saved
      : saveState === "error"
        ? copy.saveFailed
        : isDirty
          ? copy.unsaved
          : copy.ready;
  const showEditorStatus = isDirty || saveState !== "idle" || Boolean(statusDetail);
  const editorStatusClass = isDirty && saveState === "idle" ? "dirty" : saveState;

  useEffect(() => {
    if (saveState !== "saved") return;
    const timeout = window.setTimeout(() => setSaveState("idle"), 1800);
    return () => window.clearTimeout(timeout);
  }, [saveState]);

  const beginResize = (
    event: ReactPointerEvent<HTMLDivElement>,
    cursorClass: "resizing-column" | "resizing-row",
    update: (deltaX: number, deltaY: number) => void,
  ) => {
    event.preventDefault();
    resizeCleanupRef.current?.();
    const startX = event.clientX;
    const startY = event.clientY;
    const onPointerMove = (moveEvent: PointerEvent) => update(moveEvent.clientX - startX, moveEvent.clientY - startY);
    const cleanup = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", cleanup);
      window.removeEventListener("pointercancel", cleanup);
      document.body.classList.remove("resizing-column", "resizing-row");
      resizeCleanupRef.current = null;
    };
    resizeCleanupRef.current = cleanup;
    document.body.classList.add(cursorClass);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", cleanup);
    window.addEventListener("pointercancel", cleanup);
  };

  const resizeWithKeyboard = (
    event: ReactKeyboardEvent<HTMLDivElement>,
    orientation: "horizontal" | "vertical",
    update: (delta: number) => void,
  ) => {
    const delta = orientation === "vertical"
      ? event.key === "ArrowRight" ? 10 : event.key === "ArrowLeft" ? -10 : 0
      : event.key === "ArrowDown" ? 10 : event.key === "ArrowUp" ? -10 : 0;
    if (delta !== 0) {
      event.preventDefault();
      update(delta);
    }
  };

  const selectModel = async (model: ModelRecord) => {
    if (draftModel?.id === model.id) return;
    try {
      const freshModel = await getModel(model.id);
      applyModel(freshModel);
      setActiveInspectorTab("features");
    } catch (error) {
      setSaveState("error");
      setStatusDetail(error instanceof Error ? error.message : String(error));
    }
  };

  const handleCreateModel = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = createName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const model = await createModel({ name });
      applyModel(model);
      setCreateName("");
      setCreateDialogOpen(false);
      setProjectExpanded(true);
      setModelsExpanded(true);
      setActiveInspectorTab("features");
    } catch (error) {
      setSaveState("error");
      setStatusDetail(error instanceof Error ? error.message : String(error));
    } finally {
      setCreating(false);
    }
  };

  const saveChanges = async () => {
    if (!draftModel || !savedModel || !isDirty || saveState === "saving") return;
    setSaveState("saving");
    setStatusDetail("");
    let current = savedModel;
    try {
      const metadataChanged = current.name !== draftModel.name
        || current.description !== draftModel.description
        || current.unit !== draftModel.unit;
      if (metadataChanged) {
        current = await updateModel(current.id, {
          expectedRevision: current.revision,
          name: draftModel.name,
          description: draftModel.description,
          unit: draftModel.unit,
        });
      }
      if (JSON.stringify(current.featureGraph) !== JSON.stringify(draftModel.featureGraph)) {
        current = await replaceFeatureGraph(current.id, current.revision, draftModel.featureGraph);
      }
      applyModel(current, { preserveHistory: true });
      setSaveState("saved");
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        const latest = await getModel(draftModel.id);
        applyModel(latest);
        setSaveState("error");
        setStatusDetail(copy.conflictReloaded);
      } else {
        setSaveState("error");
        setStatusDetail(error instanceof Error ? error.message : String(error));
      }
    }
  };

  const updateBoxParameter = (key: keyof BoxFeature["parameters"], value: number) => {
    if (!Number.isFinite(value) || value <= 0) return;
    updateDraftWithHistory((current) => {
      const features = current.featureGraph.features.map((feature) => feature.id === selectedFeature?.id && feature.type === "box"
        ? { ...feature, parameters: { ...feature.parameters, [key]: value } }
        : feature);
      return { ...current, featureGraph: { ...current.featureGraph, features } };
    });
  };

  const updateCylinderParameter = (key: keyof CylinderFeature["parameters"], value: number) => {
    if (!Number.isFinite(value) || value <= 0) return;
    updateDraftWithHistory((current) => {
      const features = current.featureGraph.features.map((feature) => feature.id === selectedFeature?.id && feature.type === "cylinder"
        ? { ...feature, parameters: { ...feature.parameters, [key]: value } }
        : feature);
      return { ...current, featureGraph: { ...current.featureGraph, features } };
    });
  };

  const updateFeatureGroups = (update: (groups: FeatureGroup[]) => FeatureGroup[]) => {
    updateDraftWithHistory((current) => ({
      ...current,
      featureGraph: {
        ...current.featureGraph,
        groups: update(current.featureGraph.groups ?? []),
      },
    }));
  };

  const selectFeatureFromPointer = (featureId: string | null, additive: boolean) => {
    setTreeMenu(null);
    if (!featureId) {
      if (!additive) {
        setSelectedFeatureIds([]);
        setSelectedGroupId(null);
        setActiveInspectorTab("properties");
      }
      return;
    }

    if (!additive) {
      setSelectedFeatureIds([featureId]);
      setSelectedGroupId(null);
      setActiveInspectorTab("features");
      return;
    }

    const groupSelection = selectedGroup?.featureIds ?? [];
    setSelectedFeatureIds((current) => {
      const base = groupSelection.length > 0 ? groupSelection : current;
      return base.includes(featureId) ? base.filter((id) => id !== featureId) : [...base, featureId];
    });
    setSelectedGroupId(null);
    setActiveInspectorTab("features");
  };

  const selectGroupFromTree = (group: FeatureGroup, additive: boolean) => {
    if (!additive) {
      setSelectedFeatureIds([]);
      setSelectedGroupId(group.id);
      setActiveInspectorTab("features");
      return;
    }

    const groupSelection = selectedGroup?.featureIds ?? [];
    setSelectedFeatureIds((current) => {
      const base = groupSelection.length > 0 ? groupSelection : current;
      const allMembersSelected = group.featureIds.length > 0 && group.featureIds.every((id) => base.includes(id));
      return allMembersSelected
        ? base.filter((id) => !group.featureIds.includes(id))
        : [...new Set([...base, ...group.featureIds])];
    });
    setSelectedGroupId(null);
    setActiveInspectorTab("features");
  };

  const openContextMenu = (x: number, y: number, target: TreeMenuTarget) => {
    setMenuOpen(false);
    setTreeMenu({
      x: Math.min(x, window.innerWidth - 220),
      y: Math.min(y, window.innerHeight - 330),
      target,
    });
  };

  const openFeatureContextMenu = (featureId: string, x: number, y: number) => {
    if (selectedGroup?.featureIds.includes(featureId)) {
      openContextMenu(x, y, { kind: "group", groupId: selectedGroup.id });
      return;
    }
    if (selectedFeatureIds.includes(featureId)) {
      openContextMenu(x, y, selectedFeatureIds.length > 1
        ? { kind: "selection", featureIds: selectedFeatureIds }
        : { kind: "feature", featureId });
      return;
    }
    setSelectedFeatureIds([featureId]);
    setSelectedGroupId(null);
    setActiveInspectorTab("features");
    openContextMenu(x, y, { kind: "feature", featureId });
  };

  const openGroupContextMenu = (group: FeatureGroup, x: number, y: number) => {
    const groupAlreadySelected = selectedGroup?.id === group.id
      || (group.featureIds.length > 0 && group.featureIds.every((id) => selectedFeatureIds.includes(id)));
    if (!groupAlreadySelected) {
      setSelectedFeatureIds([]);
      setSelectedGroupId(group.id);
      setActiveInspectorTab("features");
    }
    openContextMenu(x, y, { kind: "group", groupId: group.id });
  };

  const createFeatureGroup = (featureIds: string[] = []) => {
    const groupId = window.crypto.randomUUID();
    const groupName = `${copy.newGroup} ${featureGroups.length + 1}`;
    updateFeatureGroups((groups) => [
      ...groups.map((group) => featureIds.length > 0
        ? { ...group, featureIds: group.featureIds.filter((id) => !featureIds.includes(id)) }
        : group),
      {
        id: groupId,
        name: groupName,
        featureIds,
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      },
    ]);
    setSelectedFeatureIds([]);
    setSelectedGroupId(groupId);
    setActiveInspectorTab("features");
    setExpandedGroupIds((current) => [...current, groupId]);
    setTreeMenu(null);
  };

  const moveFeaturesToGroup = (featureIds: string[], groupId: string) => {
    updateFeatureGroups((groups) => groups.map((group) => ({
      ...group,
      featureIds: group.id === groupId
        ? [...group.featureIds.filter((id) => !featureIds.includes(id)), ...featureIds]
        : group.featureIds.filter((id) => !featureIds.includes(id)),
    })));
    setExpandedGroupIds((current) => current.includes(groupId) ? current : [...current, groupId]);
    setSelectedGroupId(null);
    setSelectedFeatureIds(featureIds);
    setTreeMenu(null);
  };

  const removeFeaturesFromGroups = (featureIds: string[]) => {
    updateFeatureGroups((groups) => groups.map((group) => ({
      ...group,
      featureIds: group.featureIds.filter((id) => !featureIds.includes(id)),
    })));
    setTreeMenu(null);
  };

  const dissolveFeatureGroup = (groupId: string) => {
    updateFeatureGroups((groups) => groups.filter((group) => group.id !== groupId));
    if (selectedGroupId === groupId) setSelectedGroupId(null);
    setActiveInspectorTab("properties");
    setExpandedGroupIds((current) => current.filter((id) => id !== groupId));
    setTreeMenu(null);
  };

  const updateSelectedGroupName = (name: string) => {
    if (!selectedGroup || !name.trim()) return;
    updateFeatureGroups((groups) => groups.map((group) => group.id === selectedGroup.id ? { ...group, name } : group));
  };

  const updateSelectedGroupVector = (key: "position" | "rotation", index: number, value: number) => {
    if (!selectedGroup || !Number.isFinite(value)) return;
    updateFeatureGroups((groups) => groups.map((group) => {
      if (group.id !== selectedGroup.id) return group;
      const vector = [...group[key]] as Vector3Tuple;
      vector[index] = value;
      return { ...group, [key]: vector };
    }));
  };

  const updateSelectedTransformVector = (key: "position" | "rotation" | "scale", index: number, value: number) => {
    if (!Number.isFinite(value) || (key === "scale" && value <= 0)) return;
    updateDraftWithHistory((current) => ({
      ...current,
      featureGraph: {
        ...current.featureGraph,
        features: current.featureGraph.features.map((feature) => {
          if (selectedGroup || selectedFeatures.length !== 1 || feature.id !== selectedFeatures[0]!.id) return feature;
          const vector = [...(key === "scale" ? feature.scale ?? [1, 1, 1] : feature[key])] as Vector3Tuple;
          if (key === "scale" && uniformScale) vector.fill(value);
          else vector[index] = value;
          return { ...feature, [key]: vector };
        }),
        groups: (current.featureGraph.groups ?? []).map((group) => {
          if (!selectedGroup || group.id !== selectedGroup.id) return group;
          const vector = [...(key === "scale" ? group.scale ?? [1, 1, 1] : group[key])] as Vector3Tuple;
          if (key === "scale" && uniformScale) vector.fill(value);
          else vector[index] = value;
          return { ...group, [key]: vector };
        }),
      },
    }));
  };

  const commitViewportTransforms = (transforms: TransformCommit[]) => {
    if (transforms.length === 0) return;
    const featureTransforms = new Map(transforms.filter((transform) => transform.kind === "feature").map((transform) => [transform.id, transform]));
    const groupTransforms = new Map(transforms.filter((transform) => transform.kind === "group").map((transform) => [transform.id, transform]));
    updateDraftWithHistory((current) => ({
      ...current,
      featureGraph: {
        ...current.featureGraph,
        features: current.featureGraph.features.map((feature) => {
          const transform = featureTransforms.get(feature.id);
          return transform ? {
            ...feature,
            position: transform.position,
            rotation: transform.rotation,
            scale: transform.scale.map((value) => Math.max(0.001, Math.abs(value))) as Vector3Tuple,
          } : feature;
        }),
        groups: (current.featureGraph.groups ?? []).map((group) => {
          const transform = groupTransforms.get(group.id);
          return transform ? {
            ...group,
            position: transform.position,
            rotation: transform.rotation,
            scale: transform.scale.map((value) => Math.max(0.001, Math.abs(value))) as Vector3Tuple,
          } : group;
        }),
      },
    }));
  };

  const applyMeshResult = (result: ModelFeature, sourceIds: string[]) => {
    updateDraftWithHistory((current) => ({
      ...current,
      featureGraph: {
        ...current.featureGraph,
        features: preserveSources
          ? [...current.featureGraph.features, result]
          : [...current.featureGraph.features.filter((feature) => !sourceIds.includes(feature.id)), result],
        groups: preserveSources
          ? current.featureGraph.groups ?? []
          : (current.featureGraph.groups ?? [])
            .map((group) => ({ ...group, featureIds: group.featureIds.filter((id) => !sourceIds.includes(id)) }))
            .filter((group) => group.featureIds.length > 0),
      },
    }));
    setExpandedGroupIds((current) => current.filter((groupId) => featureGroups.some((group) => group.id === groupId && (preserveSources || group.featureIds.some((id) => !sourceIds.includes(id))))));
    setSelectedGroupId(null);
    setSelectedFeatureIds([result.id]);
    setActiveInspectorTab("features");
    setActiveObjectTool(null);
    setOperationError("");
  };

  const executeBooleanOperation = () => {
    if (selectedOperationFeatures.length < 2) return;
    try {
      const result = evaluateBoolean(selectedOperationFeatures, featureGroups, booleanOperation, `${copy.booleanResult} · ${copy[booleanOperation]}`);
      applyMeshResult(result, selectedOperationFeatures.map((feature) => feature.id));
    } catch (error) {
      setOperationError(`${copy.operationFailed}：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const executePlaneCutOperation = () => {
    if (selectedOperationFeatures.length === 0) return;
    try {
      const result = evaluatePlaneCut(selectedOperationFeatures, featureGroups, cutRotation, cutOffset, keepPositive, copy.cutResult);
      applyMeshResult(result, selectedOperationFeatures.map((feature) => feature.id));
    } catch (error) {
      setOperationError(`${copy.operationFailed}：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const toggleObjectTool = (tool: ObjectTool) => {
    setOperationError("");
    setAnnotationMode(false);
    setActiveObjectTool((current) => current === tool ? null : tool);
  };

  return (
    <div
      className={`studio-shell${libraryCollapsed ? " library-collapsed" : ""}`}
      style={{
        "--library-width": libraryCollapsed ? "0px" : `${libraryWidth}px`,
        "--inspector-width": `${inspectorWidth}px`,
      } as CSSProperties}
    >
      <header className="topbar">
        {!libraryCollapsed && (
          <div className="brand" aria-label="SolidLoom">
            <span className="brand-mark"><Layers3 size={18} /></span>
            <span className="brand-name">SolidLoom</span>
            <button className="collapse-button" type="button" aria-label={copy.collapseLibrary} title={copy.collapseLibrary} onClick={() => setLibraryCollapsed(true)}>
              <PanelLeftClose size={16} />
            </button>
          </div>
        )}

        <div className="topbar-main">
          {libraryCollapsed && (
            <button className="expand-button" type="button" aria-label={copy.expandLibrary} title={copy.expandLibrary} onClick={() => setLibraryCollapsed(false)}>
              <PanelLeftOpen size={16} />
            </button>
          )}
          <div className="document-title">
            <FileBox size={15} />
            <span>{draftModel?.name ?? copy.noModel}</span>
            {draftModel && <small>{copy.revision} {draftModel.revision}</small>}
          </div>
        </div>

        <div className="top-actions">
          <button className="icon-button" type="button" aria-label={copy.undo} title={copy.undo} disabled={historySize.undo === 0} onClick={undo}><Undo2 size={16} /></button>
          <button className="icon-button" type="button" aria-label={copy.redo} title={copy.redo} disabled={historySize.redo === 0} onClick={redo}><Redo2 size={16} /></button>
          <button className="icon-button save-button" type="button" aria-label={copy.save} title={copy.save} disabled={!isDirty || saveState === "saving"} onClick={saveChanges}>
            <Save size={16} />
          </button>
        </div>
      </header>

      {!libraryCollapsed && (
        <aside className="library-panel">
          <div
            className="panel-resizer library-resizer"
            role="separator"
            tabIndex={0}
            aria-label={copy.resizeProjectTree}
            aria-orientation="vertical"
            aria-valuemin={180}
            aria-valuemax={420}
            aria-valuenow={libraryWidth}
            onPointerDown={(event) => {
              const startWidth = libraryWidth;
              const maximum = Math.min(420, Math.max(180, window.innerWidth - inspectorWidth - 420));
              beginResize(event, "resizing-column", (deltaX) => setLibraryWidth(clamp(startWidth + deltaX, 180, maximum)));
            }}
            onKeyDown={(event) => resizeWithKeyboard(event, "vertical", (delta) => {
              const maximum = Math.min(420, Math.max(180, window.innerWidth - inspectorWidth - 420));
              setLibraryWidth((width) => clamp(width + delta, 180, maximum));
            })}
          />
          <div
            className="project-tree"
            role="tree"
            aria-label={copy.projectTree}
            aria-multiselectable="true"
            onContextMenu={(event) => {
              event.preventDefault();
              setMenuOpen(false);
              setTreeMenu({
                x: Math.min(event.clientX, window.innerWidth - 210),
                y: Math.min(event.clientY, window.innerHeight - 320),
                target: { kind: "tree" },
              });
            }}
          >
            <button className="tree-row tree-root" data-depth="0" type="button" role="treeitem" aria-expanded={projectExpanded} onClick={() => setProjectExpanded((value) => !value)}>
              {projectExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <FolderTree size={16} />
              <span>{copy.untitledProject}</span>
            </button>

            {projectExpanded && (
              <div className="tree-group" role="group">
                <button className="tree-row" data-depth="1" type="button" role="treeitem" aria-expanded={modelsExpanded} onClick={() => setModelsExpanded((value) => !value)}>
                  {modelsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  {modelsExpanded ? <FolderOpen size={16} /> : <Folder size={16} />}
                  <span>{copy.models}</span>
                </button>

                {modelsExpanded && (
                  <div className="tree-group tree-models" role="group">
                    {models.length > 0 ? models.map((model) => {
                      const isCurrentModel = draftModel?.id === model.id;
                      const isSelectedModel = isCurrentModel && selectedFeatureIds.length === 0 && !selectedGroup;
                      const isModelExpanded = isCurrentModel && expandedModelIds.includes(model.id);
                      return (
                        <div className="tree-model-entry" role="none" key={model.id}>
                          <button
                            className={`tree-row tree-model${isSelectedModel ? " selected" : ""}`}
                            data-depth="2"
                            type="button"
                            role="treeitem"
                            aria-expanded={isModelExpanded}
                            aria-selected={isSelectedModel}
                            onClick={() => {
                              if (!isCurrentModel) {
                                void selectModel(model).then(() => {
                                  setSelectedFeatureIds([]);
                                  setSelectedGroupId(null);
                                  setActiveInspectorTab("properties");
                                });
                                setExpandedModelIds((current) => current.includes(model.id) ? current : [...current, model.id]);
                              } else if (selectedFeatureIds.length > 0 || selectedGroup) {
                                setSelectedFeatureIds([]);
                                setSelectedGroupId(null);
                                setActiveInspectorTab("properties");
                              } else {
                                setExpandedModelIds((current) => current.includes(model.id)
                                  ? current.filter((id) => id !== model.id)
                                  : [...current, model.id]);
                              }
                            }}
                            onContextMenu={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              setTreeMenu({
                                x: Math.min(event.clientX, window.innerWidth - 210),
                                y: Math.min(event.clientY, window.innerHeight - 320),
                                target: { kind: "model", modelId: model.id },
                              });
                            }}
                          >
                            {isModelExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            <FileBox size={15} />
                            <span>{model.name}</span>
                            <small>{copy.revision} {model.revision}</small>
                          </button>

                          {isModelExpanded && draftModel && (
                            <div className="tree-group tree-features" role="group">
                              {featureGroups.map((group) => {
                                const isGroupExpanded = expandedGroupIds.includes(group.id);
                                const isGroupSelected = selectedGroup?.id === group.id
                                  || (group.featureIds.length > 0 && group.featureIds.every((id) => selectedFeatureIds.includes(id)));
                                return (
                                  <div className="tree-group-entry" role="none" key={group.id}>
                                    <button
                                      className={`tree-row tree-feature-group${isGroupSelected ? " selected" : ""}`}
                                      data-depth="3"
                                      type="button"
                                      role="treeitem"
                                      aria-expanded={isGroupExpanded}
                                      aria-selected={isGroupSelected}
                                      onClick={(event) => {
                                        const additive = event.metaKey || event.ctrlKey;
                                        selectGroupFromTree(group, additive);
                                        if (!additive && isGroupSelected) {
                                          setExpandedGroupIds((current) => current.includes(group.id)
                                            ? current.filter((id) => id !== group.id)
                                            : [...current, group.id]);
                                        } else {
                                          setExpandedGroupIds((current) => current.includes(group.id) ? current : [...current, group.id]);
                                        }
                                      }}
                                      onContextMenu={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        openGroupContextMenu(group, event.clientX, event.clientY);
                                      }}
                                    >
                                      {isGroupExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                      {isGroupExpanded ? <FolderOpen size={15} /> : <Folder size={15} />}
                                      <span>{group.name}</span>
                                      <small>{group.featureIds.length}</small>
                                    </button>
                                    {isGroupExpanded && (
                                      <div className="tree-group" role="group">
                                        {group.featureIds.map((featureId) => {
                                          const feature = draftModel.featureGraph.features.find((item) => item.id === featureId);
                                          if (!feature) return null;
                                          return (
                                            <button
                                              className={`tree-row tree-feature${selectedFeatureIds.includes(feature.id) ? " selected" : ""}`}
                                              data-depth="4"
                                              type="button"
                                              role="treeitem"
                                              aria-selected={selectedFeatureIds.includes(feature.id)}
                                              key={feature.id}
                                              onClick={(event) => selectFeatureFromPointer(feature.id, event.metaKey || event.ctrlKey)}
                                              onContextMenu={(event) => {
                                                event.preventDefault();
                                                event.stopPropagation();
                                                openFeatureContextMenu(feature.id, event.clientX, event.clientY);
                                              }}
                                            >
                                              <span className="tree-spacer" />
                                              {feature.type === "box" ? <Cuboid size={15} /> : feature.type === "cylinder" ? <Cylinder size={15} /> : <Layers3 size={15} />}
                                              <span>{feature.name}</span>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}

                              {ungroupedFeatures.map((feature) => (
                                <button
                                  className={`tree-row tree-feature${selectedFeatureIds.includes(feature.id) ? " selected" : ""}`}
                                  data-depth="3"
                                  type="button"
                                  role="treeitem"
                                  aria-selected={selectedFeatureIds.includes(feature.id)}
                                  key={feature.id}
                                  onClick={(event) => selectFeatureFromPointer(feature.id, event.metaKey || event.ctrlKey)}
                                  onContextMenu={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    openFeatureContextMenu(feature.id, event.clientX, event.clientY);
                                  }}
                                >
                                  <span className="tree-spacer" />
                                  {feature.type === "box" ? <Cuboid size={15} /> : feature.type === "cylinder" ? <Cylinder size={15} /> : <Layers3 size={15} />}
                                  <span>{feature.name}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    }) : (
                      <div className="tree-empty" data-depth="2" role="treeitem">
                        <span className="tree-spacer" />
                        <span className="tree-empty-dot" />
                        <span>{copy.emptyModels}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {treeMenu && (
            <div className="tree-context-menu" ref={treeMenuRef} role="menu" style={{ left: treeMenu.x, top: treeMenu.y }}>
              {(treeMenu.target.kind === "tree" || treeMenu.target.kind === "model") && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setCreateName(copy.untitledModel);
                    setCreateDialogOpen(true);
                    setTreeMenu(null);
                  }}
                >
                  <Plus size={15} />
                  <span>{copy.createModel}</span>
                </button>
              )}

              {draftModel && treeMenu.target.kind !== "group"
                && (treeMenu.target.kind !== "model" || treeMenu.target.modelId === draftModel.id) && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => createFeatureGroup(contextFeatureIds)}
                >
                  <Folder size={15} />
                  <span>{copy.createGroup}</span>
                </button>
              )}

              {contextFeatureIds.length > 0 && featureGroups.some((group) => group.featureIds.some((id) => contextFeatureIds.includes(id))) && (
                <button type="button" role="menuitem" onClick={() => removeFeaturesFromGroups(contextFeatureIds)}>
                  <ChevronRight size={15} />
                  <span>{copy.removeFromGroup}</span>
                </button>
              )}

              {contextFeatureIds.length > 0 && featureGroups
                .filter((group) => !contextFeatureIds.every((id) => group.featureIds.includes(id)))
                .map((group) => (
                  <button type="button" role="menuitem" key={group.id} onClick={() => moveFeaturesToGroup(contextFeatureIds, group.id)}>
                    <FolderOpen size={15} />
                    <span>{copy.moveToGroup} · {group.name}</span>
                  </button>
                ))}

              {contextGroupId && (
                <button type="button" role="menuitem" onClick={() => dissolveFeatureGroup(contextGroupId)}>
                  <Layers3 size={15} />
                  <span>{copy.dissolveGroup}</span>
                </button>
              )}

              <div className="context-divider" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  const shouldExpand = !projectExpanded || !modelsExpanded;
                  setProjectExpanded(shouldExpand);
                  setModelsExpanded(shouldExpand);
                  setExpandedModelIds(shouldExpand ? models.map((model) => model.id) : []);
                  setExpandedGroupIds(shouldExpand ? featureGroups.map((group) => group.id) : []);
                  setTreeMenu(null);
                }}
              >
                {projectExpanded && modelsExpanded ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                <span>{projectExpanded && modelsExpanded ? copy.collapseTree : copy.expandTree}</span>
              </button>
            </div>
          )}

          <div className="library-footer" ref={menuRef}>
            {menuOpen && (
              <div className="workspace-menu" id="workspace-menu" role="dialog" aria-label={copy.menuTitle}>
                <div className="menu-section-label menu-heading"><MenuIcon size={16} /><span>{copy.menuTitle}</span></div>
                <nav className="menu-links">
                  <a href="/llms.txt" target="_blank" rel="noreferrer"><Braces size={16} /><span>{copy.agentGuide}</span><ExternalLink size={13} /></a>
                  <a href="/docs" target="_blank" rel="noreferrer"><CircleDot size={16} /><span>{copy.apiDocs}</span><ExternalLink size={13} /></a>
                </nav>
                <div className="menu-divider" />
                <div className="preference-group">
                  <div className="menu-section-label preference-label"><Languages size={16} /><span>{copy.language}</span></div>
                  <div className="segmented-control" aria-label={copy.language}>
                    <button type="button" className={locale === "zh-CN" ? "active" : ""} onClick={() => setLocale("zh-CN")}>中文</button>
                    <button type="button" className={locale === "en" ? "active" : ""} onClick={() => setLocale("en")}>English</button>
                  </div>
                </div>
                <div className="preference-group">
                  <div className="menu-section-label preference-label"><Sun size={16} /><span>{copy.theme}</span></div>
                  <div className="theme-control" aria-label={copy.theme}>
                    <button type="button" className={theme === "light" ? "active" : ""} aria-label={copy.themeLight} title={copy.themeLight} onClick={() => setTheme("light")}><Sun size={15} /></button>
                    <button type="button" className={theme === "dark" ? "active" : ""} aria-label={copy.themeDark} title={copy.themeDark} onClick={() => setTheme("dark")}><Moon size={15} /></button>
                    <button type="button" className={theme === "system" ? "active" : ""} aria-label={copy.themeSystem} title={copy.themeSystem} onClick={() => setTheme("system")}><Monitor size={15} /></button>
                  </div>
                </div>
              </div>
            )}
            <button
              className="menu-trigger"
              type="button"
              aria-expanded={menuOpen}
              aria-controls="workspace-menu"
              aria-label={copy.menu}
              title={copy.menu}
              onClick={() => {
                setTreeMenu(null);
                setMenuOpen((value) => !value);
              }}
            >
              <MenuIcon size={17} />
              <span>{copy.menu}</span>
            </button>
          </div>
        </aside>
      )}

      {libraryCollapsed && treeMenu && (
        <div className="tree-context-menu" ref={treeMenuRef} role="menu" style={{ left: treeMenu.x, top: treeMenu.y }}>
          {treeMenu.target.kind !== "group" && (
            <button type="button" role="menuitem" onClick={() => createFeatureGroup(contextFeatureIds)}>
              <Folder size={15} />
              <span>{copy.createGroup}</span>
            </button>
          )}
          {contextFeatureIds.length > 0 && featureGroups.some((group) => group.featureIds.some((id) => contextFeatureIds.includes(id))) && (
            <button type="button" role="menuitem" onClick={() => removeFeaturesFromGroups(contextFeatureIds)}>
              <ChevronRight size={15} />
              <span>{copy.removeFromGroup}</span>
            </button>
          )}
          {contextFeatureIds.length > 0 && featureGroups
            .filter((group) => !contextFeatureIds.every((id) => group.featureIds.includes(id)))
            .map((group) => (
              <button type="button" role="menuitem" key={group.id} onClick={() => moveFeaturesToGroup(contextFeatureIds, group.id)}>
                <FolderOpen size={15} />
                <span>{copy.moveToGroup} · {group.name}</span>
              </button>
            ))}
          {contextGroupId && (
            <button type="button" role="menuitem" onClick={() => dissolveFeatureGroup(contextGroupId)}>
              <Layers3 size={15} />
              <span>{copy.dissolveGroup}</span>
            </button>
          )}
        </div>
      )}

      <main className="viewport-panel">
        <div className="viewport-toolbar" role="toolbar" aria-label={copy.contextTools}>
          <div className="viewport-tool-group" aria-label={copy.contextTools}>
            {!draftModel && (
              <button type="button" aria-label={copy.createModel} title={copy.createModel} onClick={() => {
                setCreateName(copy.untitledModel);
                setCreateDialogOpen(true);
              }}>
                <Plus size={16} />
              </button>
            )}
            {draftModel && selectedFeatures.length === 0 && !selectedGroup && (
              <>
                <button type="button" aria-label={copy.metadata} title={copy.metadata} className={activeInspectorTab === "properties" ? "tool-active" : ""} onClick={() => setActiveInspectorTab("properties")}>
                  <FileBox size={16} />
                </button>
                <button type="button" aria-label={copy.createGroup} title={copy.createGroup} onClick={() => createFeatureGroup()}>
                  <Folder size={16} />
                </button>
              </>
            )}
            {selectedViewportFeatureIds.length > 0 && (
              <>
                <button type="button" className={activeObjectTool === "translate" ? "tool-active" : ""} aria-label={copy.moveTool} title={`${copy.moveTool} [M]`} onClick={() => toggleObjectTool("translate")}>
                  <Move3D size={16} />
                </button>
                <button type="button" className={activeObjectTool === "rotate" ? "tool-active" : ""} aria-label={copy.rotateTool} title={`${copy.rotateTool} [R]`} onClick={() => toggleObjectTool("rotate")}>
                  <Rotate3D size={16} />
                </button>
                <button type="button" className={activeObjectTool === "scale" ? "tool-active" : ""} aria-label={copy.scaleTool} title={`${copy.scaleTool} [S]`} onClick={() => toggleObjectTool("scale")}>
                  <Scaling size={16} />
                </button>
                <span className="viewport-tool-divider" aria-hidden="true" />
                <button type="button" className={activeObjectTool === "plane-cut" ? "tool-active" : ""} aria-label={copy.planeCutTool} title={copy.planeCutTool} onClick={() => toggleObjectTool("plane-cut")}>
                  <Slice size={16} />
                </button>
                {selectedViewportFeatureIds.length > 1 && (
                  <button type="button" className={activeObjectTool === "boolean" ? "tool-active" : ""} aria-label={copy.booleanTool} title={copy.booleanTool} onClick={() => toggleObjectTool("boolean")}>
                    <Combine size={16} />
                  </button>
                )}
                <span className="viewport-tool-divider" aria-hidden="true" />
              </>
            )}
            {selectedFeature && (
              <>
                <button type="button" aria-label={copy.parameters} title={copy.parameters} className={activeInspectorTab === "features" ? "tool-active" : ""} onClick={() => setActiveInspectorTab("features")}>
                  <Settings2 size={16} />
                </button>
                {selectedFeatureGroup ? (
                  <button type="button" aria-label={copy.removeFromGroup} title={copy.removeFromGroup} onClick={() => removeFeaturesFromGroups([selectedFeature.id])}>
                    <FolderMinus size={16} />
                  </button>
                ) : (
                  <button type="button" aria-label={copy.createGroup} title={copy.createGroup} onClick={() => createFeatureGroup([selectedFeature.id])}>
                    <Folder size={16} />
                  </button>
                )}
              </>
            )}
            {selectedFeatures.length > 1 && (
              <button type="button" aria-label={copy.createGroup} title={copy.createGroup} onClick={() => createFeatureGroup(selectedFeatureIds)}>
                <Folder size={16} />
              </button>
            )}
            {selectedGroup && (
              <button type="button" aria-label={copy.dissolveGroup} title={copy.dissolveGroup} onClick={() => dissolveFeatureGroup(selectedGroup.id)}>
                <Layers3 size={16} />
              </button>
            )}
            {draftModel && (
              <>
                <span className="viewport-tool-divider" aria-hidden="true" />
                <button
                  type="button"
                  className={annotationMode ? "tool-active" : ""}
                  aria-label={copy.annotationAssist}
                  aria-pressed={annotationMode}
                  title={copy.annotationAssist}
                  onClick={() => {
                    setActiveObjectTool(null);
                    setOperationError("");
                    setAnnotationMode((value) => !value);
                  }}
                >
                  <MessageSquareText size={16} />
                </button>
              </>
            )}
          </div>
        </div>

        {activeObjectTool && selectedViewportFeatureIds.length > 0 && (
          <section className="object-tool-popover" aria-label={activeObjectTool === "translate"
            ? copy.moveTool
            : activeObjectTool === "rotate"
              ? copy.rotateTool
              : activeObjectTool === "scale"
                ? copy.scaleTool
                : activeObjectTool === "plane-cut"
                  ? copy.planeCutTool
                  : copy.booleanTool}>
            <div className="object-tool-heading">
              {activeObjectTool === "translate" ? <Move3D size={16} />
                : activeObjectTool === "rotate" ? <Rotate3D size={16} />
                  : activeObjectTool === "scale" ? <Scaling size={16} />
                    : activeObjectTool === "plane-cut" ? <Slice size={16} /> : <Combine size={16} />}
              <strong>{activeObjectTool === "translate" ? copy.moveTool
                : activeObjectTool === "rotate" ? copy.rotateTool
                  : activeObjectTool === "scale" ? copy.scaleTool
                    : activeObjectTool === "plane-cut" ? copy.planeCutTool : copy.booleanTool}</strong>
            </div>

            {(activeObjectTool === "translate" || activeObjectTool === "rotate" || activeObjectTool === "scale") && (
              selectedTransformTarget ? (
                <div className="tool-vector-grid">
                  <span />
                  {(["X", "Y", "Z"] as const).map((axis) => <b className={`axis-${axis.toLowerCase()}`} key={axis}>{axis}</b>)}
                  <span />
                  <span>{activeObjectTool === "translate" ? copy.position : activeObjectTool === "rotate" ? copy.rotationLabel : copy.scaleTool}</span>
                  {([0, 1, 2] as const).map((axis) => {
                    const vector = activeObjectTool === "translate"
                      ? selectedTransformTarget.position
                      : activeObjectTool === "rotate"
                        ? selectedTransformTarget.rotation
                        : selectedTransformTarget.scale ?? [1, 1, 1];
                    const value = activeObjectTool === "scale" ? vector[axis] * 100 : vector[axis];
                    return <input
                      key={axis}
                      type="number"
                      step={activeObjectTool === "scale" ? 1 : 0.1}
                      min={activeObjectTool === "scale" ? 1 : undefined}
                      value={Number(value.toFixed(3))}
                      onChange={(event) => updateSelectedTransformVector(
                        activeObjectTool === "translate" ? "position" : activeObjectTool === "rotate" ? "rotation" : "scale",
                        axis,
                        activeObjectTool === "scale" ? Number(event.target.value) / 100 : Number(event.target.value),
                      )}
                    />;
                  })}
                  <span className="tool-unit">{activeObjectTool === "translate" ? draftModel?.unit : activeObjectTool === "rotate" ? "°" : "%"}</span>
                </div>
              ) : <p className="object-tool-hint">{copy.multiTransformHint}</p>
            )}

            {activeObjectTool === "scale" && (
              <label className="tool-checkbox"><input type="checkbox" checked={uniformScale} onChange={(event) => setUniformScale(event.target.checked)} /> {copy.scaleTool} XYZ</label>
            )}

            {activeObjectTool === "plane-cut" && (
              <>
                <div className="tool-vector-grid">
                  <span />
                  {(["X", "Y", "Z"] as const).map((axis) => <b className={`axis-${axis.toLowerCase()}`} key={axis}>{axis}</b>)}
                  <span />
                  <span>{copy.rotationLabel}</span>
                  {([0, 1, 2] as const).map((axis) => <input key={axis} type="number" step="1" value={cutRotation[axis]} onChange={(event) => {
                    const next = [...cutRotation] as Vector3Tuple;
                    next[axis] = Number(event.target.value);
                    setCutRotation(next);
                  }} />)}
                  <span className="tool-unit">°</span>
                </div>
                <label className="tool-scalar-row"><span>{copy.offset}</span><input type="number" step="0.1" value={cutOffset} onChange={(event) => setCutOffset(Number(event.target.value))} /><small>{draftModel?.unit}</small></label>
                <label className="tool-checkbox"><input type="checkbox" checked={keepPositive} onChange={(event) => setKeepPositive(event.target.checked)} /> {copy.keepPositive}</label>
                <label className="tool-checkbox"><input type="checkbox" checked={preserveSources} onChange={(event) => setPreserveSources(event.target.checked)} /> {copy.preserveSources}</label>
                <p className="object-tool-notice">{copy.meshResultNotice}</p>
                <div className="object-tool-actions">
                  <button type="button" onClick={() => { setCutRotation([0, 0, 0]); setCutOffset(0); }}>{copy.reset}</button>
                  <button className="primary-button" type="button" onClick={executePlaneCutOperation}>{copy.execute}</button>
                </div>
              </>
            )}

            {activeObjectTool === "boolean" && (
              <>
                <div className="boolean-mode" aria-label={copy.booleanTool}>
                  {(["union", "intersection", "difference"] as const).map((operation) => <button type="button" className={booleanOperation === operation ? "active" : ""} key={operation} onClick={() => setBooleanOperation(operation)}>{copy[operation]}</button>)}
                </div>
                <p className="object-tool-hint">{copy.selectedCount} · {selectedOperationFeatures.length}</p>
                <label className="tool-checkbox"><input type="checkbox" checked={preserveSources} onChange={(event) => setPreserveSources(event.target.checked)} /> {copy.preserveSources}</label>
                <p className="object-tool-notice">{copy.meshResultNotice}</p>
                <div className="object-tool-actions">
                  <button type="button" onClick={() => setBooleanOperation("union")}>{copy.reset}</button>
                  <button className="primary-button" type="button" disabled={selectedOperationFeatures.length < 2} onClick={executeBooleanOperation}>{copy.execute}</button>
                </div>
              </>
            )}

            {operationError && <p className="object-tool-error" role="alert">{operationError}</p>}
          </section>
        )}

        {draftModel && draftModel.featureGraph.features.length > 0 && (
          <Viewport3D
            annotationMode={annotationMode}
            annotationStrings={{
              add: copy.add,
              assistActive: copy.annotationAssistActive,
              box: copy.box,
              cut: copy.cut,
              cylinder: copy.cylinder,
              feature: copy.annotationFeature,
              group: copy.annotationGroup,
              members: copy.annotationMembers,
              mesh: copy.mesh,
              path: copy.annotationPath,
            }}
            cutPlane={activeObjectTool === "plane-cut" ? { offset: cutOffset, rotation: cutRotation } : null}
            features={draftModel.featureGraph.features}
            groups={featureGroups}
            label={copy.viewportPreview}
            modelId={draftModel.id}
            modelName={draftModel.name}
            onSelectFeature={selectFeatureFromPointer}
            onSelectGroup={(groupId) => {
              const group = featureGroups.find((item) => item.id === groupId);
              if (group) selectGroupFromTree(group, false);
            }}
            onOpenContextMenu={(featureId, point) => {
              if (featureId) openFeatureContextMenu(featureId, point.x, point.y);
              else setTreeMenu(null);
            }}
            onTransformCommit={commitViewportTransforms}
            selectedFeatureIds={selectedViewportFeatureIds}
            selectedGroupId={selectedGroup?.id ?? null}
            theme={theme}
            transformMode={transformMode}
            viewCubeLabel={copy.viewCube}
            viewLabels={viewLabels}
          />
        )}

        {(selectedFeatures.length > 0 || selectedGroup) && (
          <aside className="selection-summary" aria-label={copy.selectionSummary}>
            <div className="selection-summary-heading">
              <span className="selection-summary-icon" aria-hidden="true">
                {selectedGroup ? <Folder size={16} /> : selectedFeatures.length > 1 ? <Layers3 size={16} /> : selectedFeature?.type === "box" ? <Cuboid size={16} /> : selectedFeature?.type === "cylinder" ? <Cylinder size={16} /> : <Layers3 size={16} />}
              </span>
              <span>
                <strong>{selectedGroup?.name ?? selectedFeature?.name ?? `${copy.selectedObjects} ${selectedFeatures.length}`}</strong>
                <small>{selectedGroup
                  ? copy.groups
                  : selectedFeatures.length > 1
                    ? copy.multipleSelection
                  : `${selectedFeature?.type === "box" ? copy.box : selectedFeature?.type === "cylinder" ? copy.cylinder : copy.mesh} · ${selectedFeature ? copy[selectedFeature.operation] : ""}`}</small>
              </span>
            </div>
            <dl>
              {selectedFeature && (
                <>
                  <div><dt>{copy.size}</dt><dd>{selectedFeatureSize}</dd></div>
                  <div><dt>{copy.position}</dt><dd>{selectedFeature.position.map(formatNumber).join(", ")} {draftModel?.unit}</dd></div>
                  <div><dt>{copy.volume}</dt><dd>{formatNumber(selectedFeatureVolume)} {draftModel?.unit}³</dd></div>
                  <div><dt>{copy.triangles}</dt><dd>{numberFormatter.format(selectedFeatureTriangles)}</dd></div>
                </>
              )}
              {selectedGroup && (
                <>
                  <div><dt>{copy.groupMembers}</dt><dd>{numberFormatter.format(selectedGroup.featureIds.length)}</dd></div>
                  <div><dt>{copy.position}</dt><dd>{selectedGroup.position.map(formatNumber).join(", ")} {draftModel?.unit}</dd></div>
                  <div><dt>{copy.rotationLabel}</dt><dd>{selectedGroup.rotation.map((value) => `${formatNumber(value)}°`).join(", ")}</dd></div>
                </>
              )}
              {selectedFeatures.length > 1 && (
                <div><dt>{copy.groupMembers}</dt><dd>{numberFormatter.format(selectedFeatures.length)}</dd></div>
              )}
            </dl>
          </aside>
        )}

        {!draftModel && (
          <div className="viewport-note">
            <strong>{copy.noModel}</strong>
            <p>{copy.selectModelHint}</p>
          </div>
        )}

      </main>

      <aside className="inspector-panel">
        <div
          className="panel-resizer inspector-width-resizer"
          role="separator"
          tabIndex={0}
          aria-label={copy.resizeInspectorWidth}
          aria-orientation="vertical"
          aria-valuemin={240}
          aria-valuemax={480}
          aria-valuenow={inspectorWidth}
          onPointerDown={(event) => {
            const startWidth = inspectorWidth;
            const maximum = Math.min(480, Math.max(240, window.innerWidth - (libraryCollapsed ? 0 : libraryWidth) - 420));
            beginResize(event, "resizing-column", (deltaX) => setInspectorWidth(clamp(startWidth - deltaX, 240, maximum)));
          }}
          onKeyDown={(event) => resizeWithKeyboard(event, "vertical", (delta) => {
            const maximum = Math.min(480, Math.max(240, window.innerWidth - (libraryCollapsed ? 0 : libraryWidth) - 420));
            setInspectorWidth((width) => clamp(width - delta, 240, maximum));
          })}
        />
        <div className="inspector-tabs">
          <button className={activeInspectorTab === "features" ? "active" : ""} type="button" onClick={() => setActiveInspectorTab("features")}>{copy.parameters}</button>
          <button className={activeInspectorTab === "properties" ? "active" : ""} type="button" onClick={() => setActiveInspectorTab("properties")}>{copy.properties}</button>
        </div>

        <div className="inspector-body">
          {activeInspectorTab === "features" ? (
            <div className="inspector-lower-pane">
              <section className="inspector-section properties">
                <div className="section-title"><span>{selectedGroup ? copy.groupTransform : copy.parameters}</span><Settings2 size={15} /></div>
                {selectedGroup && (
                  <>
                    <label className="group-name-row">
                      {copy.groupName}
                      <input
                        className="group-name-input"
                        aria-label={copy.groupName}
                        value={selectedGroup.name}
                        maxLength={120}
                        onChange={(event) => updateSelectedGroupName(event.target.value)}
                      />
                    </label>
                    <p className="group-member-count">{copy.groupMembers} · {selectedGroup.featureIds.length}</p>
                    {(["X", "Y", "Z"] as const).map((axis, index) => (
                      <label key={`position-${axis}`}>{copy.position} {axis} <span><input aria-label={`${copy.position} ${axis}`} type="number" step="0.1" value={selectedGroup.position[index]} onChange={(event) => updateSelectedGroupVector("position", index, Number(event.target.value))} /> {draftModel?.unit}</span></label>
                    ))}
                    {(["X", "Y", "Z"] as const).map((axis, index) => (
                      <label key={`rotation-${axis}`}>{copy.rotationLabel} {axis} <span><input aria-label={`${copy.rotationLabel} ${axis}`} type="number" step="1" value={selectedGroup.rotation[index]} onChange={(event) => updateSelectedGroupVector("rotation", index, Number(event.target.value))} /> °</span></label>
                    ))}
                  </>
                )}
                {selectedFeature?.type === "box" && (
                  <>
                    <label>{copy.width} <span><input aria-label={`${copy.width} ${draftModel?.unit ?? "mm"}`} type="number" min="0.01" step="0.1" value={selectedFeature.parameters.width} onChange={(event) => updateBoxParameter("width", Number(event.target.value))} /> {draftModel?.unit}</span></label>
                    <label>{copy.depth} <span><input aria-label={`${copy.depth} ${draftModel?.unit ?? "mm"}`} type="number" min="0.01" step="0.1" value={selectedFeature.parameters.depth} onChange={(event) => updateBoxParameter("depth", Number(event.target.value))} /> {draftModel?.unit}</span></label>
                    <label>{copy.height} <span><input aria-label={`${copy.height} ${draftModel?.unit ?? "mm"}`} type="number" min="0.01" step="0.1" value={selectedFeature.parameters.height} onChange={(event) => updateBoxParameter("height", Number(event.target.value))} /> {draftModel?.unit}</span></label>
                  </>
                )}
                {selectedFeature?.type === "cylinder" && (
                  <>
                    <label>{copy.radius} <span><input aria-label={`${copy.radius} ${draftModel?.unit ?? "mm"}`} type="number" min="0.01" step="0.1" value={selectedFeature.parameters.radius} onChange={(event) => updateCylinderParameter("radius", Number(event.target.value))} /> {draftModel?.unit}</span></label>
                    <label>{copy.height} <span><input aria-label={`${copy.height} ${draftModel?.unit ?? "mm"}`} type="number" min="0.01" step="0.1" value={selectedFeature.parameters.height} onChange={(event) => updateCylinderParameter("height", Number(event.target.value))} /> {draftModel?.unit}</span></label>
                  </>
                )}
                {selectedFeature?.type === "mesh" && <p className="inspector-empty">{copy.meshResultNotice}</p>}
                {selectedFeatures.length > 1 && <p className="inspector-empty">{copy.selectedObjects} · {selectedFeatures.length}</p>}
                {selectedFeatures.length === 0 && !selectedGroup && <p className="inspector-empty">{copy.noSelection}</p>}
              </section>
            </div>
          ) : (
            <div className="inspector-lower-pane">
              <section className="inspector-section metadata-form">
                <div className="section-title"><span>{copy.metadata}</span><Settings2 size={15} /></div>
                {draftModel ? (
                  <>
                    <label>
                      <span>{copy.modelName}</span>
                      <input value={draftModel.name} maxLength={120} onChange={(event) => {
                        updateDraftWithHistory((current) => ({ ...current, name: event.target.value }));
                      }} />
                    </label>
                    <label>
                      <span>{copy.modelDescription}</span>
                      <textarea value={draftModel.description} maxLength={2000} onChange={(event) => {
                        updateDraftWithHistory((current) => ({ ...current, description: event.target.value }));
                      }} />
                    </label>
                    <label>
                      <span>{copy.unit}</span>
                      <select value={draftModel.unit} onChange={(event) => {
                        updateDraftWithHistory((current) => ({ ...current, unit: event.target.value as Unit }));
                      }}>
                        <option value="mm">mm</option>
                        <option value="cm">cm</option>
                        <option value="in">in</option>
                      </select>
                    </label>
                  </>
                ) : <p className="inspector-empty">{copy.selectModelHint}</p>}
              </section>
            </div>
          )}
        </div>
      </aside>

      <footer className="statusbar" aria-label={copy.workspaceStatus}>
        <div className="status-main">
          <nav className="status-breadcrumb" aria-label={copy.currentPath}>
            <ol>
              {statusPath.map((segment, index) => (
                <li key={segment.id}>
                  {index > 0 && <ChevronRight size={10} aria-hidden="true" />}
                  <span aria-current={index === statusPath.length - 1 ? "page" : undefined} title={segment.label}>{segment.label}</span>
                </li>
              ))}
            </ol>
          </nav>
          {showEditorStatus && (
            <div className="status-feedback">
              <span className="status-divider" aria-hidden="true" />
              <span className={`status-primary ${editorStatusClass}`}><span className="status-ready-dot" />{saveLabel}</span>
              {statusDetail && <><span className="status-divider" aria-hidden="true" /><span className="status-detail">{statusDetail}</span></>}
            </div>
          )}
        </div>
        <div className="status-right">
          <span>{copy.units} {draftModel?.unit ?? "mm"}</span>
          <span className="status-divider" aria-hidden="true" />
          <span className={`status-service ${serviceState}`}><span className="state-dot" />{serviceLabel}</span>
        </div>
      </footer>

      {createDialogOpen && (
        <div className="dialog-backdrop" role="presentation" onPointerDown={(event) => {
          if (event.currentTarget === event.target) setCreateDialogOpen(false);
        }}>
          <form className="create-dialog" role="dialog" aria-modal="true" aria-labelledby="create-model-title" onSubmit={handleCreateModel}>
            <div className="dialog-heading" id="create-model-title"><FileBox size={17} /><span>{copy.createModel}</span></div>
            <label>
              <span>{copy.modelName}</span>
              <input autoFocus value={createName} maxLength={120} onChange={(event) => setCreateName(event.target.value)} />
            </label>
            <div className="dialog-actions">
              <button type="button" onClick={() => setCreateDialogOpen(false)}>{copy.cancel}</button>
              <button className="primary-button" type="submit" disabled={!createName.trim() || creating}>{copy.create}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
