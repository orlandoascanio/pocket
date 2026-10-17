import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CATEGORY_START, categoryName, categorySymbol } from "../../core/categories";
import { relativeDay, shortDay } from "../../core/day";
import { waiting } from "../../core/engine";
import { EMPTY_QUERY, matches, queryIsEmpty, type EntryQuery } from "../../core/history";
import { line } from "../../core/lines";
import type { Entry, Occurrence, Preset } from "../../core/models";
import { KEYS, getItem, setItem } from "../../data/storage";
import { store, useMoney, usePocket } from "../../data/store";
import { Big, Button, Card, Chip, Empty, MoneyRow, SectionTitle, tap, useToast } from "../../ui/components";
import { useRunway, useSpentThisMonth } from "../../ui/derived";
import { HistorySearch, shareCSV } from "../../ui/HistorySearch";
import { Icon } from "../../ui/Icon";
import { PocketCharacter } from "../../ui/PocketCharacter";
import { SyncBadge } from "../../ui/SyncBadge";
import { DISPLAY, GUTTER, useColors } from "../../ui/theme";

const PAGE = 60;

export default function Overview() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const money = useMoney();
  const s = usePocket();
  const spent = useSpentThisMonth();
  const rw = useRunway(money);
  const toast = useToast();
  const [shown, setShown] = useState(PAGE);
  const [refreshing, setRefreshing] = useState(false);
  const [greeting, setGreeting] = useState<string | null>(null);
  const [query, setQuery] = useState<EntryQuery>(EMPTY_QUERY);
  const due = useMemo(() => waiting(s.upcoming, s.today), [s.upcoming, s.today]);

  // Say hello once in the morning or late at night, or ask about money that's due.
  useEffect(() => {
    (async () => {
      if (due.length) {
        setGreeting(due[0].cents > 0 ? `Did ${due[0].label} pay yet?` : `Was ${due[0].label} paid?`);
        return;
      }
      const h = new Date().getHours();
      const slot = h >= 5 && h < 11 ? "morning" : h >= 23 || h < 5 ? "night" : null;
      if (!slot) return;
      const stamp = s.today + slot;
      if ((await getItem(KEYS.greeted)) === stamp) return;
      await setItem(KEYS.greeted, stamp);
      setGreeting(line(slot));
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const searching = !queryIsEmpty(query);
  const found = useMemo(() => (searching ? s.entries.filter((e) => matches(query, e)) : s.entries), [s.entries, query, searching]);
  const after = useMemo(() => balanceAfter(s.entries, s.balance), [s.entries, s.balance]);
  const days = useMemo(() => groupByDay(found.slice(0, shown), after), [found, after, shown]);
  const foundNet = useMemo(() => found.reduce((sum, e) => sum + e.cents, 0), [found]);
  const changeQuery = (q: EntryQuery) => { setQuery(q); setShown(PAGE); };
  const exportFound = async () => {
    const problem = await shareCSV(found, `Pocket search ${s.today}`);
    if (problem) toast({ text: problem });
  };

  const addPreset = async (p: Preset) => {
    if (p.cents == null) {
      router.push({ pathname: "/entry", params: { preset: p.id } });
      return;
    }
    try {
      const id = await store.addEntry({ cents: p.sign * p.cents, label: p.label, day: s.today, category: p.category });
      if (id === null) {
        toast({ text: `You're offline. ${p.label} is saved here and will sync later.` });
        return;
      }
      toast({
        text: `Added ${p.label} ${money.string(p.sign * p.cents, true)}`,
        action: { label: "Undo", run: () => { store.deleteEntry(id, "undo").catch(() => toast({ text: "Couldn't undo. Delete it from History." })); } },
      });
    } catch {
      toast({ text: "Couldn't add that. Check your connection." });
    }
  };

  const skip = async (o: Occurrence) => {
    try {
      await store.skip(o.ruleID);
    } catch {
      toast({ text: "Couldn't skip it. Try again." });
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 110, paddingHorizontal: GUTTER }}
      {...(s.mode === "server" ? {
        refreshControl: (
          <RefreshControl
            refreshing={refreshing}
            tintColor={c.muted}
            onRefresh={async () => { setRefreshing(true); await store.refresh(); setRefreshing(false); }}
          />
        ),
      } : {})}
    >
      {s.loadError ? <LoadErrorBanner message={s.loadError} /> : null}
      {s.locked ? <LockedBanner message={s.locked} /> : null}

      <View style={styles.hero}>
        <View style={{ flex: 1, paddingTop: 18 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={[styles.heroLabel, { color: c.muted }]}>Money left</Text>
            {s.mode === "server" ? <SyncBadge /> : null}
          </View>
          <Big
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[styles.balance, { color: s.balance < 0 ? c.neg : c.ink }]}
          >
            {money.string(s.balance)}
          </Big>
        </View>
        <View style={{ marginTop: 6 }}>
          <PocketCharacter size={92} negative={s.balance < 0} greeting={greeting} />
        </View>
      </View>

      <View style={styles.subline}>
        <Text style={{ color: c.muted, fontSize: 15 }}>{money.string(spent)} spent this month</Text>
        <Pressable
          onPress={() => router.navigate("/plan")}
          accessibilityRole="link"
          accessibilityLabel={`${rw.lead} ${rw.strong}. Open Plan.`}
          hitSlop={8}
          style={({ pressed }) => [styles.runway, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Icon name={rw.warn ? "exclamationmark.triangle" : "chart.xyaxis.line"} size={14} color={rw.warn ? c.neg : c.muted} />
          <Text style={{ color: rw.warn ? c.neg : c.ink, fontSize: 15 }}>
            {rw.lead} <Text style={{ fontWeight: "700" }}>{rw.strong}</Text>
          </Text>
          <Icon name="chevron.right" size={11} color={c.faint} />
        </Pressable>
      </View>

      {s.presets.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -GUTTER, marginTop: 18 }}
          contentContainerStyle={{ gap: 8, paddingHorizontal: GUTTER }}>
          {s.presets.map((p) => (
            <Chip
              key={p.id}
              label={p.label}
              detail={p.cents != null ? money.string(p.sign * p.cents, true) : undefined}
              icon={categorySymbol(p.category, p.sign)}
              iconColor={c.hues[p.sign > 0 ? "green" : "brown"]}
              onPress={() => addPreset(p)}
              onLongPress={() => router.push("/buttons")}
              accessibilityHint={p.cents != null ? "Adds it now. Long press to edit buttons." : "Asks for the amount. Long press to edit buttons."}
            />
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.addRow}>
        <AddButton sign={-1} />
        <AddButton sign={1} />
      </View>

      {due.length ? (
        <>
          <SectionTitle title="Waiting for you" meta={due.length === 1 ? "Did it arrive?" : `${due.length} payments`} />
          <Card>
            {due.map((o, i) => (
              <View key={o.ruleID + o.day} style={{ paddingBottom: 12 }}>
                <MoneyRow
                  title={o.label}
                  category={o.category}
                  cents={o.cents}
                  note={`Was due ${shortDay(o.day)}`}
                  amount={money.string(o.cents, true)}
                  amountColor={o.cents > 0 ? c.pos : c.ink}
                  last
                />
                <View style={[styles.waitActions, i < due.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.line, paddingBottom: 12 }]}>
                  <Button small kind="secondary" title="Skip" onPress={() => skip(o)} style={{ flex: 1 }} />
                  <Button small title={o.cents > 0 ? "Got it" : "Paid"} icon="checkmark"
                    onPress={() => router.push({ pathname: "/settle", params: { id: o.ruleID } })} style={{ flex: 2 }} />
                </View>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      <SectionTitle title="History" />
      {s.entries.length ? <HistorySearch query={query} onChange={changeQuery} entries={s.entries} today={s.today} /> : null}
      {searching && found.length ? (
        <View style={styles.results}>
          <Text style={{ color: c.muted, fontSize: 14, fontVariant: ["tabular-nums"], flex: 1 }}>
            {found.length} {found.length === 1 ? "entry" : "entries"} · {money.string(foundNet, true)}
          </Text>
          <Pressable onPress={exportFound} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Export these ${found.length} entries as a spreadsheet`}
            style={({ pressed }) => [styles.resultAction, { opacity: pressed ? 0.6 : 1 }]}>
            <Icon name="square.and.arrow.up" size={15} color={c.accent} />
            <Text style={{ color: c.accent, fontSize: 14, fontWeight: "600" }}>Export</Text>
          </Pressable>
          <Pressable onPress={() => changeQuery(EMPTY_QUERY)} hitSlop={8} accessibilityRole="button" style={({ pressed }) => [styles.resultAction, { opacity: pressed ? 0.6 : 1 }]}>
            <Text style={{ color: c.accent, fontSize: 14, fontWeight: "600" }}>Clear</Text>
          </Pressable>
        </View>
      ) : null}
      {s.entries.length === 0 ? (
        <Card>
          <Empty icon="hand.tap" title="Nothing yet" body="Add what you spend and what you get. Your balance updates right away." />
        </Card>
      ) : found.length === 0 ? (
        <Card>
          <Empty icon="magnifyingglass" title="Nothing matches" body="Try other words or clear the filters." />
          <View style={{ padding: 14, paddingTop: 0 }}>
            <Button kind="secondary" title="Clear search and filters" onPress={() => changeQuery(EMPTY_QUERY)} />
          </View>
        </Card>
      ) : (
        days.map((d) => (
          <View key={d.day} style={{ marginBottom: 14 }}>
            <View style={styles.dayHead}>
              <Text style={{ color: c.muted, fontWeight: "600", fontSize: 14 }}>{relativeDay(d.day, s.today)}</Text>
              <Text style={{ color: c.muted, fontSize: 14, fontVariant: ["tabular-nums"] }}>{money.string(d.total, true)}</Text>
            </View>
            <Card>
              {d.rows.map(({ e, after }, i) => (
                <MoneyRow
                  key={e.id}
                  title={e.label}
                  category={e.category}
                  cents={e.cents}
                  note={e.category === CATEGORY_START ? (e.label === "Starting balance" ? undefined : "Starting balance") : e.category ? categoryName(e.category) : e.ruleID ? "Repeating" : undefined}
                  amount={money.string(e.cents, true)}
                  amountColor={e.cents > 0 ? c.pos : c.ink}
                  rightNote={`left ${money.string(after)}`}
                  rightNoteColor={after < 0 ? c.neg : c.muted}
                  onPress={() => router.push({ pathname: "/entry", params: { id: e.id } })}
                  accessibilityHint="Edit or delete"
                  last={i === d.rows.length - 1}
                />
              ))}
            </Card>
          </View>
        ))
      )}
      {found.length > shown ? (
        <Button kind="secondary" title={`Show ${Math.min(PAGE, found.length - shown)} more`} onPress={() => setShown((n) => n + PAGE)} />
      ) : null}
    </ScrollView>
  );
}

function AddButton({ sign }: { sign: 1 | -1 }) {
  const c = useColors();
  const spent = sign < 0;
  return (
    <Pressable
      onPress={() => { tap(); router.push({ pathname: "/entry", params: { sign: String(sign) } }); }}
      accessibilityRole="button"
      accessibilityLabel={spent ? "Add spending" : "Add money in"}
      style={({ pressed }) => [styles.add, {
        backgroundColor: spent ? c.surface : c.accent, borderColor: spent ? c.line : c.accent,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      }]}
    >
      <View style={[styles.addIcon, { backgroundColor: spent ? c.chip : "rgba(255,255,255,0.18)" }]}>
        <Icon name={spent ? "minus" : "plus"} size={16} color={spent ? c.ink : c.accentInk} weight="bold" />
      </View>
      <Text style={{ color: spent ? c.ink : c.accentInk, fontSize: 17, fontWeight: "700", fontFamily: DISPLAY }}>
        {spent ? "Spent" : "Got money"}
      </Text>
    </Pressable>
  );
}

function LoadErrorBanner({ message }: { message: string }) {
  const c = useColors();
  return (
    <Card style={{ padding: 14, marginBottom: 12, borderColor: c.neg }}>
      <Text style={{ color: c.neg, fontWeight: "700", marginBottom: 4 }}>Saved data couldn’t be read</Text>
      <Text style={{ color: c.muted, fontSize: 14, lineHeight: 19 }}>
        {message} Nothing will be overwritten. In Settings you can import a backup or start fresh (the unreadable file is kept aside).
      </Text>
    </Card>
  );
}

function LockedBanner({ message }: { message: string }) {
  const c = useColors();
  return (
    <Card style={{ padding: 14, marginBottom: 12 }}>
      <Text style={{ color: c.ink, fontWeight: "700", marginBottom: 4 }}>Sync stopped</Text>
      <Text style={{ color: c.muted, fontSize: 14, lineHeight: 19, marginBottom: 10 }}>{message}</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button small title="Pair again" onPress={() => { store.dismissLocked(); router.push("/connect"); }} />
        <Button small kind="secondary" title="Dismiss" onPress={() => store.dismissLocked()} />
      </View>
    </Card>
  );
}

/** The balance right after each entry (entries newest first). */
function balanceAfter(entries: Entry[], balance: number) {
  const out = new Map<string, number>();
  let after = balance;
  for (const e of entries) {
    out.set(e.id, after);
    after -= e.cents;
  }
  return out;
}

/** History grouped by day, with each entry's balance right after it. */
function groupByDay(page: Entry[], after: Map<string, number>) {
  const out: { day: string; total: number; rows: { e: Entry; after: number }[] }[] = [];
  for (const e of page) {
    let g = out[out.length - 1];
    if (!g || g.day !== e.day) {
      g = { day: e.day, total: 0, rows: [] };
      out.push(g);
    }
    g.rows.push({ e, after: after.get(e.id) ?? 0 });
    g.total += e.cents;
  }
  return out;
}

const styles = StyleSheet.create({
  hero: { flexDirection: "row", alignItems: "flex-start" },
  heroLabel: { fontSize: 17, fontWeight: "500" },
  balance: { fontSize: 54, letterSpacing: -1.5, marginTop: 2 },
  subline: { gap: 6, marginTop: 4 },
  runway: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" },
  addRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  add: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14, minHeight: 58,
  },
  addIcon: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  waitActions: { flexDirection: "row", gap: 8, paddingHorizontal: 14 },
  results: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 4, marginBottom: 10 },
  resultAction: { flexDirection: "row", alignItems: "center", gap: 4 },
  dayHead: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 4, marginBottom: 6 },
});
