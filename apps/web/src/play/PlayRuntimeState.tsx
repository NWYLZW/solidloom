import {
  AlertTriangle,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  SearchX,
  WifiOff,
} from "lucide-react";
import type { EditorLocale } from "../workspaces/editor/editorCopy";
import type { RunRuntimeSnapshot } from "../runtime-store/runRuntimeStore";
import "./PlayRuntimeState.css";

const stateCopy = {
  "zh-CN": {
    disconnected: ["运行服务已断开", "请检查本地服务后重新连接。"],
    error: ["无法载入运行视图", "运行实例返回了无法处理的错误。"],
    forbidden: ["无权进入此运行实例", "当前身份没有查看该运行实例的权限。"],
    loading: ["正在连接运行实例", "正在恢复场景和本地运行状态。"],
    "not-found": ["找不到运行实例", "此地址对应的运行实例不存在。"],
    reconnect: "重新连接",
  },
  en: {
    disconnected: ["Runtime service disconnected", "Check the local service and reconnect."],
    error: ["Unable to load runtime", "The runtime returned an unexpected error."],
    forbidden: ["Access denied", "The current identity cannot view this runtime."],
    loading: ["Connecting to runtime", "Restoring the scene and local runtime state."],
    "not-found": ["Runtime not found", "No runtime exists for this address."],
    reconnect: "Reconnect",
  },
} as const;

interface PlayRuntimeStateProps {
  locale: EditorLocale;
  onReconnect: () => void;
  snapshot: RunRuntimeSnapshot;
}

export function PlayRuntimeState({ locale, onReconnect, snapshot }: PlayRuntimeStateProps) {
  if (snapshot.status === "ready" || snapshot.status === "paused") return null;
  const status = snapshot.status;
  const copy = stateCopy[locale];
  const [title, description] = copy[status];
  const Icon = status === "loading"
    ? LoaderCircle
    : status === "forbidden"
      ? LockKeyhole
      : status === "not-found"
        ? SearchX
        : status === "disconnected"
          ? WifiOff
          : AlertTriangle;

  return (
    <section className="play-runtime-state" role="status" aria-live="polite">
      <Icon aria-hidden="true" className={status === "loading" ? "is-loading" : ""} size={26} />
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {status !== "loading" && (
        <button type="button" onClick={onReconnect}>
          <RefreshCw aria-hidden="true" size={17} />
          <span>{copy.reconnect}</span>
        </button>
      )}
    </section>
  );
}
