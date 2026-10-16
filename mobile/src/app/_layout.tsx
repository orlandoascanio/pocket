import * as Notifications from "expo-notifications";
import { Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";
import { AppState } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { startReminders } from "../data/reminders";
import { store, usePocket } from "../data/store";
import { ToastHost } from "../ui/components";
import { useColors, useIsDark } from "../ui/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const c = useColors();
  const dark = useIsDark();
  const ready = usePocket((s) => s.ready);

  useEffect(() => {
    void store.load();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void store.wake();
      else store.sleep();
    });
    return () => sub.remove();
  }, []);

  // Payment reminders: keep the schedule current, and open "Got it" when one is tapped.
  useEffect(() => {
    if (!ready) return;
    let stop = () => {};
    void startReminders().then((fn) => { stop = fn; });
    const open = (n: Notifications.Notification) => {
      const url = n.request.content.data?.url;
      if (typeof url === "string" && url.startsWith("/")) {
        router.push(url as Parameters<typeof router.push>[0]);
        Notifications.clearLastNotificationResponse();
      }
    };
    const launched = Notifications.getLastNotificationResponse();
    if (launched?.notification) open(launched.notification);
    const sub = Notifications.addNotificationResponseReceivedListener((res) => open(res.notification));
    return () => { stop(); sub.remove(); };
  }, [ready]);

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(c.bg);
  }, [c.bg]);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  const sheet = {
    presentation: "modal" as const,
    headerShown: false,
    contentStyle: { backgroundColor: c.bg },
  };

  return (
    <SafeAreaProvider>
      <ToastHost>
        <StatusBar style={dark ? "light" : "dark"} />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="welcome" options={{ animation: "fade" }} />
          <Stack.Screen name="entry" options={sheet} />
          <Stack.Screen name="settle" options={sheet} />
          <Stack.Screen name="buttons" options={sheet} />
          <Stack.Screen name="category" options={sheet} />
          <Stack.Screen name="connect" options={sheet} />
        </Stack>
      </ToastHost>
    </SafeAreaProvider>
  );
}
