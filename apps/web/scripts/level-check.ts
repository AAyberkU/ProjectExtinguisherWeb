// Validates Puzzle Lab levels with the editor's rules and checks solver consistency.
// Usage (cwd apps/web): npm run level:check -- [files or folders...]
// Default: levels/pool and src/game/levels/campaign. Exit code 1 when any error is found.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import {
  bfsSearch,
  compileLevel,
  countSolutions,
  minBudget,
  validateLevel,
  type PuzzleLabLevel,
} from '../src/game/engine/index';

const DEFAULT_PATHS = ['levels/pool', 'src/game/levels/campaign'];
const CAMPAIGN_FILE = 'campaign.json';

interface Row {
  file: string;
  id: string;
  size: string;
  steps: string;
  minBudget: string;
  solutions: string;
  moves: string;
  ms: number;
  errors: string[];
  warnings: string[];
  notes: string[];
}

let totalErrors = 0;
let totalWarnings = 0;

function listJson(path: string): string[] {
  const st = statSync(path);
  if (st.isFile()) return [path];
  return readdirSync(path)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => join(path, f));
}

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(file, 'utf8').replace(/^﻿/, ''));
}

const sameList = (a: readonly unknown[] | null | undefined, b: readonly unknown[] | null | undefined): boolean =>
  !!a && !!b && a.length === b.length && a.every((x, i) => x === b[i]);

function checkLevel(file: string, raw: unknown): Row {
  const t0 = performance.now();
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Partial<PuzzleLabLevel>;
  const row: Row = {
    file,
    id: typeof obj.id === 'string' ? obj.id : '?',
    size: String(obj.grid?.size ?? '?'),
    steps: String(obj.params?.steps ?? '?'),
    minBudget: '-',
    solutions: '-',
    moves: '-',
    ms: 0,
    errors: [],
    warnings: [],
    notes: [],
  };
  const v = validateLevel(raw);
  row.errors.push(...v.errors);
  row.warnings.push(...v.warnings);
  if (!file.includes('#') && row.id !== '?' && basename(file, '.json') !== row.id) {
    row.errors.push(`File name does not match level id "${row.id}"`);
  }
  if (v.errors.length) {
    row.ms = performance.now() - t0;
    return row;
  }

  const level = compileLevel(raw as PuzzleLabLevel);
  const budget = level.budget;
  const search = bfsSearch(level, budget);
  const aborted = search !== null && 'aborted' in search;
  const shortest = search && 'path' in search ? search : null;
  const mb = minBudget(level);
  const count = countSolutions(level, budget);
  row.minBudget = String(mb ?? '-');
  row.moves = shortest ? String(shortest.moves) : '-';
  row.solutions = count.aborted ? 'aborted' : String(count.count) + (count.looped ? '*' : '');
  if (aborted) row.errors.push('Solver aborted: state space too large to verify');
  else if (!shortest) row.errors.push(`Not solvable within ${budget} steps`);
  if (count.aborted) row.warnings.push('Solution count aborted (state space too large)');
  else if (shortest && count.count !== 1) row.warnings.push(`${count.count} solutions (the editor accepts exactly one)`);
  if (count.looped) row.notes.push('refill loop (not counted)');

  const sol = level.level.meta?.solution;
  if (!sol) {
    row.notes.push('no meta.solution');
  } else {
    if (sol.solvable !== !!shortest) row.errors.push(`meta.solution.solvable is ${sol.solvable}, computed ${!!shortest}`);
    if (sol.minBudget !== mb) row.errors.push(`meta.solution.minBudget is ${sol.minBudget}, computed ${mb}`);
    if (!count.aborted && sol.solutions !== count.count) row.errors.push(`meta.solution.solutions is ${sol.solutions}, computed ${count.count}`);
    const path = shortest ? shortest.path : null;
    if (!(sol.shortest === null && path === null) && !sameList(sol.shortest, path)) {
      row.errors.push(`meta.solution.shortest is ${JSON.stringify(sol.shortest)}, computed ${JSON.stringify(path)}`);
    }
  }
  row.ms = performance.now() - t0;
  return row;
}

function checkCampaign(folder: string, levelIds: Set<string>): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  let data: unknown;
  try {
    data = readJson(join(folder, CAMPAIGN_FILE));
  } catch (e) {
    return { errors: [`campaign.json is not valid JSON: ${(e as Error).message}`], warnings };
  }
  const chapters = data !== null && typeof data === 'object' ? (data as { chapters?: unknown }).chapters : undefined;
  if (!Array.isArray(chapters)) return { errors: ['campaign.json has no chapters array'], warnings };
  const seen = new Set<string>();
  const chapterIds = new Set<string>();
  chapters.forEach((ch: unknown, ci: number) => {
    const c = (ch !== null && typeof ch === 'object' ? ch : {}) as { id?: unknown; levels?: unknown };
    const name = typeof c.id === 'string' ? c.id : `#${ci + 1}`;
    if (typeof c.id !== 'string' || !c.id) errors.push(`Chapter #${ci + 1} has no id`);
    else if (chapterIds.has(c.id)) errors.push(`Chapter id ${c.id} is used twice`);
    else chapterIds.add(c.id);
    if (!Array.isArray(c.levels) || !c.levels.length) {
      errors.push(`Chapter ${name} has no levels`);
      return;
    }
    for (const id of c.levels) {
      if (typeof id !== 'string') {
        errors.push(`Chapter ${name} has a non-string level id`);
        continue;
      }
      if (seen.has(id)) errors.push(`Level ${id} appears twice in the campaign`);
      seen.add(id);
      if (!existsSync(join(folder, `${id}.json`))) errors.push(`Level ${id} (chapter ${name}) has no file`);
    }
  });
  for (const id of levelIds) if (!seen.has(id)) warnings.push(`Level file ${id}.json is not in the campaign`);
  return { errors, warnings };
}

