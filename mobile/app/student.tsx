import React, { useMemo } from "react";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  attColor,
  attRate,
  compute,
  periodOf,
  shortPeriod,
  termOf,
} from "@ulat/grade-math";
import {
  consultSummary,
  countdown,
  DEMO_INSTRUCTOR,
  firstNameOf,
  fmtDate,
  greeting,
  hasConsultHours,
  passingLineOf,
  todayIso,
} from "@/derive";
import { OTHER_CLASSES, type StaticClass, type UpcomingItem } from "@/demo";
import { currentPeriodOf } from "@/live";
import { useUlat, type STab } from "@/store";
import { C, F } from "@/theme";
import { Card, Chip, PhoneShell, SectionTitle, TabBar, UpcomingRow, type TabDef } from "@/ui";

const SEG_COLORS = ["#0FA3A0", "#5BBFBD", "#9AD9D7", "#C9ECEB"];

export default function StudentScreen() {
  const st = useUlat();
  const cls = st.classes.find((c) => c.id === "cs101")!;
  const gs = cls.grading;
  const sr = cls.roster.find((r) => r.id === st.studentId) || cls.roster[0];
  const first = firstNameOf(sr.name);
  const fil = st.lang === "Filipino";

  // The class's live period: the last open period where scores are recorded.
  const period = useMemo(() => currentPeriodOf(cls, sr.id), [cls, sr.id]);
  const periodClosed = !!(cls.closed || {})[period];
  const passing = Number(gs.passing) || 0;

  const { live, term, strip } = useMemo(() => {
    const asmsP = cls.assessments.filter((a) => a.period === period);
    const c = compute(cls, gs, sr.id, null, asmsP);
    const rate = attRate(cls, sr.id);
    const missing = c.missing.map((a) => a.name);
    const upcoming: UpcomingItem[] = cls.assessments
      .filter((a) => {
        const v = (cls.scores[sr.id] || {})[a.id];
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
    const t = termOf(cls, gs, cls.periods, sr.id);
    const stripRows = cls.periods.map((p) => {
      const r = periodOf(cls, gs, sr.id, p);
      return {
        short: shortPeriod(p),
        value: r && r.pct !== null ? r.grade : "—",
        color: r && r.pct !== null ? r.color : C.faint,
        bg: p === period ? C.tealTint8 : (cls.closed || {})[p] ? C.canvas : "#FFFFFF",
        border: p === period ? C.teal : C.line,
      };
    });
    const liveCls: StaticClass & { c: ReturnType<typeof compute> } = {
      live: true,
      code: cls.code,
      title: cls.title,
      instructor: DEMO_INSTRUCTOR.name,
      grade: c.grade,
      k: c.k,
      pct: c.pctText,
      att: rate + "%",
      attColor: attColor(rate),
      color: c.color,
      bg: c.bg,
      chipPlain: c.chipPlain,
      passingLine: passingLineOf(gs),
      missing,
      upcoming,
      remark: cls.remarks[sr.id] || "",
      scopes: ["Grades", "Attendance", "Missing work"],
      status: "Active",
      c,
    };
    return { live: liveCls, term: t, strip: stripRows };
  }, [cls, gs, sr, period]);

  const others = useMemo(() => OTHER_CLASSES(), []);
  const sAll: StaticClass[] = [live, ...others];
  const flagged = !!(cls.flags || {})[sr.id];
  const hasHours = hasConsultHours(cls);

  const sFocus = sAll.find((x) => x.code === st.sFocusCode) || sAll[0];
  const sCls = sAll.find((x) => x.code === st.sClsCode) || sAll[0];
  const sUpcoming = sAll.flatMap((x) => x.upcoming).sort((a, b) => (a.iso < b.iso ? -1 : 1));

  const alerts = useMemo(() => {
    const rows: { title: string; body: string; bg: string; color: string; when: string }[] = [];
    if (flagged)
      rows.push({
        title: cls.code + " · " + DEMO_INSTRUCTOR.name + " asked to see you",
        body: "Consultation hours: " + consultSummary(cls),
        bg: C.amberTint,
        color: C.amberText,
        when: "Today",
      });
    live.upcoming.forEach((u) =>
      rows.push({
        title: cls.code + " · " + u.name + " · " + u.countdown,
        body: u.notes || u.compPath + " · " + u.max + " points",
        bg: "#FFFFFF",
        color: C.ink,
        when: u.mon + " " + u.day,
      }),
    );
    live.missing.forEach((m) =>
      rows.push({
        title: cls.code + " · " + m + " recorded as missed",
        body: "Ask " + DEMO_INSTRUCTOR.name + " about the make-up schedule.",
        bg: C.redTint8,
        color: C.redText,
        when: "",
      }),
    );
    if (live.remark)
      rows.push({
        title: cls.code + " · Remark from " + DEMO_INSTRUCTOR.name,
        body: live.remark,
        bg: "#FFFFFF",
        color: C.ink,
        when: "",
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
  }, [cls, live, others, flagged]);

  const share = [
    ["Grades", true],
    ["Attendance", true],
    ["Missing work", true],
    ["Remarks", false],
  ].map(([k, on]) => ({ k: k as string, v: on ? "Shared" : "Hidden", color: on ? C.tealText : C.faint }));

  const tabs: TabDef<STab>[] = [
    { k: "home", label: "Home", icon: "home" },
    { k: "classes", label: "Classes", icon: "classes" },
    { k: "alerts", label: "Alerts", icon: "alerts", badge: alerts.some((r) => r.color !== C.ink) },
    { k: "me", label: "Me", icon: "me" },
  ];
  const title = { home: "Home", classes: "Class detail", alerts: "Alerts", me: "Profile" }[st.ptabS];
  const periodHead = period + (periodClosed ? " · Final" : "");
  const sub =
    st.ptabS === "home"
      ? sAll.length + " classes · " + period
      : st.ptabS === "classes"
        ? sCls.code + " · " + sCls.title + " · " + period
        : st.ptabS === "alerts"
          ? "All " + sAll.length + " classes"
          : sr.name;

  const weightedShare = live.c.groups.map((g, i) => ({
    name: g.name,
    w: g.shareW,
    color: SEG_COLORS[i % 4],
  }));

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
          <Pressable onPress={() => st.set({ ptabS: "classes", sClsCode: sFocus.code })}>
            <Card style={{ gap: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <View style={{ minWidth: 0, flexShrink: 1 }}>
                  <Text style={{ fontFamily: F.d800, fontSize: 15, color: C.ink }}>
                    {sFocus.code} · {sFocus.title}
                  </Text>
                  <Text style={{ fontFamily: F.b400, fontSize: 12, color: C.sub }}>
                    {sFocus.instructor} · {period}
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
              {sFocus.live && (
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    paddingTop: 8,
                    borderTopWidth: 1,
                    borderTopColor: C.hairline,
                  }}
                >
                  <Text style={{ fontFamily: F.b500, fontSize: 12, color: C.sub }}>{periodHead}</Text>
                  <Text style={{ fontFamily: F.b700, fontSize: 12, color: term.color }}>
                    {term.label} {term.pct === null ? "—" : term.grade + " · " + term.pctText}
                  </Text>
                </View>
              )}
            </Card>
          </Pressable>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {sAll
              .filter((x) => x.code !== sFocus.code)
              .map((x) => (
                <Pressable key={x.code} style={{ flex: 1 }} onPress={() => st.set({ sFocusCode: x.code })}>
                  <Card style={{ borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, gap: 2 }}>
                    <Text style={{ fontFamily: F.b700, fontSize: 12, color: C.sub }}>{x.code}</Text>
                    <Text style={{ fontFamily: F.d900, fontSize: 22, lineHeight: 25, color: x.color }}>
                      {x.grade}
                    </Text>
                    <Text style={{ fontFamily: F.b500, fontSize: 11, color: C.sub }}>
                      Attendance {x.att}
                    </Text>
                  </Card>
                </Pressable>
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

          {sCls.live ? (
            <>
              <Card style={{ padding: 18, gap: 14 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <View style={{ gap: 6 }}>
                    <Text style={{ fontFamily: F.b600, fontSize: 13, color: C.sub }}>
                      Your standing · {periodHead}
                    </Text>
                    <Chip text={live.chipPlain} bg={live.bg} color={live.color} />
                  </View>
                  <Text style={{ fontFamily: F.d900, fontSize: 48, letterSpacing: -2, lineHeight: 52, color: live.color }}>
                    {live.grade}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {strip.map((p, i) => (
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
                  <Text style={{ fontFamily: F.b600, fontSize: 13, color: C.sub }}>{term.label}</Text>
                  <Text style={{ fontFamily: F.b600, fontSize: 13, color: term.color }}>
                    {term.pct === null ? "—" : term.grade + " · " + term.pctText}
                  </Text>
                </View>
                <View style={{ gap: 6 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ fontFamily: F.b700, fontSize: 13, color: C.ink }}>Weighted total</Text>
                    <Text style={{ fontFamily: F.b700, fontSize: 13, color: live.color }}>{live.pct}</Text>
                  </View>
                  <View style={{ position: "relative", height: 12, borderRadius: 999, backgroundColor: C.line, overflow: "hidden", flexDirection: "row" }}>
                    {live.c.groups.map((g, i) => (
                      <View key={i} style={{ height: "100%", width: `${g.share}%`, backgroundColor: SEG_COLORS[i % 4] }} />
                    ))}
                    <View style={{ position: "absolute", top: 0, bottom: 0, width: 2, backgroundColor: C.ink, left: `${passing}%` }} />
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 4 }}>
                    <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                      {weightedShare.map((g, i) => (
                        <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                          <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: g.color }} />
                          <Text style={{ fontFamily: F.b500, fontSize: 12, color: C.sub }}>
                            {g.name} {g.w}
                          </Text>
                        </View>
                      ))}
                    </View>
                    <Text style={{ fontFamily: F.b500, fontSize: 12, color: C.sub }}>Passing {passing}%</Text>
                  </View>
                </View>
              </Card>

              {live.c.groups.map((g, gi) => (
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

              {live.upcoming.length > 0 && (
                <Card style={{ gap: 10 }}>
                  <SectionTitle>Upcoming</SectionTitle>
                  {live.upcoming.map((u, i) => (
                    <UpcomingRow key={i} u={u} />
                  ))}
                </Card>
              )}

              {flagged ? (
                <View style={{ backgroundColor: C.amberTint, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 14, gap: 4 }}>
                  <Text style={{ fontFamily: F.d800, fontSize: 14, color: C.amberText }}>
                    {DEMO_INSTRUCTOR.name} asked to see you
                  </Text>
                  <Text style={{ fontFamily: F.b400, fontSize: 13, color: C.ink, lineHeight: 19 }}>
                    Consultation hours: {consultSummary(cls)}
                  </Text>
                </View>
              ) : (
                hasHours && (
                  <Card style={{ paddingVertical: 14, gap: 4 }}>
                    <Text style={{ fontFamily: F.b600, fontSize: 14, color: C.ink }}>Consultation hours</Text>
                    <Text style={{ fontFamily: F.b400, fontSize: 13, color: C.sub, lineHeight: 19 }}>
                      {consultSummary(cls)}
                    </Text>
                  </Card>
                )
              )}

              <Card style={{ paddingVertical: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontFamily: F.b600, fontSize: 14, color: C.ink }}>
                  Attendance{" "}
                  <Text style={{ fontFamily: F.b500, fontSize: 12, color: C.sub }}>
                    {cls.sessions.length
                      ? cls.sessions.filter((x) => (x.marks[sr.id] || "P") !== "A").length +
                        " of " +
                        cls.sessions.length +
                        " sessions"
                      : "no sessions yet"}
                  </Text>
                </Text>
                <Text style={{ fontFamily: F.d800, fontSize: 15, color: live.attColor }}>{live.att}</Text>
              </Card>

              {!!live.remark && (
                <View style={s.dashedBox}>
                  <Text style={{ fontFamily: F.b700, fontSize: 13, color: C.sub }}>
                    Remark from {DEMO_INSTRUCTOR.name}
                  </Text>
                  <Text style={{ fontFamily: F.b400, fontSize: 14, color: C.ink, marginTop: 4 }}>
                    {live.remark}
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
                      Your standing · {period}
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
                Recorded by {sCls.instructor} in their own Ulat class.
              </Text>
            </>
          )}
        </>
      )}

      {/* ============ ALERTS ============ */}
      {st.ptabS === "alerts" && (
        <Card style={{ gap: 12 }}>
          <SectionTitle>Alerts</SectionTitle>
          {alerts.length === 0 && (
            <Text style={{ fontFamily: F.b400, fontSize: 13, color: C.sub }}>
              Nothing new. You are up to date.
            </Text>
          )}
          {alerts.map((r, i) => (
            <View
              key={i}
              style={{
                gap: 3,
                paddingHorizontal: 14,
                paddingVertical: 12,
                borderRadius: 14,
                backgroundColor: r.bg,
                borderWidth: 1,
                borderColor: C.hairline,
              }}
            >
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
            </View>
          ))}
        </Card>
      )}

      {/* ============ ME ============ */}
      {st.ptabS === "me" && (
        <>
          <Card style={{ alignItems: "center", paddingVertical: 24, gap: 6 }}>
            <View style={s.avatar}>
              <Text style={{ fontFamily: F.d800, fontSize: 22, color: "#FFFFFF" }}>{first}</Text>
            </View>
            <Text style={{ fontFamily: F.d800, fontSize: 18, color: C.ink }}>{sr.name}</Text>
            <Text style={{ fontFamily: F.b400, fontSize: 13, color: C.sub }}>{cls.section}</Text>
          </Card>
          <Card style={{ gap: 0 }}>
            {[
              ["Student no.", sr.no],
              ["Section", cls.section],
              ["Guardian", "Lorna Reyes · Mother"],
              ["Sharing", "Set by class · 3 of 4 scopes"],
            ].map(([k, v], i) => (
              <View
                key={i}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  gap: 12,
                  paddingVertical: 8,
                  borderBottomWidth: i === 3 ? 0 : 1,
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
          <Pressable onPress={() => router.back()} style={s.signOut}>
            <Text style={{ fontFamily: F.b700, fontSize: 13, color: C.redText }}>Sign out</Text>
          </Pressable>
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
