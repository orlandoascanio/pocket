import * as Sharing from "expo-sharing";
import { useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { CATEGORY_START, categoryHue, categoryKey, categoryName, categorySymbol } from "../core/categories";
import type { Day } from "../core/day";
import {
  KIND_NAME, PERIODS, PERIOD_NAME, periodRange, queryPeriod,
  type EntryKind, type EntryQuery,
} from "../core/history";
import type { Entry } from "../core/models";
import { store } from "../data/store";
import { Chip, tap } from "./components";
import { Icon } from "./Icon";
import { GUTTER, tint, useColors } from "./theme";

/** Hands a CSV spreadsheet of `entries` to the share sheet. Returns what went wrong, or null. */
export async function shareCSV(entries: Entry[], name?: string): Promise<string | null> {
  try {
    if (!(await Sharing.isAvailableAsync())) return "Sharing isn't available here.";
    const f = await store.exportCSV(entries, name);
    await Sharing.shareAsync(f.uri, { mimeType: "text/csv", dialogTitle: "Export as a spreadsheet", UTI: "public.comma-separated-values-text" });
    return null;
  } catch {
    return "Couldn't export. Try again.";
  }
}

/** Search box for History, with a filter button that shows money in or out, date ranges and categories. */
export function HistorySearch({ query, onChange, entries, today }: {
  query: EntryQuery; onChange: (q: EntryQuery) => void; entries: Entry[]; today: Day;
}) {
  const c = useColors();
  const active = (query.kind !== "all" ? 1 : 0) + (query.category !== undefined ? 1 : 0) + (query.from !== undefined || query.to !== undefined ? 1 : 0);
  const [open, setOpen] = useState(active > 0);
  const period = queryPeriod(query, today);

  // Categories that are actually used, most used first.
  const categories = useMemo(() => {
    const counts = new Map<string, { cents: number; count: number }>();
    for (const e of entries) {
      if (e.category === CATEGORY_START) continue;
      const k = categoryKey(e.category, e.cents);
      const cur = counts.get(k) ?? { cents: e.cents, count: 0 };
      counts.set(k, { cents: cur.cents, count: cur.count + 1 });
    }
    return [...counts].sort((a, b) => b[1].count - a[1].count).map(([id, v]) => ({ id, cents: v.cents }));
  }, [entries]);

  const setKind = (kind: EntryKind) => onChange({ ...query, kind: query.kind === kind ? "all" : kind });

  return (
    <View style={{ gap: 10, marginBottom: 12 }}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={[styles.search, { backgroundColor: c.surface, borderColor: c.line }]}>
          <Icon name="magnifyingglass" size={16} color={c.muted} />
          <TextInput
            value={query.text}
            onChangeText={(text) => onChange({ ...query, text })}
            placeholder="Search history"
            placeholderTextColor={c.faint}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
            accessibilityLabel="Search history"
            style={[styles.input, { color: c.ink }]}
          />
          {query.text && Platform.OS !== "ios" ? (
            <Pressable onPress={() => onChange({ ...query, text: "" })} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear search">
              <Icon name="xmark.circle.fill" size={17} color={c.faint} />
            </Pressable>
          ) : null}
        </View>
        <Pressable
          onPress={() => { tap(); setOpen((v) => !v); }}
          accessibilityRole="button"
          accessibilityLabel={active ? `Filters, ${active} on` : "Filters"}
          accessibilityState={{ expanded: open }}
          style={({ pressed }) => [styles.filterButton, {
            backgroundColor: active ? tint(c.accent, 0.14) : c.surface,
            borderColor: active ? c.accent : c.line,
            transform: [{ scale: pressed ? 0.96 : 1 }],
          }]}
        >
          <Icon name="line.3.horizontal.decrease" size={18} color={active ? c.accent : c.ink} />
          {active ? <Text style={{ color: c.accent, fontWeight: "700", fontSize: 14 }}>{active}</Text> : null}
        </Pressable>
      </View>

      {open ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -GUTTER }}
            contentContainerStyle={{ gap: 8, paddingHorizontal: GUTTER }} keyboardShouldPersistTaps="handled">
            {(["spending", "income"] as const).map((k) => (
              <Chip key={k} label={KIND_NAME[k]} selected={query.kind === k} onPress={() => setKind(k)} />
            ))}
            <View style={[styles.divider, { backgroundColor: c.line }]} />
            {PERIODS.map((p) => (
              <Chip
                key={p}
                label={PERIOD_NAME[p]}
                selected={period === p}
                onPress={() => onChange(period === p ? { ...query, from: undefined, to: undefined } : { ...query, ...periodRange(p, today) })}
              />
            ))}
          </ScrollView>
          {categories.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -GUTTER }}
              contentContainerStyle={{ gap: 8, paddingHorizontal: GUTTER }} keyboardShouldPersistTaps="handled">
              {categories.map((cat) => (
                <Chip
                  key={cat.id}
                  label={categoryName(cat.id)}
                  icon={categorySymbol(cat.id, cat.cents)}
                  iconColor={c.hues[categoryHue(cat.id, cat.cents)]}
                  selected={query.category === cat.id}
                  onPress={() => onChange({ ...query, category: query.category === cat.id ? undefined : cat.id })}
                />
              ))}
            </ScrollView>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12, minHeight: 44,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: 10 },
  filterButton: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth, minWidth: 44, minHeight: 44, paddingHorizontal: 10,
  },
  divider: { width: StyleSheet.hairlineWidth, marginVertical: 6 },
});
