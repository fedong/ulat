"use client";

import { PRESETS, uid } from "./presets";
import type { Grading } from "./types";

/** Class-wizard draft state and the roster import parser (ported from the prototype). */

export interface WizStudent {
  id: string;
  no: string;
  name: string;
  last: string;
  first: string;
  mi: string;
  issues: string[];
  /** Set when a whole import had no student numbers — blank no. is then not an issue. */
  noOptional?: boolean;
}

export interface WizSlot {
  days: string[];
  start: string;
  end: string;
  room: string;
}

export interface WizDraft {
  code: string;
  title: string;
  section: string;
  level: string;
  termKind: string;
  yearStart: number;
  termCustom: boolean;
  termText: string;
  slots: WizSlot[];
  periods: string[];
  newPeriod: string;
  joinCode: string;
  preset: number;
  grading: Grading;
  roster: WizStudent[];
  pasted: string;
}

export const blankDraft = (): WizDraft => ({
  code: "",
  title: "",
  section: "",
  level: "College",
  termKind: "1st Semester",
  yearStart: new Date().getFullYear(),
  termCustom: false,
  termText: "",
  slots: [{ days: [], start: "", end: "", room: "" }],
  periods: ["Prelims", "Midterms", "Semi-finals", "Finals"],
  newPeriod: "",
  joinCode: Array.from(
    { length: 6 },
    () => "ABCDEFGHJKMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 31)],
  ).join(""),
  preset: 1,
  grading: PRESETS[1].make(),
  roster: [],
  pasted: "",
});

export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface LevelDef {
  terms: string[];
  yr: (y: number) => string;
  periods: string[];
  note: string;
  ph: string;
}

export const LEVELS: Record<string, LevelDef> = {
  College: {
    terms: ["1st Semester", "2nd Semester", "Midyear / Summer", "1st Trimester", "2nd Trimester", "3rd Trimester"],
    yr: (y) => "AY " + y + "–" + String(y + 1).slice(2),
    periods: ["Prelims", "Midterms", "Semi-finals", "Finals"],
    note: "Semestral or trimestral, on an Academic Year (AY). Periods run from Prelims to Finals by default.",
    ph: "e.g. Term 2 · AY 2026–27",
  },
  "Senior High": {
    terms: ["1st Semester", "2nd Semester"],
    yr: (y) => "SY " + y + "–" + (y + 1),
    periods: ["Q1", "Q2"],
    note: "DepEd K to 12 has two semesters with two quarters each. Uses School Year (SY).",
    ph: "e.g. 1st Sem · SY 2026–2027",
  },
  "Basic Ed": {
    terms: ["Full year"],
    yr: (y) => "SY " + y + "–" + (y + 1),
    periods: ["Q1", "Q2", "Q3", "Q4"],
    note: "Elementary and Junior High run one school year with four quarters.",
    ph: "e.g. SY 2026–2027",
  },
};

export const fmtT = (t: string) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const hh = ((h + 11) % 12) + 1;
  return hh + ":" + String(m).padStart(2, "0") + (h < 12 ? " AM" : " PM");
};
export const slotBad = (sl: WizSlot) => !!(sl.start && sl.end && sl.end <= sl.start);

export const schedText = (slots: WizSlot[]) =>
  slots
    .filter((sl) => sl.days.length || sl.start)
    .map((sl) =>
      [
        DAYS.filter((x) => sl.days.includes(x)).join("/"),
        sl.start && sl.end && !slotBad(sl) ? fmtT(sl.start) + "–" + fmtT(sl.end) : fmtT(sl.start),
        sl.room ? (/^(rm|room|lab)/i.test(sl.room) ? sl.room : "Rm " + sl.room) : "",
      ]
        .filter(Boolean)
        .join(" "),
    )
    .join(" · ");

