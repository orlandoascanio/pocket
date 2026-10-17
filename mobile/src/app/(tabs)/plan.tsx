import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CATEGORY_START } from "../../core/categories";
import { shortDay, weekdayDay } from "../../core/day";
import { CADENCES } from "../../core/models";
import { store, useMoney, usePocket, RANGES } from "../../data/store";
import { Big, Button, Card, Empty, MoneyRow, SectionTitle, Segmented } from "../../ui/components";
import { RANGE_NAME, RANGE_SHORT, monthsLeftText, useEveryday, useMonthsLeft, useRunway } from "../../ui/derived";
import { ForecastChart } from "../../ui/ForecastChart";
import { GUTTER, useColors } from "../../ui/theme";

export default function Plan() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const money = useMoney();
  const s = usePocket();
  const rw = useRunway(money);
  const p = rw.projection;
  const [showAll, setShowAll] = useState(false);
  const everyday = useEveryday();
  const months = useMonthsLeft();
  const hasEntries = s.entries.some((e) => e.category !== CATEGORY_START);

  // Coming up, with the balance after each payment (the chart's table view).
  const future = p.steps.filter((st) => !st.occurrence.overdue);
  const seen = new Set(s.upcoming.filter((o) => o.overdue).map((o) => o.ruleID));
  const rows = future.map((st) => {
    const first = !seen.has(st.occurrence.ruleID);
    seen.add(st.occurrence.ruleID);
    return { ...st, actionable: first };
  });
  const visible = showAll ? rows : rows.slice(0, 8);

  let outM = 0, inM = 0;
  for (const r of s.rules) {
    const monthly = r.once || !r.active ? 0 : Math.abs(r.cents) * CADENCES[r.cadence].perMonth;
    if (r.cents < 0) outM += monthly; else inM += monthly;
  }
  const perMonth = [outM ? `${money.whole(outM)} out` : "", inM ? `${money.whole(inM)} in` : ""].filter(Boolean).join(" · ");

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 110, paddingHorizontal: GUTTER }}
    >
      <Text style={{ color: c.muted, fontSize: 15, fontWeight: "500" }}>Plan</Text>
      <Big style={[styles.title, { color: rw.warn ? c.neg : c.ink }]} numberOfLines={2}>{rw.lead} {rw.strong}</Big>
      <Text style={{ color: c.muted, fontSize: 15, marginTop: 4 }}>
        On {shortDay(p.end)}: {money.string(p.endBalance)}
        {p.lowBalance < p.start ? ` · lowest ${money.string(p.lowBalance)} on ${shortDay(p.lowDay)}` : ""}
      </Text>
      {months != null ? <Text style={{ color: c.muted, fontSize: 15, marginTop: 2 }}>{monthsLeftText(months)}</Text> : null}

      <Segmented
        style={{ marginTop: 18 }}
        options={RANGES.map((r) => ({ value: r, label: RANGE_SHORT[r] }))}
        value={s.range}
        onChange={(r) => void store.setRange(r)}
      />

      <Card style={{ marginTop: 14, paddingHorizontal: 8, paddingBottom: 8 }}>
        <ForecastChart p={p} money={money} range={s.range} />
        {everyday ? (
          <View style={[styles.everyday, { borderColor: c.line }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.ink, fontSize: 16 }}>Count everyday spending</Text>
              <Text style={{ color: c.muted, fontSize: 14, lineHeight: 19, marginTop: 2 }}>
                ≈ {money.string(everyday.perDay)} a day, from a typical week of your last {everyday.weeks} weeks. Scheduled payments are counted separately.
              </Text>
            </View>
            <Switch
              value={s.includeEveryday}
              onValueChange={(v) => void store.setIncludeEveryday(v)}
              trackColor={{ true: c.accent }}
              accessibilityLabel="Count everyday spending"
            />
          </View>
        ) : hasEntries ? (
          <Text style={[styles.everyday, { borderColor: c.line, color: c.muted, fontSize: 14, lineHeight: 19 }]}>
            After two weeks of entries, the forecast also counts your everyday spending.
          </Text>
        ) : null}
      </Card>

      {rows.length ? (
        <>
          <SectionTitle title="Coming up" meta={`Next ${RANGE_NAME[s.range]}`} />
          <Card>
            {visible.map((st, i) => {
              const o = st.occurrence;
              return (
                <MoneyRow
                  key={o.ruleID + o.day}
                  title={o.label}
                  category={o.category}
                  cents={o.cents}
                  symbol={o.category ? undefined : "repeat"}
                  note={weekdayDay(o.day)}
                  amount={money.string(o.cents, true)}
                  amountColor={o.cents > 0 ? c.pos : c.ink}
                  rightNote={`then ${money.string(st.after)}`}
                  rightNoteColor={st.after < 0 ? c.neg : c.muted}
                  onPress={st.actionable
                    ? () => router.push({ pathname: "/settle", params: { id: o.ruleID } })
                    : () => router.push({ pathname: "/entry", params: { rule: o.ruleID } })}
                  accessibilityHint={st.actionable ? (o.cents > 0 ? "Log that it arrived early" : "Log that it's paid") : "Edit the schedule"}
                  last={i === visible.length - 1}
                />
              );
            })}
          </Card>
          {rows.length > 8 ? (
            <Button kind="plain" title={showAll ? "Show less" : `Show all ${rows.length}`} onPress={() => setShowAll((v) => !v)} style={{ marginTop: 4 }} />
          ) : null}
        </>
      ) : null}

      <SectionTitle title="Repeating and planned" meta={perMonth ? `≈ ${perMonth} a month` : undefined} />
      {s.rules.length ? (
        <Card>
          {s.rules.map((r, i) => (
            <MoneyRow
              key={r.id}
              title={r.label}
              category={r.category}
              cents={r.cents}
              symbol={r.once ? "clock" : r.category ? undefined : "repeat"}
              tag={!r.active ? "paused" : !r.auto ? "you confirm" : undefined}
              dimmed={!r.active}
              note={r.once
                ? `One time · ${weekdayDay(r.next)}`
                : `${CADENCES[r.cadence].name} · next ${shortDay(r.next)}` + (r.remaining != null ? ` · ${r.remaining === 1 ? "last one" : r.remaining + " left"}` : "")}
              amount={money.string(r.cents, true)}
              amountColor={r.cents > 0 ? c.pos : c.ink}
              rightNote={r.once ? "expected" : `per ${CADENCES[r.cadence].unit}`}
              onPress={() => router.push({ pathname: "/entry", params: { rule: r.id } })}
              accessibilityHint="Edit, pause or stop"
              last={i === s.rules.length - 1}
            />
          ))}
        </Card>
      ) : (
        <Card>
          <Empty
            icon="calendar"
            title="Nothing planned yet"
            body="Add rent, subscriptions or your paycheck with a repeat, or pick a future date. Plan shows how long your money lasts."
          />
          <View style={{ padding: 14, paddingTop: 0 }}>
            <Button title="Plan a payment" icon="plus" onPress={() => router.push({ pathname: "/entry", params: { sign: "-1" } })} />
          </View>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 34, letterSpacing: -0.8, marginTop: 2 },
  everyday: {
    flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8, paddingTop: 12, paddingHorizontal: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
