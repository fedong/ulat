import { uid } from "./presets";
import type { StudentRow } from "./types";

const ID = /^(?=.*\d)[A-Z0-9]{1,6}(-[A-Z0-9]{1,6}){1,3}$|^\d{5,12}$/i;

const titleCase = (x: string) =>
  x
    .toLowerCase()
    .replace(/(^|[\s\-'])\S/g, (m) => m.toUpperCase())
    .replace(/\b(De|Del|Dela|Delos|Da|Di|Y)\b/g, (m) => m.toLowerCase())
    .replace(/^./, (m) => m.toUpperCase());

/**
 * Parse quick-add input: "Student No., Last, First, M.I." (commas or tabs),
 * one student per line. A lighter version of the wizard's import parser.
 */
export function parseRoster(text: string): StudentRow[] {
  return text
    .split(/\n+/)
    .map((line) => line.split(/[\t,]/).map((x) => x.trim()).filter(Boolean))
    .filter((cells) => cells.length > 0)
    .map((cells) => {
      let no = "";
      if (ID.test(cells[0])) no = cells.shift() as string;
      else if (cells.length && ID.test(cells[cells.length - 1]))
        no = cells.pop() as string;
      if (!cells.length) return null;
      const last = titleCase(cells[0] || "");
      let first = titleCase(cells[1] || "");
      let mi = cells[2] || "";
      if (!mi && /\s[A-Za-z]\.?$/.test(first)) {
        const w = first.split(/\s+/);
        mi = w.pop() as string;
        first = w.join(" ");
      }
      if (mi && /^[a-z]\.?$/i.test(mi)) mi = mi[0].toUpperCase() + ".";
      const name = first ? `${last}, ${first}` : last;
      const issues: string[] = [];
      if (!no) issues.push("Missing student no.");
      return { id: uid(), no, name, last, first, mi, issues };
    })
    .filter((r): r is StudentRow => r !== null && !!r.last);
}
