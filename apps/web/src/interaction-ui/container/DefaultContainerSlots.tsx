import { Box } from "lucide-react";
import type { ContainerEmptySlotProps, ContainerItemSlotProps } from "../types";

export function DefaultContainerItem({ item }: ContainerItemSlotProps) {
  return (
    <span className="interaction-container-item">
      <span aria-hidden="true"><Box size={15} /></span>
      <strong>{item.name}</strong>
    </span>
  );
}

export function DefaultContainerEmptySlot({ index }: ContainerEmptySlotProps) {
  return (
    <span
      aria-hidden="true"
      className="interaction-container-slot"
      data-slot-index={index}
    >
      <span />
    </span>
  );
}
