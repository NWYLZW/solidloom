export type MaterialIconName =
  | "check_circle"
  | "error"
  | "info"
  | "inventory_2"
  | "key"
  | "lock"
  | "lock_open"
  | "login"
  | "logout"
  | "schedule"
  | "security"
  | "swap_horiz"
  | "warehouse";

// A deliberately small, local subset of the Apache-2.0 Material Icons set.
// Keeping the paths inline makes the standalone preview work without a font CDN.
const materialIconPaths: Record<MaterialIconName, string> = {
  check_circle: '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9Z"/>',
  error: '<path d="M12 2a10 10 0 1 0 .01 20.01A10 10 0 0 0 12 2Zm1 15h-2v-2h2v2Zm0-4h-2V7h2v6Z"/>',
  info: '<path d="M11 17h2v-6h-2v6Zm1-15a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm-1-11h2V7h-2v2Z"/>',
  inventory_2: '<path d="M20 2H4a2 2 0 0 0-2 2v3c0 .55.45 1 1 1v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8c.55 0 1-.45 1-1V4a2 2 0 0 0-2-2Zm-5 12H9v-2h6v2Zm5-7H4V4h16v3Z"/>',
  key: '<path d="M7 14a3.5 3.5 0 1 1 3.32-4.6H22V12h-2v2h-2v2h-3v-2h-4.68A3.5 3.5 0 0 1 7 14Zm0-5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z"/>',
  lock: '<path d="M18 8h-1V6a5 5 0 0 0-10 0v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2Zm-6 9a2 2 0 1 1 0-4 2 2 0 0 1 0 4Zm3.1-9H8.9V6a3.1 3.1 0 0 1 6.2 0v2Z"/>',
  lock_open: '<path d="M18 8h-8V6a2 2 0 1 1 4 0h2a4 4 0 0 0-8 0v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2Zm-6 9a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z"/>',
  login: '<path d="M11 7 9.6 8.4l2.6 2.6H2v2h10.2l-2.6 2.6L11 17l5-5-5-5Zm9 12h-8v2h8a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-8v2h8v14Z"/>',
  logout: '<path d="m13 7-1.4 1.4 2.6 2.6H4v2h10.2l-2.6 2.6L13 17l5-5-5-5Zm7 12h-8v2h8a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-8v2h8v14Z"/>',
  schedule: '<path d="M11.99 2a10 10 0 1 0 .01 20.01A10 10 0 0 0 11.99 2ZM12 20a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7Z"/>',
  security: '<path d="M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4Zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8Z"/>',
  swap_horiz: '<path d="m7.41 13.41-1.42-1.42L2 16l3.99 4 1.42-1.41L5.83 17H21v-2H5.83l1.58-1.59ZM16.59 10.59l1.42 1.42L22 8l-3.99-4-1.42 1.41L18.17 7H3v2h15.17l-1.58 1.59Z"/>',
  warehouse: '<path d="M12 2 2 7v15h5v-8h10v8h5V7L12 2Zm7 18h-2v-2H7v2H5V8.24l7-3.5 7 3.5V20Zm-2-4H7v-2h10v2Zm0-4H7v-2h10v2Z"/>',
};

export function materialIcon(name: MaterialIconName, className = "") {
  const classes = ["material-icon", className].filter(Boolean).join(" ");
  return `<svg class="${classes}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${materialIconPaths[name]}</svg>`;
}
