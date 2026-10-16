import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { categoryHue, categoryName } from "../../core/categories";
import { monthTitle, shiftMonth, yearMonth } from "../../core/day";
import { summary, type CategoryTotal } from "../../core/engine";
import { useMoney, usePocket } from "../../data/store";
import { Big, Card, CategoryIcon, Empty, SectionTitle, Segmented, tap } from "../../ui/components";
import { Icon } from "../../ui/Icon";
import { GUTTER, tint, useColors } from "../../ui/theme";

export default function Categories() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const money = useMoney();
  const entries = usePocket((s) => s.entries);
  const today = usePocket((s) => s.today);
  const thisMonth = yearMonth(today);
  const [scope, setScope] = useState<"month" | "all">("month");
  const [month, setMonth] = useState(thisMonth);
  const first = useMemo(() => entries.reduce((min, e) => (e.day < min ? e.day : min), today).slice(0, 7), [entries, today]);
  const sum = useMemo(() => summary(entries, scope === "month" ? month : null), [entries, scope, month]);
  const net = sum.income - sum.spent;

  const open = (row: CategoryTotal, income: boolean) => {
    router.push({ pathname: "/category", params: { id: row.category, month: scope === "month" ? month : "", income: income ? "1" : "" } });
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 110, paddingHorizontal: GUTTER }}
    >
      <Segmented
        options={[{ value: "month" as const, label: "By month" }, { value: "all" as const, label: "All time" }]}
        value={scope}
        onChange={setScope}
      />

      {scope === "month" ? (
        <View style={styles.monthNav}>
          <MonthArrow dir={-1} disabled={month <= first} onPress={() => setMonth((m) => shiftMonth(m, -1))} />
          <Text style={[styles.month, { color: c.ink }]} accessibilityRole="header">{monthTitle(month, today)}</Text>
          <MonthArrow dir={1} disabled={month >= thisMonth} onPress={() => setMonth((m) => shiftMonth(m, 1))} />
        </View>
      ) : <View style={{ height: 18 }} />}

      <View style={styles.totals}>
        <Total label="Spent" value={money.string(sum.spent)} />
        <Total label="Money in" value={money.string(sum.income)} color={sum.income ? c.pos : undefined} />
        <Total label="Net" value={money.string(net, true)} color={net > 0 ? c.pos : net < 0 ? c.neg : undefined} />
      </View>

      <SectionTitle title="Spending" meta={sum.byCategory.length ? `${sum.byCategory.reduce((n, r) => n + r.count, 0)} entries` : undefined} />
      {sum.byCategory.length ? (
        <Card>{sum.byCategory.map((r, i) => (
          <Bar key={r.category} row={r} total={sum.spent} income={false} last={i === sum.byCategory.length - 1} onPress={() => open(r, false)} />
        ))}</Card>
      ) : (
        <Card><Empty title={scope === "month" ? "No spending this month" : "No spending yet"} body="Spending shows up here by category." /></Card>
      )}

      {sum.incomeByCategory.length ? (
        <>
          <SectionTitle title="Money in" />
          <Card>{sum.incomeByCategory.map((r, i) => (
            <Bar key={r.category} row={r} total={sum.income} income last={i === sum.incomeByCategory.length - 1} onPress={() => open(r, true)} />
          ))}</Card>
        </>
      ) : null}
      <Text style={{ color: c.faint, fontSize: 13, marginTop: 14, paddingHorizontal: 4, lineHeight: 18 }}>
        Your starting balance isn’t counted as money in.
      </Text>
    </ScrollView>
  );

  function Total({ label, value, color }: { label: string; value: string; color?: string }) {
    return (
      <View style={[styles.total, { backgroundColor: c.surface, borderColor: c.line }]}>
        <Text style={{ color: c.muted, fontSize: 13 }}>{label}</Text>
        <Big style={{ fontSize: 19, color: color ?? c.ink }} numberOfLines={1} adjustsFontSizeToFit>{value}</Big>
      </View>
    );
  }

  function MonthArrow({ dir, disabled, onPress }: { dir: -1 | 1; disabled: boolean; onPress: () => void }) {
    return (
      <Pressable
        onPress={() => { tap(); onPress(); }}
        disabled={disabled}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={dir < 0 ? "Previous month" : "Next month"}
        style={[styles.arrow, { backgroundColor: c.chip, opacity: disabled ? 0.35 : 1 }]}
      >
        <Icon name={dir < 0 ? "chevron.left" : "chevron.right"} size={14} color={c.ink} weight="semibold" />
      </Pressable>
    );
  }

  function Bar({ row, total, income, last, onPress }: { row: CategoryTotal; total: number; income: boolean; last: boolean; onPress: () => void }) {
    const share = total ? row.cents / total : 0;
    const hue = c.hues[categoryHue(row.category, income ? 1 : -1)];
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${categoryName(row.category)}, ${money.string(row.cents)}, ${Math.round(share * 100)} percent, ${row.count} entries`}
        style={({ pressed }) => [styles.bar, { backgroundColor: pressed ? c.chip : "transparent" }]}
      >
        <CategoryIcon category={row.category} cents={income ? 1 : -1} />
        <View style={{ flex: 1, gap: 6 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: c.ink, fontSize: 16, fontWeight: "500" }}>{categoryName(row.category)}</Text>
            <Text style={{ color: income ? c.pos : c.ink, fontSize: 16, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{money.string(row.cents)}</Text>
          </View>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: tint(hue, 0.14), overflow: "hidden" }}>
            <View style={{ width: `${Math.max(2, share * 100)}%`, height: 6, borderRadius: 3, backgroundColor: hue }} />
          </View>
          <Text style={{ color: c.muted, fontSize: 12 }}>{Math.round(share * 100)}% · {row.count} {row.count === 1 ? "entry" : "entries"}</Text>
        </View>
        {!last ? <View style={{ position: "absolute", left: 62, right: 0, bottom: 0, height: StyleSheet.hairlineWidth, backgroundColor: c.line }} /> : null}
      </Pressable>
    );
  }
}

const styles = StyleSheet.create({
  monthNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 18, marginBottom: 14 },
  month: { fontSize: 24, fontWeight: "800" },
  arrow: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  totals: { flexDirection: "row", gap: 8 },
  total: { flex: 1, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 4 },
  bar: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
});
