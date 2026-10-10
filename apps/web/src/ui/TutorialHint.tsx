import { useLayoutEffect, useRef } from 'react';
import type { HintAnchor } from '../game/renderer/stageController';

/** Gap between the pill and the screen edges, in CSS pixels. */
const EDGE_MARGIN_PX = 16;
/** Gap between the pill and its tile. */
const TILE_GAP_PX = 6;

export type TutorialHintProps = Readonly<{
  /** The hint line, or null to fade the pill out. */
  text: string | null;
  /** Screen placement of the glowing tile; null hides the pill. */
  anchor: HintAnchor | null;
  /** The pill goes above the tile only when it stays below this line (the HUD). */
  minTop: number;
}>;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, Math.max(min, max)));
}

/**
 * One line of tutorial text next to the glowing tile. The layer ignores the pointer, so the board
 * stays fully playable under and around it.
 */
export function TutorialHint({ text, anchor, minTop }: TutorialHintProps) {
  const pillRef = useRef<HTMLParagraphElement | null>(null);
  // The last text stays rendered while the pill fades out.
  const lastTextRef = useRef<string | null>(null);

  if (text !== null) {
    lastTextRef.current = text;
  }

  const shown = text !== null && anchor !== null;

  useLayoutEffect(() => {
    const pill = pillRef.current;
    const layer = pill?.parentElement;

    if (!pill || !layer || anchor === null) {
      return;
    }

    const width = pill.offsetWidth;
    const height = pill.offsetHeight;
    let top = anchor.y - anchor.radius - TILE_GAP_PX - height;

    if (top < Math.max(EDGE_MARGIN_PX, minTop)) {
      top = anchor.y + anchor.radius + TILE_GAP_PX;
    }

    top = clamp(top, EDGE_MARGIN_PX, layer.clientHeight - EDGE_MARGIN_PX - height);

    const left = clamp(anchor.x - width / 2, EDGE_MARGIN_PX, layer.clientWidth - EDGE_MARGIN_PX - width);

    pill.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  }, [anchor, text, minTop]);

  if (lastTextRef.current === null) {
    return null;
  }

  return (
    <div className="tutorial-layer">
      <p ref={pillRef} className="tutorial-hint" role="status" data-visible={shown ? 'true' : 'false'}>
        {lastTextRef.current}
      </p>
    </div>
  );
}