/** QR-like join tile: 25×25 cells seeded from the join code (decorative). */
export function qrCells(code: string): string[] {
  const N = 25;
  let h = 0;
  for (const ch of code) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const rnd = () => {
    h ^= h << 13; h >>>= 0;
    h ^= h >>> 17;
    h ^= h << 5; h >>>= 0;
    return h / 4294967296;
  };
  const finder = (r: number, c: number) => {
    const inF = (r0: number, c0: number) => r >= r0 && r < r0 + 7 && c >= c0 && c < c0 + 7;
    const pat = (r0: number, c0: number) => {
      const i = r - r0, j = c - c0;
      return i === 0 || i === 6 || j === 0 || j === 6 || (i >= 2 && i <= 4 && j >= 2 && j <= 4);
    };
    if (inF(0, 0)) return pat(0, 0);
    if (inF(0, N - 7)) return pat(0, N - 7);
    if (inF(N - 7, 0)) return pat(N - 7, 0);
    return null;
  };
  const cells: string[] = [];
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      let on = finder(r, c);
      if (on === null) {
        const sep = (r < 8 && (c < 8 || c >= N - 8)) || (r >= N - 8 && c < 8);
        on = sep ? false : r === 6 || c === 6 ? (r + c) % 2 === 0 : rnd() < 0.45;
      }
      cells.push(on ? "#22303C" : "transparent");
    }
  return cells;
}

/* ------------------------------------------------- roster import parser */

