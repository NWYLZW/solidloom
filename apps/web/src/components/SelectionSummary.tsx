import { Cuboid, Cylinder, Folder, Layers3, Link2 } from "lucide-react";
import "./SelectionSummary.css";

export type SelectionSummaryIcon = "box" | "cylinder" | "group" | "multiple" | "reference";

interface SelectionSummaryProps {
  entries: Array<{ label: string; value: string }>;
  icon: SelectionSummaryIcon;
  label: string;
  subtitle: string;
  title: string;
}

function SummaryIcon({ icon }: { icon: SelectionSummaryIcon }) {
  if (icon === "reference") return <Link2 size={16} />;
  if (icon === "group") return <Folder size={16} />;
  if (icon === "box") return <Cuboid size={16} />;
  if (icon === "cylinder") return <Cylinder size={16} />;
  return <Layers3 size={16} />;
}

export function SelectionSummary({ entries, icon, label, subtitle, title }: SelectionSummaryProps) {
  return (
    <aside className="selection-summary" aria-label={label}>
      <div className="selection-summary-heading">
        <span className="selection-summary-icon" aria-hidden="true"><SummaryIcon icon={icon} /></span>
        <span><strong>{title}</strong><small>{subtitle}</small></span>
      </div>
      <dl>
        {entries.map((entry) => <div key={`${entry.label}-${entry.value}`}><dt>{entry.label}</dt><dd>{entry.value}</dd></div>)}
      </dl>
    </aside>
  );
}