/** Path relative to cwd, or absolute when outside it. */
function show(path: string): string {
  const rel = relative(process.cwd(), path);
  return !rel ? '.' : rel.startsWith('..') ? path : rel;
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

function main(): void {
  const args = process.argv.slice(2).filter((a) => a !== '--');
  const targets = (args.length ? args : DEFAULT_PATHS).map((p) => resolve(p));
  const t0 = performance.now();
  for (const target of targets) {
    if (!existsSync(target)) {
      console.log(`ERROR ${target}: not found`);
      totalErrors++;
      continue;
    }
    const isDir = statSync(target).isDirectory();
    const files = listJson(target);
    const rows: Row[] = [];
    const ids = new Set<string>();
    for (const file of files) {
      if (basename(file) === CAMPAIGN_FILE) continue;
      const rel = show(file);
      let raw: unknown;
      try {
        raw = readJson(file);
      } catch (e) {
        rows.push({ file: rel, id: '?', size: '?', steps: '?', minBudget: '-', solutions: '-', moves: '-', ms: 0, errors: [`Invalid JSON: ${(e as Error).message}`], warnings: [], notes: [] });
        continue;
      }
      const pack = raw as { format?: unknown; levels?: unknown };
      if (pack && pack.format === 'puzzle-lab/pack@1' && Array.isArray(pack.levels)) {
        pack.levels.forEach((lvl, i) => rows.push(checkLevel(`${rel}#${i + 1}`, lvl)));
        continue;
      }
      const row = checkLevel(rel, raw);
      if (row.id !== '?') ids.add(row.id);
      rows.push(row);
    }

    console.log(`\n== ${show(target)} (${rows.length} levels)`);
    console.log(`${pad('id', 16)} ${pad('size', 4)} ${pad('steps', 5)} ${pad('minB', 4)} ${pad('sols', 7)} ${pad('moves', 5)} ${pad('ms', 6)} status`);
    for (const r of rows) {
      const status = r.errors.length ? 'ERROR' : r.warnings.length ? 'warn' : 'ok';
      const notes = r.notes.length ? `  (${r.notes.join('; ')})` : '';
      console.log(
        `${pad(r.id, 16)} ${pad(r.size, 4)} ${pad(r.steps, 5)} ${pad(r.minBudget, 4)} ${pad(r.solutions, 7)} ${pad(r.moves, 5)} ${pad(r.ms.toFixed(0), 6)} ${status}${notes}`,
      );
      for (const e of r.errors) console.log(`    error: ${e}`);
      for (const w of r.warnings) console.log(`    warning: ${w}`);
      totalErrors += r.errors.length;
      totalWarnings += r.warnings.length;
    }
    const folder = isDir ? target : dirname(target);
    if (isDir && existsSync(join(folder, CAMPAIGN_FILE))) {
      const c = checkCampaign(folder, ids);
      let chapters: unknown[] = [];
      try {
        const data = readJson(join(folder, CAMPAIGN_FILE)) as { chapters?: unknown } | null;
        if (data && Array.isArray(data.chapters)) chapters = data.chapters;
      } catch {
        // checkCampaign already reported the parse error.
      }
      const levelCount = chapters.reduce<number>((n, ch) => {
        const levels = ch !== null && typeof ch === 'object' ? (ch as { levels?: unknown }).levels : undefined;
        return n + (Array.isArray(levels) ? levels.length : 0);
      }, 0);
      console.log(`campaign.json: ${chapters.length} chapters, ${levelCount} levels, ${c.errors.length} errors, ${c.warnings.length} warnings`);
      for (const e of c.errors) console.log(`    error: ${e}`);
      for (const w of c.warnings) console.log(`    warning: ${w}`);
      totalErrors += c.errors.length;
      totalWarnings += c.warnings.length;
    }
    const bad = rows.filter((r) => r.errors.length).length;
    const warned = rows.filter((r) => !r.errors.length && r.warnings.length).length;
    console.log(`-- ${rows.length - bad - warned} ok, ${warned} with warnings, ${bad} with errors`);
  }
  console.log(`\nTotal: ${totalErrors} errors, ${totalWarnings} warnings (${((performance.now() - t0) / 1000).toFixed(1)} s)`);
  process.exitCode = totalErrors ? 1 : 0;
}

main();