const titleCase = (x: string) =>
  x
    .toLowerCase()
    .replace(/(^|[\s\-'])\S/g, (m) => m.toUpperCase())
    .replace(/\b(De|Del|Dela|Delos|Da|Di|Y)\b/g, (m) => m.toLowerCase())
    .replace(/^./, (m) => m.toUpperCase());

const NOISE = /^(course|school year|academic year|ay:?|sy:?|subject|instructor|total students|sample class list|dummy|page \d|prepared by|date generated|schedule|class schedule|room|test data|official|section:?$|class (list|directory|roster)|student name|first name|last name|middle initial|parsing test|no\.?$|#$|signature|remarks|attendance|group|sex|year|status)\b/i;
const SHORT = /^(M|F|Male|Female|Enrolled|Regular|Irregular|Active|Dropped|INC|DRP|W|NG|Passed|Failed|[A-Z]|[A-F][+-]|TTh|MWF|MW|TF|WF|MTh|Sat|Sun|\d{1,3}(\.\d+)?%?|\d{1,3}[).:]|[A-Z]?\d[A-Z]?|[A-Z]{2,6}\d[A-Z0-9]*|[_\s]+)$/i;
const ID = /^(?=.*\d)[A-Z0-9]{1,6}(-[A-Z0-9]{1,6}){1,3}$|^\d{5,12}$/i;
const HARD = /^(instructor|teacher|adviser|professor|p\.?\s?o\.?\s?box|subject\s*(code|description)?\s*:|offering|grading sheet|class record|(first|second|1st|2nd|summer|midyear)\s+(semester|term|sem)|semester|units?\s*:|day\s*:|time\s*:|room\s*:|school year|a\.?y\.?\s*[:\d]|s\.?y\.?\s*[:\d]|college|university|department|campus)(?=[\s:,#]|$)/i;
const TIME = /\d{1,2}:\d{2}\s*(AM|PM|NN)\b/i;
const TRAIL = /^(\d{1,3}(\.\d+)?%?|[A-F][+-]?|INC|DRP|W|NG|Passed|Failed)$/i;
const PARTICLE = /^(de|del|dela|delos|delas|da|di|san|santa|sta\.?|sto\.?|van|von|mac|mc)$/i;
const isInitial = (w: string) => /^[A-Za-z]{1,2}\.$/.test(w) || /^[A-Z]$/.test(w);

const cleanCell = (x: string) => {
  x = x.replace(/^\d{1,3}[).:]\s*/, "").trim();
  const w = x.split(/\s+/);
  while (w.length > 2 && TRAIL.test(w[w.length - 1]) && !/^[A-Z]$/.test(w[w.length - 1])) w.pop();
  return w.join(" ");
};

const splitName = (raw: string) => {
  raw = raw.replace(/\s+/g, " ").trim();
  let last = "", first = "", mi = "", bad = false;
  const m = raw.match(/^([^,]+),\s*(.+)$/);
  if (m) {
    last = m[1];
    first = m[2];
    const mm = first.match(/^(.*\S)\s+([A-Za-z]{1,2}\.?)$/);
    if (mm) { first = mm[1]; mi = mm[2]; }
  } else {
    const trailing = /,\s*$/.test(raw);
    const w = raw.replace(/,$/, "").split(" ");
    if (w.length < 2 || trailing) { last = raw.replace(/,$/, ""); bad = true; }
    else {
      const mIdx = w.findIndex((x, i) => i > 0 && i < w.length - 1 && isInitial(x));
      if (mIdx > 0) { first = w.slice(0, mIdx).join(" "); mi = w[mIdx]; last = w.slice(mIdx + 1).join(" "); }
      else {
        let cut = w.length - 1;
        while (cut > 1 && PARTICLE.test(w[cut - 1])) cut--;
        if (isInitial(w[w.length - 1])) {
          mi = w[w.length - 1];
          cut = w.length - 2;
          while (cut > 1 && PARTICLE.test(w[cut - 1])) cut--;
          first = w.slice(0, cut).join(" ");
          last = w.slice(cut, w.length - 1).join(" ");
        } else {
          first = w.slice(0, cut).join(" ");
          last = w.slice(cut).join(" ");
        }
      }
    }
  }
  if (/^[^a-z]*$/.test(last + first)) { last = titleCase(last); first = titleCase(first); }
  if (mi) mi = mi.replace(/\.$/, "").toUpperCase() + ".";
  return { last: last.trim(), first: first.trim(), mi, bad };
};

/** Cell-matrix roster parser: skips headers/noise, attaches IDs to names, two-column layouts. */
export function parseCells(rowsIn: (string | null | undefined)[][]): WizStudent[] {
  const rows = rowsIn.map((r) => r.map((x) => String(x ?? "").trim())).filter((r) => r.some(Boolean));
  const out: WizStudent[] = [];
  const push = (no: string, n: ReturnType<typeof splitName>, issues: string[]) =>
    out.push({
      id: uid(),
      no,
      last: n.last,
      first: n.first,
      mi: n.mi,
      name: (n.first ? n.last + ", " + n.first : n.last) + (n.mi ? " " + n.mi : ""),
      issues,
    });
  rows.forEach((cellsRaw) => {
    const cells = cellsRaw.map(cleanCell).filter(Boolean);
    if (cells.every((x) => SHORT.test(x) || NOISE.test(x))) return;
    if (cells.some((x) => HARD.test(x) || TIME.test(x))) return;
    if (cells.some((x) => NOISE.test(x)) && !cells.some((x) => /,/.test(x) && !/first name|last name|middle/i.test(x))) return;
    const isWordCell = (x: string) => /[A-Za-z]/.test(x) && !SHORT.test(x) && !NOISE.test(x) && !ID.test(x);
    const isFullName = (x: string) =>
      isWordCell(x) &&
      (x.includes(",") || (x.split(/\s+/).length >= 2 && (x.split(/\s+/).length >= 3 || x.split(/\s+/).some(isInitial))));
    const words = cells.filter(isWordCell);
    const ids = cells.filter((x) => ID.test(x));
    // CSV-style columns: [ID], Last, First [M.]
    if (words.length >= 2 && words.length <= 3 && ids.length <= 1 && !words.some((x) => x.includes(",")) && words.filter(isFullName).length < 2) {
      const n = splitName(words[0] + ", " + words.slice(1).join(" "));
      push(ids[0] || "", n, ids[0] ? [] : ["no"]);
      return;
    }
    let pendingNo = "";
    const isName = (x: string) => isWordCell(x) && (x.includes(",") || x.split(/\s+/).length >= 2);
    const nameCells = cells.filter(isName);
    if (!nameCells.length) return;
    if (nameCells.length === 1 && !nameCells[0].includes(",") && nameCells[0].split(/\s+/).length > 4) return; // prose line
    cells.forEach((x) => {
      if (ID.test(x)) { pendingNo = x; return; }
      if (!isName(x)) return;
      const n = splitName(x);
      const issues: string[] = [];
      if (!pendingNo) issues.push("no");
      if (n.bad) issues.push("name");
      push(pendingNo, n, issues);
      pendingNo = "";
    });
  });
  return out;
}

export const parseRows = (text: string) =>
  parseCells(text.split(/\r?\n/).map((l) => l.split(/[\t;]+|,(?=\s*\S)/).map((x) => x.trim())));

export async function readXlsxCells(file: File): Promise<string[][]> {
  const X = (await import("xlsx-js-style")).default;
  const wb = X.read(new Uint8Array(await file.arrayBuffer()), { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("no sheet");
  return X.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false, defval: "" });
}

/** Position-aware text extraction from born-digital PDFs (no library). */
export async function readPdfCells(file: File): Promise<string[][]> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const latin = new TextDecoder("latin1").decode(buf);
  const a85 = (str: string) => {
    str = str.replace(/^<~/, "").replace(/~>[\s\S]*$/, "").replace(/\s/g, "");
    const out: number[] = [];
    let t: number[] = [];
    for (const ch of str) {
      if (ch === "z") { out.push(0, 0, 0, 0); continue; }
      t.push(ch.charCodeAt(0) - 33);
      if (t.length === 5) {
        let v = 0;
        for (const x of t) v = v * 85 + x;
        out.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255);
        t = [];
      }
    }
    if (t.length) {
      const n = t.length;
      while (t.length < 5) t.push(84);
      let v = 0;
      for (const x of t) v = v * 85 + x;
      out.push(...[(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255].slice(0, n - 1));
    }
    return new Uint8Array(out);
  };
  const inflate = async (bytes: Uint8Array) => {
    try {
      return await new Response(
        new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate")),
      ).text();
    } catch {
      return null;
    }
  };
  const lines: { y: number; x: number; s: string }[][] = [];
  let i = 0, foundText = false;
  for (;;) {
    const a = latin.indexOf("stream", i);
    if (a < 0) break;
    if (latin.slice(a - 3, a) === "end") { i = a + 6; continue; }
    let stPos = a + 6;
    if (latin[stPos] === "\r") stPos++;
    if (latin[stPos] === "\n") stPos++;
    const b = latin.indexOf("endstream", stPos);
    if (b < 0) break;
    i = b + 9;
    const dict = latin.slice(latin.lastIndexOf("<<", a), a);
    if (/\/Subtype\s*\/Image|application\/c2pa|EmbeddedFile/.test(dict)) continue;
    let bytes = buf.slice(stPos, b);
    if (/ASCII85Decode/.test(dict)) bytes = a85(latin.slice(stPos, b));
    const text = /FlateDecode/.test(dict) ? await inflate(bytes) : new TextDecoder("latin1").decode(bytes);
    if (!text || !/T[jJ]/.test(text)) continue;
    foundText = true;
    let x = 0, y = 0, cmX = 0, cmY = 0;
    const pageLines: { y: number; x: number; s: string }[] = [];
    const stack: [number, number][] = [];
    const re = /\bq\b|\bQ\b|(-?[\d.]+)\s+(-?[\d.]+)\s+(?:Td|TD)|(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+Tm|(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+cm|\((?:\\.|[^\\)])*\)\s*Tj|\[(?:[^\]]*)\]\s*TJ|T\*|BT/g;
    const unesc = (t: string) =>
      t.replace(/\\([nrtbf()\\]|[0-7]{1,3})/g, (_q, c) =>
        c === "n" ? "\n" : c === "r" ? "" : /^[0-7]+$/.test(c) ? String.fromCharCode(parseInt(c, 8)) : c.length === 1 ? c : c,
      );
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const tok = m[0];
      if (tok === "q") stack.push([cmX, cmY]);
      else if (tok === "Q") { const p = stack.pop(); if (p) { cmX = p[0]; cmY = p[1]; } }
      else if (tok === "BT") { x = 0; y = 0; }
      else if (tok.endsWith("cm")) { cmX += parseFloat(m[13]); cmY += parseFloat(m[14]); }
      else if (tok.endsWith("Tm")) { x = parseFloat(m[7]); y = parseFloat(m[8]); }
      else if (/Td|TD$/.test(tok)) { x += parseFloat(m[1]); y += parseFloat(m[2]); }
      else if (tok === "T*") y -= 12;
      else if (tok.endsWith("Tj")) pageLines.push({ y: Math.round((y + cmY) * 2) / 2, x: x + cmX, s: unesc(tok.slice(1, tok.lastIndexOf(")"))) });
      else if (tok.endsWith("TJ")) {
        const parts = [...tok.matchAll(/\((?:\\.|[^\\)])*\)/g)].map((p) => unesc(p[0].slice(1, -1))).join("");
        pageLines.push({ y: Math.round((y + cmY) * 2) / 2, x: x + cmX, s: parts });
      }
    }
    lines.push(pageLines);
  }
  if (!foundText) throw new Error("no text layer — scanned PDF");
  return lines.flatMap((pl) => {
    const byY: Record<string, { y: number; x: number; s: string }[]> = {};
    pl.forEach((l) => {
      (byY[String(l.y)] = byY[String(l.y)] || []).push(l);
    });
    return Object.keys(byY)
      .map(Number)
      .sort((p, q) => q - p)
      .map((k) => byY[String(k)].sort((p, q) => p.x - q.x).map((l) => l.s.trim()).filter(Boolean));
  });
}

export interface AddRosterResult {
  fresh: WizStudent[];
  msg: string;
  kind: "ok" | "warn" | "error";
}

/** Merge parsed rows into the draft roster: dedupe by name, summarize issues. */
export function mergeRoster(existing: WizStudent[], rows: WizStudent[], file: string): AddRosterResult {
  const fresh = rows.filter((r) => !existing.some((e) => e.name === r.name));
  const dup = rows.length - fresh.length;
  const noneHaveNo = rows.length > 0 && rows.every((r) => !r.no);
  if (noneHaveNo)
    fresh.forEach((r) => {
      r.issues = r.issues.filter((x) => x !== "no");
      r.noOptional = true;
    });
  const missNo = fresh.filter((r) => r.issues.includes("no")).length;
  const badName = fresh.filter((r) => r.issues.includes("name")).length;
  let kind: AddRosterResult["kind"] = "ok";
  let msg =
    fresh.length + " students added" + (file ? " from " + file : "") +
    (dup ? " · " + dup + " duplicate" + (dup > 1 ? "s" : "") + " skipped" : "") + ".";
  if (!rows.length) {
    kind = "error";
    msg = (file ? file + ": " : "") + "no student rows found. The file should have a Student No., Last name and First name for each student.";
  } else if (noneHaveNo && !badName) {
    msg += " This file has no student numbers; you can type them in later or leave them blank.";
  } else if (missNo || badName) {
    kind = "warn";
    const parts: string[] = [];
    if (missNo) parts.push(missNo + " without a student no.");
    if (badName) parts.push(badName + " name" + (badName > 1 ? "s" : "") + ' not in "Last, First" form');
    msg += " Check " + parts.join(" and ") + ", highlighted in the list. You can fix them there.";
  }
  return { fresh, msg, kind };
}

export const DEMO_WIZ_ROSTER = (): WizStudent[] =>
  [
    "Aquino, Paolo", "Bautista, Maria", "Dela Cruz, Juan", "Garcia, Jose", "Mendoza, Carlo",
    "Ramos, Nico", "Reyes, Ana", "Santos, Miguel", "Torres, Bea", "Villanueva, Liza",
  ].map((name, i) => ({
    id: uid(),
    no: "2024-0" + (1102 + i * 13),
    name,
    last: name.split(",")[0].trim(),
    first: name.split(",")[1].trim(),
    mi: "",
    issues: [],
  }));
