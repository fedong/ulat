import React, { useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ApiError } from "@/api";
import { firstNameOf, greeting, initialsOfRosterName } from "@/derive";
import { DEMO_GUARDIAN, KLABEL, MIGUEL_CLASSES, OTHER_CLASSES, type StaticClass } from "@/demo";
import { buildLive, type StripTile } from "@/live";
import { doClaimInvite, doSignOut } from "@/session";
import { useUlat, type GTab } from "@/store";
import { C, F } from "@/theme";
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
  UpcomingRow,
  type TabDef,
} from "@/ui";

interface Kid {
  name: string;
  first: string;
  initials: string;
  meta: string;
  classes: GClass[];
}

/** A shared class card carrying its own period strip + term (live ones). */
type GClass = StaticClass & {
  term?: ReturnType<typeof buildLive>["term"];
  strip?: StripTile[];
};

/** Demo guardian keeps Miguel and the static showcase classes. */
const DEMO_GUARDIAN_EMAIL = "lorna.reyes@example.com";

/** Route component: the guardian role needs a signed-in guardian account. */
export default function GuardianScreen() {
  const signedIn = useUlat((s) => s.signedIn);
  const role = useUlat((s) => s.role);
  useEffect(() => {
    if (!signedIn || role !== "guardian") router.replace("/signin?role=guardian" as never);
  }, [signedIn, role]);
  if (!signedIn || role !== "guardian") return null;
  return <GuardianInner />;
}

/** Empty state: link the first child with an invite code (or scanned link). */
function ClaimInviteCard() {
  const pending = useUlat((s) => s.pendingClaimCode);
  const [code, setCode] = useState(pending || "");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (pending) useUlat.setState({ pendingClaimCode: null });
  }, [pending]);
  const claim = async () => {
    if (busy) return;
    if (!code.trim()) return setErr("Enter the invite code from the instructor.");
    setBusy(true);
    setErr("");
    try {
      await doClaimInvite(code.trim());
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
      <Text style={{ fontFamily: F.d800, fontSize: 17, color: C.ink }}>Link your child</Text>
      <Text style={{ fontFamily: F.b400, fontSize: 13, color: C.sub, lineHeight: 19 }}>
        The instructor creates an invite from their Sharing page and gives you a one-time code.
        Enter it here to start following your child&apos;s classes.
      </Text>
      <FocusInput
        value={code}
        onChangeText={(v) => {
          setCode(v);
          setErr("");
        }}
        placeholder="Invite code"
        autoCapitalize="characters"
        style={{
          height: 46,
          borderRadius: 12,
          borderWidth: 1.5,
          borderColor: C.line,
          backgroundColor: "#FFFFFF",
          paddingHorizontal: 12,
          fontFamily: F.b500,
          fontSize: 14,
          color: C.ink,
        }}
      />
      {!!err && <Text style={{ fontFamily: F.b600, fontSize: 12.5, color: C.redText }}>{err}</Text>}
      <PrimaryButton label={busy ? "Linking…" : "Link child"} onPress={() => void claim()} disabled={busy} />
    </Card>
  );
}

function GuardianInner() {
  const st = useUlat();
  const fil = st.lang === "Filipino";
  const isDemo = st.email === DEMO_GUARDIAN_EMAIL;

  const kids: Kid[] = useMemo(() => {
    const liveKids: Kid[] = (st.gKids ?? []).map((k) => {
      const classes: GClass[] = k.classes.map((r) => {
        const b = buildLive(r.class, r.studentRowId, { instructor: r.instructor, scopes: r.scopes });
        return { ...b.live, term: b.term, strip: b.strip };
      });
      return {
        name: k.name,
        first: firstNameOf(k.name),
        initials: initialsOfRosterName(k.name),
        meta: classes.length + (classes.length === 1 ? " class shared" : " classes shared"),
        classes,
      };
    });
    if (isDemo && liveKids[0]) {
      // Demo tour: the static showcase classes and Miguel ride along.
      liveKids[0].classes = [...liveKids[0].classes, ...OTHER_CLASSES()];
      liveKids[0].meta = liveKids[0].classes.length + " classes shared";
      liveKids.push({
        name: "Reyes, Miguel",
        first: "Miguel",
        initials: "MR",
        meta: MIGUEL_CLASSES().length + " classes shared",
        classes: MIGUEL_CLASSES(),
      });
    }
    return liveKids;
  }, [st.gKids, isDemo]);

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
          : st.meName || DEMO_GUARDIAN.name;

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

  /* ---- no children yet: everything funnels into the invite-code card ---- */
  if (kids.length === 0)
    return (
      <PhoneShell title="Home" sub="Link your first child" tabBar={null}>
        <Card style={{ gap: 0 }}>
          <Text style={{ fontFamily: F.b400, fontSize: 13, color: C.sub }}>{greeting(fil)}</Text>
          <Text style={{ fontFamily: F.d800, fontSize: 24, letterSpacing: -0.4, color: C.ink }}>
            {st.meName || "Welcome"}
          </Text>
        </Card>
        <ClaimInviteCard />
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
      tabBar={<TabBar tabs={tabs} active={st.ptabG} onPick={(k) => st.set({ ptabG: k })} />}
    >
      {/* ============ HOME ============ */}
      {st.ptabG === "home" && (
        <>
          <Card style={{ gap: 0 }}>
            <Text style={{ fontFamily: F.b400, fontSize: 13, color: C.sub }}>{greeting(fil)}</Text>
            <Text style={{ fontFamily: F.d800, fontSize: 24, letterSpacing: -0.4, color: C.ink }}>
              {isDemo ? (fil ? "Gng. Reyes" : DEMO_GUARDIAN.shortName) : st.meName || "Welcome"}
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
          strip={(gClsSel as GClass).strip ?? null}
          termLabel={(gClsSel as GClass).term?.label ?? ""}
          termText={
            (gClsSel as GClass).term
              ? (gClsSel as GClass).term!.pct === null
                ? "—"
                : (gClsSel as GClass).term!.grade + " · " + (gClsSel as GClass).term!.pctText
              : ""
          }
          termColor={(gClsSel as GClass).term?.color ?? C.sub}
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
              <Text style={{ fontFamily: F.d800, fontSize: 22, color: "#FFFFFF" }}>
                {(st.meName.match(/\b([A-Z])/g) || ["G"]).slice(-2).join("")}
              </Text>
            </View>
            <Text style={{ fontFamily: F.d800, fontSize: 18, color: C.ink }}>
              {st.meName || DEMO_GUARDIAN.name}
            </Text>
            <Text style={{ fontFamily: F.b400, fontSize: 13, color: C.sub }}>
              Guardian of {kids.map((k) => k.first).join(" and ")}
            </Text>
            {/* Chip self-aligns flex-start for inline use; center it here. */}
            <View style={{ alignSelf: "center" }}>
              <Chip
                text={st.gKids?.[0]?.role || DEMO_GUARDIAN.role}
                bg="rgba(212,90,140,0.14)"
                color="#8C2F5A"
              />
            </View>
          </Card>
          <Card style={{ gap: 10 }}>
            <SectionTitle>What {kids[0].first} shares</SectionTitle>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {(["Grades", "Attendance", "Missing work", "Remarks"] as const).map((k, i) => {
                const on = (kids[0].classes[0]?.scopes || []).includes(k);
                return (
                  <View key={i} style={s.shareChip}>
                    <Text style={{ fontFamily: F.b600, fontSize: 12, color: on ? C.tealText : C.faint }}>
                      {k} · {on ? "Shared" : "Hidden"}
                    </Text>
                  </View>
                );
              })}
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
