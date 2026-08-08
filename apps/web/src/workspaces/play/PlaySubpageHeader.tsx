import { ArrowLeft } from "lucide-react";
import "./PlaySubpageHeader.css";

interface PlaySubpageHeaderProps {
  backLabel: string;
  onBack: () => void;
  title: string;
}

export function PlaySubpageHeader({ backLabel, onBack, title }: PlaySubpageHeaderProps) {
  return (
    <header className="play-subpage-header">
      <button aria-label={backLabel} className="play-subpage-back" title={backLabel} type="button" onClick={onBack}>
        <ArrowLeft aria-hidden="true" size={20} />
      </button>
      <strong>{title}</strong>
    </header>
  );
}
