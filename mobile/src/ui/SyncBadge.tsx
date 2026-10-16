import { Text, View } from "react-native";
import { usePocket, type State } from "../data/store";
import { useColors } from "./theme";

/** "Synced 3:04 PM" / "Offline · 2 waiting", shown while connected to a server. */
export function syncText(sync: State["sync"]): string {
  if (sync.state === "busy") return "Syncing…";
  if (sync.state === "offline") return sync.waiting ? `Offline · ${sync.waiting} waiting` : "Offline, retrying";
  if (sync.at) return `Synced ${new Date(sync.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  return "Connecting…";
}

export function SyncBadge() {
  const c = useColors();
  const sync = usePocket((s) => s.sync);
  const color = sync.state === "offline" ? c.warn : sync.state === "ok" ? c.pos : c.faint;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }} accessibilityLabel={syncText(sync)}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ color: c.muted, fontSize: 13 }}>{syncText(sync)}</Text>
    </View>
  );
}
