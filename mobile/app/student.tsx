import React, { useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  attColor,
  attRate,
  compute,
  periodOf,
  shortPeriod,
  termOf,
  type Computed,
  type Klass,
  type TermResult,
} from "@ulat/grade-math";
import {
  consultSummary,
  countdown,
  firstNameOf,
  greeting,
  hasConsultHours,
  passingLineOf,
  todayIso,
} from "@/derive";
import { ApiError } from "@/api";
import { OTHER_CLASSES, type StaticClass, type UpcomingItem } from "@/demo";
import { currentPeriodOf } from "@/live";
import { doJoinClass, doSignOut } from "@/session";
import { useUlat, type STab } from "@/store";
import { C, F } from "@/theme";
import {
  animateNextLayout,
  Card,
  Chip,
  FocusInput,
  PhoneShell,
  PressableScale,
  PrimaryButton,
  SectionTitle,
  TabBar,
  UpcomingRow,
  type TabDef,
} from "@/ui";

const SEG_COLORS = ["#0FA3A0", "#5BBFBD", "#9AD9D7", "#C9ECEB"];

/** Demo student keeps the static showcase classes beside the live one. */
const DEMO_STUDENT_EMAIL = "a.reyes@student.univ.edu.ph";

interface StripRow {
  short: string;
  value: string;
  color: string;
  bg: string;
  border: string;
}

/** A live class card with everything the detail view needs attached. */
type LiveCard = StaticClass & {
  c: Computed;
  term: TermResult;
  strip: StripRow[];
  clsRef: Klass;
  sid: string;
  period: string;
  periodClosed: boolean;
  flagged: boolean;
  hasHours: boolean;
  consultText: string;
  section: string;
  no: string;
  rosterName: string;
  passing: number;
};

function buildCard(cls: Klass, sid: string, instructor: string): LiveCard {
  const gs = cls.grading;
  const period = currentPeriodOf(cls, sid);
  const asmsP = cls.assessments.filter((a) => a.period === period);
  const c = compute(cls, gs, sid, null, asmsP);
  const rate = attRate(cls, sid);
  const upcoming: UpcomingItem[] = cls.assessments
    .filter((a) => {
      const v = (cls.scores[sid] || {})[a.id];
      return a.date > todayIso() && (v === undefined || v === null);
    })
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((a) => {
      const dt = new Date(a.date + "T00:00:00");
      const cp = gs.groups.flatMap((g) => g.comps).find((x) => x.id === a.comp);
      return {
        iso: a.date,
        code: cls.code,
        name: a.name,
        max: a.max,
        compPath: cp ? cp.name : "Unassigned",
        countdown: countdown(a.date),
        day: dt.getDate(),
        mon: dt.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
        notes: a.notes || "",
      };
    });
  const term = termOf(cls, gs, cls.periods, sid);
  const strip: StripRow[] = cls.periods.map((p) => {
    const r = periodOf(cls, gs, sid, p);
    return {
      short: shortPeriod(p),
      value: r && r.pct !== null ? r.grade : "—",
      color: r && r.pct !== null ? r.color : C.faint,
      bg: p === period ? C.tealTint8 : (cls.closed || {})[p] ? C.canvas : "#FFFFFF",
      border: p === period ? C.teal : C.line,
    };
  });
  const row = cls.roster.find((r) => r.id === sid);
  return {
    live: true,
    code: cls.code,
    title: cls.title,
    instructor,
    grade: c.grade,
    k: c.k,
    pct: c.pctText,
    att: rate + "%",
    attColor: attColor(rate),
    color: c.color,
    bg: c.bg,
    chipPlain: c.chipPlain,
    passingLine: passingLineOf(gs),
    missing: c.missing.map((a) => a.name),
    upcoming,
    remark: cls.remarks[sid] || "",
    scopes: ["Grades", "Attendance", "Missing work"],
    status: "Active",
    c,
    term,
    strip,
    clsRef: cls,
    sid,
    period,
    periodClosed: !!(cls.closed || {})[period],
    flagged: !!(cls.flags || {})[sid],
    hasHours: hasConsultHours(cls),
    consultText: consultSummary(cls),
    section: cls.section,
    no: row?.no || "",
    rosterName: row?.name || "",
    passing: Number(gs.passing) || 0,
  };
}

