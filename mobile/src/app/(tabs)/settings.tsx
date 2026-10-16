import Constants from "expo-constants";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { router } from "expo-router";
import * as Sharing from "expo-sharing";
import { useCallback, useEffect, useState } from "react";
import { Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CURRENCIES } from "../../core/money";
import { openSystemSettings, sendTestReminder, setRemindersEnabled, useReminders } from "../../data/reminders";
import { isDefaultServer, type Device } from "../../data/server";
import { store, usePocket } from "../../data/store";
import { Big, tap, useToast } from "../../ui/components";
import { Field, Group, ToggleField } from "../../ui/form";
import { Icon } from "../../ui/Icon";
import { SyncBadge } from "../../ui/SyncBadge";
import { DISPLAY, GUTTER, tint, useColors } from "../../ui/theme";

export default function Settings() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const s = usePocket();
  const toast = useToast();
  const [pickCurrency, setPickCurrency] = useState(false);

  const exportData = async () => {
    try {
      const f = await store.exportLedger();
      if (!(await Sharing.isAvailableAsync())) { toast({ text: "Sharing isn't available here." }); return; }
      await Sharing.shareAsync(f.uri, { mimeType: "application/json", dialogTitle: "Export Pocket data", UTI: "public.json" });
    } catch {
      toast({ text: "Couldn't export. Try again." });
    }
  };

  const importData = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: ["application/json", "public.json", "*/*"], copyToCacheDirectory: true });
    if (res.canceled) return;
    const asset = res.assets[0];
    let text: string;
    try {
      text = Platform.OS === "web" ? await (await fetch(asset.uri)).text() : await new File(asset.uri).text();
    } catch {
      Alert.alert("Couldn't read that file");
      return;
    }
    Alert.alert("Replace everything on this phone?", "Your current entries, plans and buttons are replaced by the file. Export first if you want to keep them.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Replace", style: "destructive",
        onPress: async () => {
          try {
            await store.importLedger(text);
            toast({ text: "Imported." });
          } catch (e) {
            Alert.alert("Couldn't import", e instanceof Error ? e.message : undefined);
          }
        },
      },
    ]);
  };

  const erase = () => {
    Alert.alert("Erase everything?", "Every entry, plan and button on this phone is deleted. This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Erase", style: "destructive", onPress: () => store.eraseEverything().catch(() => toast({ text: "Couldn't erase. Try again." })) },
    ]);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 110, paddingHorizontal: GUTTER }}
      keyboardShouldPersistTaps="handled"
    >
      <Big style={{ fontSize: 34, letterSpacing: -0.8 }}>Settings</Big>

      {s.mode === "server" ? <Connected /> : (
        <Group
          title="Sync"
          footer="Your money is saved only on this phone. Connect to use the same Pocket on your Mac and the web. On your Mac, open Settings → Sync and make a pairing code."
        >
          <Field label="On this phone only" icon="iphone" />
          <Field label="Connect to your Pocket" icon="link" iconColor={c.accent} onPress={() => router.push("/connect")} last />
        </Group>
      )}

      <Group title="Money" footer={s.mode === "server" ? "Changes how amounts are shown on this phone. It doesn't convert anything." : "Changing the currency doesn't convert amounts."}>
        <Field label="Currency" icon="banknote" onPress={() => setPickCurrency((v) => !v)} last={!pickCurrency}>
          <Text style={{ color: c.muted, fontSize: 16 }}>{s.currency}</Text>
          <Icon name={pickCurrency ? "chevron.down" : "chevron.right"} size={12} color={c.faint} />
        </Field>
        {pickCurrency ? (
          <View style={styles.currencies}>
            {CURRENCIES.map((code) => {
              const on = code === s.currency;
              return (
                <Pressable
                  key={code}
                  onPress={() => { tap(); void store.setCurrency(code); setPickCurrency(false); }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={[styles.currency, { backgroundColor: on ? tint(c.accent, 0.14) : c.chip, borderColor: on ? c.accent : "transparent" }]}
                >
                  <Text style={{ color: c.ink, fontWeight: on ? "700" : "500", fontSize: 14 }}>{code}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </Group>

      {Platform.OS !== "web" ? <Reminders /> : null}

      <Group title="Quick-add buttons" footer="One tap adds them from Overview. Long press a button there to come back here.">
        <Field label={s.presets.length ? `${s.presets.length} ${s.presets.length === 1 ? "button" : "buttons"}` : "No buttons yet"} icon="hand.tap" onPress={() => router.push("/buttons")} last>
          <Text style={{ color: c.accent, fontSize: 16 }}>Edit</Text>
        </Field>
      </Group>

      {s.mode === "local" ? (
        <Group title="Your data" footer="Exports a JSON file that Pocket for Mac can import too. Pocket keeps 7 daily backups on this phone.">
          <Field label="Export" icon="square.and.arrow.up" onPress={exportData} />
          <Field label="Import a file" icon="square.and.arrow.down" onPress={importData} />
          <Field label="Erase everything" icon="trash" iconColor={c.neg} onPress={erase} last />
        </Group>
      ) : null}

      <Group title="About">
        <Field label="Pocket" icon="questionmark.circle">
          <Text style={{ color: c.muted, fontSize: 16 }}>{Constants.expoConfig?.version ?? ""}</Text>
        </Field>
        <Field label="pocketleft.app" icon="link" onPress={() => Linking.openURL("https://pocketleft.app")} />
        <Field label="Star Pocket on GitHub" icon="star" onPress={() => Linking.openURL("https://github.com/orlandoascanio/pocket")} last />
      </Group>
      <Text style={{ color: c.faint, fontSize: 13, textAlign: "center", marginTop: 20, fontFamily: DISPLAY }}>Always know how much money you have left.</Text>
    </ScrollView>
  );
}

/** Payment reminders, like Pocket for Mac's. */
function Reminders() {
  const c = useColors();
  const toast = useToast();
  const r = useReminders();
  const change = async (on: boolean) => {
    if (!(await setRemindersEnabled(on))) toast({ text: "Notifications are off for Pocket. Turn them on in the Settings app." });
  };
  const test = async () => {
    if (await sendTestReminder()) toast({ text: "A test reminder arrives in 5 seconds." });
    else toast({ text: "Notifications are off for Pocket. Turn them on in the Settings app." });
  };
  return (
    <Group
      title="Reminders"
      footer="At 10 AM on the day money you said you'd confirm is due, like an invoice or a paycheck, Pocket asks whether it arrived."
    >
      <ToggleField label="Remind me when a payment I'm waiting for is due" value={r.enabled} onChange={(on) => void change(on)} last={!r.enabled && !r.blocked} />
      {r.blocked ? (
        <Field label="Notifications are off for Pocket" icon="exclamationmark.triangle" iconColor={c.warn} onPress={openSystemSettings} last={!r.enabled}>
          <Text style={{ color: c.accent, fontSize: 16 }}>Settings</Text>
        </Field>
      ) : null}
      {r.enabled ? <Field label="Send a test reminder" icon="clock" iconColor={c.accent} onPress={() => void test()} last /> : null}
    </Group>
  );
}

/** Connected to a server: status, pairing more devices, the device list, and disconnecting. */
function Connected() {
  const c = useColors();
  const server = usePocket((s) => s.server);
  const toast = useToast();
  const [code, setCode] = useState<{ code: string; expires: number } | null>(null);
  const [left, setLeft] = useState(0);
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [busy, setBusy] = useState(false);

  const loadDevices = useCallback(async () => {
    try {
      const d = await store.devices();
      setDevices(d.devices);
      return d.devices;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    store.devices().then((d) => setDevices(d.devices), () => {});
  }, []);

  // Count down the pairing code, and notice when a new device used it.
  useEffect(() => {
    if (!code) return;
    const count = devices?.length ?? 0;
    const tick = setInterval(() => {
      const l = Math.max(0, Math.round((code.expires - Date.now()) / 1000));
      setLeft(l);
      if (l === 0) clearInterval(tick);
    }, 1000);
    const watch = setInterval(async () => {
      const d = await loadDevices();
      if (d && d.length > count) {
        setCode(null);
        toast({ text: "Paired! The new device is ready." });
      }
    }, 3000);
    return () => { clearInterval(tick); clearInterval(watch); };
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  const pair = async () => {
    setBusy(true);
    try {
      const r = await store.startPairing();
      const expires = new Date(r.expires_at).getTime();
      setCode({ code: r.code, expires });
      setLeft(Math.round((expires - Date.now()) / 1000));
    } catch {
      toast({ text: "Couldn't make a code. Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  };

  const remove = (d: Device) => {
    Alert.alert(
      d.this ? "Remove this phone?" : `Remove ${d.name}?`,
      d.this ? "It stops syncing right away, and you'll need a new pairing code to get back in." : "It's locked out right away. You can pair it again later with a new code.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove", style: "destructive",
          onPress: async () => {
            try {
              await store.removeDevice(d.id);
              if (d.this) await store.disconnect(); else await loadDevices();
            } catch {
              toast({ text: "Couldn't remove it. Try again." });
            }
          },
        },
      ],
    );
  };

  const disconnect = () => {
    Alert.alert("Stop syncing on this phone?", "Your money stays on the server, so your Mac and other devices keep it. This phone goes back to its own data.", [
      { text: "Cancel", style: "cancel" },
      { text: "Disconnect", style: "destructive", onPress: () => void store.disconnect() },
    ]);
  };

  const host = isDefaultServer(server) ? "The Pocket server" : new URL(server.url).host;

  return (
    <>
      <Group title="Sync" footer="The server keeps the main copy. Entries you add offline wait on this phone and sync when you're back online.">
        <Field label={host} icon="icloud">
          <SyncBadge />
        </Field>
        <Field label="Sync now" icon="arrow.triangle.2.circlepath" iconColor={c.accent} onPress={() => void store.refresh()} last />
      </Group>

      <Group title="Devices" footer={code ? undefined : "Pair another phone or computer with a 6-digit code."}>
        {code ? (
          <View style={{ padding: 16, alignItems: "center", gap: 6 }}>
            <Text style={{ color: c.muted, fontSize: 14 }}>{left > 0 ? "Pairing code" : "Expired"}</Text>
            <Text selectable style={{ color: left > 0 ? c.ink : c.faint, fontSize: 40, fontWeight: "800", fontFamily: DISPLAY, letterSpacing: 4, fontVariant: ["tabular-nums"] }}>
              {code.code.slice(0, 3)} {code.code.slice(3)}
            </Text>
            <Text style={{ color: c.muted, fontSize: 13, textAlign: "center", lineHeight: 18 }}>
              {left > 0
                ? `On the new device, open Pocket (or ${isDefaultServer(server) ? "pocketleft.app/app" : "Pocket set to " + host}) and type this code. Expires in ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}.`
                : "Make a new code when you're ready."}
            </Text>
          </View>
        ) : null}
        <Field label={busy ? "Making a code…" : code ? "Make a new code" : "Pair a new device"} icon="plus" iconColor={c.accent} onPress={busy ? undefined : pair} last={!devices?.length} />
        {devices?.map((d, i) => (
          <Field key={d.id} label={d.this ? `${d.name} (this phone)` : d.name} icon={/iphone|android|phone|ipad/i.test(d.name) ? "iphone" : "laptopcomputer"} last={i === devices.length - 1}>
            <Pressable onPress={() => remove(d)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove ${d.name}`}>
              <Text style={{ color: c.neg, fontSize: 15 }}>Remove</Text>
            </Pressable>
          </Field>
        ))}
      </Group>

      <Group>
        <Field label="Disconnect this phone" icon="xmark" iconColor={c.neg} onPress={disconnect} last />
      </Group>
    </>
  );
}

const styles = StyleSheet.create({
  currencies: { flexDirection: "row", flexWrap: "wrap", gap: 6, padding: 12, paddingTop: 4 },
  currency: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7, minWidth: 54, alignItems: "center" },
});
