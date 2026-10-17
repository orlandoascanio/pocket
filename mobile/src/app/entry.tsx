import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CATEGORY_START, INCOME, SPENDING } from "../core/categories";
import { guessCategory } from "../core/engine";
import { CADENCES, type Cadence } from "../core/models";
import { amountInput, editString, parseMoney } from "../core/money";
import { store, useMoney, usePocket } from "../data/store";
import { Button, CategoryIcon, Segmented, tap, useToast } from "../ui/components";
import { DateField, ErrorText, Group, SheetHeader, TextField, ToggleField } from "../ui/form";
import { DISPLAY, tint, useColors } from "../ui/theme";

type Repeat = "once" | Cadence;
const REPEATS: { value: Repeat; label: string }[] = [
  { value: "once", label: "Once" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "2 wks" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "3 mo" },
  { value: "yearly", label: "Yearly" },
];

/** Add or edit money: one-time, planned for later, or repeating. */
export default function EntrySheet() {
  const params = useLocalSearchParams<{ id?: string; rule?: string; sign?: string; preset?: string }>();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const money = useMoney();
  const toast = useToast();
  const s = usePocket();

  const editingEntry = params.id ? s.entries.find((e) => e.id === params.id) : undefined;
  const editingRule = params.rule ? s.rules.find((r) => r.id === params.rule) : undefined;
  const preset = params.preset ? s.presets.find((p) => p.id === params.preset) : undefined;
  const editing = !!(editingEntry || editingRule);
  const isStart = editingEntry?.category === CATEGORY_START;

  const initial = editingEntry ?? editingRule;
  const [sign, setSign] = useState<1 | -1>(initial ? (initial.cents > 0 ? 1 : -1) : preset ? preset.sign : params.sign === "1" ? 1 : -1);
  const [amount, setAmount] = useState(initial ? editString(initial.cents) : "");
  const [label, setLabel] = useState(initial?.label ?? preset?.label ?? "");
  const [category, setCategory] = useState<string | undefined>(initial?.category ?? preset?.category);
  const [catTouched, setCatTouched] = useState(editing || !!preset);
  const [day, setDay] = useState(editingEntry?.day ?? editingRule?.next ?? s.today);
  const [repeat, setRepeat] = useState<Repeat>(editingRule ? (editingRule.once ? "once" : editingRule.cadence) : "once");
  const [times, setTimes] = useState(editingRule?.remaining != null && !editingRule.once ? String(editingRule.remaining) : "");
  const [wait, setWait] = useState(editingRule ? !editingRule.auto : false);
  const [asButton, setAsButton] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const labelRef = useRef<ComponentRef<typeof TextInput>>(null);
  const leaving = useRef(false);
  const close = () => { if (!leaving.current) { leaving.current = true; router.back(); } };

  // The thing being edited was deleted elsewhere (another device), or finished: close.
  const gone = (!!params.id && !editingEntry) || (!!params.rule && !editingRule);
  useEffect(() => {
    if (gone && !leaving.current) { leaving.current = true; router.back(); }
  }, [gone]);

  const cats = sign > 0 ? INCOME : SPENDING;
  const planned = repeat !== "once" || day > s.today;
  const cents = parseMoney(amount, isStart);

  // Keep the chosen category in view (tiles are 88 wide with 8 between).
  const catScroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const catOffset = (id: string | undefined, list = cats) => Math.max(0, list.findIndex((x) => x.id === id) - 1) * 96;
  const guess = (text: string, next: 1 | -1) => {
    const g = guessCategory(text, next > 0, s.entries, s.presets);
    if (g && g !== category) catScroll.current?.scrollTo({ x: catOffset(g, next > 0 ? INCOME : SPENDING), animated: true });
    setCategory(g);
  };

  // Guess the category from what it was for ("valo" picks Games), until one is picked by hand.
  const changeLabel = (text: string) => {
    setLabel(text);
    if (!catTouched) guess(text, sign);
  };

  // A category from the other direction doesn't fit.
  const changeSign = (next: 1 | -1) => {
    setSign(next);
    if (isStart) return;
    const fits = (next > 0 ? INCOME : SPENDING).some((x) => x.id === category);
    if (catTouched) setCategory(fits ? category : undefined);
    else guess(label, next);
  };

  const title = editingRule ? (editingRule.once ? "Planned" : "Repeating") : editingEntry ? (isStart ? "Starting balance" : "Edit") : sign > 0 ? "Money in" : "Spending";

  const preview = useMemo(() => {
    if (cents == null || editing || planned) return null;
    return s.balance + sign * cents;
  }, [cents, editing, planned, s.balance, sign]);

  const save = async () => {
    setError("");
    if (cents == null) { setError("Enter an amount, like 9.99"); return; }
    const l = label.trim();
    if (!l) { setError("Say what it was for"); labelRef.current?.focus(); return; }
    let left: number | undefined;
    if (repeat !== "once" && times.trim() !== "") {
      left = Number(times.trim());
      if (!Number.isInteger(left) || left < 1) { setError("Payments must be a whole number, like 3"); return; }
    }
    const signed = isStart ? (sign < 0 ? -cents : cents) : sign * cents;
    const cat = isStart ? CATEGORY_START : category;
    setBusy(true);
    try {
      if (editingRule) {
        await store.updateRule(editingRule.id, {
          cents: signed, label: l, day, category: cat, cadence: repeat === "once" ? "monthly" : repeat,
          times: repeat === "once" ? 1 : left, auto: !wait,
        });
      } else if (editingEntry) {
        await store.updateEntry(editingEntry.id, { cents: signed, label: l, day, category: cat });
      } else if (planned) {
        const sent = await store.addRule({
          cents: signed, label: l, day, category: cat, cadence: repeat === "once" ? "monthly" : repeat,
          times: repeat === "once" ? 1 : left, auto: !wait,
        });
        if (!sent) toast({ text: "You're offline. Saved here, and it'll sync when you're back." });
      } else {
        const id = await store.addEntry({ cents: signed, label: l, day, category: cat });
        if (id === null) toast({ text: "You're offline. Saved here, and it'll sync when you're back." });
        if (asButton) {
          await store.savePreset({ label: l, sign, cents, category: cat });
          toast({ text: `"${l}" is now a quick-add button` });
        }
      }
      close();
    } catch (e) {
      setError(e instanceof Error && !/HTTP|fetch|reach/i.test(e.message) ? e.message : "Couldn't save. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    const question = editingRule
      ? editingRule.once ? `Remove expected “${editingRule.label}”?` : `Stop “${editingRule.label}”?`
      : `Delete “${editingEntry?.label}” (${money.string(editingEntry?.cents ?? 0)})?`;
    Alert.alert(question, editingRule && !editingRule.once ? "Payments already logged stay in your history." : undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: editingRule && !editingRule.once ? "Stop" : "Delete", style: "destructive",
        onPress: async () => {
          try {
            leaving.current = true;
            if (editingRule) await store.deleteRule(editingRule.id);
            else if (editingEntry) await store.deleteEntry(editingEntry.id);
            leaving.current = false;
            close();
          } catch {
            setError("Couldn't do that. Try again.");
          }
        },
      },
    ]);
  };

  const togglePause = async () => {
    if (!editingRule) return;
    try {
      await store.setActive(editingRule.id, !editingRule.active);
      toast({
        text: editingRule.active
          ? `Paused ${editingRule.label}. Nothing is logged until you resume it.`
          : `Resumed ${editingRule.label}. It picks up from the next date, without the missed ones.`,
      });
      close();
    } catch {
      setError("Couldn't do that. Try again.");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <SheetHeader title={title} action={editing ? "Save" : "Add"} onAction={save} actionDisabled={cents == null} busy={busy} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }}
      >
        {!isStart ? (
          <Segmented
            options={[{ value: -1 as const, label: "Spent", icon: "minus" }, { value: 1 as const, label: "Got money", icon: "plus" }]}
            value={sign}
            onChange={changeSign}
          />
        ) : (
          <Segmented
            options={[{ value: 1 as const, label: "I had" }, { value: -1 as const, label: "Below zero by" }]}
            value={sign}
            onChange={setSign}
          />
        )}

        <View style={[styles.amountBox, { backgroundColor: c.surface, borderColor: amount ? c.accent : c.line }]}>
          <Text style={[styles.amountSign, { color: c.muted }]}>{isStart ? "" : sign > 0 ? "+" : "−"}{money.symbol}</Text>
          <TextInput
            value={amount}
            onChangeText={(t) => { setAmount(amountInput(t)); setError(""); }}
            placeholder="0.00"
            placeholderTextColor={c.faint}
            keyboardType="decimal-pad"
            autoFocus={!editing}
            returnKeyType="next"
            onSubmitEditing={() => labelRef.current?.focus()}
            accessibilityLabel="Amount"
            style={[styles.amount, { color: sign > 0 && !isStart ? c.pos : c.ink }]}
          />
        </View>
        {preview != null ? (
          <Text style={{ color: preview < 0 ? c.neg : c.muted, fontSize: 14, marginTop: 8, paddingHorizontal: 4 }}>
            You’ll have {money.string(preview)} left
          </Text>
        ) : null}

        <Group>
          <TextField
            ref={labelRef}
            value={label}
            onChangeText={changeLabel}
            placeholder={sign > 0 ? "Where did it come from?" : "What was it for?"}
            returnKeyType="done"
            onSubmitEditing={save}
            maxLength={120}
            accessibilityLabel="What it was for"
          />
        </Group>

        {!isStart ? (
          <ScrollView ref={catScroll} horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14, marginHorizontal: -16 }}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
            contentOffset={{ x: catOffset(initial?.category), y: 0 }}>
            {cats.map((x) => {
              const on = category === x.id;
              const hue = c.hues[x.hue];
              return (
                <Pressable
                  key={x.id}
                  onPress={() => { tap(); setCatTouched(true); setCategory(on ? undefined : x.id); }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={x.name}
                  style={[styles.cat, { backgroundColor: on ? tint(hue, 0.16) : c.surface, borderColor: on ? hue : c.line }]}
                >
                  <CategoryIcon category={x.id} cents={sign} size={30} />
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={{ color: on ? c.ink : c.muted, fontSize: 12, fontWeight: on ? "700" : "500" }}>{x.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        <Group>
          <DateField value={day} onChange={setDay} label={editingRule ? "Next" : "Date"} last={!!editingEntry} />
          {!editingEntry ? (
            <View style={{ padding: 12 }}>
              <Segmented options={REPEATS} value={repeat} onChange={setRepeat} />
            </View>
          ) : null}
        </Group>

        {!editingEntry && planned ? (
          <Group footer={repeat !== "once"
            ? `≈ ${money.whole(Math.round((cents ?? 0) * CADENCES[repeat].perMonth))} a month. Leave the count empty to keep it going.`
            : "It counts on its day, and shows in Plan until then."}>
            {repeat !== "once" ? (
              <View style={{ flexDirection: "row", alignItems: "center", paddingRight: 16 }}>
                <Text style={{ color: c.ink, fontSize: 16, paddingLeft: 16, flex: 1 }}>How many payments</Text>
                <TextInput
                  value={times}
                  onChangeText={setTimes}
                  placeholder="No end"
                  placeholderTextColor={c.faint}
                  keyboardType="number-pad"
                  accessibilityLabel="How many payments"
                  style={{ color: c.ink, fontSize: 16, textAlign: "right", minWidth: 90, minHeight: 50 }}
                />
              </View>
            ) : null}
            <ToggleField
              label={sign > 0 ? "Wait until I confirm it arrived" : "Ask me before logging it"}
              value={wait}
              onChange={setWait}
              last
            />
          </Group>
        ) : null}

        {!editing && !planned ? (
          <Group footer="Adds a button above, so next time it's one tap.">
            <ToggleField label="Save as a quick-add button" value={asButton} onChange={setAsButton} last />
          </Group>
        ) : null}

        <ErrorText>{error}</ErrorText>

        <Button title={editing ? "Save" : sign > 0 ? "Add money in" : "Add spending"} onPress={save} disabled={cents == null} busy={busy} style={{ marginTop: 24 }} />

        {editingRule ? (
          <Button kind="secondary" icon={editingRule.active ? "pause" : "play"} title={editingRule.active ? "Pause" : "Resume"} onPress={togglePause} style={{ marginTop: 10 }} />
        ) : null}
        {editing ? (
          <Button kind="danger" icon="trash" title={editingRule ? (editingRule.once ? "Remove" : "Stop repeating") : "Delete"} onPress={remove} style={{ marginTop: 6 }} />
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  amountBox: { flexDirection: "row", alignItems: "center", marginTop: 14, borderRadius: 16, borderWidth: 1.5, paddingHorizontal: 16, minHeight: 84 },
  amountSign: { fontFamily: DISPLAY, fontSize: 34, fontWeight: "700", marginRight: 6 },
  amount: { flex: 1, fontFamily: DISPLAY, fontSize: 44, fontWeight: "800", fontVariant: ["tabular-nums"], paddingVertical: 8 },
  cat: { alignItems: "center", gap: 6, borderRadius: 14, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 6, width: 88 },
});