/** Route component: the student role needs a signed-in student account. */
export default function StudentScreen() {
  const signedIn = useUlat((s) => s.signedIn);
  const role = useUlat((s) => s.role);
  useEffect(() => {
    if (!signedIn || role !== "student") router.replace("/signin?role=student" as never);
  }, [signedIn, role]);
  if (!signedIn || role !== "student") return null;
  return <StudentInner />;
}

/** Empty state: join the first class with the instructor's code. */
function JoinClassCard() {
  const [code, setCode] = useState("");
  const [no, setNo] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const join = async () => {
    if (busy) return;
    if (!code.trim() || !no.trim())
      return setErr("Enter the class code and your student number (or full name).");
    setBusy(true);
    setErr("");
    try {
      // Whatever they typed works as a student number first, then as a name.
      await doJoinClass(code.trim(), /^[\d-]+$/.test(no.trim()) ? { studentNo: no.trim() } : { name: no.trim() });
    } catch (ex) {
      setErr(
        ex instanceof ApiError && ex.status !== 500
          ? ex.message
          : "Couldn't reach Ulat. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card style={{ gap: 10, paddingVertical: 20 }}>
      <Text style={{ fontFamily: F.d800, fontSize: 17, color: C.ink }}>Join your class</Text>
      <Text style={{ fontFamily: F.b400, fontSize: 13, color: C.sub, lineHeight: 19 }}>
        Ask your instructor for the class code, then enter it with your student number so we can
        find you on the class list.
      </Text>
      <FocusInput
        value={code}
        onChangeText={(v) => {
          setCode(v);
          setErr("");
        }}
        placeholder="Class code (e.g. CS1A2Q)"
        autoCapitalize="characters"
        style={sj.input}
      />
      <FocusInput
        value={no}
        onChangeText={(v) => {
          setNo(v);
          setErr("");
        }}
        placeholder="Student number (or full name)"
        style={sj.input}
      />
      {!!err && <Text style={{ fontFamily: F.b600, fontSize: 12.5, color: C.redText }}>{err}</Text>}
      <PrimaryButton label={busy ? "Joining…" : "Join class"} onPress={() => void join()} disabled={busy} />
    </Card>
  );
}

const sj = StyleSheet.create({
  input: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.line,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    fontFamily: F.b500,
    fontSize: 14,
    color: C.ink,
  },
});

function StudentInner() {
  const st = useUlat();
  const fil = st.lang === "Filipino";
  const isDemo = st.email === DEMO_STUDENT_EMAIL;

  const lives: LiveCard[] = useMemo(
    () => (st.sLive ?? []).map((r) => buildCard(r.class, r.studentRowId, r.instructor)),
    [st.sLive],
  );
  const others = useMemo(() => (isDemo ? OTHER_CLASSES() : []), [isDemo]);
  const sAll: StaticClass[] = [...lives, ...others];

  const main = lives[0] ?? null;
  const first = main ? firstNameOf(main.rosterName) : st.meName.split(" ")[0] || "there";
  const mainPeriod = main?.period || "";

  const sFocus = sAll.find((x) => x.code === st.sFocusCode) || sAll[0];
  const sCls = sAll.find((x) => x.code === st.sClsCode) || sAll[0];
  const sClsLive = sCls?.live ? (sCls as LiveCard) : null;
  const sFocusLive = sFocus?.live ? (sFocus as LiveCard) : null;
  const sUpcoming = sAll.flatMap((x) => x.upcoming).sort((a, b) => (a.iso < b.iso ? -1 : 1));

  const alerts = useMemo(() => {
    const rows: { title: string; body: string; bg: string; color: string; when: string }[] = [];
    lives.forEach((x) => {
      if (x.flagged)
        rows.push({
          title: x.code + " · " + x.instructor + " asked to see you",
          body: "Consultation hours: " + x.consultText,
          bg: C.amberTint,
          color: C.amberText,
          when: "Today",
        });
      x.upcoming.forEach((u) =>
        rows.push({
          title: x.code + " · " + u.name + " · " + u.countdown,
          body: u.notes || u.compPath + " · " + u.max + " points",
          bg: "#FFFFFF",
          color: C.ink,
          when: u.mon + " " + u.day,
        }),
      );
      x.missing.forEach((m) =>
        rows.push({
          title: x.code + " · " + m + " recorded as missed",
          body: "Ask " + x.instructor + " about the make-up schedule.",
          bg: C.redTint8,
          color: C.redText,
          when: "",
        }),
      );
      if (x.remark)
        rows.push({
          title: x.code + " · Remark from " + x.instructor,
          body: x.remark,
          bg: "#FFFFFF",
          color: C.ink,
          when: "",
        });
    });
    others.forEach((x) => {
      x.missing.forEach((m) =>
        rows.push({
          title: x.code + " · " + m + " recorded as missed",
          body: "Ask " + x.instructor + " about the make-up schedule.",
          bg: C.redTint8,
          color: C.redText,
          when: "",
        }),
      );
      x.upcoming.forEach((u) =>
        rows.push({
          title: x.code + " · " + u.name + " · " + u.countdown,
          body: u.notes || u.compPath + " · " + u.max + " points",
          bg: "#FFFFFF",
          color: C.ink,
          when: u.mon + " " + u.day,
        }),
      );
      if (x.remark)
        rows.push({
          title: x.code + " · Remark from " + x.instructor,
          body: x.remark,
          bg: "#FFFFFF",
          color: C.ink,
          when: "",
        });
    });
    return rows;
  }, [lives, others]);

  // "Shared with your guardian" — the first live class's policy (account-level
  // policy view comes with guardian management in the student app).
  const gScopes = (main?.clsRef.guardianScopes ?? {}) as Record<string, boolean>;
  const share = [
    ["Grades", true],
    ["Attendance", true],
    ["Missing work", gScopes["Missing work"] !== false],
    ["Remarks", gScopes.Remarks === true],
  ].map(([k, on]) => ({ k: k as string, v: on ? "Shared" : "Hidden", color: on ? C.tealText : C.faint }));

  const tabs: TabDef<STab>[] = [
    { k: "home", label: "Home", icon: "home" },
    { k: "classes", label: "Classes", icon: "classes" },
    { k: "alerts", label: "Alerts", icon: "alerts", badge: alerts.some((r) => r.color !== C.ink) },
    { k: "me", label: "Me", icon: "me" },
  ];
  const title = { home: "Home", classes: "Class detail", alerts: "Alerts", me: "Profile" }[st.ptabS];
  const sub =
    st.ptabS === "home"
      ? sAll.length + (sAll.length === 1 ? " class" : " classes") + (mainPeriod ? " · " + mainPeriod : "")
      : st.ptabS === "classes"
        ? sCls
          ? sCls.code + " · " + sCls.title + (sClsLive ? " · " + sClsLive.period : "")
          : "No classes yet"
        : st.ptabS === "alerts"
          ? "All " + sAll.length + (sAll.length === 1 ? " class" : " classes")
          : main?.rosterName || st.meName;

  /* ---- no classes yet: everything funnels into the join card ---- */
  if (sAll.length === 0)
    return (
      <PhoneShell title="Home" sub="Join your first class" tabBar={null}>
        <Card style={{ gap: 0 }}>
          <Text style={{ fontFamily: F.b400, fontSize: 13, color: C.sub }}>{greeting(fil)}</Text>
          <Text style={{ fontFamily: F.d800, fontSize: 24, letterSpacing: -0.4, color: C.ink }}>
            {first}
          </Text>
        </Card>
        <JoinClassCard />
        <PressableScale
          scaleTo={0.98}
          onPress={() => {
            void doSignOut();
            router.replace("/");
          }}
        >
          <View style={s.signOut}>
            <Text style={{ fontFamily: F.b700, fontSize: 13, color: C.redText }}>
              {fil ? "Mag-sign out" : "Sign out"}
            </Text>
          </View>
        </PressableScale>
      </PhoneShell>
    );

  return (
    <PhoneShell
      title={title}
      sub={sub}
      tabBar={<TabBar tabs={tabs} active={st.ptabS} onPick={(k) => st.set({ ptabS: k })} />}
    >
      {/* ============ HOME ============ */}
      {st.ptabS === "home" && (
        <>
          <Card style={{ gap: 0 }}>
            <Text style={{ fontFamily: F.b400, fontSize: 13, color: C.sub }}>{greeting(fil)}</Text>
            <Text style={{ fontFamily: F.d800, fontSize: 24, letterSpacing: -0.4, color: C.ink }}>
              {first}
            </Text>
          </Card>
          <PressableScale scaleTo={0.985} onPress={() => st.set({ ptabS: "classes", sClsCode: sFocus.code })}>
            <Card style={{ gap: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <View style={{ minWidth: 0, flexShrink: 1 }}>
                  <Text style={{ fontFamily: F.d800, fontSize: 15, color: C.ink }}>
                    {sFocus.code} · {sFocus.title}
                  </Text>
                  <Text style={{ fontFamily: F.b400, fontSize: 12, color: C.sub }}>
                    {sFocus.instructor}
                    {sFocusLive ? " · " + sFocusLive.period : ""}
                  </Text>
                </View>
                <Text style={{ fontFamily: F.d900, fontSize: 28, color: sFocus.color }}>
                  {sFocus.grade}
                </Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontFamily: F.b600, fontSize: 13, color: C.sub }}>
                  Weighted {sFocus.pct}
                </Text>
                <Text style={{ fontFamily: F.b600, fontSize: 13, color: sFocus.attColor }}>
                  Attendance {sFocus.att}
                </Text>
              </View>
              {sFocusLive && (
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    paddingTop: 8,
                    borderTopWidth: 1,
                    borderTopColor: C.hairline,
                  }}
                >
                  <Text style={{ fontFamily: F.b500, fontSize: 12, color: C.sub }}>
                    {sFocusLive.period + (sFocusLive.periodClosed ? " · Final" : "")}
                  </Text>
                  <Text style={{ fontFamily: F.b700, fontSize: 12, color: sFocusLive.term.color }}>
                    {sFocusLive.term.label}{" "}
                    {sFocusLive.term.pct === null
                      ? "—"
                      : sFocusLive.term.grade + " · " + sFocusLive.term.pctText}
                  </Text>
                </View>
              )}
            </Card>
          </PressableScale>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {sAll
              .filter((x) => x.code !== sFocus.code)
              .map((x) => (
                <PressableScale
                  key={x.code}
                  scaleTo={0.96}
                  style={{ flex: 1 }}
                  onPress={() => {
                    // The tapped tile and the expanded card trade places.
                    animateNextLayout();
                    st.set({ sFocusCode: x.code });
                  }}
                >
                  <Card style={{ borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, gap: 2 }}>
                    <Text style={{ fontFamily: F.b700, fontSize: 12, color: C.sub }}>{x.code}</Text>
                    <Text style={{ fontFamily: F.d900, fontSize: 22, lineHeight: 25, color: x.color }}>
                      {x.grade}
                    </Text>
                    <Text style={{ fontFamily: F.b500, fontSize: 11, color: C.sub }}>
                      Attendance {x.att}
                    </Text>
                  </Card>
                </PressableScale>
              ))}
          </View>
          {sUpcoming.length > 0 && (
            <Card style={{ gap: 10 }}>
              <SectionTitle>Upcoming</SectionTitle>
              {sUpcoming.map((u, i) => (
                <UpcomingRow key={i} u={u} showCode />
              ))}
            </Card>
          )}
        </>
      )}

      {/* ============ CLASSES ============ */}
      {st.ptabS === "classes" && (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
            {sAll.map((x) => {
              const on = x.code === sCls.code;
              return (
                <Pressable
                  key={x.code}
                  onPress={() => st.set({ sClsCode: x.code })}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 999,
                    borderWidth: 1.5,
                    borderColor: on ? C.teal : C.line,
                    backgroundColor: on ? C.tealTint10 : "#FFFFFF",
                  }}
                >
                  <Text style={{ fontFamily: F.b700, fontSize: 13, color: C.ink }}>{x.code}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {sClsLive ? (
            <>
              <Card style={{ padding: 18, gap: 14 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <View style={{ gap: 6 }}>
                    <Text style={{ fontFamily: F.b600, fontSize: 13, color: C.sub }}>
                      Your standing · {sClsLive.period + (sClsLive.periodClosed ? " · Final" : "")}
                    </Text>
                    <Chip text={sClsLive.chipPlain} bg={sClsLive.bg} color={sClsLive.color} />
                  </View>
                  <Text style={{ fontFamily: F.d900, fontSize: 48, letterSpacing: -2, lineHeight: 52, color: sClsLive.color }}>
                    {sClsLive.grade}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {sClsLive.strip.map((p, i) => (
                    <View
                      key={i}
                      style={{
                        flex: 1,
                        borderRadius: 10,
                        paddingVertical: 6,
                        paddingHorizontal: 2,
                        alignItems: "center",
                        backgroundColor: p.bg,
                        borderWidth: 1,
                        borderColor: p.border,
                      }}
                    >
                      <Text numberOfLines={1} style={{ fontFamily: F.b600, fontSize: 9, letterSpacing: 0.4, color: C.sub }}>
                        {p.short}
                      </Text>
                      <Text style={{ fontFamily: F.d800, fontSize: 14, color: p.color }}>{p.value}</Text>
                    </View>
                  ))}
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontFamily: F.b600, fontSize: 13, color: C.sub }}>{sClsLive.term.label}</Text>
                  <Text style={{ fontFamily: F.b600, fontSize: 13, color: sClsLive.term.color }}>
                    {sClsLive.term.pct === null ? "—" : sClsLive.term.grade + " · " + sClsLive.term.pctText}
                  </Text>
                </View>
                <View style={{ gap: 6 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ fontFamily: F.b700, fontSize: 13, color: C.ink }}>Weighted total</Text>
                    <Text style={{ fontFamily: F.b700, fontSize: 13, color: sClsLive.color }}>{sClsLive.pct}</Text>
                  </View>
                  <View style={{ position: "relative", height: 12, borderRadius: 999, backgroundColor: C.line, overflow: "hidden", flexDirection: "row" }}>
                    {sClsLive.c.groups.map((g, i) => (
                      <View key={i} style={{ height: "100%", width: `${g.share}%`, backgroundColor: SEG_COLORS[i % 4] }} />
                    ))}
                    <View style={{ position: "absolute", top: 0, bottom: 0, width: 2, backgroundColor: C.ink, left: `${sClsLive.passing}%` }} />
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 4 }}>
                    <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                      {sClsLive.c.groups.map((g, i) => (
                        <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                          <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: SEG_COLORS[i % 4] }} />
                          <Text style={{ fontFamily: F.b500, fontSize: 12, color: C.sub }}>
                            {g.name} {g.shareW}
                          </Text>
                        </View>
                      ))}
                    </View>
                    <Text style={{ fontFamily: F.b500, fontSize: 12, color: C.sub }}>Passing {sClsLive.passing}%</Text>
                  </View>
                </View>
              </Card>

              {sClsLive.c.groups.map((g, gi) => (
                <Card key={gi} style={{ gap: 12 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: SEG_COLORS[gi % 4] }} />
                      <Text style={{ fontFamily: F.d800, fontSize: 15, color: C.ink }}>{g.name}</Text>
                      {!!g.weightText && (
                        <Text style={{ fontFamily: F.b500, fontSize: 12, color: C.sub }}>
                          {g.weightText} of grade
                        </Text>
                      )}
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={{ fontFamily: F.d800, fontSize: 15, color: g.pctColor }}>{g.avg}</Text>
                      <Text style={{ fontFamily: F.b500, fontSize: 11, color: C.sub }}>
                        {g.shareW} earned
                      </Text>
                    </View>
                  </View>
                  <View style={{ gap: 10 }}>
                    {g.comps.map((c, ci) => (
                      <View key={ci} style={{ gap: 2 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                          <Text style={{ fontFamily: F.b600, fontSize: 13, color: C.ink }}>
                            {c.name} <Text style={{ fontFamily: F.b500, fontSize: 12, color: C.sub }}>{c.w}%</Text>
                          </Text>
                          <Text style={{ fontFamily: F.b700, fontSize: 13, color: c.color }}>
                            {c.pctText}{" "}
                            <Text style={{ fontFamily: F.b500, fontSize: 12, color: C.sub }}>{c.text}</Text>
                          </Text>
                        </View>
                        <View style={{ height: 5, borderRadius: 999, backgroundColor: C.hairline, overflow: "hidden" }}>
                          <View style={{ height: "100%", borderRadius: 999, backgroundColor: c.bar, width: `${c.p === null ? 0 : Math.round(c.p * 100)}%` }} />
                        </View>
                      </View>
                    ))}
                  </View>
                </Card>
              ))}

              {sClsLive.upcoming.length > 0 && (
                <Card style={{ gap: 10 }}>
                  <SectionTitle>Upcoming</SectionTitle>
                  {sClsLive.upcoming.map((u, i) => (
                    <UpcomingRow key={i} u={u} />
                  ))}
                </Card>
              )}

              {sClsLive.flagged ? (
                <View style={{ backgroundColor: C.amberTint, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 14, gap: 4 }}>
                  <Text style={{ fontFamily: F.d800, fontSize: 14, color: C.amberText }}>
                    {sClsLive.instructor} asked to see you
                  </Text>
                  <Text style={{ fontFamily: F.b400, fontSize: 13, color: C.ink, lineHeight: 19 }}>
                    Consultation hours: {sClsLive.consultText}
                  </Text>
                </View>
              ) : (
                sClsLive.hasHours && (
                  <Card style={{ paddingVertical: 14, gap: 4 }}>
                    <Text style={{ fontFamily: F.b600, fontSize: 14, color: C.ink }}>Consultation hours</Text>
                    <Text style={{ fontFamily: F.b400, fontSize: 13, color: C.sub, lineHeight: 19 }}>
                      {sClsLive.consultText}
                    </Text>
                  </Card>
                )
              )}

              <Card style={{ paddingVertical: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontFamily: F.b600, fontSize: 14, color: C.ink }}>
                  Attendance{" "}
                  <Text style={{ fontFamily: F.b500, fontSize: 12, color: C.sub }}>
                    {sClsLive.clsRef.sessions.length
                      ? sClsLive.clsRef.sessions.filter((x) => (x.marks[sClsLive.sid] || "P") !== "A").length +
                        " of " +
                        sClsLive.clsRef.sessions.length +
                        " sessions"
                      : "no sessions yet"}
                  </Text>
                </Text>
                <Text style={{ fontFamily: F.d800, fontSize: 15, color: sClsLive.attColor }}>{sClsLive.att}</Text>
              </Card>

              {!!sClsLive.remark && (
                <View style={s.dashedBox}>
                  <Text style={{ fontFamily: F.b700, fontSize: 13, color: C.sub }}>
                    Remark from {sClsLive.instructor}
                  </Text>
                  <Text style={{ fontFamily: F.b400, fontSize: 14, color: C.ink, marginTop: 4 }}>
                    {sClsLive.remark}
                  </Text>
                </View>
              )}
            </>
          ) : (
            <>
              <Card style={{ gap: 12 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <View style={{ gap: 6 }}>
                    <Text style={{ fontFamily: F.b600, fontSize: 13, color: C.sub }}>
                      Your standing{mainPeriod ? " · " + mainPeriod : ""}
                    </Text>
                    <Chip text={sCls.chipPlain} bg={sCls.bg} color={sCls.color} />
                  </View>
                  <Text style={{ fontFamily: F.d900, fontSize: 48, letterSpacing: -2, lineHeight: 52, color: sCls.color }}>
                    {sCls.grade}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontFamily: F.b600, fontSize: 13, color: C.sub }}>
                    Weighted {sCls.pct}
                  </Text>
                  <Text style={{ fontFamily: F.b600, fontSize: 13, color: sCls.attColor }}>
                    Attendance {sCls.att}
                  </Text>
                </View>
                <Text style={{ fontFamily: F.b400, fontSize: 12, color: C.sub, lineHeight: 18 }}>
                  {sCls.instructor} · {sCls.passingLine}
                </Text>
              </Card>
              <View
                style={[
                  { borderRadius: 16, paddingHorizontal: 18, paddingVertical: 16 },
                  sCls.missing.length
                    ? { backgroundColor: C.amberTint }
                    : { backgroundColor: "#FFFFFF", borderWidth: 1.5, borderStyle: "dashed", borderColor: C.line },
                ]}
              >
                <Text style={{ fontFamily: F.b700, fontSize: 15, color: sCls.missing.length ? C.amberText : C.sub }}>
                  Missing work
                </Text>
                <Text style={{ fontFamily: F.b400, fontSize: 14, color: C.ink, marginTop: 6, lineHeight: 21 }}>
                  {sCls.missing.length
                    ? sCls.missing.join(", ") +
                      (sCls.missing.length > 1 ? " are" : " is") +
                      " still missing — ask about the make-up schedule."
                    : "All work complete"}
                </Text>
              </View>
              {sCls.upcoming.length > 0 && (
                <Card style={{ gap: 10 }}>
                  <SectionTitle>Upcoming</SectionTitle>
                  {sCls.upcoming.map((u, i) => (
                    <UpcomingRow key={i} u={u} showCode />
                  ))}
                </Card>
              )}
              <Text style={{ fontFamily: F.b400, fontSize: 12, color: C.sub, paddingHorizontal: 4, lineHeight: 18 }}>
                Recorded by {sCls.instructor} in their own Ulat class — other instructors share the
                summary only, so component breakdowns appear just for classes graded here.
              </Text>
            </>
          )}
        </>
      )}

      {/* ============ ALERTS ============ */}
      {/* The header already says Alerts, so each item stands on its own. */}
      {st.ptabS === "alerts" && (
        <>
          {alerts.length === 0 && (
            <View style={s.emptyBox}>
              <Text style={{ fontFamily: F.b500, fontSize: 13, color: C.sub, textAlign: "center" }}>
                Nothing new. You are up to date.
              </Text>
            </View>
          )}
          {alerts.map((r, i) => (
            <Card key={i} style={{ gap: 3, paddingHorizontal: 16, paddingVertical: 13, borderRadius: 16 }}>
              {r.bg !== "#FFFFFF" && (
                <View
                  pointerEvents="none"
                  style={[StyleSheet.absoluteFill, { backgroundColor: r.bg, borderRadius: 16 }]}
                />
              )}
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                <Text style={{ fontFamily: F.b700, fontSize: 13, color: r.color, flexShrink: 1 }}>
                  {r.title}
                </Text>
                {!!r.when && (
                  <Text style={{ fontFamily: F.b600, fontSize: 11, color: C.sub }}>{r.when}</Text>
                )}
              </View>
              <Text style={{ fontFamily: F.b400, fontSize: 13, color: C.ink, lineHeight: 19 }}>
                {r.body}
              </Text>
            </Card>
          ))}
        </>
      )}

      {/* ============ ME ============ */}
      {st.ptabS === "me" && (
        <>
          <Card style={{ alignItems: "center", paddingVertical: 24, gap: 6 }}>
            <View style={s.avatar}>
              <Text style={{ fontFamily: F.d800, fontSize: 22, color: "#FFFFFF" }}>{first}</Text>
            </View>
            <Text style={{ fontFamily: F.d800, fontSize: 18, color: C.ink }}>
              {main?.rosterName || st.meName}
            </Text>
            <Text style={{ fontFamily: F.b400, fontSize: 13, color: C.sub }}>
              {main?.section || st.email}
            </Text>
          </Card>
          <Card style={{ gap: 0 }}>
            {(
              [
                ["Student no.", main?.no || "—"],
                ["Section", main?.section || "—"],
                ...(isDemo ? ([["Guardian", "Lorna Reyes · Mother"]] as [string, string][]) : []),
                ["Sharing", "Set by class · " + share.filter((r) => r.v === "Shared").length + " of 4 scopes"],
              ] as [string, string][]
            ).map(([k, v], i, arr) => (
              <View
                key={i}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  gap: 12,
                  paddingVertical: 8,
                  borderBottomWidth: i === arr.length - 1 ? 0 : 1,
                  borderBottomColor: C.hairline,
                }}
              >
                <Text style={{ fontFamily: F.b500, fontSize: 13, color: C.sub }}>{k}</Text>
                <Text style={{ fontFamily: F.b700, fontSize: 13, color: C.ink }}>{v}</Text>
              </View>
            ))}
          </Card>
          <Card style={{ gap: 10 }}>
            <SectionTitle>Shared with your guardian</SectionTitle>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {share.map((r, i) => (
                <View key={i} style={s.shareChip}>
                  <Text style={{ fontFamily: F.b600, fontSize: 12, color: r.color }}>
                    {r.k} · {r.v}
                  </Text>
                </View>
              ))}
            </View>
            <Text style={{ fontFamily: F.b400, fontSize: 12, color: C.sub, lineHeight: 18 }}>
              Your guardians are linked to your account, not to a class. Every class you take on Ulat
              shares with them under its own policy.
            </Text>
          </Card>
          <PressableScale
            scaleTo={0.98}
            onPress={() => {
              void doSignOut();
              router.replace("/");
            }}
          >
            <View style={s.signOut}>
              <Text style={{ fontFamily: F.b700, fontSize: 13, color: C.redText }}>
                {fil ? "Mag-sign out" : "Sign out"}
              </Text>
            </View>
          </PressableScale>
        </>
      )}
    </PhoneShell>
  );
}

const s = StyleSheet.create({
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 999,
    backgroundColor: C.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  dashedBox: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: C.line,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  emptyBox: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: C.line,
    borderRadius: 16,
    padding: 20,
  },
  shareChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.line,
  },
  signOut: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.line,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
});
