import React, { useEffect, useMemo, useRef } from "react";
import { router } from "expo-router";
import {
  Alert,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { Assessment, AttMark, Klass, Score, Session } from "@ulat/grade-math";
import {
  ATT_COLORS,
  ATT_CYCLE,
  attColor,
  attRate,
  compById,
  compute,
  uid,
} from "@ulat/grade-math";
import {
  consultSummary,
  DEMO_INSTRUCTOR,
  fmtDate,
  honor,
  todayIso,
} from "@/derive";
import { useUlat, type ITab } from "@/store";
import { C, F, selectedShadow } from "@/theme";
import {
  BackPill,
  Card,
  Chip,
  FocusInput,
  PhoneShell,
  PressableScale,
  PrimaryButton,
  SectionTitle,
  TabBar,
  type TabDef,
} from "@/ui";

const CARD_W = 260;
const CARD_GAP = 10;

const CARD_STEP = CARD_W + CARD_GAP;

/**
 * Pager-style class card: scale and opacity follow the live scroll position
 * (like Flutter's PageView), so whichever card sits in the center reads as
 * active while you swipe; releasing makes it the selected class.
 */
function ClassCard({
  index,
  scrollX,
  on,
  children,
  onPress,
}: {
  index: number;
  scrollX: Animated.Value;
  on: boolean;
  children: React.ReactNode;
  onPress: () => void;
}) {
  const inputRange = [(index - 1) * CARD_STEP, index * CARD_STEP, (index + 1) * CARD_STEP];
  return (
    <Pressable onPress={onPress}>
      <Animated.View
        style={[
          {
            width: CARD_W,
            paddingHorizontal: 16,
            paddingVertical: 14,
            borderRadius: 16,
            borderWidth: 1.5,
            gap: 1,
            borderColor: on ? C.teal : C.line,
            // Opaque tint (tealTint10 over white): Android elevation shadows
            // bleed through translucent backgrounds and draw an inner ring.
            backgroundColor: on ? "#E7F6F5" : "#FFFFFF",
            opacity: scrollX.interpolate({
              inputRange,
              outputRange: [0.65, 1, 0.65],
              extrapolate: "clamp",
            }),
            transform: [
              {
                // All cards share the same base width; the centered one grows
                // proportionally instead of the neighbors shrinking.
                scale: scrollX.interpolate({
                  inputRange,
                  outputRange: [1, 1.06, 1],
                  extrapolate: "clamp",
                }),
              },
            ],
          },
          on && selectedShadow,
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}

const asmGroup = (cls: Klass, compId: string) => {
  const r = compById(cls.grading, compId);
  return r ? cls.grading.groups.find((g) => g.comps.some((c) => c.id === r.c.id))?.id ?? null : null;
};
const linked = (cls: Klass, s: Session, a: { date: string; comp: string }) =>
  a.date === s.date && (!s.group || asmGroup(cls, a.comp) === s.group);

export default function InstructorScreen() {
  const st = useUlat();
  const cls = st.classes.find((c) => c.id === st.clsId) || st.classes[0];
  const gs = cls.grading;
  const roster = cls.roster;
  const periods = cls.periods;
  const closedP = cls.closed || {};
  const activeCls = st.classes.filter((c) => !c.archived);
  const fil = st.lang === "Filipino";
  const carouselRef = useRef<ScrollView>(null);
  const carouselX = useRef(new Animated.Value(0)).current;
  const sesChipsRef = useRef<ScrollView>(null);

  const asmsP = useMemo(
    () => cls.assessments.filter((a) => a.period === st.period),
    [cls, st.period],
  );
  const gradedOf = (a: Assessment) =>
    roster.filter((r) => {
      const v = (cls.scores[r.id] || {})[a.id];
      return v !== undefined && v !== null;
    }).length;

  /* ---- new assessment draft ---- */
  const naComp = compById(gs, st.na.comp) ? st.na.comp : gs.groups[0]?.comps[0]?.id || "";
  const naPeriod = periods.includes(st.na.period) ? st.na.period : periods[0] || "";
  const compOptions = gs.groups.flatMap((g) =>
    g.comps.map((c) => ({
      value: c.id,
      label: (gs.groups.length > 1 ? g.name + " · " : "") + c.name + " (" + c.w + "%)",
    })),
  );
  const naCompObj = compById(gs, naComp);
  const naBase = naCompObj
    ? naCompObj.c.name
        .replace(/zzes$/i, "z")
        .replace(/([^s])ies$/i, "$1y")
        .replace(/(ch|sh|x|ss)es$/i, "$1")
        .replace(/([^s])s$/i, "$1")
    : "Item";
  const naSuggest = naBase + " " + (cls.assessments.filter((a) => a.comp === naComp).length + 1);
  const naOk = parseFloat(st.na.max) > 0 && !!naComp;
  const naFuture = st.na.later && st.na.date > todayIso();

  const createNa = () => {
    if (!naOk) return;
    const id = uid();
    const nm = st.na.name.trim() || naSuggest;
    st.upCls(cls.id, (c) => {
      const ses = c.sessions.find((s) => linked(c, s, { date: st.na.date, comp: naComp }));
      const scores = { ...c.scores };
      if (ses)
        c.roster.forEach((r) => {
          const m = ses.marks[r.id];
          const v: Score | null = m === "A" ? "MISSED" : m === "E" ? "EXC" : null;
          if (v) scores[r.id] = { ...(scores[r.id] || {}), [id]: v };
        });
      return {
        assessments: [
          ...c.assessments,
          {
            id,
            name: nm,
            comp: naComp,
            period: naPeriod,
            max: Number(st.na.max),
            date: st.na.date,
            notes: st.na.notes.trim(),
          },
        ],
        scores,
      };
    });
    st.set({
      na: { ...st.na, name: "", notes: "", later: false, date: todayIso() },
      period: naPeriod,
      ptabI: "grades",
      phoneAsmId: null,
    });
    st.toast(
      nm + (naFuture ? " scheduled for " + fmtDate(st.na.date) : " created") + ". Students can see it now.",
    );
  };

  /* ---- attendance ---- */
  const multiGroup = gs.groups.length > 1;
  const gName = (id?: string) => gs.groups.find((x) => x.id === id)?.name || "";
  const nSes = cls.sessions.length;
  const si = Math.min(st.phoneSession ?? nSes - 1, nSes - 1);
  const ses = nSes > 0 ? cls.sessions[si] : null;

  // Keep the selected date chip in view (chips list newest-first; 60px + 8 gap).
  useEffect(() => {
    if (nSes === 0 || si < 0) return;
    const pos = (nSes - 1 - si) * 68;
    sesChipsRef.current?.scrollTo({ x: Math.max(0, pos - 130), animated: true });
  }, [si, nSes]);

  const tapMark = (sid: string) => {
    if (!ses) return;
    st.upCls(cls.id, (c) => {
      const s = c.sessions[si];
      const k = (s.marks[sid] || "P") as AttMark;
      const nk = ATT_CYCLE[k];
      const auto: Partial<Record<AttMark, Score>> = { A: "MISSED", E: "EXC" };
      const scores = { ...c.scores };
      const mine = { ...(scores[sid] || {}) };
      let touched = false;
      // Carry A/E into same-day assessments of the matching group, unless hand-edited.
      c.assessments
        .filter((a) => linked(c, s, a))
        .forEach((a) => {
          const cur = mine[a.id];
          const wasAuto = cur === undefined || cur === null || cur === auto[k];
          if (!wasAuto) return;
          if (auto[nk]) {
            mine[a.id] = auto[nk];
            touched = true;
          } else if (cur === auto[k]) {
            delete mine[a.id];
            touched = true;
          }
        });
      if (touched) scores[sid] = mine;
      return {
        sessions: c.sessions.map((x, j) => (j === si ? { ...x, marks: { ...x.marks, [sid]: nk } } : x)),
        scores,
      };
    });
  };

  const sortSes = (ss: Session[]) =>
    ss.sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        gs.groups.findIndex((g) => g.id === a.group) - gs.groups.findIndex((g) => g.id === b.group),
    );
  /** Remove today's session (accidental start): also clears the MISSED/EXC
      scores it auto-carried into same-day assessments, unless hand-edited. */
  const discardToday = (gid: string | null) => {
    st.upCls(cls.id, (c) => {
      const ses2 = c.sessions.find((x) => x.date === todayIso() && (x.group || null) === gid);
      if (!ses2) return {};
      const scores = { ...c.scores };
      c.assessments
        .filter((a) => linked(c, ses2, a))
        .forEach((a) => {
          c.roster.forEach((r) => {
            const m = ses2.marks[r.id];
            const auto = m === "A" ? "MISSED" : m === "E" ? "EXC" : null;
            if (auto && (scores[r.id] || {})[a.id] === auto) {
              const { [a.id]: _drop, ...rest } = scores[r.id];
              scores[r.id] = rest;
            }
          });
        });
      return { sessions: c.sessions.filter((x) => x !== ses2), scores };
    });
    st.set({ phoneSession: null });
    st.toast("Today's session was discarded.");
  };
  const confirmDiscard = (gid: string | null) => {
    const nm = gid ? gName(gid) : "";
    const title = "Discard today's " + (nm ? nm + " " : "") + "session?";
    const body = "All of today's marks are removed for everyone. This cannot be undone.";
    if (Platform.OS === "web") {
      // eslint-disable-next-line no-alert
      if (window.confirm(title + "\n\n" + body)) discardToday(gid);
    } else {
      Alert.alert(title, body, [
        { text: "Cancel", style: "cancel" },
        { text: "Discard", style: "destructive", onPress: () => discardToday(gid) },
      ]);
    }
  };

  const startToday = (gid: string | null) => {
    const nm = gid ? gName(gid) : "";
    const idx = cls.sessions.findIndex((s) => s.date === todayIso() && (s.group || null) === gid);
    if (idx >= 0) return st.set({ phoneSession: idx });
    st.upCls(cls.id, (c) => ({
      sessions: sortSes([
        ...c.sessions,
        {
          date: todayIso(),
          group: gid || undefined,
          marks: Object.fromEntries(c.roster.map((r) => [r.id, "P" as AttMark])),
        },
      ]),
    }));
    const next = sortSes([...cls.sessions, { date: todayIso(), group: gid || undefined, marks: {} }]);
    st.set({ phoneSession: next.findIndex((s) => s.date === todayIso() && (s.group || null) === gid) });
    st.toast(
      (nm ? nm + " session" : "Session") +
        " started — all " +
        roster.length +
        " marked Present. Marks record as you tap.",
      { label: "Undo", run: () => discardToday(gid) },
    );
  };

  /* ---- alerts (needs attention) — always on the class's live period, not
     the Grades filter the instructor last browsed ---- */
  const passing = Number(gs.passing) || 0;
  const livePeriod = useMemo(() => {
    const graded = periods.filter((p) =>
      cls.assessments.some(
        (a) =>
          a.period === p &&
          roster.some((r) => {
            const v = (cls.scores[r.id] || {})[a.id];
            return v !== undefined && v !== null;
          }),
      ),
    );
    const open = graded.filter((p) => !closedP[p]);
    return open[open.length - 1] || graded[graded.length - 1] || periods[0];
  }, [cls, periods, roster, closedP]);
  const liveComputed = useMemo(() => {
    const asmsLive = cls.assessments.filter((a) => a.period === livePeriod);
    return Object.fromEntries(roster.map((r) => [r.id, compute(cls, gs, r.id, null, asmsLive)]));
  }, [cls, gs, roster, livePeriod]);
  const watch = useMemo(() => {
    const order: Record<string, number> = { fail: 0, inc: 1, risk: 2 };
    return roster
      .map((r) => ({ r, c: liveComputed[r.id] }))
      .filter((x) => x.c.k !== "pass")
      .sort((a, b) => order[a.c.k] - order[b.c.k] || (a.c.pct || 0) - (b.c.pct || 0))
      .map((x) => {
        const out: string[] = [];
        if (x.c.missing.length) out.push(x.c.missing.length + " missed");
        const comps = x.c.groups
          .flatMap((g) =>
            g.comps
              .filter((c) => c.p !== null && c.p * 100 < passing)
              .map((c) => ({ n: (x.c.groups.length > 1 ? g.name + " " : "") + c.name, p: c.p as number })),
          )
          .sort((a, b) => a.p - b.p);
        if (comps.length) out.push("weakest " + comps[0].n + " " + Math.round(comps[0].p * 100) + "%");
        const at = attRate(cls, x.r.id);
        if (at < 85) out.push("attendance " + at + "%");
        if (x.c.k === "inc") out.push("exam pending");
        return {
          name: x.r.name,
          chip: x.c.chip,
          bg: x.c.bg,
          color: x.c.color,
          why: out.join(" · ") || "Close to the passing line",
        };
      });
  }, [roster, liveComputed, cls, passing]);
  const flagged = Object.keys(cls.flags || {})
    .filter((k) => (cls.flags || {})[k])
    .map((id) => roster.find((r) => r.id === id))
    .filter(Boolean)
    .map((r) => ({
      name: r!.name,
      chip: "Consult",
      bg: C.amberTint,
      color: C.amberText,
      why: "Flagged for consultation",
    }));
  const alerts = [...watch, ...flagged];

  const tabs: TabDef<ITab>[] = [
    { k: "classes", label: "Classes", icon: "classes" },
    { k: "grades", label: "Grades", icon: "grades" },
    { k: "attend", label: "Attendance", icon: "attend" },
    { k: "alerts", label: "Alerts", icon: "alerts", badge: alerts.length > 0 },
    { k: "me", label: "Me", icon: "me" },
  ];
  const title = {
    classes: "New assessment",
    grades: st.phoneAsmId ? "Gradebook" : "Grades",
    attend: "Attendance",
    alerts: "Alerts",
    me: "Profile",
  }[st.ptabI];
  const sub = cls.code + " · " + cls.title + " · " + cls.section;

  const activateCls = (c: Klass) => {
    if (c.id === st.clsId) return;
    st.set({ clsId: c.id, phoneAsmId: null, phoneSession: null, period: c.periods[0] });
  };
  const pickCls = (c: Klass, idx: number) => {
    activateCls(c);
    carouselRef.current?.scrollTo({ x: idx * CARD_STEP, animated: true });
  };

  const pa = cls.assessments.find((a) => a.id === st.phoneAsmId) || null;
  const paGraded = pa ? gradedOf(pa) : 0;
  const putScore = (sid: string, v: Score | null) => {
    if (!pa) return;
    st.upCls(cls.id, (c) => ({
      scores: { ...c.scores, [sid]: { ...(c.scores[sid] || {}), [pa.id]: v } },
    }));
  };
  const periodClosed = !!closedP[st.period];

  /* ---- entitlement (demo: Trialing) ---- */
  const trialDays = Math.max(0, Math.round((Date.parse("2027-02-14") - Date.now()) / 864e5));
  const planTitle = fil
    ? "Nasa Pro ka — libre hanggang February 14"
    : "You're on Pro — free until February 14";
  const planSub = fil ? trialDays + " araw pa" : trialDays + " days left";

  return (
    <PhoneShell
      title={title}
      sub={sub}
      toast={st.phoneToast}
      toastAction={st.phoneToastAct}
      tabBar={<TabBar tabs={tabs} active={st.ptabI} onPick={(k) => st.set({ ptabI: k })} />}
    >
      {/* ============ CLASSES + NEW ASSESSMENT ============ */}
      {st.ptabI === "classes" && (
        <>
          <View style={s.planBanner}>
            <View style={s.planDot} />
            <View style={{ minWidth: 0, flexShrink: 1 }}>
              <Text style={{ fontFamily: F.b700, fontSize: 13, color: C.tealText }}>{planTitle}</Text>
              <Text style={{ fontFamily: F.b500, fontSize: 12, color: C.tealText, marginTop: 1, opacity: 0.85 }}>
                {planSub}
              </Text>
            </View>
          </View>

          <View style={{ marginHorizontal: -20, gap: 10 }}>
            <Animated.ScrollView
              ref={carouselRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={CARD_STEP}
              decelerationRate="fast"
              scrollEventThrottle={16}
              onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: carouselX } } }], {
                useNativeDriver: true,
              })}
              onMomentumScrollEnd={(e) => {
                // Whichever card settles in the center becomes the active class.
                const idx = Math.max(
                  0,
                  Math.min(activeCls.length - 1, Math.round(e.nativeEvent.contentOffset.x / CARD_STEP)),
                );
                if (activeCls[idx]) activateCls(activeCls[idx]);
              }}
              contentContainerStyle={{ gap: CARD_GAP, paddingHorizontal: 65, paddingVertical: 8, alignItems: "center" }}
            >
              {activeCls.map((c, i) => {
                const on = c.id === cls.id;
                const team = (c.team || []).filter((m) => m.status === "active");
                return (
                  <ClassCard key={c.id} index={i} scrollX={carouselX} on={on} onPress={() => pickCls(c, i)}>
                    <Text numberOfLines={1} style={{ fontFamily: F.d800, fontSize: 15, color: C.ink }}>
                      {c.code} · {c.section}
                    </Text>
                    <Text numberOfLines={1} style={{ fontFamily: F.b400, fontSize: 12, color: C.sub }}>
                      {c.title} · {c.roster.length} students
                      {team.length ? " · with " + team.map((m) => honor(m.name)).join(", ") : ""}
                    </Text>
                  </ClassCard>
                );
              })}
            </Animated.ScrollView>
            <View style={{ flexDirection: "row", justifyContent: "center", gap: 6 }}>
              {activeCls.map((c, i) => {
                const on = c.id === cls.id;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => pickCls(c, i)}
                    style={{
                      width: on ? 18 : 6,
                      height: 6,
                      borderRadius: 999,
                      backgroundColor: on ? C.teal : "#D5CFC3",
                    }}
                  />
                );
              })}
            </View>
          </View>

          <Card style={{ gap: 14 }}>
            <View style={{ gap: 6 }}>
              <Text style={s.label}>NAME</Text>
              <FocusInput
                value={st.na.name}
                onChangeText={(t) => st.set({ na: { ...st.na, name: t } })}
                placeholder={naSuggest}
                style={s.input}
              />
            </View>
            <View style={{ gap: 6 }}>
              <Text style={s.label}>COMPONENT</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {compOptions.map((o) => {
                  const on = naComp === o.value;
                  return (
                    <Pressable
                      key={o.value}
                      onPress={() => st.set({ na: { ...st.na, comp: o.value } })}
                      style={[s.chipBtn, on && s.chipBtnOn]}
                    >
                      <Text style={[s.chipBtnText, on && { color: "#FFFFFF" }]}>{o.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <View style={{ gap: 6 }}>
              <Text style={s.label}>PERIOD</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {periods.map((p) => {
                  const on = naPeriod === p;
                  return (
                    <Pressable
                      key={p}
                      onPress={() => st.set({ na: { ...st.na, period: p } })}
                      style={[s.chipBtn, on && s.chipBtnOn]}
                    >
                      <Text style={[s.chipBtnText, on && { color: "#FFFFFF" }]}>{p}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1, gap: 6, minWidth: 0 }}>
                <Text style={s.label}>MAX SCORE</Text>
                <FocusInput
                  value={st.na.max}
                  onChangeText={(t) => st.set({ na: { ...st.na, max: t } })}
                  inputMode="decimal"
                  style={[s.input, { fontFamily: F.d800, fontSize: 16 }]}
                />
              </View>
              <View style={{ flex: 1, gap: 6, minWidth: 0 }}>
                <Text style={s.label}>WHEN</Text>
                <View style={s.segWrap}>
                  {(
                    [
                      ["Today", false],
                      ["Later", true],
                    ] as const
                  ).map(([label, later]) => {
                    const on = st.na.later === later;
                    return (
                      <Pressable
                        key={label}
                        onPress={() => st.set({ na: { ...st.na, later } })}
                        style={[s.segBtn, on && s.segBtnOn]}
                      >
                        <Text
                          numberOfLines={1}
                          style={{ fontFamily: F.b700, fontSize: 12, color: on ? "#FFFFFF" : C.sub }}
                        >
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
            {st.na.later && (
              <View style={{ gap: 6 }}>
                <Text style={s.label}>DATE</Text>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {(
                    [
                      ["Tomorrow", 1],
                      ["+3 days", 3],
                      ["Next week", 7],
                    ] as const
                  ).map(([label, days]) => {
                    const iso = new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);
                    const on = st.na.date === iso;
                    return (
                      <Pressable
                        key={label}
                        onPress={() => st.set({ na: { ...st.na, date: iso } })}
                        style={[s.chipBtn, on && s.chipBtnOn]}
                      >
                        <Text style={[s.chipBtnText, on && { color: "#FFFFFF" }]}>{label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <FocusInput
                  value={st.na.date}
                  onChangeText={(t) => st.set({ na: { ...st.na, date: t } })}
                  placeholder="YYYY-MM-DD"
                  style={s.input}
                />
              </View>
            )}
            <View style={{ gap: 6 }}>
              <Text style={s.label}>
                COVERAGE AND REMINDERS <Text style={{ fontFamily: F.b500 }}>· shown to students</Text>
              </Text>
              <FocusInput
                value={st.na.notes}
                onChangeText={(t) => st.set({ na: { ...st.na, notes: t } })}
                placeholder="e.g. Chapters 3–5, bring a calculator. Room B-301."
                multiline
                numberOfLines={2}
                style={[s.input, { height: 64, paddingTop: 10, textAlignVertical: "top" }]}
              />
            </View>
            {naFuture && (
              <View style={{ backgroundColor: C.tealTint12, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 }}>
                <Text style={{ fontFamily: F.b500, fontSize: 13, color: C.tealText, lineHeight: 19 }}>
                  Scheduled {fmtDate(st.na.date)}. Students see it under Upcoming with a countdown.
                </Text>
              </View>
            )}
            <PrimaryButton label="Add assessment" onPress={createNa} disabled={!naOk} />
            <Text style={{ fontFamily: F.b400, fontSize: 12, color: C.sub, lineHeight: 18 }}>
              Leave blank to name it &quot;{naSuggest}&quot;. Components come from the grading system set
              on the web.
            </Text>
          </Card>
        </>
      )}

      {/* ============ GRADES ============ */}
      {st.ptabI === "grades" && !pa && (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {periods.map((p) => {
              const on = st.period === p;
              return (
                <Pressable
                  key={p}
                  onPress={() => st.set({ period: p, phoneAsmId: null })}
                  style={[s.chipBtn, on && s.chipBtnOn]}
                >
                  <Text style={[s.chipBtnText, on && { color: "#FFFFFF" }]}>
                    {p + (closedP[p] ? " · Final" : "")}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Card style={{ gap: 12 }}>
            <SectionTitle>{st.period} assessments</SectionTitle>
            {asmsP.length === 0 && (
              <Text style={{ fontFamily: F.b400, fontSize: 13, color: C.sub }}>
                No assessments in this period yet.
              </Text>
            )}
            {asmsP
              .slice()
              .sort((a, b) => (a.date < b.date ? 1 : -1))
              .map((a) => {
                const g = gradedOf(a);
                const upcoming = a.date > todayIso() && g === 0;
                return (
                  <Pressable
                    key={a.id}
                    onPress={() => st.set({ phoneAsmId: a.id })}
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 10,
                      paddingVertical: 10,
                      borderTopWidth: 1,
                      borderTopColor: C.hairline,
                    }}
                  >
                    <View style={{ minWidth: 0, flexShrink: 1 }}>
                      <Text numberOfLines={1} style={{ fontFamily: F.b600, fontSize: 14, color: C.ink }}>
                        {a.name}
                      </Text>
                      <Text style={{ fontFamily: F.b400, fontSize: 12, color: C.sub }}>
                        {(compById(gs, a.comp)
                          ? (gs.groups.length > 1 ? compById(gs, a.comp)!.g.name + " · " : "") +
                            compById(gs, a.comp)!.c.name
                          : "Unassigned") +
                          " · " +
                          fmtDate(a.date)}
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontFamily: F.b700,
                        fontSize: 12,
                        color: g >= roster.length ? C.tealText : C.sub,
                      }}
                    >
                      {upcoming ? "Scheduled" : g + " / " + roster.length + " graded"}
                    </Text>
                  </Pressable>
                );
              })}
          </Card>
        </>
      )}
      {st.ptabI === "grades" && pa && (
        <>
          <BackPill label="All assessments" onPress={() => st.set({ phoneAsmId: null })} />
          <Card style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 }}>
                <Text style={{ fontFamily: F.d800, fontSize: 17, color: C.ink }}>{pa.name}</Text>
                {periodClosed && <Chip text="Final" bg={C.incTint} color={C.sub} />}
              </View>
              <Text style={{ fontFamily: F.b700, fontSize: 13, color: C.tealText }}>
                {Math.round((paGraded / Math.max(1, roster.length)) * 100)}%
              </Text>
            </View>
            <Text style={{ fontFamily: F.b400, fontSize: 12, color: C.sub }}>
              {fmtDate(pa.date)} · out of {pa.max} · {paGraded} of {roster.length} graded
            </Text>
            <View style={{ height: 6, borderRadius: 999, backgroundColor: C.hairline, overflow: "hidden" }}>
              <View
                style={{
                  height: "100%",
                  borderRadius: 999,
                  backgroundColor: C.teal,
                  width: `${Math.round((paGraded / Math.max(1, roster.length)) * 100)}%`,
                }}
              />
            </View>
            <Text style={{ fontFamily: F.b400, fontSize: 12, color: C.sub, lineHeight: 18 }}>
              {periodClosed
                ? "This period is marked Final — scores are read-only."
                : "Type a score, or M for missed and E for excused. Leave blank to clear."}
            </Text>
          </Card>
          <Card pad={false} style={{ paddingHorizontal: 18, paddingVertical: 4 }}>
            {roster.map((r) => {
              const v = (cls.scores[r.id] || {})[pa.id];
              const special = v === "MISSED" || v === "EXC";
              const pct = typeof v === "number" ? Math.round((v / pa.max) * 100) : null;
              return (
                <View
                  key={r.id}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                    paddingVertical: 8,
                    borderBottomWidth: 1,
                    borderBottomColor: C.hairline,
                  }}
                >
                  <View style={{ minWidth: 0, flex: 1 }}>
                    <Text numberOfLines={1} style={{ fontFamily: F.b600, fontSize: 14, color: C.ink }}>
                      {r.name}
                    </Text>
                    {special && (
                      <View style={{ marginTop: 3, alignSelf: "flex-start" }}>
                        <Chip
                          text={v === "MISSED" ? "Missed" : "Excused"}
                          bg={v === "MISSED" ? C.redTint12 : C.incTint}
                          color={v === "MISSED" ? C.redText : C.sub}
                        />
                      </View>
                    )}
                    {pct !== null && (
                      <Text
                        style={{
                          fontFamily: F.b600,
                          fontSize: 12,
                          marginTop: 2,
                          color: pct < passing ? C.redText : C.tealText,
                        }}
                      >
                        {pct}%
                      </Text>
                    )}
                  </View>
                  <FocusInput
                    key={pa.id + r.id + String(v)}
                    defaultValue={typeof v === "number" ? String(v) : ""}
                    editable={!periodClosed}
                    inputMode="decimal"
                    placeholder={special ? (v === "MISSED" ? "M" : "E") : "—"}
                    onEndEditing={(e) => {
                      const raw = e.nativeEvent.text.trim();
                      if (raw === "") return putScore(r.id, null);
                      if (/^m/i.test(raw)) return putScore(r.id, "MISSED");
                      if (/^e/i.test(raw)) return putScore(r.id, "EXC");
                      const n = parseFloat(raw);
                      if (!isNaN(n)) putScore(r.id, Math.max(0, Math.min(Number(pa.max), n)));
                    }}
                    style={[
                      s.scoreInput,
                      periodClosed && {
                        backgroundColor: C.canvas,
                        borderColor: C.hairline,
                        color: C.sub,
                      },
                    ]}
                  />
                </View>
              );
            })}
          </Card>
        </>
      )}

      {/* ============ ATTENDANCE ============ */}
      {st.ptabI === "attend" && (
        <>
          {/* One control per group: Start (one tap, everyone Present, marks
              record live) — or, once recording, a status strip with Discard
              as the escape hatch for an accidental start. */}
          <View style={{ gap: 8 }}>
            {(multiGroup ? gs.groups.map((g) => [g.id, g.name] as const) : [[null, ""] as const]).map(
              ([gid, nm]) => {
                const open = cls.sessions.some(
                  (x) => x.date === todayIso() && (x.group || null) === gid,
                );
                return open ? (
                  <View key={String(gid)} style={s.recStrip}>
                    <View style={s.recDot} />
                    <Text
                      numberOfLines={1}
                      style={{ fontFamily: F.b600, fontSize: 13, color: C.tealText, flexShrink: 1, flexGrow: 1 }}
                    >
                      {(nm ? "Today's " + nm + " session" : "Today's session") + " is recording"}
                    </Text>
                    <Pressable onPress={() => confirmDiscard(gid)} hitSlop={8}>
                      <Text style={{ fontFamily: F.b700, fontSize: 12, color: C.redText }}>Discard</Text>
                    </Pressable>
                  </View>
                ) : (
                  <PrimaryButton
                    key={String(gid)}
                    label={nm ? "Start today's " + nm + " session" : "Start today's session"}
                    onPress={() => startToday(gid)}
                  />
                );
              },
            )}
          </View>
          {nSes === 0 && (
            <View style={s.dashedBox}>
              <Text style={{ fontFamily: F.b500, fontSize: 13, color: C.sub, textAlign: "center", lineHeight: 19 }}>
                No sessions yet. Start today&apos;s session and everyone is marked present until you
                change it.
              </Text>
            </View>
          )}
          {nSes > 0 && ses && (
            <>
              <ScrollView
                ref={sesChipsRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
              >
                {cls.sessions
                  .map((x, k) => ({ x, k }))
                  .reverse()
                  .map(({ x, k }) => {
                    const on = k === si;
                    const dt = new Date(x.date + "T00:00:00");
                    const short = gName(x.group).slice(0, 3).toUpperCase();
                    return (
                      <Pressable
                        key={k}
                        onPress={() => st.set({ phoneSession: k })}
                        style={{
                          width: 60,
                          paddingVertical: 8,
                          borderRadius: 14,
                          borderWidth: 1.5,
                          alignItems: "center",
                          gap: 1,
                          borderColor: on ? C.teal : C.line,
                          backgroundColor: on ? C.teal : "#FFFFFF",
                        }}
                      >
                        <Text style={{ fontFamily: F.b600, fontSize: 10, letterSpacing: 0.4, color: on ? "rgba(255,255,255,0.8)" : C.sub }}>
                          {dt.toLocaleDateString("en-US", { weekday: "short" })}
                        </Text>
                        <Text style={{ fontFamily: F.d800, fontSize: 18, lineHeight: 20, color: on ? "#FFFFFF" : C.ink }}>
                          {dt.getDate()}
                        </Text>
                        <Text style={{ fontFamily: F.b600, fontSize: 10, letterSpacing: 0.4, color: on ? "rgba(255,255,255,0.8)" : C.sub }}>
                          {dt.toLocaleDateString("en-US", { month: "short" }).toUpperCase()}
                        </Text>
                        {!!x.group && (
                          <View
                            style={{
                              paddingHorizontal: 5,
                              paddingVertical: 1,
                              borderRadius: 999,
                              marginTop: 2,
                              backgroundColor: on ? "rgba(255,255,255,0.22)" : C.tealTint12,
                            }}
                          >
                            <Text style={{ fontFamily: F.b700, fontSize: 9, letterSpacing: 0.5, color: on ? "#FFFFFF" : C.tealText }}>
                              {short}
                            </Text>
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
              </ScrollView>
              <Card style={{ gap: 10 }}>
                <SectionTitle>
                  {new Date(ses.date + "T00:00:00").toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                  }) + (ses.group ? " · " + gName(ses.group) : "")}
                </SectionTitle>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {(["P", "L", "A", "E"] as const).map((k) => {
                    const n = roster.filter((r) => (ses.marks[r.id] || "P") === k).length;
                    return (
                      <View
                        key={k}
                        style={{ flex: 1, borderRadius: 12, paddingVertical: 8, alignItems: "center", backgroundColor: ATT_COLORS[k][0] }}
                      >
                        <Text style={{ fontFamily: F.d800, fontSize: 18, lineHeight: 20, color: ATT_COLORS[k][1] }}>
                          {n}
                        </Text>
                        <Text style={{ fontFamily: F.b600, fontSize: 10, letterSpacing: 0.3, color: ATT_COLORS[k][1] }}>
                          {ATT_COLORS[k][2]}
                        </Text>
                      </View>
                    );
                  })}
                </View>
                <Text style={{ fontFamily: F.b400, fontSize: 12, color: C.sub, lineHeight: 18 }}>
                  Tap a mark to cycle Present → Late → Absent → Excused. Absent and Excused carry into
                  this session&apos;s assessments.
                </Text>
              </Card>
              <Card pad={false} style={{ paddingHorizontal: 18, paddingVertical: 4 }}>
                {roster.map((r) => {
                  const k = (ses.marks[r.id] || "P") as AttMark;
                  const rate = attRate(cls, r.id);
                  return (
                    <View
                      key={r.id}
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 10,
                        paddingVertical: 10,
                        borderBottomWidth: 1,
                        borderBottomColor: C.hairline,
                      }}
                    >
                      <View style={{ minWidth: 0, flexShrink: 1 }}>
                        <Text numberOfLines={1} style={{ fontFamily: F.b600, fontSize: 14, color: C.ink }}>
                          {r.name}
                        </Text>
                        <Text style={{ fontFamily: F.b400, fontSize: 12, color: attColor(rate) }}>
                          {rate}% overall
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => tapMark(r.id)}
                        style={{
                          minWidth: 84,
                          height: 34,
                          paddingHorizontal: 12,
                          borderRadius: 999,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: ATT_COLORS[k][0],
                        }}
                      >
                        <Text style={{ fontFamily: F.b700, fontSize: 12, color: ATT_COLORS[k][1] }}>
                          {ATT_COLORS[k][2]}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
              </Card>
            </>
          )}
        </>
      )}

      {/* ============ ALERTS ============ */}
      {st.ptabI === "alerts" && (
        <Card style={{ gap: 12 }}>
          <View>
            <SectionTitle>
              Needs attention{" "}
              <Text style={{ fontFamily: F.b500, fontSize: 13, color: C.sub }}>
                · {watch.length} of {roster.length}
              </Text>
            </SectionTitle>
            {alerts.length === 0 && (
              <Text style={{ fontFamily: F.b400, fontSize: 13, color: C.sub, marginTop: 6 }}>
                Everyone is passing. Nothing to act on.
              </Text>
            )}
          </View>
          {alerts.map((a, i) => (
            <View
              key={i}
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 10,
                paddingVertical: 10,
                borderTopWidth: 1,
                borderTopColor: C.hairline,
              }}
            >
              <View style={{ minWidth: 0, flexShrink: 1 }}>
                <Text style={{ fontFamily: F.b600, fontSize: 14, color: C.ink }}>{a.name}</Text>
                <Text style={{ fontFamily: F.b400, fontSize: 12, color: C.sub, lineHeight: 18 }}>
                  {a.why}
                </Text>
              </View>
              <Chip text={a.chip} bg={a.bg} color={a.color} />
            </View>
          ))}
        </Card>
      )}

      {/* ============ ME ============ */}
      {st.ptabI === "me" && (
        <>
          <Card style={{ alignItems: "center", paddingVertical: 24, gap: 6 }}>
            <View style={[s.avatar, s.avatarGlow]}>
              <LinearGradient
                colors={["#17B5B1", "#0B8F8C"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Text style={{ fontFamily: F.d800, fontSize: 22, color: "#FFFFFF" }}>DR</Text>
            </View>
            <Text style={{ fontFamily: F.d800, fontSize: 18, color: C.ink }}>{DEMO_INSTRUCTOR.name}</Text>
            <Text style={{ fontFamily: F.b400, fontSize: 13, color: C.sub }}>
              {DEMO_INSTRUCTOR.email} · {activeCls.length} {fil ? "klase" : "classes"}
            </Text>
          </Card>
          <Card style={{ gap: 8 }}>
            <SectionTitle>{fil ? "Oras ng konsultasyon" : "Consultation hours"}</SectionTitle>
            <Text style={{ fontFamily: F.b400, fontSize: 13, color: C.sub, lineHeight: 19 }}>
              {consultSummary(cls)}
            </Text>
            <Text style={{ fontFamily: F.b400, fontSize: 12, color: C.sub }}>
              {fil ? "Pinamamahalaan sa Settings sa web." : "Managed in Settings on the web."}
            </Text>
          </Card>
          <Card style={{ gap: 8 }}>
            <SectionTitle>{fil ? "Wika" : "Language"}</SectionTitle>
            <View style={s.segWrap}>
              {(["English", "Filipino"] as const).map((l) => {
                const on = st.lang === l;
                return (
                  <Pressable key={l} onPress={() => st.set({ lang: l })} style={[s.segBtn, on && s.segBtnOn]}>
                    <Text style={{ fontFamily: F.b700, fontSize: 12, color: on ? "#FFFFFF" : C.sub }}>{l}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>
          <PressableScale scaleTo={0.98} onPress={() => router.back()}>
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
  // Plan status banner: tinted like the web PlanBanner so it reads as a
  // reminder, not just another card (teal = trial/active; amber and red
  // variants apply for grace / past-due states).
  planBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: C.tealTint10,
    borderWidth: 1,
    borderColor: "rgba(15,163,160,0.3)",
  },
  planDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: C.teal,
    flexShrink: 0,
  },
  label: { fontFamily: F.b700, fontSize: 11, letterSpacing: 0.6, color: C.sub },
  input: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.line,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    fontFamily: F.b500,
    fontSize: 14,
    color: C.ink,
  },
  chipBtn: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  chipBtnOn: { backgroundColor: C.teal, borderColor: C.teal },
  chipBtnText: { fontFamily: F.b700, fontSize: 12, color: C.sub },
  segWrap: {
    flexDirection: "row",
    gap: 3,
    height: 44,
    padding: 3,
    borderRadius: 12,
    backgroundColor: C.canvas,
    borderWidth: 1.5,
    borderColor: C.line,
  },
  segBtn: { flex: 1, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  segBtnOn: { backgroundColor: C.teal },
  scoreInput: {
    width: 72,
    height: 40,
    textAlign: "center",
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: C.line,
    backgroundColor: "#FFFFFF",
    fontFamily: F.d800,
    fontSize: 16,
    color: C.ink,
  },
  dashedBox: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: C.line,
    borderRadius: 16,
    padding: 20,
  },
  recStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: "#E7F6F5",
    borderWidth: 1,
    borderColor: "rgba(15,163,160,0.3)",
  },
  recDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: C.teal,
    flexShrink: 0,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 999,
    backgroundColor: C.teal,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarGlow: {
    shadowColor: "#0FA3A0",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 4,
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
