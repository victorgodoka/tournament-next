type Size = { width: number; height: number }

/** The card width that makes a board `measured` at card width `probe` fill `room`, by its tighter side, in whole px. */
export const fitCardWidth = (probe: number, measured: Size, room: Size) =>
  Math.floor(probe * Math.min(room.width / measured.width, room.height / measured.height))
