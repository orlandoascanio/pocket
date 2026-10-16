import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { INCOME, SPENDING, categorySymbol } from "../core/categories";
import type { Preset } from "../core/models";
import { amountInput, editString, parseMoney } from "../core/money";
import { store, useMoney, usePocket } from "../data/store";
import { Button, CategoryIcon, Empty, Segmented, tap } from "../ui/components";
import { ErrorText, SheetHeader } from "../ui/form";
import { Icon } from "../ui/Icon";
import { tint, useColors } from "../ui/theme";

type Draft = { id?: string; label: string; amount: string; sign: 1 | -1; category?: string };

/** Quick-add buttons: one tap adds them from Overview. */
export default function Buttons() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const money = useMoney();
  const presets = usePocket((s) => s.presets);
  const local = usePocket((s) => s.mode === "local");
  const [draft, setDraft] = useState<Draft | null>(null);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <SheetHeader title="Quick-add buttons" />
      <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }}>
        {presets.length === 0 && !draft ? (
          <Empty icon="hand.tap" title="No buttons yet" body="Make one for things you buy often, like coffee or the train. Leave the amount empty when it changes each time." />
        ) : null}

        {presets.map((p, i) => draft?.id === p.id ? (
          <Editor key={p.id} draft={draft} setDraft={setDraft} />
        ) : (
          <View key={p.id} style={[styles.row, { backgroundColor: c.surface, borderColor: c.line }]}>
            <Pressable style={styles.rowMain} onPress={() => setDraft(toDraft(p))} accessibilityRole="button" accessibilityLabel={`Edit ${p.label}`}>
              <CategoryIcon category={p.category} cents={p.sign} symbol={categorySymbol(p.category, p.sign)} size={34} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.ink, fontSize: 16, fontWeight: "600" }}>{p.label}</Text>
                <Text style={{ color: c.muted, fontSize: 13 }}>
                  {p.cents != null ? money.string(p.sign * p.cents, true) : "Asks for the amount"}
                </Text>
              </View>
            </Pressable>
            {local ? (
              <View style={{ flexDirection: "row", gap: 2 }}>
                <MoveButton dir={-1} disabled={i === 0} id={p.id} />
                <MoveButton dir={1} disabled={i === presets.length - 1} id={p.id} />
              </View>
            ) : null}
          </View>
        ))}

        {draft && !draft.id ? <Editor draft={draft} setDraft={setDraft} /> : null}

        {!draft ? (
          <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
            <Button kind="secondary" icon="minus" title="Spending" onPress={() => setDraft({ label: "", amount: "", sign: -1 })} style={{ flex: 1 }} />
            <Button kind="secondary" icon="plus" title="Money in" onPress={() => setDraft({ label: "Got paid", amount: "", sign: 1, category: "pay" })} style={{ flex: 1 }} />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );

  function MoveButton({ dir, disabled, id }: { dir: -1 | 1; disabled: boolean; id: string }) {
    return (
      <Pressable
        onPress={() => { tap(); void store.movePreset(id, dir); }}
        disabled={disabled}
        hitSlop={4}
        accessibilityRole="button"
        accessibilityLabel={dir < 0 ? "Move up" : "Move down"}
        style={[styles.move, { opacity: disabled ? 0.3 : 1 }]}
      >
        <Icon name={dir < 0 ? "arrow.up" : "arrow.down"} size={14} color={c.muted} />
      </Pressable>
    );
  }
}

function toDraft(p: Preset): Draft {
  return { id: p.id, label: p.label, amount: p.cents != null ? editString(p.cents) : "", sign: p.sign, category: p.category };
}

function Editor({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft | null) => void }) {
  const c = useColors();
  const money = useMoney();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const cats = draft.sign > 0 ? INCOME : SPENDING;

  const save = async () => {
    const label = draft.label.trim();
    if (!label) { setError("Give it a name"); return; }
    const cents = draft.amount.trim() === "" ? undefined : parseMoney(draft.amount);
    if (cents === null) { setError("Enter an amount, like 4.50, or leave it empty"); return; }
    setBusy(true);
    try {
      await store.savePreset({ id: draft.id, label, sign: draft.sign, cents, category: draft.category });
      setDraft(null);
    } catch {
      setError("Couldn't save. Your edits are still here; try again.");
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    if (!draft.id) { setDraft(null); return; }
    Alert.alert(`Delete “${draft.label}”?`, undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await store.deletePreset(draft.id!).catch(() => {}); setDraft(null); } },
    ]);
  };

  return (
    <View style={[styles.editor, { backgroundColor: c.surface, borderColor: c.accent }]}>
      <Segmented
        options={[{ value: -1 as const, label: "Spending" }, { value: 1 as const, label: "Money in" }]}
        value={draft.sign}
        onChange={(sign) => setDraft({ ...draft, sign, category: undefined })}
      />
      <TextInput
        value={draft.label}
        onChangeText={(label) => setDraft({ ...draft, label })}
        placeholder="Name, like Coffee"
        placeholderTextColor={c.faint}
        autoFocus={!draft.id}
        maxLength={120}
        accessibilityLabel="Button name"
        style={[styles.input, { color: c.ink, borderColor: c.line }]}
      />
      <View style={[styles.input, { borderColor: c.line, flexDirection: "row", alignItems: "center" }]}>
        <Text style={{ color: c.muted, fontSize: 16, marginRight: 4 }}>{money.symbol}</Text>
        <TextInput
          value={draft.amount}
          onChangeText={(amount) => setDraft({ ...draft, amount: amountInput(amount) })}
          placeholder="Ask each time"
          placeholderTextColor={c.faint}
          keyboardType="decimal-pad"
          accessibilityLabel="Amount, or empty to ask each time"
          style={{ color: c.ink, fontSize: 16, flex: 1 }}
        />
      </View>
      <View style={styles.cats}>
        {cats.map((x) => {
          const on = draft.category === x.id;
          return (
            <Pressable
              key={x.id}
              onPress={() => { tap(); setDraft({ ...draft, category: on ? undefined : x.id }); }}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={x.name}
              style={[styles.cat, { borderColor: on ? c.hues[x.hue] : "transparent", backgroundColor: on ? tint(c.hues[x.hue], 0.12) : "transparent" }]}
            >
              <CategoryIcon category={x.id} cents={draft.sign} size={28} />
            </Pressable>
          );
        })}
      </View>
      <ErrorText>{error}</ErrorText>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
        <Button small kind={draft.id ? "danger" : "secondary"} title={draft.id ? "Delete" : "Cancel"} onPress={remove} style={{ flex: 1 }} />
        {draft.id ? <Button small kind="secondary" title="Cancel" onPress={() => setDraft(null)} style={{ flex: 1 }} /> : null}
        <Button small title="Save" onPress={save} busy={busy} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, marginBottom: 8, paddingRight: 8 },
  rowMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, padding: 12 },
  move: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  editor: { borderRadius: 16, borderWidth: 1.5, padding: 12, marginBottom: 8, gap: 10 },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 12, minHeight: 46, fontSize: 16 },
  cats: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  cat: { borderRadius: 12, borderWidth: 1.5, padding: 4 },
});
