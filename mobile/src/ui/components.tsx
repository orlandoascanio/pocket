import * as Haptics from "expo-haptics";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator, Animated, Platform, Pressable, StyleSheet, Text, View,
  type PressableProps, type StyleProp, type TextStyle, type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { categoryHue, categorySymbol } from "../core/categories";
import { Icon } from "./Icon";
import { DISPLAY, radius, tint, useColors } from "./theme";

export const tap = () => { if (Platform.OS !== "web") void Haptics.selectionAsync(); };

/** A category glyph on a tile of its own hue. */
export function CategoryIcon({ category, cents, size = 36, symbol, dimmed }: {
  category?: string; cents: number; size?: number; symbol?: string; dimmed?: boolean;
}) {
  const c = useColors();
  const color = c.hues[categoryHue(category, cents)];
  return (
    <View style={{
      width: size, height: size, borderRadius: size * 0.28, alignItems: "center", justifyContent: "center",
      backgroundColor: tint(color, 0.14), opacity: dimmed ? 0.55 : 1,
    }}>
      <Icon name={symbol ?? categorySymbol(category, cents)} size={size * 0.48} color={color} />
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return (
    <View style={[{ backgroundColor: c.surface, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line, overflow: "hidden" }, style]}>
      {children}
    </View>
  );
}

export function SectionTitle({ title, meta, onMeta }: { title: string; meta?: string; onMeta?: () => void }) {
  const c = useColors();
  return (
    <View style={styles.sectionTitle}>
      <Text style={[styles.sectionText, { color: c.ink }]} accessibilityRole="header">{title}</Text>
      {meta ? (
        <Pressable onPress={onMeta} disabled={!onMeta} hitSlop={8}>
          <Text style={{ color: onMeta ? c.accent : c.muted, fontSize: 14, fontWeight: onMeta ? "600" : "400" }}>{meta}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** A row in History, Coming up or Repeating. */
export function MoneyRow({
  category, cents, symbol, title, tag, note, amount, amountColor, rightNote, rightNoteColor, onPress, dimmed, trailing, last, accessibilityHint,
}: {
  category?: string; cents: number; symbol?: string; title: string; tag?: string; note?: string; amount: string; amountColor?: string;
  rightNote?: string; rightNoteColor?: string; onPress?: () => void; dimmed?: boolean; trailing?: ReactNode; last?: boolean;
  accessibilityHint?: string;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={`${title}, ${amount}${note ? ", " + note : ""}${rightNote ? ", " + rightNote : ""}`}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? c.chip : "transparent" }]}
    >
      <CategoryIcon category={category} cents={cents} symbol={symbol} dimmed={dimmed} />
      <View style={[styles.rowMid, { opacity: dimmed ? 0.55 : 1 }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={[styles.rowTitle, { color: c.ink }]} numberOfLines={1}>{title}</Text>
          {tag ? (
            <View style={[styles.tag, { borderColor: c.line }]}>
              <Text style={{ color: c.muted, fontSize: 11, fontWeight: "600" }}>{tag}</Text>
            </View>
          ) : null}
        </View>
        {note ? <Text style={[styles.rowNote, { color: c.muted }]} numberOfLines={1}>{note}</Text> : null}
      </View>
      <View style={{ alignItems: "flex-end", opacity: dimmed ? 0.55 : 1 }}>
        <Text style={[styles.rowAmount, { color: amountColor ?? c.ink }]}>{amount}</Text>
        {rightNote ? <Text style={[styles.rowNote, { color: rightNoteColor ?? c.muted }]}>{rightNote}</Text> : null}
      </View>
      {trailing}
      {!last ? <View style={[styles.divider, { backgroundColor: c.line }]} /> : null}
    </Pressable>
  );
}

export function Button({ title, onPress, kind = "primary", icon, disabled, busy, style, small }: {
  title: string; onPress: () => void; kind?: "primary" | "secondary" | "plain" | "danger"; icon?: string;
  disabled?: boolean; busy?: boolean; style?: StyleProp<ViewStyle>; small?: boolean;
}) {
  const c = useColors();
  const bg = kind === "primary" ? c.accent : kind === "secondary" ? c.chip : "transparent";
  const fg = kind === "primary" ? c.accentInk : kind === "danger" ? c.neg : kind === "plain" ? c.accent : c.ink;
  return (
    <Pressable
      onPress={() => { tap(); onPress(); }}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy, busy }}
      style={({ pressed }) => [
        styles.button, small && styles.buttonSmall,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        style,
      ]}
    >
      {busy ? <ActivityIndicator color={fg} /> : (
        <>
          {icon ? <Icon name={icon} size={small ? 14 : 17} color={fg} weight="semibold" /> : null}
          <Text style={[styles.buttonText, small && { fontSize: 14 }, { color: fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Chip({ label, detail, onPress, onLongPress, icon, iconColor, selected, disabled, ...rest }: {
  label: string; detail?: string; onPress: () => void; onLongPress?: () => void; icon?: string; iconColor?: string;
  selected?: boolean; disabled?: boolean;
} & Pick<PressableProps, "accessibilityHint">) {
  const c = useColors();
  return (
    <Pressable
      onPress={() => { tap(); onPress(); }}
      onLongPress={onLongPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      {...rest}
      style={({ pressed }) => [styles.chip, {
        backgroundColor: selected ? tint(c.accent, 0.14) : c.surface,
        borderColor: selected ? c.accent : c.line,
        opacity: disabled ? 0.5 : 1,
        transform: [{ scale: pressed ? 0.96 : 1 }],
      }]}
    >
      {icon ? <Icon name={icon} size={15} color={iconColor ?? c.muted} /> : null}
      <Text style={{ color: c.ink, fontWeight: "600", fontSize: 15 }}>{label}</Text>
      {detail ? <Text style={{ color: c.muted, fontSize: 15, fontVariant: ["tabular-nums"] }}>{detail}</Text> : null}
    </Pressable>
  );
}

export function Segmented<T extends string | number>({ options, value, onChange, style }: {
  options: { value: T; label: string; icon?: string }[]; value: T; onChange: (v: T) => void; style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  return (
    <View style={[styles.seg, { backgroundColor: c.chip }, style]} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => { if (!on) { tap(); onChange(o.value); } }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[styles.segItem, on && { backgroundColor: c.surface, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 }]}
          >
            {o.icon ? <Icon name={o.icon} size={14} color={on ? c.ink : c.muted} weight="semibold" /> : null}
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ color: on ? c.ink : c.muted, fontWeight: "600", fontSize: 14 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Big({ children, style, ...rest }: { children: ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number; adjustsFontSizeToFit?: boolean }) {
  const c = useColors();
  return <Text {...rest} style={[{ fontFamily: DISPLAY, fontWeight: "800", color: c.ink, fontVariant: ["tabular-nums"] }, style]}>{children}</Text>;
}

export function Empty({ title, body, icon }: { title: string; body?: string; icon?: string }) {
  const c = useColors();
  return (
    <View style={{ alignItems: "center", paddingVertical: 28, paddingHorizontal: 24, gap: 6 }}>
      {icon ? <Icon name={icon} size={26} color={c.faint} /> : null}
      <Text style={{ color: c.ink, fontWeight: "600", fontSize: 16, textAlign: "center" }}>{title}</Text>
      {body ? <Text style={{ color: c.muted, fontSize: 14, textAlign: "center", lineHeight: 20 }}>{body}</Text> : null}
    </View>
  );
}

// ---------- toast ----------

interface ToastMsg { text: string; action?: { label: string; run: () => void } }
const ToastContext = createContext<(t: ToastMsg) => void>(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastHost({ children }: { children: ReactNode }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [msg, setMsg] = useState<ToastMsg | null>(null);
  const [anim] = useState(() => new Animated.Value(0));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => setMsg(null));
  }, [anim]);

  const show = useCallback((t: ToastMsg) => {
    if (timer.current) clearTimeout(timer.current);
    setMsg(t);
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, damping: 18, stiffness: 220 }).start();
    timer.current = setTimeout(hide, 5200);
  }, [anim, hide]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {msg ? (
        <Animated.View
          accessibilityLiveRegion="polite"
          style={[styles.toast, {
            bottom: insets.bottom + 92, backgroundColor: c.ink,
            opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
          }]}
        >
          <Text style={{ color: c.bg, flex: 1, fontSize: 15 }}>{msg.text}</Text>
          {msg.action ? (
            <Pressable onPress={() => { msg.action!.run(); hide(); }} hitSlop={10} accessibilityRole="button">
              <Text style={{ color: c.bg, fontWeight: "700", fontSize: 15 }}>{msg.action.label}</Text>
            </Pressable>
          ) : null}
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingHorizontal: 4, marginTop: 28, marginBottom: 10 },
  sectionText: { fontSize: 21, fontWeight: "700", fontFamily: DISPLAY },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 11, minHeight: 60 },
  rowMid: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, fontWeight: "500", flexShrink: 1 },
  rowNote: { fontSize: 13 },
  rowAmount: { fontSize: 16, fontWeight: "700", fontFamily: DISPLAY, fontVariant: ["tabular-nums"] },
  tag: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1 },
  divider: { position: "absolute", left: 62, right: 0, bottom: 0, height: StyleSheet.hairlineWidth },
  button: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 50, borderRadius: 14, paddingHorizontal: 18 },
  buttonSmall: { minHeight: 34, borderRadius: 10, paddingHorizontal: 12 },
  buttonText: { fontSize: 17, fontWeight: "600", textAlign: "center", flexShrink: 1 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.chip, paddingHorizontal: 14, minHeight: 40 },
  seg: { flexDirection: "row", borderRadius: 11, padding: 3 },
  segItem: { flex: 1, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", minHeight: 34, borderRadius: 8, paddingHorizontal: 4 },
  toast: {
    position: "absolute", left: 16, right: 16, flexDirection: "row", alignItems: "center", gap: 14,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 6,
  },
});
