import { Gamepad2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { EditorLocale } from "../workspaces/editor/editorCopy";
import { useInputNotice } from "./InputRuntimeContext";
import "./InputDeviceNotice.css";

export function InputDeviceNotice({ locale }: { locale: EditorLocale }) {
  const notice = useInputNotice();
  const [visibleSequence, setVisibleSequence] = useState<number | null>(null);

  useEffect(() => {
    if (!notice) return;
    setVisibleSequence(notice.sequence);
    const timeout = window.setTimeout(() => setVisibleSequence(null), 2600);
    return () => window.clearTimeout(timeout);
  }, [notice?.sequence]);

  if (!notice || visibleSequence !== notice.sequence) return null;
  const connected = notice.kind === "connected";
  const message = locale === "zh-CN"
    ? connected ? "手柄已连接" : "手柄已断开，已切换到键鼠"
    : connected ? "Gamepad connected" : "Gamepad disconnected; keyboard and mouse active";
  return (
    <div className="play-input-device-notice" role="status">
      <Gamepad2 aria-hidden="true" size={16} />
      <span>{message}</span>
    </div>
  );
}
