import { Redirect } from "expo-router";
import { NativeTabs } from "expo-router/native-tabs";
import { waiting } from "../../core/engine";
import { usePocket } from "../../data/store";
import { useColors } from "../../ui/theme";

export default function TabLayout() {
  const c = useColors();
  const waitingCount = usePocket((s) => waiting(s.upcoming, s.today).length);
  const onboarded = usePocket((s) => s.onboarded);
  if (!onboarded) return <Redirect href="/welcome" />;
  return (
    <NativeTabs tintColor={c.accent} minimizeBehavior="onScrollDown">
      <NativeTabs.Trigger name="index" disableAutomaticContentInsets>
        <NativeTabs.Trigger.Label>Overview</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "house", selected: "house.fill" }} md="home" />
        {waitingCount > 0 ? <NativeTabs.Trigger.Badge>{String(waitingCount)}</NativeTabs.Trigger.Badge> : null}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="plan" disableAutomaticContentInsets>
        <NativeTabs.Trigger.Label>Plan</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="chart.xyaxis.line" md="show_chart" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="categories" disableAutomaticContentInsets>
        <NativeTabs.Trigger.Label>Categories</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "chart.bar", selected: "chart.bar.fill" }} md="bar_chart" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings" disableAutomaticContentInsets>
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "gearshape", selected: "gearshape.fill" }} md="settings" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
