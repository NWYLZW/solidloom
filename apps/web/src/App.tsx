import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Braces,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Cuboid,
  ExternalLink,
  FileBox,
  Folder,
  FolderOpen,
  FolderTree,
  Languages,
  Layers3,
  Menu as MenuIcon,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Redo2,
  Rotate3D,
  Save,
  Settings2,
  Sun,
  Undo2,
} from "lucide-react";
import type { ModelRecord } from "@solidloom/shared";
import { getHealth, listModels } from "./api";

type ServiceState = "checking" | "online" | "offline";
type Locale = "zh-CN" | "en";
type Theme = "light" | "dark" | "system";

const copyByLocale = {
  "zh-CN": {
    pageTitle: "SolidLoom 建模工作台",
    untitledProject: "未命名项目",
    untitledModel: "未命名模型",
    connecting: "连接中",
    serviceOnline: "本地服务已连接",
    serviceOffline: "本地服务离线",
    workspaceStatus: "工作台状态",
    ready: "就绪",
    noSelection: "未选择对象",
    units: "单位 mm",
    undo: "撤销",
    redo: "重做",
    save: "保存",
    collapseLibrary: "折叠模型栏",
    expandLibrary: "展开模型栏",
    projectTree: "项目树",
    models: "模型",
    createModel: "新建模型",
    revision: "修订",
    emptyModels: "暂无模型",
    collapseTree: "折叠全部",
    expandTree: "展开全部",
    resizeProjectTree: "调整项目树宽度",
    resizeInspectorWidth: "调整属性面板宽度",
    resizeInspectorHeight: "调整特征区高度",
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
    viewportPreview: "三维视口占位预览",
    viewportScaffold: "视口骨架",
    engineReserved: "几何引擎接口已预留",
    engineNext: "下一阶段接入真实几何求值与选择交互。",
    perspective: "透视",
    grid: "网格 10 mm",
    previewOnly: "仅预览",
    features: "特征",
    properties: "属性",
    featureGraph: "特征图",
    baseSolid: "基础实体",
    boxAdd: "长方体 · 添加",
    planned: "规划中",
    parameters: "参数",
    width: "宽度",
    depth: "深度",
    height: "高度",
    scaffoldNotice: "当前是工程骨架。控件只展示未来的数据结构，不会写入模型。",
  },
  en: {
    pageTitle: "SolidLoom Modeling Workspace",
    untitledProject: "Untitled project",
    untitledModel: "Untitled model",
    connecting: "Connecting",
    serviceOnline: "Local service connected",
    serviceOffline: "Local service offline",
    workspaceStatus: "Workspace status",
    ready: "Ready",
    noSelection: "No object selected",
    units: "Units mm",
    undo: "Undo",
    redo: "Redo",
    save: "Save",
    collapseLibrary: "Collapse model library",
    expandLibrary: "Expand model library",
    projectTree: "Project tree",
    models: "Models",
    createModel: "Create model",
    revision: "Revision",
    emptyModels: "No models",
    collapseTree: "Collapse all",
    expandTree: "Expand all",
    resizeProjectTree: "Resize project tree width",
    resizeInspectorWidth: "Resize inspector width",
    resizeInspectorHeight: "Resize feature area height",
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
    viewportPreview: "3D viewport placeholder",
    viewportScaffold: "Viewport scaffold",
    engineReserved: "Geometry engine boundary reserved",
    engineNext: "Real geometry evaluation and selection arrive in the next phase.",
    perspective: "Perspective",
    grid: "Grid 10 mm",
    previewOnly: "Preview only",
    features: "Features",
    properties: "Properties",
    featureGraph: "Feature graph",
    baseSolid: "Base solid",
    boxAdd: "Box · Add",
    planned: "Planned",
    parameters: "Parameters",
    width: "Width",
    depth: "Depth",
    height: "Height",
    scaffoldNotice: "This is an engineering scaffold. Controls show the future data shape and do not write to a model.",
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

export function App() {
  const [serviceState, setServiceState] = useState<ServiceState>("checking");
  const [models, setModels] = useState<ModelRecord[]>([]);
  const [libraryCollapsed, setLibraryCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [projectExpanded, setProjectExpanded] = useState(true);
  const [modelsExpanded, setModelsExpanded] = useState(true);
  const [libraryWidth, setLibraryWidth] = useState(() => readNumberPreference("solidloom.layout.libraryWidth.v1", 260, 180, 420));
  const [inspectorWidth, setInspectorWidth] = useState(() => readNumberPreference("solidloom.layout.inspectorWidth.v1", 294, 240, 480));
  const [featurePaneHeight, setFeaturePaneHeight] = useState(() => readNumberPreference("solidloom.layout.featurePaneHeight.v2", 100, 100, 600));
  const [treeMenu, setTreeMenu] = useState<{ x: number; y: number } | null>(null);
  const [locale, setLocale] = useState<Locale>(() => readPreference("solidloom.locale", ["zh-CN", "en"], "zh-CN"));
  const [theme, setTheme] = useState<Theme>(() => readPreference("solidloom.theme", ["light", "dark", "system"], "system"));
  const menuRef = useRef<HTMLDivElement>(null);
  const treeMenuRef = useRef<HTMLDivElement>(null);
  const resizeCleanupRef = useRef<(() => void) | null>(null);
  const copy = copyByLocale[locale];

  useEffect(() => {
    Promise.all([getHealth(), listModels()])
      .then(([, modelList]) => {
        setModels(modelList.items);
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

  useEffect(() => {
    if (window.localStorage.getItem("solidloom.layout.featurePaneHeight.v2") === null) setFeaturePaneHeight(100);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("solidloom.layout.featurePaneHeight.v2", String(featurePaneHeight));
  }, [featurePaneHeight]);

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
            <button
              className="collapse-button"
              type="button"
              aria-label={copy.collapseLibrary}
              title={copy.collapseLibrary}
              onClick={() => setLibraryCollapsed(true)}
            >
              <PanelLeftClose size={16} />
            </button>
          </div>
        )}

        <div className="topbar-main">
          {libraryCollapsed && (
            <button
              className="expand-button"
              type="button"
              aria-label={copy.expandLibrary}
              title={copy.expandLibrary}
              onClick={() => setLibraryCollapsed(false)}
            >
              <PanelLeftOpen size={16} />
            </button>
          )}
          <div className="document-title">
            <FileBox size={15} />
            <span>{copy.untitledModel}</span>
            <ChevronDown size={14} />
          </div>
        </div>

        <div className="top-actions">
          <button className="icon-button" type="button" aria-label={copy.undo} disabled><Undo2 size={16} /></button>
          <button className="icon-button" type="button" aria-label={copy.redo} disabled><Redo2 size={16} /></button>
          <button className="primary-button" type="button" disabled><Save size={15} />{copy.save}</button>
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
            onContextMenu={(event) => {
              event.preventDefault();
              setMenuOpen(false);
              setTreeMenu({
                x: Math.min(event.clientX, window.innerWidth - 210),
                y: Math.min(event.clientY, window.innerHeight - 110),
              });
            }}
          >
            <button
              className="tree-row tree-root"
              data-depth="0"
              type="button"
              role="treeitem"
              aria-expanded={projectExpanded}
              onClick={() => setProjectExpanded((value) => !value)}
            >
              {projectExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <FolderTree size={16} />
              <span>{copy.untitledProject}</span>
            </button>

            {projectExpanded && (
              <div className="tree-group" role="group">
                <button
                  className="tree-row"
                  data-depth="1"
                  type="button"
                  role="treeitem"
                  aria-expanded={modelsExpanded}
                  onClick={() => setModelsExpanded((value) => !value)}
                >
                  {modelsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  {modelsExpanded ? <FolderOpen size={16} /> : <Folder size={16} />}
                  <span>{copy.models}</span>
                </button>

                {modelsExpanded && (
                  <div className="tree-group tree-models" role="group">
                    {models.length > 0 ? models.map((model) => (
                      <button className="tree-row tree-model" data-depth="2" type="button" role="treeitem" key={model.id}>
                        <span className="tree-spacer" />
                        <FileBox size={15} />
                        <span>{model.name}</span>
                        <small>{copy.revision} {model.revision}</small>
                      </button>
                    )) : (
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
            <div
              className="tree-context-menu"
              ref={treeMenuRef}
              role="menu"
              style={{ left: treeMenu.x, top: treeMenu.y }}
            >
              <button type="button" role="menuitem" disabled>
                <Plus size={15} />
                <span>{copy.createModel}</span>
                <small>{copy.planned}</small>
              </button>
              <div className="context-divider" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  const shouldExpand = !projectExpanded || !modelsExpanded;
                  setProjectExpanded(shouldExpand);
                  setModelsExpanded(shouldExpand);
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
              <div className="menu-heading"><MenuIcon size={16} /><span>{copy.menuTitle}</span></div>
              <nav className="menu-links">
                <a href="/llms.txt" target="_blank" rel="noreferrer"><Braces size={16} /><span>{copy.agentGuide}</span><ExternalLink size={13} /></a>
                <a href="/docs" target="_blank" rel="noreferrer"><CircleDot size={16} /><span>{copy.apiDocs}</span><ExternalLink size={13} /></a>
              </nav>
              <div className="menu-divider" />
              <div className="preference-group">
                <div className="preference-label"><Languages size={15} />{copy.language}</div>
                <div className="segmented-control" aria-label={copy.language}>
                  <button type="button" className={locale === "zh-CN" ? "active" : ""} onClick={() => setLocale("zh-CN")}>中文</button>
                  <button type="button" className={locale === "en" ? "active" : ""} onClick={() => setLocale("en")}>English</button>
                </div>
              </div>
              <div className="preference-group">
                <div className="preference-label"><Sun size={15} />{copy.theme}</div>
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

      <main className="viewport-panel">
        <div className="viewport-toolbar" aria-label={copy.viewTools}>
          <button type="button" className="tool-active"><Rotate3D size={17} /><span>{copy.rotate}</span></button>
          <button type="button" disabled><Cuboid size={17} /><span>{copy.orthographic}</span></button>
        </div>

        <div className="axis-widget" aria-hidden="true">
          <span className="axis-z">Z</span>
          <span className="axis-x">X</span>
          <span className="axis-y">Y</span>
        </div>

        <div className="mock-object" aria-label={copy.viewportPreview}>
          <div className="mock-top" />
          <div className="mock-front" />
          <div className="mock-side" />
        </div>

        <div className="viewport-note">
          <span>{copy.viewportScaffold}</span>
          <strong>{copy.engineReserved}</strong>
          <p>{copy.engineNext}</p>
        </div>

        <div className="view-status">
          <span>{copy.perspective}</span>
          <span>{copy.grid}</span>
          <span>{copy.previewOnly}</span>
        </div>
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
          <button className="active" type="button">{copy.features}</button>
          <button type="button">{copy.properties}</button>
        </div>

        <div className="inspector-body">
          <section className="inspector-section inspector-feature-pane" style={{ height: featurePaneHeight }}>
            <div className="section-title"><span>{copy.featureGraph}</span><Plus size={15} /></div>
            <div className="feature-row selected">
              <span className="feature-icon"><Cuboid size={16} /></span>
              <span className="feature-copy"><strong>{copy.baseSolid}</strong><small>{copy.boxAdd}</small></span>
              <span className="planned-chip">{copy.planned}</span>
            </div>
          </section>

          <div
            className="inspector-height-resizer"
            role="separator"
            tabIndex={0}
            aria-label={copy.resizeInspectorHeight}
            aria-orientation="horizontal"
            aria-valuemin={100}
            aria-valuemax={600}
            aria-valuenow={featurePaneHeight}
            onPointerDown={(event) => {
              const startHeight = featurePaneHeight;
              const maximum = Math.max(100, window.innerHeight - 300);
              beginResize(event, "resizing-row", (_deltaX, deltaY) => setFeaturePaneHeight(clamp(startHeight + deltaY, 100, maximum)));
            }}
            onKeyDown={(event) => resizeWithKeyboard(event, "horizontal", (delta) => {
              const maximum = Math.max(100, window.innerHeight - 300);
              setFeaturePaneHeight((height) => clamp(height + delta, 100, maximum));
            })}
          />

          <div className="inspector-lower-pane">
            <section className="inspector-section properties">
              <div className="section-title"><span>{copy.parameters}</span><Settings2 size={15} /></div>
              <label>{copy.width} <span><input value="48" readOnly /> mm</span></label>
              <label>{copy.depth} <span><input value="32" readOnly /> mm</span></label>
              <label>{copy.height} <span><input value="24" readOnly /> mm</span></label>
            </section>

            <p className="inspector-message">{copy.scaffoldNotice}</p>
          </div>
        </div>
      </aside>

      <footer className="statusbar" aria-label={copy.workspaceStatus}>
        <span className="status-primary"><span className="status-ready-dot" />{copy.ready}</span>
        <span className="status-divider" aria-hidden="true" />
        <span>{copy.noSelection}</span>
        <span className="status-spacer" />
        <span>{copy.units}</span>
        <span className="status-divider" aria-hidden="true" />
        <span className={`status-service ${serviceState}`}><span className="state-dot" />{serviceLabel}</span>
      </footer>
    </div>
  );
}
