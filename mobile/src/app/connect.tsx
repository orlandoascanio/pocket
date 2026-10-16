import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState, type ComponentRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { line } from "../core/lines";
import { DEFAULT_SERVER, cleanServer, isDefaultServer } from "../data/server";
import { store, usePocket } from "../data/store";
import { Button, useToast } from "../ui/components";
import { ErrorText, Group, SheetHeader, TextField } from "../ui/form";
import { Icon } from "../ui/Icon";
import { PocketCharacter } from "../ui/PocketCharacter";
import { DISPLAY, useColors } from "../ui/theme";

/**
 * Join a Pocket that already exists (on a Mac or the web) with a 6-digit pairing code.
 * A link like pocket://connect?server=…&apikey=…&code=… fills everything in.
 */
export default function Connect() {
  const params = useLocalSearchParams<{ server?: string; apikey?: string; code?: string }>();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const current = usePocket((s) => s.server);
  const hasLocal = usePocket((s) => s.mode === "local" && (s.entries.length > 0 || s.rules.length > 0));
  const linked = params.server ? cleanServer(params.server, params.apikey ?? "") : null;
  const start = linked ?? current;
  const [code, setCode] = useState(formatCode(params.code ?? ""));
  const [own, setOwn] = useState(!isDefaultServer(start));
  const [url, setUrl] = useState(isDefaultServer(start) ? "" : start.url);
  const [key, setKey] = useState(isDefaultServer(start) ? "" : start.key);
  const [useKey, setUseKey] = useState(false);
  const [accessKey, setAccessKey] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const codeRef = useRef<ComponentRef<typeof TextInput>>(null);

  useEffect(() => { if (!params.code) setTimeout(() => codeRef.current?.focus(), 400); }, [params.code]);

  const go = async () => {
    setError("");
    const server = own ? cleanServer(url, key) : DEFAULT_SERVER;
    if (!server) { setError("Check the server address and its publishable key."); return; }
    setBusy(true);
    const res = useKey ? await store.connectWithKey(server, accessKey) : await store.pair(server, code);
    setBusy(false);
    if (res.error) { setError(res.error); return; }
    toast({ text: line("paired") + " This phone is synced." });
    router.dismissAll();
    router.replace("/");
  };

  const ready = useKey ? accessKey.trim().length >= 16 : code.replace(/\D/g, "").length === 6;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <SheetHeader title="Connect" action={useKey ? "Connect" : "Pair"} onAction={go} actionDisabled={!ready} busy={busy} />
      <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }}>
        <View style={{ alignItems: "center", marginTop: 8 }}>
          <PocketCharacter size={84} sleeping={busy} interactive={false} />
          <Text style={[styles.title, { color: c.ink }]}>Use Pocket everywhere</Text>
          <Text style={[styles.body, { color: c.muted }]}>
            On your Mac, open Pocket’s Settings → Sync and choose Pair a new device. On the web, open Settings at pocketleft.app/app. Then type the code here.
          </Text>
        </View>

        {!useKey ? (
          <TextInput
            ref={codeRef}
            value={code}
            onChangeText={(t) => { setCode(formatCode(t)); setError(""); }}
            placeholder="000 000"
            placeholderTextColor={c.faint}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={7}
            accessibilityLabel="6-digit pairing code"
            onSubmitEditing={() => ready && go()}
            style={[styles.code, { color: c.ink, backgroundColor: c.surface, borderColor: ready ? c.accent : c.line }]}
          />
        ) : (
          <Group footer="The secret key from your own server's setup, or a device token. It's stored in this phone's keychain.">
            <TextField value={accessKey} onChangeText={setAccessKey} placeholder="Access key" autoCapitalize="none" autoCorrect={false} secureTextEntry />
          </Group>
        )}

        <ErrorText>{error}</ErrorText>

        <Button title={useKey ? "Connect" : "Pair this phone"} onPress={go} disabled={!ready} busy={busy} style={{ marginTop: 20 }} />

        {hasLocal ? (
          <Text style={[styles.note, { color: c.muted }]}>
            The money already on this phone stays saved here. While connected, Pocket shows your synced Pocket instead; disconnect any time to come back to it.
          </Text>
        ) : null}

        <Pressable onPress={() => setOwn((v) => !v)} style={styles.toggle} accessibilityRole="button" accessibilityState={{ expanded: own }}>
          <Icon name={own ? "chevron.down" : "chevron.right"} size={12} color={c.muted} />
          <Text style={{ color: c.muted, fontSize: 15 }}>{own ? "Using your own server" : "Use your own server"}</Text>
        </Pressable>
        {own ? (
          <Group footer="A Supabase project running Pocket's SQL. See SELF-HOSTING.md in the Pocket repository.">
            <TextField value={url} onChangeText={setUrl} placeholder="https://your-project.supabase.co" autoCapitalize="none" autoCorrect={false} keyboardType="url" />
            <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.line, marginLeft: 16 }} />
            <TextField value={key} onChangeText={setKey} placeholder="Publishable key" autoCapitalize="none" autoCorrect={false} />
          </Group>
        ) : null}
        <Pressable onPress={() => { setUseKey((v) => !v); setError(""); }} style={styles.toggle} accessibilityRole="button">
          <Icon name="lock" size={13} color={c.muted} />
          <Text style={{ color: c.muted, fontSize: 15 }}>{useKey ? "Use a pairing code instead" : "Use an access key instead"}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function formatCode(t: string) {
  const d = t.replace(/\D/g, "").slice(0, 6);
  return d.length > 3 ? `${d.slice(0, 3)} ${d.slice(3)}` : d;
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: "800", fontFamily: DISPLAY, marginTop: 16, textAlign: "center" },
  body: { fontSize: 15, lineHeight: 21, textAlign: "center", marginTop: 8, paddingHorizontal: 8 },
  code: {
    marginTop: 24, borderRadius: 16, borderWidth: 1.5, textAlign: "center", fontSize: 40, fontWeight: "800",
    fontFamily: DISPLAY, letterSpacing: 6, paddingVertical: 14, fontVariant: ["tabular-nums"],
  },
  note: { fontSize: 13, lineHeight: 18, marginTop: 14, textAlign: "center", paddingHorizontal: 8 },
  toggle: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 22, paddingHorizontal: 4, minHeight: 32 },
});
