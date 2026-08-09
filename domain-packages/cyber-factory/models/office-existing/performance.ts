import type {
  OfficeAssetPerformanceBudget,
  OfficeExistingAssetKey,
} from "./types.js";

export const officeAssetPerformanceBudgets = {
  desk: {
    desktop: [
      { levelId: "desk-desktop-full", maximumDrawCalls: 12, triangleBudget: 1_200 },
      { levelId: "desk-desktop-core", maximumDrawCalls: 7, triangleBudget: 420 },
    ],
    mobile: [
      { levelId: "desk-mobile-core", maximumDrawCalls: 7, triangleBudget: 420 },
    ],
  },
  chair: {
    desktop: [
      { levelId: "chair-desktop-full", maximumDrawCalls: 22, triangleBudget: 2_400 },
      { levelId: "chair-desktop-core", maximumDrawCalls: 10, triangleBudget: 760 },
    ],
    mobile: [
      { levelId: "chair-mobile-core", maximumDrawCalls: 10, triangleBudget: 760 },
    ],
  },
  laptop: {
    desktop: [
      { levelId: "laptop-desktop-full", maximumDrawCalls: 6, triangleBudget: 8_000 },
      { levelId: "laptop-desktop-core", maximumDrawCalls: 4, triangleBudget: 6_000 },
    ],
    mobile: [
      { levelId: "laptop-mobile-core", maximumDrawCalls: 4, triangleBudget: 6_000 },
    ],
  },
  monitor: {
    desktop: [
      { levelId: "monitor-desktop-full", maximumDrawCalls: 11, triangleBudget: 1_400 },
      { levelId: "monitor-desktop-core", maximumDrawCalls: 5, triangleBudget: 520 },
    ],
    mobile: [
      { levelId: "monitor-mobile-core", maximumDrawCalls: 5, triangleBudget: 520 },
    ],
  },
  tower: {
    desktop: [
      { levelId: "tower-desktop-full", maximumDrawCalls: 11, triangleBudget: 1_500 },
      { levelId: "tower-desktop-core", maximumDrawCalls: 7, triangleBudget: 680 },
    ],
    mobile: [
      { levelId: "tower-mobile-core", maximumDrawCalls: 7, triangleBudget: 680 },
    ],
  },
  avatar: {
    desktop: [
      { levelId: "avatar-desktop-full", maximumDrawCalls: 8, triangleBudget: 160 },
    ],
    mobile: [
      { levelId: "avatar-mobile-low-poly", maximumDrawCalls: 8, triangleBudget: 160 },
    ],
  },
} as const satisfies Record<OfficeExistingAssetKey, OfficeAssetPerformanceBudget>;
