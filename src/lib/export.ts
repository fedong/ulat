"use client";

import { profileFullName } from "./derive";
import {
  attRate,
  compute,
  periodOf,
  periodWeight,
  termOf,
  txBase,
} from "./grading";
import type { Profile } from "./store";
import type { Assessment, Klass } from "./types";

export interface ExportCtx {
  cls: Klass;
  period: string;
  exportSel: string;
  profile: Profile;
  isPaid?: boolean;
}

const STAND: Record<string, [string, string]> = {
  pass: ["D6F1F0", "0B807E"],
  risk: ["FDF0C9", "8A6400"],
  fail: ["F8DCD6", "B03A24"],
  inc: ["E6E9EC", "5A6672"],
};
const ATTC: Record<string, [string, string]> = {
  P: STAND.pass,
  L: STAND.risk,
  A: STAND.fail,
  E: STAND.inc,
};

const ctxBits = (ctx: ExportCtx) => {
  const { cls } = ctx;
  const gs = cls.grading;
  const periods = cls.periods;
  const closedP = cls.closed || {};
  const termMethod = gs.termMethod === "cumulative" ? "cumulative" : "average";
  const passing = Number(gs.passing) || 0;
  const base = txBase(gs);
  const groupOf = (compId: string) => gs.groups.find((g) => g.comps.some((c) => c.id === compId));
  const compName = (id: string) => {
    const g = groupOf(id);
    const cm = g && g.comps.find((x) => x.id === id);
    return g && cm ? g.name + " › " + cm.name : "";
  };
  const pW = (p: string) => periodWeight(gs, periods, p);
  const fullName = profileFullName(ctx.profile);
  const coT = (cls.team || []).filter((m) => m.status === "active").map((m) => m.name);
  const asmsP = cls.assessments.filter((a) => a.period === ctx.period);
  const pNameXlsx = (p: string) => p + (closedP[p] ? " (Final)" : "");
  const pNamePdf = (p: string) => p + (closedP[p] ? " · Final" : "");
  return { gs, periods, closedP, termMethod, passing, base, groupOf, compName, pW, fullName, coT, asmsP, pNameXlsx, pNamePdf };
};

/* ------------------------------------------------------------------ XLSX */

