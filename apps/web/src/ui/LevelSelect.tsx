import { useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { LockIcon, TickIcon } from './icons';

export type LevelSelectEntry = Readonly<{
  index: number;
  label: string;
  chapter: number;
  position: number;
  unlocked: boolean;
  completed: boolean;
}>;

export type LevelSelectProps = Readonly<{
  entries: readonly LevelSelectEntry[];
  currentIndex: number | null;
  onSelect(index: number): void;
  onClose(): void;
  onMainMenu(): void;
}>;

const CHAPTERS_PER_PAGE = 5;

type Chapter = Readonly<{ chapter: number; entries: readonly LevelSelectEntry[] }>;

function groupChapters(entries: readonly LevelSelectEntry[]): readonly Chapter[] {
  const byChapter = new Map<number, LevelSelectEntry[]>();

  for (const entry of entries) {
    const list = byChapter.get(entry.chapter);

    if (list === undefined) {
      byChapter.set(entry.chapter, [entry]);
    } else {
      list.push(entry);
    }
  }

  return [...byChapter.entries()]
    .sort(([a], [b]) => a - b)
    .map(([chapter, list]) => ({ chapter, entries: [...list].sort((a, b) => a.position - b.position) }));
}

function stateOf(entry: LevelSelectEntry): 'locked' | 'open' | 'completed' {
  if (entry.completed) {
    return 'completed';
  }

  return entry.unlocked ? 'open' : 'locked';
}

function ArrowGlyph({ direction }: Readonly<{ direction: 'left' | 'right' }>) {
  return (
    <svg className="level-select-arrow-glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d={direction === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}
        fill="none"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LevelSelect({ entries, currentIndex, onSelect, onClose, onMainMenu }: LevelSelectProps) {
  const chapters = useMemo(() => groupChapters(entries), [entries]);
  const pageCount = Math.max(1, Math.ceil(chapters.length / CHAPTERS_PER_PAGE));
  const [page, setPage] = useState(() => {
    const current = chapters.findIndex((chapter) => chapter.entries.some((entry) => entry.index === currentIndex));

    return current < 0 ? 0 : Math.floor(current / CHAPTERS_PER_PAGE);
  });
  const panelRef = useRef<HTMLDivElement | null>(null);
  const pageRef = useRef(page);
  const pageCountRef = useRef(pageCount);

  pageRef.current = page;
  pageCountRef.current = pageCount;

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    panelRef.current?.focus({ preventScroll: true });

    // Closing returns focus to whatever opened the dialog (when it still exists).
    return () => {
      if (opener !== null && opener.isConnected) {
        opener.focus({ preventScroll: true });
      }
    };
  }, []);

  // Tab stays inside the dialog while it is open.
  useEffect(() => {
    function handleTab(event: KeyboardEvent) {
      const panel = panelRef.current;

      if (event.key !== 'Tab' || panel === null) {
        return;
      }

      const items = [...panel.querySelectorAll<HTMLElement>('button:not(:disabled)')];
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (first === undefined || last === undefined) {
        event.preventDefault();
      } else if (!panel.contains(active) || active === panel) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener('keydown', handleTab);

    return () => window.removeEventListener('keydown', handleTab);
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }

      if (event.key === 'ArrowLeft') {
        setPage(Math.max(0, pageRef.current - 1));
      } else if (event.key === 'ArrowRight') {
        setPage(Math.min(pageCountRef.current - 1, pageRef.current + 1));
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const safePage = Math.min(page, pageCount - 1);
  const visible = chapters.slice(safePage * CHAPTERS_PER_PAGE, (safePage + 1) * CHAPTERS_PER_PAGE);

  function handleBackdropClick(event: MouseEvent<HTMLElement>) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  return (
    <section className="level-select" role="dialog" aria-modal="true" aria-label="Level select" onClick={handleBackdropClick}>
      <div className="level-select-panel" ref={panelRef} tabIndex={-1}>
        <header className="level-select-header">
          <h2 className="level-select-title">Level Select</h2>
          <button className="level-select-close" type="button" aria-label="Close level select" onClick={onClose}>
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="level-select-body" key={safePage} data-page={safePage}>
          {visible.map((chapter) => (
            <div className="level-chapter" key={chapter.chapter} data-chapter={chapter.chapter}>
              <h3 className="level-chapter-title">Chapter {chapter.chapter}</h3>
              <div className="level-chapter-cards">
                {chapter.entries.map((entry) => {
                  const state = stateOf(entry);
                  const current = entry.index === currentIndex;
                  const suffix = state === 'locked' ? ', locked' : state === 'completed' ? ', completed' : '';

                  return (
                    <button
                      className="level-card"
                      type="button"
                      key={entry.index}
                      data-level-index={entry.index}
                      data-state={state}
                      data-current={current ? 'true' : undefined}
                      disabled={state === 'locked'}
                      aria-label={`${entry.label}${suffix}`}
                      aria-current={current ? 'true' : undefined}
                      onClick={() => onSelect(entry.index)}
                    >
                      <span className="level-card-number">{entry.index + 1}</span>
                      {state === 'locked' ? <LockIcon className="level-card-glyph level-card-lock" /> : null}
                      {state === 'completed' ? <TickIcon className="level-card-glyph level-card-tick" /> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <footer className="level-select-footer">
          <div className="level-select-pager">
            <button
              className="level-select-arrow level-select-prev"
              type="button"
              aria-label="Previous page"
              disabled={safePage === 0}
              onClick={() => setPage(safePage - 1)}
            >
              <ArrowGlyph direction="left" />
            </button>
            <div className="level-select-dots" role="group" aria-label="Pages">
              {Array.from({ length: pageCount }, (_, i) => (
                <button
                  className="level-select-dot"
                  type="button"
                  key={i}
                  aria-label={`Page ${i + 1}`}
                  aria-current={i === safePage ? 'page' : undefined}
                  data-active={i === safePage ? 'true' : undefined}
                  onClick={() => setPage(i)}
                />
              ))}
            </div>
            <button
              className="level-select-arrow level-select-next"
              type="button"
              aria-label="Next page"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage(safePage + 1)}
            >
              <ArrowGlyph direction="right" />
            </button>
          </div>
          <button className="level-select-menu" type="button" onClick={onMainMenu}>
            Main Menu
          </button>
        </footer>
      </div>
    </section>
  );
}
