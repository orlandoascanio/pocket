import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { Platform, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { dayOf, isDay, localDate, relativeDay, type Day } from "../core/day";
import { Icon } from "./Icon";
import { DISPLAY, useColors } from "./theme";

/** The top of a sheet: Cancel, a title, and the main action. */
export function SheetHeader({ title, action, onAction, actionDisabled, busy }: {
  title: string; action?: string; onAction?: () => void; actionDisabled?: boolean; busy?: boolean;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: Platform.OS === "ios" ? 14 : insets.top + 10, borderColor: c.line }]}>
      <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" style={styles.headerSide}>
        <Text style={{ color: c.accent, fontSize: 17 }}>Cancel</Text>
      </Pressable>
      <Text style={[styles.headerTitle, { color: c.ink }]} accessibilityRole="header" numberOfLines={1}>{title}</Text>
      <View style={[styles.headerSide, { alignItems: "flex-end" }]}>
        {action ? (
          <Pressable onPress={onAction} disabled={actionDisabled || busy} hitSlop={10} accessibilityRole="button"
            accessibilityState={{ disabled: actionDisabled || busy }}>
            <Text style={{ color: actionDisabled || busy ? c.faint : c.accent, fontSize: 17, fontWeight: "700" }}>{busy ? "Saving…" : action}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/** A grouped list of settings-style rows. */
export function Group({ children, footer, title }: { children: ReactNode; footer?: string; title?: string }) {
  const c = useColors();
  return (
    <View style={{ marginTop: 22 }}>
      {title ? <Text style={[styles.groupTitle, { color: c.muted }]}>{title}</Text> : null}
      <View style={{ backgroundColor: c.surface, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line, overflow: "hidden" }}>
        {children}
      </View>
      {footer ? <Text style={[styles.footer, { color: c.muted }]}>{footer}</Text> : null}
    </View>
  );
}

export function Field({ label, children, last, onPress, icon, iconColor, accessibilityLabel }: {
  label: string; children?: ReactNode; last?: boolean; onPress?: () => void; icon?: string; iconColor?: string; accessibilityLabel?: string;
}) {
  const c = useColors();
  const content = (
    <>
      {icon ? <Icon name={icon} size={18} color={iconColor ?? c.muted} /> : null}
      <Text style={{ color: iconColor && !children ? iconColor : c.ink, fontSize: 16, flex: 1 }}>{label}</Text>
      {children}
      {!last ? <View style={[styles.fieldLine, { backgroundColor: c.line, left: icon ? 46 : 16 }]} /> : null}
    </>
  );
  // A row without an action is a plain view, so controls inside it (a switch, a date picker) get their touches.
  if (!onPress) return <View style={styles.field} accessibilityLabel={accessibilityLabel}>{content}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.field, { backgroundColor: pressed ? c.chip : "transparent" }]}
    >
      {content}
    </Pressable>
  );
}

export function ToggleField({ label, value, onChange, last }: { label: string; value: boolean; onChange: (v: boolean) => void; last?: boolean }) {
  const c = useColors();
  return (
    <Field label={label} last={last} onPress={() => onChange(!value)}>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: c.accent }} accessibilityLabel={label} />
    </Field>
  );
}

export function TextField(props: React.ComponentProps<typeof TextInput>) {
  const c = useColors();
  return (
    <TextInput
      placeholderTextColor={c.faint}
      {...props}
      style={[{ color: c.ink, fontSize: 16, paddingVertical: 12, paddingHorizontal: 16, minHeight: 50 }, props.style]}
    />
  );
}

/** Picks a day. Compact native picker on iOS, the system dialog on Android, a text field on web. */
export function DateField({ value, onChange, label = "Date", last, minimum }: {
  value: Day; onChange: (d: Day) => void; label?: string; last?: boolean; minimum?: Day;
}) {
  const c = useColors();
  if (Platform.OS === "ios") {
    return (
      <Field label={label} icon="calendar" last={last}>
        <DateTimePicker
          value={localDate(value)}
          mode="date"
          display="compact"
          accentColor={c.accent}
          minimumDate={minimum ? localDate(minimum) : undefined}
          onValueChange={(_, d) => onChange(dayOf(d))}
        />
      </Field>
    );
  }
  if (Platform.OS === "android") {
    return (
      <Field
        label={label}
        icon="calendar"
        last={last}
        accessibilityLabel={`${label}: ${relativeDay(value)}. Change`}
        onPress={() => DateTimePickerAndroid.open({
          value: localDate(value), mode: "date",
          minimumDate: minimum ? localDate(minimum) : undefined,
          onValueChange: (_, d) => onChange(dayOf(d)),
        })}
      >
        <Text style={{ color: c.accent, fontSize: 16 }}>{relativeDay(value)}</Text>
      </Field>
    );
  }
  return (
    <Field label={label} icon="calendar" last={last}>
      <TextInput
        defaultValue={value}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={c.faint}
        onChangeText={(t) => { if (isDay(t)) onChange(t); }}
        style={{ color: c.ink, fontSize: 16, textAlign: "right", minWidth: 120 }}
      />
    </Field>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  const c = useColors();
  if (!children) return null;
  return <Text style={{ color: c.neg, fontSize: 14, marginTop: 10, paddingHorizontal: 4 }} accessibilityLiveRegion="assertive">{children}</Text>;
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  headerSide: { width: 84 },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700", fontFamily: DISPLAY },
  groupTitle: { fontSize: 13, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 7, paddingHorizontal: 16 },
  footer: { fontSize: 13, lineHeight: 18, marginTop: 7, paddingHorizontal: 16 },
  field: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 50, paddingHorizontal: 16, paddingVertical: 6 },
  fieldLine: { position: "absolute", right: 0, bottom: 0, height: StyleSheet.hairlineWidth },
});
