import { router, useLocalSearchParams } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CATEGORY_START, categoryKey, categoryName } from "../core/categories";
import { monthContains, monthTitle, relativeDay } from "../core/day";
import { useMoney, usePocket } from "../data/store";
import { Card, CategoryIcon, MoneyRow } from "../ui/components";
import { SheetHeader } from "../ui/form";
import { DISPLAY, useColors } from "../ui/theme";

/** Every entry in one category (for a month, or all time). */
export default function CategorySheet() {
  const { id, month, income } = useLocalSearchParams<{ id: string; month?: string; income?: string }>();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const money = useMoney();
  const entries = usePocket((s) => s.entries);
  const today = usePocket((s) => s.today);
  const sign = income ? 1 : -1;
  const list = entries.filter((e) =>
    e.category !== CATEGORY_START && Math.sign(e.cents) === sign && categoryKey(e.category, e.cents) === id && (!month || monthContains(month, e.day)));
  const total = list.reduce((n, e) => n + e.cents, 0);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <SheetHeader title={categoryName(id)} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <CategoryIcon category={id} cents={sign} size={48} />
          <View>
            <Text style={{ color: c.ink, fontSize: 26, fontWeight: "800", fontFamily: DISPLAY, fontVariant: ["tabular-nums"] }}>
              {money.string(Math.abs(total))}
            </Text>
            <Text style={{ color: c.muted, fontSize: 14 }}>
              {month ? monthTitle(month, today) : "All time"} · {list.length} {list.length === 1 ? "entry" : "entries"}
            </Text>
          </View>
        </View>
        <Card>
          {list.map((e, i) => (
            <MoneyRow
              key={e.id}
              title={e.label}
              category={e.category}
              cents={e.cents}
              note={relativeDay(e.day, today)}
              amount={money.string(e.cents, true)}
              amountColor={e.cents > 0 ? c.pos : c.ink}
              onPress={() => router.push({ pathname: "/entry", params: { id: e.id } })}
              last={i === list.length - 1}
            />
          ))}
        </Card>
      </ScrollView>
    </View>
  );
}