export async function exportXlsx(ctx: ExportCtx) {
  const X = (await import("xlsx-js-style")).default;
  const { cls, exportSel, profile } = ctx;
  const { gs, periods, closedP, termMethod, passing, base, compName, pW, fullName, coT, asmsP, pNameXlsx } = ctxBits(ctx);
  const roster = cls.roster;

  const F = "Calibri";
  const INK = "22303C", MUTED = "5A6672", LINE = "E8E2D6", SAND = "EFEBE3", PAPER = "FBF9F5", TEAL = "0FA3A0";
  const thin = { style: "thin", color: { rgb: LINE } };
  const box = { top: thin, bottom: thin, left: thin, right: thin };
  const S = {
    title: { font: { name: F, sz: 14, bold: true, color: { rgb: INK } } },
    meta: { font: { name: F, sz: 10, color: { rgb: MUTED } } },
    metaBold: { font: { name: F, sz: 10, bold: true, color: { rgb: INK } } },
    head: { font: { name: F, sz: 10, bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: TEAL } }, alignment: { horizontal: "center", vertical: "center", wrapText: true }, border: box },
    headL: { font: { name: F, sz: 10, bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: TEAL } }, alignment: { vertical: "center" }, border: box },
    sub: { font: { name: F, sz: 9, italic: true, color: { rgb: MUTED } }, fill: { fgColor: { rgb: SAND } }, alignment: { horizontal: "center", wrapText: true }, border: box },
    subL: { font: { name: F, sz: 9, italic: true, color: { rgb: MUTED } }, fill: { fgColor: { rgb: SAND } }, border: box },
    cell: { font: { name: F, sz: 10, color: { rgb: INK } }, alignment: { horizontal: "center" }, border: box },
    cellL: { font: { name: F, sz: 10, color: { rgb: INK } }, border: box },
    cellAlt: { font: { name: F, sz: 10, color: { rgb: INK } }, alignment: { horizontal: "center" }, border: box, fill: { fgColor: { rgb: PAPER } } },
    cellAltL: { font: { name: F, sz: 10, color: { rgb: INK } }, border: box, fill: { fgColor: { rgb: PAPER } } },
    missed: { font: { name: F, sz: 10, bold: true, color: { rgb: "B03A24" } }, fill: { fgColor: { rgb: "F8DCD6" } }, alignment: { horizontal: "center" }, border: box },
    exc: { font: { name: F, sz: 10, italic: true, color: { rgb: MUTED } }, fill: { fgColor: { rgb: "E6E9EC" } }, alignment: { horizontal: "center" }, border: box },
    bold: { font: { name: F, sz: 10, bold: true, color: { rgb: INK } }, alignment: { horizontal: "center" }, border: box },
    note: { font: { name: F, sz: 9, italic: true, color: { rgb: MUTED } } },
    stand: (k: string) => ({ font: { name: F, sz: 10, bold: true, color: { rgb: STAND[k][1] } }, fill: { fgColor: { rgb: STAND[k][0] } }, alignment: { horizontal: "center" }, border: box }),
    att: (k: string) => ({ font: { name: F, sz: 10, bold: true, color: { rgb: (ATTC[k] || ATTC.P)[1] } }, fill: { fgColor: { rgb: (ATTC[k] || ATTC.P)[0] } }, alignment: { horizontal: "center" }, border: box }),
  };
  type Cell = { v: string | number; t: "n" | "s"; s: object };
  const c = (v: string | number, s: object): Cell => ({ v, t: typeof v === "number" ? "n" : "s", s });

  const exportedOn = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const instructorLine =
    (coT.length ? "Instructors: " : "Instructor: ") +
    [fullName, ...coT].filter(Boolean).join(", ") +
    ([profile.position, profile.department, profile.school].filter(Boolean).length
      ? "  ·  " + [profile.position, profile.department, profile.school].filter(Boolean).join(", ")
      : "");

  const banner = (subtitle: string): Cell[][] => [
    [c(cls.code + " · " + cls.title, S.title)],
    [c([cls.section, cls.term, subtitle].filter(Boolean).join("  ·  "), S.meta)],
    [c(instructorLine, S.metaBold)],
    [c("Exported " + exportedOn + "  ·  Passing " + passing + "%" + (base !== null ? "  ·  Transmutation base " + base : ""), S.meta)],
    [],
  ];
  const finish = (aoa: Cell[][], cols: { wch: number }[], headRow: number) => {
    const ws = X.utils.aoa_to_sheet(aoa as unknown as unknown[][]);
    ws["!cols"] = cols;
    const span = Math.max(...aoa.map((r) => r.length));
    ws["!merges"] = [0, 1, 2, 3].map((r) => ({ s: { r, c: 0 }, e: { r, c: Math.max(1, span - 1) } }));
    ws["!rows"] = aoa.map((_, i) => (i === 0 ? { hpt: 22 } : i === headRow ? { hpt: 30 } : { hpt: 17 }));
    (ws as Record<string, unknown>)["!freeze"] = { xSplit: 2, ySplit: headRow + 1 };
    return ws;
  };
  const scoreCell = (v: unknown, alt: boolean): Cell =>
    v === "MISSED" ? c("MISSED", S.missed)
    : v === "EXC" ? c("EXC", S.exc)
    : v === undefined || v === null ? c("", alt ? S.cellAlt : S.cell)
    : c(Number(v), alt ? S.cellAlt : S.cell);

  const scoreSheet = (set: Assessment[], subtitle: string) => {
    const head = [c("Student No.", S.headL), c("Name", S.headL), ...set.map((a) => c(a.name + "\n/ " + a.max, S.head)), c("Weighted %", S.head), c("Grade", S.head), c("Standing", S.head)];
    const sub = [c("", S.subL), c("", S.subL), ...set.map((a) => c(compName(a.comp) + (a.date ? " · " + a.date : ""), S.sub)), c("", S.sub), c("", S.sub), c("", S.sub)];
    const rows = roster.map((r, i) => {
      const k = compute(cls, gs, r.id, null, set);
      const alt = i % 2 === 1;
      return [
        c(r.no, alt ? S.cellAltL : S.cellL),
        c(r.name, alt ? S.cellAltL : S.cellL),
        ...set.map((a) => scoreCell((cls.scores[r.id] || {})[a.id], alt)),
        c(k.pct === null ? "" : Number(k.pct.toFixed(1)), alt ? S.cellAlt : S.cell),
        c(k.grade, S.bold),
        c(k.chipPlain, S.stand(k.k)),
      ];
    });
    const aoa = [...banner(subtitle), head, sub, ...rows, [], [c("MISSED counts as 0 · EXC is excluded from the total · Grades follow the class transmutation table", S.note)]];
    return finish(aoa, [{ wch: 13 }, { wch: 30 }, ...set.map(() => ({ wch: 13 })), { wch: 12 }, { wch: 9 }, { wch: 11 }], 5);
  };
  const termSheet = () => {
    const head = [c("Student No.", S.headL), c("Name", S.headL), ...periods.map((p) => c(p + "\n%", S.head)), ...periods.map((p) => c(p + "\ngrade", S.head)), c(termMethod === "cumulative" ? "Running %" : "Term %", S.head), c("Term grade", S.head), c("Standing", S.head), c("Attendance %", S.head)];
    const rows = roster.map((r, i) => {
      const ps = periods.map((p) => periodOf(cls, gs, r.id, p));
      const t = termOf(cls, gs, periods, r.id);
      const alt = i % 2 === 1;
      const cs = alt ? S.cellAlt : S.cell;
      return [
        c(r.no, alt ? S.cellAltL : S.cellL),
        c(r.name, alt ? S.cellAltL : S.cellL),
        ...ps.map((x) => c(x && x.pct !== null ? Number(x.pct.toFixed(1)) : "", cs)),
        ...ps.map((x) => c(x && x.pct !== null ? x.grade : "", cs)),
        c(t.pct === null ? "" : Number(t.pct.toFixed(1)), cs),
        c(t.grade, S.bold),
        c(t.chipPlain, S.stand(t.k)),
        c(attRate(cls, r.id), cs),
      ];
    });
    const note = "Term method: " + (termMethod === "cumulative" ? "Cumulative (all assessments)" : "Average of periods · weights " + periods.map((p) => p + " " + pW(p) + "%").join(", ")) + (periods.filter((p) => closedP[p]).length ? "  ·  Final: " + periods.filter((p) => closedP[p]).join(", ") : "");
    const aoa = [...banner("Term grades"), head, ...rows, [], [c(note, S.note)]];
    return finish(aoa, [{ wch: 13 }, { wch: 30 }, ...periods.map(() => ({ wch: 11 })), ...periods.map(() => ({ wch: 11 })), { wch: 11 }, { wch: 11 }, { wch: 11 }, { wch: 13 }], 5);
  };
  const attSheet = () => {
    const ses = cls.sessions.slice().sort((x, y) => (x.date < y.date ? -1 : 1));
    const head = [c("Student No.", S.headL), c("Name", S.headL), ...ses.map((s) => c(s.date + (s.group ? "\n" + ((gs.groups.find((g) => g.id === s.group) || {}).name || "") : ""), S.head)), c("Present", S.head), c("Late", S.head), c("Absent", S.head), c("Excused", S.head), c("Rate %", S.head)];
    const rows = roster.map((r, i) => {
      const alt = i % 2 === 1;
      const ks = ses.map((s) => s.marks[r.id] || "P");
      const n = (k: string) => ks.filter((x) => x === k).length;
      const cs = alt ? S.cellAlt : S.cell;
      return [
        c(r.no, alt ? S.cellAltL : S.cellL),
        c(r.name, alt ? S.cellAltL : S.cellL),
        ...ks.map((k) => c(k, S.att(k))),
        c(n("P"), cs), c(n("L"), cs), c(n("A"), cs), c(n("E"), cs),
        c(attRate(cls, r.id), S.bold),
      ];
    });
    const aoa = [...banner("Attendance · " + ses.length + " sessions"), head, ...rows, [], [c("P = Present · L = Late · A = Absent · E = Excused (not counted)", S.note)]];
    return finish(aoa, [{ wch: 13 }, { wch: 30 }, ...ses.map(() => ({ wch: 11 })), { wch: 9 }, { wch: 9 }, { wch: 9 }, { wch: 9 }, { wch: 9 }], 5);
  };

  const wb = X.utils.book_new();
  const add = (ws: unknown, name: string) =>
    X.utils.book_append_sheet(wb, ws as Parameters<typeof X.utils.book_append_sheet>[1], name.replace(/[\\/?*[\]:]/g, " ").slice(0, 31));
  let stem = "gradebook";
  if (exportSel === "all") {
    periods.forEach((p) => {
      const set = cls.assessments.filter((a) => a.period === p);
      if (set.length || closedP[p]) add(scoreSheet(set, pNameXlsx(p)), pNameXlsx(p));
    });
    add(termSheet(), "Term");
    if (cls.sessions.length) add(attSheet(), "Attendance");
  } else if (exportSel === "period") {
    add(scoreSheet(asmsP, pNameXlsx(ctx.period)), pNameXlsx(ctx.period));
    stem = ctx.period;
  } else if (exportSel.startsWith("group:")) {
    const g = gs.groups.find((x) => x.id === exportSel.slice(6));
    if (g) {
      const ids = new Set(g.comps.map((x) => x.id));
      periods.forEach((p) => {
        const set = cls.assessments.filter((a) => a.period === p && ids.has(a.comp));
        if (set.length) add(scoreSheet(set, g.name + " · " + pNameXlsx(p)), g.name + " · " + p);
      });
      stem = g.name;
    }
  } else if (exportSel === "term") {
    add(termSheet(), "Term");
    stem = "term grades";
  } else if (exportSel === "attendance") {
    add(attSheet(), "Attendance");
    stem = "attendance";
  }
  if (!wb.SheetNames.length) add(termSheet(), "Term");
  X.writeFile(wb, (cls.code + " " + (cls.section || "") + " " + stem + " " + new Date().toISOString().slice(0, 10)).replace(/\s+/g, " ").trim() + ".xlsx");
}

