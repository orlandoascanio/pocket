import { Redirect, router } from "expo-router";
import { useRef, useState, type ComponentRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CURRENCIES, Money, amountInput, parseMoney } from "../core/money";
import { store, usePocket } from "../data/store";
import { Button, Segmented, tap } from "../ui/components";
import { ErrorText } from "../ui/form";
import { PocketCharacter } from "../ui/PocketCharacter";
import { DISPLAY, tint, useColors } from "../ui/theme";

/** First run: how much money is there right now? */
export default function Welcome() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const saved = usePocket((s) => s.currency);
  const onboarded = usePocket((s) => s.onboarded);
  const [currency, setCurrency] = useState(saved);
  const [below, setBelow] = useState(false);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const money = new Money(currency);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  if (onboarded) return <Redirect href="/" />;

  const begin = async () => {
    const cents = amount.trim() === "" ? 0 : parseMoney(amount, true);
    if (cents == null) { setError("Enter a valid amount, like 125.50, or leave it empty for zero."); return; }
    setBusy(true);
    try {
      await store.start(currency, below ? -cents : cents);
    } catch {
      setError("Couldn't save. Try again.");
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}
      >
        <View style={{ alignItems: "center" }}>
          <PocketCharacter size={128} greeting="Hi! I'm your Pocket" />
          <Text style={[styles.title, { color: c.ink }]}>Always know how much money you have left</Text>
          <Text style={[styles.body, { color: c.muted }]}>How much money do you have right now?</Text>
        </View>

        <Segmented
          style={{ marginTop: 24 }}
          options={[{ value: "have", label: "I have" }, { value: "below", label: "I'm below zero by" }]}
          value={below ? "below" : "have"}
          onChange={(v) => setBelow(v === "below")}
        />

        <View style={[styles.amountBox, { backgroundColor: c.surface, borderColor: amount ? c.accent : c.line }]}>
          <Text style={[styles.sign, { color: c.muted }]}>{below ? "−" : ""}{money.symbol}</Text>
          <TextInput
            value={amount}
            onChangeText={(t) => {
              setError("");
              // A pasted signed amount should agree with the direction control.
              const m = t.trim().match(/^([+-])(.*)$/);
              if (m && !/^[+-]/.test(m[2])) { setBelow(m[1] === "-"); setAmount(amountInput(m[2])); } else setAmount(amountInput(t));
            }}
            placeholder="0.00"
            placeholderTextColor={c.faint}
            keyboardType="decimal-pad"
            // Keep "Set my balance" above the keyboard.
            onFocus={() => setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 350)}
            accessibilityLabel={below ? "How far below zero" : "Money you have now"}
            style={[styles.amount, { color: below ? c.neg : c.ink }]}
          />
          <Pressable onPress={() => { tap(); setPicking((v) => !v); }} style={[styles.cur, { backgroundColor: c.chip }]} accessibilityRole="button" accessibilityLabel={`Currency ${currency}. Change`}>
            <Text style={{ color: c.ink, fontWeight: "700" }}>{currency}</Text>
          </Pressable>
        </View>
        {picking ? (
          <View style={styles.currencies}>
            {CURRENCIES.map((code) => (
              <Pressable key={code} onPress={() => { tap(); setCurrency(code); setPicking(false); }}
                style={[styles.currency, { backgroundColor: code === currency ? tint(c.accent, 0.14) : c.chip, borderColor: code === currency ? c.accent : "transparent" }]}>
                <Text style={{ color: c.ink, fontWeight: code === currency ? "700" : "500" }}>{code}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <Text style={{ color: c.muted, fontSize: 13, marginTop: 8, paddingHorizontal: 4 }}>Use the money you have now. Leave it empty to start at zero.</Text>
        <ErrorText>{error}</ErrorText>

        <Button title="Set my balance" onPress={begin} busy={busy} style={{ marginTop: 22 }} />
        <Text style={{ color: c.muted, fontSize: 13, textAlign: "center", marginTop: 10 }}>Saved on this phone. No account needed.</Text>
        <Button kind="plain" title="Already use Pocket on your Mac? Connect" onPress={() => router.push("/connect")} style={{ marginTop: 8 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: "800", fontFamily: DISPLAY, textAlign: "center", marginTop: 18, letterSpacing: -0.5 },
  body: { fontSize: 17, textAlign: "center", marginTop: 8 },
  amountBox: { flexDirection: "row", alignItems: "center", marginTop: 12, borderRadius: 16, borderWidth: 1.5, paddingLeft: 16, paddingRight: 10, minHeight: 76 },
  sign: { fontFamily: DISPLAY, fontSize: 30, fontWeight: "700", marginRight: 6 },
  amount: { flex: 1, fontFamily: DISPLAY, fontSize: 38, fontWeight: "800", fontVariant: ["tabular-nums"] },
  cur: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  currencies: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  currency: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7, minWidth: 54, alignItems: "center" },
});
