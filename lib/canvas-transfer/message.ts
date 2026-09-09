import type { CanvasTransferPackageV1 } from "./schema";

// Kept as named constants (not inlined) because the companion extension's
// content script matches on these exact strings — changing either without
// updating the extension breaks the handoff silently.
export const CANVAS_EXPORT_MESSAGE_SOURCE = "gridgrader-web" as const;
export const CANVAS_EXPORT_MESSAGE_TYPE = "GRIDGRADER_CANVAS_EXPORT" as const;

export type CanvasExportMessage = {
  source: typeof CANVAS_EXPORT_MESSAGE_SOURCE;
  type: typeof CANVAS_EXPORT_MESSAGE_TYPE;
  payload: CanvasTransferPackageV1;
};

export function createCanvasExportMessage(
  payload: CanvasTransferPackageV1
): CanvasExportMessage {
  return {
    source: CANVAS_EXPORT_MESSAGE_SOURCE,
    type: CANVAS_EXPORT_MESSAGE_TYPE,
    payload,
  };
}
