import type { CSSProperties, ReactNode } from "react";
import "../styles/EditorWorkspaceShell.css";

interface EditorWorkspaceShellProps {
  children: ReactNode;
  className: string;
  style: CSSProperties;
}

export function EditorWorkspaceShell({ children, className, style }: EditorWorkspaceShellProps) {
  return <div className={className} style={style}>{children}</div>;
}
