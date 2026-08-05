import { Braces, CircleDot, ExternalLink, Keyboard, Languages, Menu, Monitor, Moon, Sun } from "lucide-react";
import type { RefObject } from "react";

export type WorkspaceLocale = "zh-CN" | "en";
export type WorkspaceTheme = "light" | "dark" | "system";

interface WorkspaceMenuProps {
  labels: {
    agentGuide: string;
    apiDocs: string;
    keyboardShortcuts: string;
    language: string;
    menu: string;
    menuTitle: string;
    theme: string;
    themeDark: string;
    themeLight: string;
    themeSystem: string;
  };
  locale: WorkspaceLocale;
  menuOpen: boolean;
  menuRef: RefObject<HTMLDivElement | null>;
  onLocaleChange: (locale: WorkspaceLocale) => void;
  onMenuOpenChange: (open: boolean) => void;
  onOpenShortcutGuide: () => void;
  onTreeMenuClose: () => void;
  onThemeChange: (theme: WorkspaceTheme) => void;
  theme: WorkspaceTheme;
}

export function WorkspaceMenu({
  labels,
  locale,
  menuOpen,
  menuRef,
  onLocaleChange,
  onMenuOpenChange,
  onOpenShortcutGuide,
  onThemeChange,
  onTreeMenuClose,
  theme,
}: WorkspaceMenuProps) {
  return (
    <div className="library-footer" ref={menuRef}>
      {menuOpen && (
        <div className="workspace-menu" id="workspace-menu" role="dialog" aria-label={labels.menuTitle}>
          <div className="menu-section-label menu-heading"><Menu size={16} /><span>{labels.menuTitle}</span></div>
          <nav className="menu-links">
            <a href="/llms.txt" target="_blank" rel="noreferrer"><Braces size={16} /><span>{labels.agentGuide}</span><ExternalLink size={13} /></a>
            <a href="/docs" target="_blank" rel="noreferrer"><CircleDot size={16} /><span>{labels.apiDocs}</span><ExternalLink size={13} /></a>
            <button type="button" onClick={onOpenShortcutGuide}>
              <Keyboard size={16} />
              <span>{labels.keyboardShortcuts}</span>
              <kbd>?</kbd>
            </button>
          </nav>
          <div className="menu-divider" />
          <div className="preference-group">
            <div className="menu-section-label preference-label"><Languages size={16} /><span>{labels.language}</span></div>
            <div className="segmented-control" aria-label={labels.language}>
              <button type="button" className={locale === "zh-CN" ? "active" : ""} onClick={() => onLocaleChange("zh-CN")}>中文</button>
              <button type="button" className={locale === "en" ? "active" : ""} onClick={() => onLocaleChange("en")}>English</button>
            </div>
          </div>
          <div className="preference-group">
            <div className="menu-section-label preference-label"><Sun size={16} /><span>{labels.theme}</span></div>
            <div className="theme-control" aria-label={labels.theme}>
              <button type="button" className={theme === "light" ? "active" : ""} aria-label={labels.themeLight} title={labels.themeLight} onClick={() => onThemeChange("light")}><Sun size={15} /></button>
              <button type="button" className={theme === "dark" ? "active" : ""} aria-label={labels.themeDark} title={labels.themeDark} onClick={() => onThemeChange("dark")}><Moon size={15} /></button>
              <button type="button" className={theme === "system" ? "active" : ""} aria-label={labels.themeSystem} title={labels.themeSystem} onClick={() => onThemeChange("system")}><Monitor size={15} /></button>
            </div>
          </div>
        </div>
      )}
      <button
        className="menu-trigger"
        type="button"
        aria-expanded={menuOpen}
        aria-controls="workspace-menu"
        aria-label={labels.menu}
        title={labels.menu}
        onClick={() => {
          onTreeMenuClose();
          onMenuOpenChange(!menuOpen);
        }}
      >
        <Menu size={17} />
        <span>{labels.menu}</span>
      </button>
    </div>
  );
}
