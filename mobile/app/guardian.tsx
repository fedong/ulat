import React, { useMemo } from "react";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { firstNameOf, greeting, initialsOfRosterName } from "@/derive";
import { DEMO_GUARDIAN, KLABEL, MIGUEL_CLASSES, OTHER_CLASSES, type StaticClass } from "@/demo";
import { buildLive, type StripTile } from "@/live";
import { useUlat, type GTab } from "@/store";
import { C, F } from "@/theme";
import {
  BackPill,
  Card,
  Chip,
  PhoneShell,
  PressableScale,
  SectionTitle,
  TabBar,
  UpcomingRow,
  type TabDef,
} from "@/ui";

interface Kid {
  name: string;
  first: string;
  initials: string;
  meta: string;
  classes: StaticClass[];
}

export default function GuardianScreen() {
  const st = useUlat();
  const cls = st.classes.find((c) => c.id === "cs101")!;
  const sr = cls.roster.find((r) => r.id === st.studentId) || cls.roster[0];
  const fil = st.lang === "Filipino";

  const { live, term, strip } = useMemo(() => buildLive(cls, sr.id), [cls, sr.id]);

  const kids: Kid[] = useMemo(() => {
    const anaClasses = [live, ...OTHER_CLASSES()];
    const miguelClasses = MIGUEL_CLASSES();
    return [
      {
        name: sr.name,
        first: firstNameOf(sr.name),
        initials: initialsOfRosterName(sr.name),
        meta: anaClasses.length + " classes shared",
        classes: anaClasses,
      },
      {
        name: "Reyes, Miguel",
        first: "Miguel",
        initials: "MR",
        meta: miguelClasses.length + " classes shared",
        classes: miguelClasses,
      },
    ];
  }, [live, sr]);

  const order: Record<string, number> = { fail: 0, inc: 1, risk: 2, pass: 3 };
  const worstOf = (k: Kid) => k.classes.slice().sort((a, b) => order[a.k] - order[b.k])[0];

  const gKid = st.gChild !== null ? kids[st.gChild] : null;
  const gClsSel = gKid ? gKid.classes.find((x) => x.code === st.gCls) || null : null;

  const scopeOn = (x: StaticClass, s: string) => x.scopes.includes(s) && x.status === "Active";

  /* Home digest + coming up */
  const { digest, coming } = useMemo(() => {
    const digest: { title: string; body: string; bg: string; color: string; when: string; childIdx: number; code: string }[] = [];
    const coming: (StaticClass["upcoming"][number] & { childFirst: string })[] = [];
    kids.forEach((k, i) =>
      k.classes.forEach((x) => {
        if (scopeOn(x, "Missing work"))
          x.missing.forEach((m) =>
            digest.push({
              title: k.first + " missed " + m,
              body: x.code + " · " + x.instructor,
              bg: C.redTint8,
              color: C.redText,
              when: "",
              childIdx: i,
              code: x.code,
            }),
          );
        if (scopeOn(x, "Grades") && (x.k === "risk" || x.k === "fail"))
          digest.push({
            title: k.first + " is " + KLABEL[x.k].toLowerCase() + " in " + x.code,
            body: x.title + " · " + x.grade + " · " + x.instructor,
            bg: x.bg,
            color: x.color,
            when: "",
            childIdx: i,
            code: x.code,
          });
        if (scopeOn(x, "Grades"))
          x.upcoming.forEach((u) => coming.push({ ...u, childFirst: k.first }));
      }),
    );
    coming.sort((a, b) => (a.iso < b.iso ? -1 : 1));
    return { digest, coming: coming.slice(0, 3) };
  }, [kids]);

  /* Alerts (merged, weekly report last) */
  const alerts = useMemo(() => {
    const rows: { title: string; body: string; bg: string; color: string; when: string }[] = [];
    kids.forEach((k) =>
      k.classes.forEach((x) => {
        if (scopeOn(x, "Missing work"))
          x.missing.forEach((m) =>
            rows.push({
              title: k.first + " missed " + m,
              body: x.code + " · " + x.instructor + " may offer a make-up.",
              bg: C.redTint8,
              color: C.redText,
              when: "",
            }),
          );
        if (scopeOn(x, "Grades"))
          x.upcoming.forEach((u) =>
            rows.push({
              title: k.first + " · " + u.name + " · " + u.countdown,
              body: u.notes || u.compPath + " · " + u.max + " points",
              bg: "#FFFFFF",
              color: C.ink,
              when: u.mon + " " + u.day,
            }),
          );
      }),
    );
    rows.push({
      title: "Weekly report",
      body:
        "Next report Friday 5 PM. Standing, attendance and anything your children have chosen to share.",
      bg: "#FFFFFF",
      color: C.ink,
      when: "Fri",
    });
    return rows;
  }, [kids]);

  const tabs: TabDef<GTab>[] = [
    { k: "home", label: "Home", icon: "home" },
    { k: "kids", label: "Children", icon: "kids" },
    { k: "alerts", label: "Alerts", icon: "alerts", badge: alerts.length > 1 },
    { k: "me", label: "Me", icon: "me" },
  ];
  const title =
    st.ptabG === "kids"
      ? gClsSel
        ? "Shared view"
        : gKid
          ? gKid.first + "'s classes"
          : "Children"
      : { home: "Home", alerts: "Alerts", me: "Profile" }[st.ptabG as "home" | "alerts" | "me"];
  const sub =
    st.ptabG === "home"
      ? kids.length + " children"
      : st.ptabG === "kids"
        ? gClsSel
          ? gKid!.name + " · " + gClsSel.code
          : gKid
            ? gKid.name
            : kids.length + " children linked"
        : st.ptabG === "alerts"
          ? "All children"
          : DEMO_GUARDIAN.name;

  const childRow = (k: Kid, i: number, inCard: boolean) => {
    const w = worstOf(k);
    return (
      <Pressable
        key={k.name}
        onPress={() => st.set({ ptabG: "kids", gChild: i, gCls: null })}
        style={[
          { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
          inCard
            ? { paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.hairline }
            : {},
        ]}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minWidth: 0, flexShrink: 1 }}>
          <View style={s.kidAvatar}>
            <Text style={{ fontFamily: F.b700, fontSize: 14, color: C.tealText }}>{k.initials}</Text>
          </View>
          <View style={{ minWidth: 0 }}>
            <Text style={{ fontFamily: F.d800, fontSize: 15, color: C.ink }}>{k.name}</Text>
            <Text style={{ fontFamily: F.b400, fontSize: 12, color: C.sub }}>{k.meta}</Text>
          </View>
        </View>
        <Chip
          text={w.k === "pass" ? "All passing" : KLABEL[w.k] + " in " + w.code}
          bg={w.bg}
          color={w.color}
        />
      </Pressable>
    );
  };

  return (
    <PhoneShell
      title={title}
      sub={sub}
      tabBar={<TabBar tabs={tabs} active={st.ptabG} onPick={(k) => st.set({ ptabG: k })} />}
    >
      {/* ============ HOME ============ */}
      {st.ptabG === "home" && (
        <>
          <Card style={{ gap: 0 }}>
            <Text style={{ fontFamily: F.b400, fontSize: 13, color: C.sub }}>{greeting(fil)}</Text>
            <Text style={{ fontFamily: F.d800, fontSize: 24, letterSpacing: -0.4, color: C.ink }}>
              {fil ? "Gng. Reyes" : DEMO_GUARDIAN.shortName}
            </Text>
          </Card>
          <Card style={{ gap: 8 }}>
            <SectionTitle>Needs attention</SectionTitle>
            {digest.length === 0 && (
              <Text style={{ fontFamily: F.b400, fontSize: 13, color: C.sub }}>
                All clear. Nothing missing and everyone is passing.
              </Text>
            )}
            {digest.map((r, i) => (
              <Pressable
                key={i}
                onPress={() => st.set({ ptabG: "kids", gChild: r.childIdx, gCls: r.code })}
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
              </Pressable>
            ))}
          </Card>
          {coming.length > 0 && (
            <Card style={{ gap: 10 }}>
              <SectionTitle>Coming up</SectionTitle>
              {coming.map((u, i) => (
                <UpcomingRow key={i} u={{ ...u, name: u.childFirst + " · " + u.name }} showCode />
              ))}
            </Card>
          )}
          <Card pad={false} style={{ paddingHorizontal: 18, paddingVertical: 4 }}>
            {kids.map((k, i) => childRow(k, i, true))}
          </Card>
          <Text style={{ fontFamily: F.b400, fontSize: 12, color: C.sub, paddingHorizontal: 4, lineHeight: 18 }}>
            Updated just now · next report Friday 5 PM
          </Text>
        </>
      )}

      {/* ============ CHILDREN ============ */}
      {st.ptabG === "kids" && !gKid && (
        <>
          {kids.map((k, i) => (
            <Card key={k.name}>{childRow(k, i, false)}</Card>
          ))}
          <Text style={{ fontFamily: F.b400, fontSize: 12, color: C.sub, paddingHorizontal: 4, lineHeight: 18 }}>
            Each child links their own account and chooses what to share with you, class by class.
          </Text>
        </>
      )}
      {st.ptabG === "kids" && gKid && !gClsSel && (
        <>
          <BackPill label="Children" onPress={() => st.set({ gChild: null, gCls: null })} />
          {gKid.classes.map((x) => (
            <PressableScale key={x.code} scaleTo={0.98} onPress={() => st.set({ gCls: x.code })}>
              <Card style={{ gap: 12 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <View style={{ minWidth: 0, flexShrink: 1 }}>
                    <Text style={{ fontFamily: F.d800, fontSize: 15, color: C.ink }}>
                      {x.code} · {x.title}
                    </Text>
                    <Text style={{ fontFamily: F.b400, fontSize: 12, color: C.sub }}>{x.instructor}</Text>
                  </View>
                  <Text style={{ fontFamily: F.d900, fontSize: 28, color: x.color }}>{x.grade}</Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Chip text={x.chipPlain} bg={x.bg} color={x.color} />
                  <Text style={{ fontFamily: F.b600, fontSize: 13, color: x.attColor }}>
                    Attendance {x.att}
                  </Text>
                </View>
                <Text style={{ fontFamily: F.b400, fontSize: 12, color: C.sub }}>
                  {x.status === "Active" ? x.scopes.length + " of 4 scopes shared" : x.status}
                </Text>
              </Card>
            </PressableScale>
          ))}
        </>
      )}
      {st.ptabG === "kids" && gKid && gClsSel && (
        <SharedView
          kidFirst={gKid.first}
          x={gClsSel}
          strip={gClsSel.live ? strip : null}
          termLabel={gClsSel.live ? term.label : ""}
          termText={gClsSel.live ? (term.pct === null ? "—" : term.grade + " · " + term.pctText) : ""}
          termColor={gClsSel.live ? term.color : C.sub}
          onBack={() => st.set({ gCls: null })}
        />
      )}

      {/* ============ ALERTS ============ */}
      {/* The header already says Alerts, so each item stands on its own. */}
      {st.ptabG === "alerts" && (
        <>
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
      {st.ptabG === "me" && (
        <>
          <Card style={{ alignItems: "center", paddingVertical: 24, gap: 6 }}>
            <View style={s.avatar}>
              <Text style={{ fontFamily: F.d800, fontSize: 22, color: "#FFFFFF" }}>LR</Text>
            </View>
            <Text style={{ fontFamily: F.d800, fontSize: 18, color: C.ink }}>{DEMO_GUARDIAN.name}</Text>
            <Text style={{ fontFamily: F.b400, fontSize: 13, color: C.sub }}>
              Guardian of {kids.map((k) => k.first).join(" and ")}
            </Text>
            <Chip text={DEMO_GUARDIAN.role} bg="rgba(212,90,140,0.14)" color="#8C2F5A" />
          </Card>
          <Card style={{ gap: 10 }}>
            <SectionTitle>What {kids[0].first} shares</SectionTitle>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {[
                ["Grades", true],
                ["Attendance", true],
                ["Missing work", true],
                ["Remarks", false],
              ].map(([k, on], i) => (
                <View key={i} style={s.shareChip}>
                  <Text style={{ fontFamily: F.b600, fontSize: 12, color: on ? C.tealText : C.faint }}>
                    {k as string} · {on ? "Shared" : "Hidden"}
                  </Text>
                </View>
              ))}
            </View>
            <Text style={{ fontFamily: F.b400, fontSize: 12, color: C.sub, lineHeight: 18 }}>
              Guardian links belong to the student&apos;s account and carry over to all their classes.
              Each class sets what it shares; the student can see it but cannot change it.
            </Text>
          </Card>
          <Card style={{ gap: 8 }}>
            <SectionTitle>How you can help</SectionTitle>
            <Text style={{ fontFamily: F.b400, fontSize: 13, color: C.sub, lineHeight: 20 }}>
              Ask about missed work early — most instructors offer make-ups. A short daily check-in on
              upcoming work beats a long talk after grades close.
            </Text>
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

/** The scope-gated per-class view a guardian sees. */
function SharedView({
  kidFirst,
  x,
  strip,
  termLabel,
  termText,
  termColor,
  onBack,
}: {
  kidFirst: string;
  x: StaticClass;
  strip: StripTile[] | null;
  termLabel: string;
  termText: string;
  termColor: string;
  onBack: () => void;
}) {
  const on = (s: string) => x.scopes.includes(s) && x.status === "Active";
  const miss = x.missing;
  const remOn = on("Remarks") && !!x.remark;
  return (
    <>
      <BackPill label={kidFirst + "'s classes"} onPress={onBack} />
      <Card style={{ borderRadius: 16, padding: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View style={{ flexShrink: 1 }}>
          <Text style={{ fontFamily: F.b600, fontSize: 15, color: C.sub }}>
            {kidFirst}&apos;s standing
          </Text>
          <View style={{ marginTop: 8 }}>
            <Chip
              text={on("Grades") ? x.chipPlain : "Not shared"}
              bg={on("Grades") ? x.bg : C.incTint}
              color={on("Grades") ? x.color : C.sub}
            />
          </View>
          <Text style={{ fontFamily: F.b400, fontSize: 14, color: C.sub, marginTop: 10 }}>
            {x.passingLine}
          </Text>
        </View>
        <Text style={{ fontFamily: F.d900, fontSize: 60, letterSpacing: -2, lineHeight: 64, color: on("Grades") ? x.color : C.faint }}>
          {on("Grades") ? x.grade : "—"}
        </Text>
      </Card>
      {on("Grades") && x.live && strip && (
        <Card style={{ borderRadius: 16, gap: 10 }}>
          <Text style={{ fontFamily: F.b700, fontSize: 15, color: C.sub }}>By period</Text>
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
            <Text style={{ fontFamily: F.b600, fontSize: 13, color: C.sub }}>{termLabel}</Text>
            <Text style={{ fontFamily: F.b600, fontSize: 13, color: termColor }}>{termText}</Text>
          </View>
        </Card>
      )}
      {on("Attendance") && (
        <Card style={{ borderRadius: 16 }}>
          <Text style={{ fontFamily: F.b700, fontSize: 15, color: C.sub }}>Attendance</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8 }}>
            <Text style={{ fontFamily: F.d900, fontSize: 30, color: x.attColor }}>{x.att}</Text>
            <View style={{ flex: 1, height: 8, borderRadius: 999, backgroundColor: C.line, overflow: "hidden" }}>
              <View style={{ height: "100%", borderRadius: 999, backgroundColor: C.teal, width: `${parseInt(x.att, 10)}%` }} />
            </View>
          </View>
        </Card>
      )}
      <View
        style={[
          { borderRadius: 16, paddingHorizontal: 18, paddingVertical: 16 },
          on("Missing work") && miss.length
            ? { backgroundColor: C.amberTint }
            : { backgroundColor: "#FFFFFF", borderWidth: 1.5, borderStyle: "dashed", borderColor: C.line },
        ]}
      >
        <Text style={{ fontFamily: F.b700, fontSize: 15, color: on("Missing work") && miss.length ? C.amberText : C.sub }}>
          Missing work
        </Text>
        <Text style={{ fontFamily: F.b400, fontSize: 14, color: C.ink, marginTop: 6, lineHeight: 21 }}>
          {!on("Missing work")
            ? "Not shared by " + kidFirst
            : miss.length
              ? miss.join(", ") + (miss.length > 1 ? " are" : " is") + " still missing — ask about the make-up schedule."
              : "All work complete"}
        </Text>
      </View>
      <View
        style={[
          { borderRadius: 16, paddingHorizontal: 18, paddingVertical: 16 },
          remOn
            ? { backgroundColor: "#FFFFFF" }
            : { borderWidth: 1.5, borderStyle: "dashed", borderColor: C.line },
        ]}
      >
        <Text style={{ fontFamily: F.b700, fontSize: 15, color: C.sub }}>Instructor remarks</Text>
        <Text style={{ fontFamily: F.b400, fontSize: 14, marginTop: 6, lineHeight: 21, color: remOn ? C.ink : C.sub }}>
          {remOn ? x.remark : on("Remarks") ? "No remarks yet" : "Not shared by " + kidFirst}
        </Text>
      </View>
      <Text style={{ fontFamily: F.b500, fontSize: 14, color: C.sub }}>
        {x.code} · {x.instructor} · updated just now
      </Text>
    </>
  );
}

const s = StyleSheet.create({
  kidAvatar: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: C.tealTint12,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 999,
    backgroundColor: C.ink,
    alignItems: "center",
    justifyContent: "center",
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
