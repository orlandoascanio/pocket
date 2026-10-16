import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { shortDay } from "../core/day";
import { amountInput, editString, parseMoney } from "../core/money";
import { store, useMoney, usePocket } from "../data/store";
import { Button, CategoryIcon } from "../ui/components";
import { DateField, ErrorText, Group, SheetHeader } from "../ui/form";
import { DISPLAY, useColors } from "../ui/theme";

/** "Got it" / "Paid": log the next payment of a rule with the real amount and date. */
export default function SettleSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const money = useMoney();
  const rule = usePocket((s) => s.rules.find((r) => r.id === id));
  const today = usePocket((s) => s.today);
  const [amount, setAmount] = useState(rule ? editString(rule.cents) : "");
  const [day, setDay] = useState(today);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const leaving = useRef(false);

  // Settled or removed elsewhere (another device): close, unless this sheet is already closing.
  useEffect(() => { if (!rule && !leaving.current) { leaving.current = true; router.back(); } }, [rule]);
  if (!rule) return null;

  const income = rule.cents > 0;
  const cents = parseMoney(amount);
  const overdue = rule.next <= today;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    leaving.current = true;
    try {
      await fn();
      router.back();
    } catch {
      leaving.current = false;
      setError("Couldn't save. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const confirm = () => {
    if (cents == null) { setError("Enter an amount, like 9.99"); return; }
    void run(() => store.settle(rule.id, Math.sign(rule.cents) * cents, day));
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <SheetHeader title={income ? "Did it arrive?" : "Was it paid?"} action={income ? "Got it" : "Paid"} onAction={confirm} actionDisabled={cents == null} busy={busy} />
      <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }}>
        <View style={styles.top}>
          <CategoryIcon category={rule.category} cents={rule.cents} size={48} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: c.ink }]}>{rule.label}</Text>
            <Text style={{ color: c.muted, fontSize: 14 }}>
              {overdue ? `Was due ${shortDay(rule.next)}` : `Due ${shortDay(rule.next)}`} · expected {money.string(rule.cents, true)}
            </Text>
          </View>
        </View>

        <Text style={{ color: c.muted, fontSize: 14, marginTop: 20, paddingHorizontal: 4 }}>
          {income ? "How much came in?" : "How much was it?"} Change it if it was different.
        </Text>
        <View style={[styles.amountBox, { backgroundColor: c.surface, borderColor: c.accent }]}>
          <Text style={[styles.sign, { color: c.muted }]}>{income ? "+" : "−"}{money.symbol}</Text>
          <TextInput
            value={amount}
            onChangeText={(t) => setAmount(amountInput(t))}
            keyboardType="decimal-pad"
            selectTextOnFocus
            accessibilityLabel="Amount"
            style={[styles.amount, { color: income ? c.pos : c.ink }]}
          />
        </View>

        <Group>
          <DateField value={day} onChange={setDay} label={income ? "Arrived on" : "Paid on"} last />
        </Group>

        <ErrorText>{error}</ErrorText>

        <Button title={income ? "Got it" : "Paid"} icon="checkmark" onPress={confirm} disabled={cents == null} busy={busy} style={{ marginTop: 24 }} />
        <Button kind="secondary" title="Skip this one" onPress={() => run(() => store.skip(rule.id))} style={{ marginTop: 10 }} />
        <Text style={{ color: c.muted, fontSize: 13, marginTop: 10, textAlign: "center", lineHeight: 18 }}>
          Skipping means this payment won’t happen.{rule.once ? "" : " The next one stays planned."}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", gap: 14 },
  title: { fontSize: 22, fontWeight: "700", fontFamily: DISPLAY },
  amountBox: { flexDirection: "row", alignItems: "center", marginTop: 8, borderRadius: 16, borderWidth: 1.5, paddingHorizontal: 16, minHeight: 76 },
  sign: { fontFamily: DISPLAY, fontSize: 30, fontWeight: "700", marginRight: 6 },
  amount: { flex: 1, fontFamily: DISPLAY, fontSize: 38, fontWeight: "800", fontVariant: ["tabular-nums"] },
});