/* ------------------------------------------------------------------- PDF */

export async function exportPdf(ctx: ExportCtx) {
  const html2pdf = (await import("html2pdf.js")).default;
  const { cls, exportSel, profile, isPaid = false } = ctx;
  const { gs, periods, closedP, termMethod, passing, base, groupOf, compName, pW, fullName, coT, asmsP, pNamePdf } = ctxBits(ctx);
  const roster = cls.roster;

  const esc = (s: unknown) =>
    String(s === undefined || s === null ? "" : s).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch] as string);
  const PSTAND: Record<string, [string, string]> = {
    pass: ["#D6F1F0", "#0B807E"], risk: ["#FDF0C9", "#8A6400"], fail: ["#F8DCD6", "#B03A24"], inc: ["#E6E9EC", "#5A6672"],
  };
  const PATT: Record<string, [string, string]> = { P: PSTAND.pass, L: PSTAND.risk, A: PSTAND.fail, E: PSTAND.inc };
  const dateLong = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const pill = (text: string, k: string) => '<span class="pill" style="background:' + PSTAND[k][0] + ";color:" + PSTAND[k][1] + '">' + esc(text) + "</span>";
  const score = (v: unknown) =>
    v === "MISSED" ? '<td class="c missed">MISSED</td>' : v === "EXC" ? '<td class="c exc">EXC</td>' : '<td class="c">' + esc(v === undefined || v === null ? "" : v) + "</td>";

  const scoreTable = (set: Assessment[], label: string) =>
    "<section><h2>" + esc(label) + '<span class="n">' + set.length + " assessments · " + roster.length + ' students</span></h2><table><thead><tr><th class="l">Student No.</th><th class="l">Name</th>' +
    set.map((a) => "<th>" + esc(a.name) + "<small>/ " + esc(a.max) + "</small></th>").join("") +
    '<th>Weighted %</th><th>Grade</th><th>Standing</th></tr><tr class="sub"><td></td><td></td>' +
    set.map((a) => "<td>" + esc(compName(a.comp)) + (a.date ? "<br>" + esc(a.date) : "") + "</td>").join("") +
    "<td></td><td></td><td></td></tr></thead><tbody>" +
    roster.map((r) => {
      const k = compute(cls, gs, r.id, null, set);
      return '<tr><td class="l">' + esc(r.no) + '</td><td class="l name">' + esc(r.name) + "</td>" +
        set.map((a) => score((cls.scores[r.id] || {})[a.id])).join("") +
        '<td class="c">' + (k.pct === null ? "—" : k.pct.toFixed(1)) + '</td><td class="c b">' + esc(k.grade) + '</td><td class="c">' + pill(k.chipPlain, k.k) + "</td></tr>";
    }).join("") +
    '</tbody></table><p class="legend">MISSED counts as 0 · EXC is excluded from the total · Grades follow the class transmutation table' + (base !== null ? " (base " + base + ")" : "") + " · Passing " + passing + "%</p></section>";

  const termTable = () =>
    '<section><h2>Term grades<span class="n">' + esc(termMethod === "cumulative" ? "Cumulative over all assessments" : "Average of periods · " + periods.map((p) => p + " " + pW(p) + "%").join(", ")) + '</span></h2><table><thead><tr><th class="l">Student No.</th><th class="l">Name</th>' +
    periods.map((p) => "<th>" + esc(p) + "<small>% · grade</small></th>").join("") +
    "<th>" + (termMethod === "cumulative" ? "Running %" : "Term %") + "</th><th>Term grade</th><th>Standing</th><th>Attendance</th></tr></thead><tbody>" +
    roster.map((r) => {
      const ps = periods.map((p) => periodOf(cls, gs, r.id, p));
      const t = termOf(cls, gs, periods, r.id);
      return '<tr><td class="l">' + esc(r.no) + '</td><td class="l name">' + esc(r.name) + "</td>" +
        ps.map((x) => '<td class="c">' + (x && x.pct !== null ? x.pct.toFixed(1) + " · <b>" + esc(x.grade) + "</b>" : "—") + "</td>").join("") +
        '<td class="c">' + (t.pct === null ? "—" : t.pct.toFixed(1)) + '</td><td class="c b big">' + esc(t.grade) + '</td><td class="c">' + pill(t.chipPlain, t.k) + '</td><td class="c">' + attRate(cls, r.id) + "%</td></tr>";
    }).join("") +
    "</tbody></table>" +
    (periods.some((p) => closedP[p])
      ? '<p class="legend">Final: ' + periods.filter((p) => closedP[p]).join(", ") + ". Other periods are running grades as of " + dateLong + ".</p>"
      : '<p class="legend">Running grades as of ' + dateLong + ". No period has been marked final.</p>") +
    "</section>";

  const attTable = () => {
    const ses = cls.sessions.slice().sort((x, y) => (x.date < y.date ? -1 : 1));
    return '<section><h2>Attendance<span class="n">' + ses.length + ' sessions</span></h2><table class="att"><thead><tr><th class="l">Student No.</th><th class="l">Name</th>' +
      ses.map((s) => "<th>" + esc(s.date.slice(5)) + (s.group ? "<small>" + esc(((gs.groups.find((g) => g.id === s.group) || {}).name || "").slice(0, 3)) + "</small>" : "") + "</th>").join("") +
      "<th>P</th><th>L</th><th>A</th><th>E</th><th>Rate</th></tr></thead><tbody>" +
      roster.map((r) => {
        const ks = ses.map((s) => s.marks[r.id] || "P");
        const n = (k: string) => ks.filter((x) => x === k).length;
        return '<tr><td class="l">' + esc(r.no) + '</td><td class="l name">' + esc(r.name) + "</td>" +
          ks.map((k) => '<td class="c"><span class="mark" style="background:' + PATT[k][0] + ";color:" + PATT[k][1] + '">' + k + "</span></td>").join("") +
          '<td class="c">' + n("P") + '</td><td class="c">' + n("L") + '</td><td class="c">' + n("A") + '</td><td class="c">' + n("E") + '</td><td class="c b">' + attRate(cls, r.id) + "%</td></tr>";
      }).join("") +
      '</tbody></table><p class="legend">P Present · L Late · A Absent · E Excused (not counted in the rate)</p></section>';
  };

  let body = "", scopeLabel = "Gradebook";
  if (exportSel === "all") {
    body = periods.map((p) => { const set = cls.assessments.filter((a) => a.period === p); return set.length || closedP[p] ? scoreTable(set, pNamePdf(p)) : ""; }).join("") + termTable() + (cls.sessions.length ? attTable() : "");
    scopeLabel = "Complete grade report";
  } else if (exportSel === "period") {
    body = scoreTable(asmsP, pNamePdf(ctx.period));
    scopeLabel = pNamePdf(ctx.period) + " grades";
  } else if (exportSel.startsWith("group:")) {
    const g = gs.groups.find((x) => x.id === exportSel.slice(6));
    if (g) {
      const ids = new Set(g.comps.map((x) => x.id));
      body = periods.map((p) => { const set = cls.assessments.filter((a) => a.period === p && ids.has(a.comp)); return set.length ? scoreTable(set, g.name + " · " + pNamePdf(p)) : ""; }).join("");
      scopeLabel = g.name + " grades";
    }
  } else if (exportSel === "term") {
    body = termTable();
    scopeLabel = "Term grade report";
  } else if (exportSel === "attendance") {
    body = attTable();
    scopeLabel = "Attendance report";
  }

  const markUrl = new URL("/ulat-mark.svg", location.href).href;
  const brandHead = isPaid ? "" : '<div class="brand"><img src="' + markUrl + '" alt=""><span>Ulat</span></div>';
  const html =
    "<style>" +
    ".rpt{width:1047px;font:10px/1.35 Figtree,system-ui,sans-serif;color:#22303C;background:#fff}.rpt *{box-sizing:border-box}" +
    ".rpt .head{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;padding-bottom:12px;border-bottom:3px solid #0FA3A0;margin-bottom:14px}.rpt .school{font:700 11px Figtree;letter-spacing:1px;text-transform:uppercase;color:#5A6672}.rpt .dept{font:500 11px Figtree;color:#5A6672;margin-top:2px}.rpt .title{font:800 22px/1.1 Gabarito;letter-spacing:-0.4px;margin-top:8px}.rpt .meta{font:500 11px Figtree;color:#5A6672;margin-top:4px}.rpt .kind{text-align:right}.rpt .kind .lbl{font:700 10px Figtree;letter-spacing:1.4px;color:#0B807E;text-transform:uppercase}.rpt .kind .scope{font:800 16px Gabarito;margin-top:2px}.rpt .kind .meta{margin-top:6px}" +
    ".rpt .brand{display:inline-flex;align-items:center;gap:5px;margin-top:8px;font:800 12px Gabarito;color:#0FA3A0}.rpt .brand img{width:14px;height:14px}" +
    ".rpt section{margin-bottom:18px}.rpt tr{page-break-inside:avoid;break-inside:avoid}.rpt h2{font:800 14px Gabarito;margin:0 0 6px;display:flex;align-items:baseline;gap:10px}.rpt h2 .n{font:500 10px Figtree;color:#5A6672}" +
    ".rpt table{width:100%;border-collapse:collapse;table-layout:auto}.rpt thead{display:table-header-group}.rpt th{background:#0FA3A0;color:#fff;font:700 9.5px Figtree;padding:6px 6px;text-align:center;vertical-align:middle;border:1px solid #0C8F8C}.rpt th.l{text-align:left}.rpt th small{display:block;font:500 9px Figtree;opacity:0.85}.rpt tr.sub td{background:#EFEBE3;color:#5A6672;font:500 8px/1.2 Figtree;text-align:center;padding:3px 4px;border:1px solid #E8E2D6}" +
    ".rpt td{padding:4px 6px;border:1px solid #E8E2D6;font:500 10px Figtree}.rpt td.l{text-align:left}.rpt td.c{text-align:center}.rpt td.b{font-weight:700}.rpt td.big{font:800 12px Gabarito}.rpt td.name{white-space:nowrap}.rpt tbody tr:nth-child(even) td{background:#FBF9F5}.rpt td.missed{color:#B03A24;font-weight:700;background:#F8DCD6!important}.rpt td.exc{color:#5A6672;font-style:italic;background:#E6E9EC!important}" +
    ".rpt .pill{display:inline-block;padding:1px 7px;border-radius:999px;font:700 9px Figtree;white-space:nowrap}.rpt .mark{display:inline-block;width:18px;line-height:16px;border-radius:5px;font:700 9px Figtree}.rpt table.att td,.rpt table.att th{padding:3px 3px}" +
    ".rpt .legend{font:400 9px Figtree;color:#7B8792;margin:6px 0 0}" +
    ".rpt .sign{display:grid;grid-template-columns:repeat(3,1fr);gap:32px;margin-top:34px;break-inside:avoid}.rpt .sign .who{font:700 9px Figtree;letter-spacing:0.8px;color:#5A6672;text-transform:uppercase}.rpt .sign .line{border-bottom:1px solid #22303C;height:30px}.rpt .sign .nm{font:700 11px Figtree;margin-top:5px}.rpt .sign .rl{font:400 9.5px Figtree;color:#5A6672}" +
    "</style>" +
    '<div class="rpt">' +
    '<div class="head"><div><div class="school">' + esc(profile.school || "School name") + '</div><div class="dept">' + esc([profile.department, cls.term].filter(Boolean).join(" · ")) + '</div><div class="title">' + esc(cls.code + " · " + cls.title) + '</div><div class="meta">' + esc([cls.section, roster.length + " students", gs.groups.map((g) => g.name + " " + g.weight + "%").join(" / ")].filter(Boolean).join(" · ")) + "</div></div>" +
    '<div class="kind"><div class="lbl">Official grade report</div><div class="scope">' + esc(scopeLabel) + '</div><div class="meta">' + esc((coT.length ? "Instructors: " : "Instructor: ") + [fullName, ...coT].join(", ")) + '</div><div class="meta">' + esc(dateLong) + "</div>" + brandHead + "</div></div>" +
    body +
    '<div class="sign"><div><div class="who">Prepared by</div><div class="line"></div><div class="nm">' + esc(fullName) + '</div><div class="rl">' + esc(profile.position || "Instructor") + '</div></div><div><div class="who">Noted by</div><div class="line"></div><div class="nm">&nbsp;</div><div class="rl">' + esc(profile.department ? "Chair, " + profile.department : "Department Chair") + '</div></div><div><div class="who">Approved by</div><div class="line"></div><div class="nm">&nbsp;</div><div class="rl">Dean / Registrar</div></div></div>' +
    "</div>";

  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:0;top:0;width:1047px;height:0;overflow:hidden;z-index:-1";
  host.innerHTML = html;
  document.body.appendChild(host);
  const el = host.querySelector(".rpt") as HTMLElement;
  const fname = (cls.code + " " + (cls.section || "") + " " + scopeLabel + " " + new Date().toISOString().slice(0, 10)).replace(/\s+/g, " ").trim() + ".pdf";
  const footL = cls.code + " · " + cls.section + " · " + scopeLabel;
  try {
    await html2pdf()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .set({
        margin: [10, 10, 14, 10],
        filename: fname,
        image: { type: "jpeg", quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#FFFFFF" },
        jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
        pagebreak: { mode: ["css", "legacy"], avoid: ["tr", ".sign", "h2"] },
      } as any)
      .from(el)
      .toPdf()
      .get("pdf")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((pdf: any) => {
        const n = pdf.internal.getNumberOfPages();
        const W = pdf.internal.pageSize.getWidth();
        const H = pdf.internal.pageSize.getHeight();
        for (let i = 1; i <= n; i++) {
          pdf.setPage(i);
          pdf.setDrawColor(232, 226, 214);
          pdf.line(10, H - 9, W - 10, H - 9);
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(7.5);
          pdf.setTextColor(123, 135, 146);
          pdf.text(footL, 10, H - 5.5);
          pdf.text("Page " + i + " of " + n, W / 2, H - 5.5, { align: "center" });
          if (isPaid) pdf.text("Generated " + dateLong, W - 10, H - 5.5, { align: "right" });
          else {
            const tail = " · ulat.ph · " + dateLong;
            const tw = pdf.getTextWidth(tail);
            pdf.text(tail, W - 10, H - 5.5, { align: "right" });
            pdf.setFont("helvetica", "bold");
            pdf.setTextColor(11, 128, 126);
            const bw = pdf.getTextWidth("Ulat");
            pdf.text("Ulat", W - 10 - tw - bw, H - 5.5);
            pdf.setFont("helvetica", "normal");
            pdf.setTextColor(123, 135, 146);
            pdf.text("Generated with ", W - 10 - tw - bw - pdf.getTextWidth("Generated with "), H - 5.5);
          }
        }
        pdf.save(fname);
      });
  } finally {
    host.remove();
  }
}
