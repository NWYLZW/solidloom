import type { RuntimeMenuItem } from "@solidloom/shared";

export const DEFAULT_PLAY_MENU_ITEMS: RuntimeMenuItem[] = [
  "resume",
  "character",
  "settings",
  "return-workshop",
];

export function resolvePlayMenuItems(items: RuntimeMenuItem[] | undefined): RuntimeMenuItem[] {
  const configured = items ?? DEFAULT_PLAY_MENU_ITEMS;
  return configured.filter((item, index) => configured.indexOf(item) === index);
}
