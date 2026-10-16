import { useMemo, useState } from "react";
import { Platform, StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from "react-native-svg";
import { addMonths, daysBetween, localDate, shortDay, weekdayDay, yearMonth } from "../core/day";
import type { Projection } from "../core/engine";
import type { Money } from "../core/money";
import { tap } from "./components";
import { tint, useColors } from "./theme";

function niceTicks(lo: number, hi: number, n: number): number[] {
  if (hi - lo < 100) { lo -= 1000; hi += 1000; }
  const raw = (hi - lo) / (n - 1);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  const out: number[] = [];
  for (let v = Math.floor(lo / step) * step; v <= Math.ceil(hi / step) * step + step / 2; v += step) out.push(Math.round(v));
  return out;
}

const monthTick = new Intl.DateTimeFormat(undefined, { month: "short" });

/** Step chart of the projected balance: it only changes when a payment lands. Drag to read any point. */
export function ForecastChart({ p, money, range }: { p: Projection; money: Money; range: number }) {
  const c = useColors();
  const [W, setW] = useState(0);
  const H = 210;
  const m = { l: 52, r: 14, t: 18, b: 26 };
  const [sel, setSel] = useState<number | null>(null);

  const geo = useMemo(() => {
    if (!W) return null;
    const span = Math.max(1, daysBetween(p.today, p.end));
    const X = (d: string) => m.l + (daysBetween(p.today, d) / span) * (W - m.l - m.r);
    const vals = p.points.map((q) => q.balance).concat(0);
    const ticks = niceTicks(Math.min(...vals), Math.max(...vals), 4);
    const lo = ticks[0], hi = ticks[ticks.length - 1];
    const Y = (v: number) => m.t + ((hi - v) / (hi - lo)) * (H - m.t - m.b);
    let d = `M${X(p.points[0].day)},${Y(p.points[0].balance)}`;
    for (let i = 1; i < p.points.length; i++) d += `H${X(p.points[i].day)}V${Y(p.points[i].balance)}`;
    d += `H${X(p.end)}`;
    const wash = `${d}V${Y(Math.max(lo, 0))}H${X(p.today)}Z`;
    const xs: { day: string; text: string; anchor: "start" | "middle" | "end" }[] = [{ day: p.today, text: "Today", anchor: "start" }];
    if (range >= 91) {
      let mth = addMonths(yearMonth(p.today) + "-01", 1);
      while (mth < p.end) {
        const x = X(mth);
        if (x - X(p.today) > 48 && X(p.end) - x > 48) xs.push({ day: mth, text: monthTick.format(localDate(mth)), anchor: "middle" });
        mth = addMonths(mth, range >= 365 ? 2 : 1);
      }
    }
    xs.push({ day: p.end, text: shortDay(p.end), anchor: "end" });
    return { X, Y, ticks, lo, d, wash, xs };
  }, [W, p, range]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (x: number) => {
    if (!geo) return;
    let best = 0;
    p.points.forEach((q, i) => { if (Math.abs(geo.X(q.day) - x) < Math.abs(geo.X(p.points[best].day) - x)) best = i; });
    if (best !== sel) tap();
    setSel(best);
  };

  // Drag across the chart to read it; a vertical drag still scrolls the page.
  const touch = {
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => true,
    onResponderTerminationRequest: () => sel == null,
    onResponderGrant: (e: GestureResponderEvent) => pick(e.nativeEvent.locationX),
    onResponderMove: (e: GestureResponderEvent) => pick(e.nativeEvent.locationX),
    onResponderRelease: () => setSel(null),
    onResponderTerminate: () => setSel(null),
  };

  const q = sel != null ? p.points[sel] : null;
  const label = `Projected balance until ${weekdayDay(p.end)}, ending at ${money.string(p.endBalance)}.` +
    (p.lowBalance < p.start ? ` Lowest ${money.string(p.lowBalance)} on ${shortDay(p.lowDay)}.` : "");

  return (
    <View>
      <View style={styles.readout}>
        {q ? (
          <>
            <Text style={{ color: q.balance < 0 ? c.neg : c.ink, fontWeight: "700", fontSize: 15, fontVariant: ["tabular-nums"] }}>
              {money.string(q.balance)}
            </Text>
            <Text style={{ color: c.muted, fontSize: 14 }} numberOfLines={1}>
              {sel === 0 ? "Today" : weekdayDay(q.day)}
              {q.events.length ? " · " + q.events.map((e) => `${e.label} ${money.string(e.cents, true)}`).join(", ") : ""}
            </Text>
          </>
        ) : (
          <Text style={{ color: c.faint, fontSize: 14 }}>{Platform.OS === "web" ? "Drag across the chart to read it" : "Touch and drag to read the chart"}</Text>
        )}
      </View>
      <View
        onLayout={(e: LayoutChangeEvent) => setW(Math.round(e.nativeEvent.layout.width))}
        style={{ height: H }}
        accessible
        accessibilityRole="image"
        accessibilityLabel={label}
        {...touch}
      >
        {geo ? (
          <Svg width={W} height={H} pointerEvents="none">
            {geo.lo < 0 ? (
              <Rect x={m.l} y={geo.Y(0)} width={W - m.l - m.r} height={geo.Y(geo.lo) - geo.Y(0)} fill={tint(c.neg, 0.07)} />
            ) : null}
            {geo.ticks.map((t) => (
              <Line key={"g" + t} x1={m.l} x2={W - m.r} y1={geo.Y(t)} y2={geo.Y(t)}
                stroke={t === 0 ? c.muted : c.line} strokeWidth={t === 0 ? 1 : StyleSheet.hairlineWidth} strokeDasharray={t === 0 ? "3 3" : undefined} />
            ))}
            {geo.ticks.map((t) => (
              <SvgText key={"t" + t} x={m.l - 8} y={geo.Y(t) + 4} fontSize={11} fill={c.muted} textAnchor="end">{money.compact(t)}</SvgText>
            ))}
            {geo.xs.map((x) => (
              <SvgText key={"x" + x.day} x={geo.X(x.day)} y={H - 6} fontSize={11} fill={c.muted} textAnchor={x.anchor}>{x.text}</SvgText>
            ))}
            <Path d={geo.wash} fill={tint(c.accent, 0.1)} />
            <Path d={geo.d} fill="none" stroke={c.accent} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
            {p.points.length <= 80 ? p.points.slice(1).map((pt) => (
              <Circle key={pt.day} cx={geo.X(pt.day)} cy={geo.Y(pt.balance)} r={3.5} fill={pt.balance < 0 ? c.neg : c.accent} />
            )) : null}
            {q ? (
              <>
                <Line x1={geo.X(q.day)} x2={geo.X(q.day)} y1={m.t} y2={H - m.b} stroke={c.muted} strokeWidth={1} />
                <Circle cx={geo.X(q.day)} cy={geo.Y(q.balance)} r={6} fill={c.surface} stroke={q.balance < 0 ? c.neg : c.accent} strokeWidth={2.5} />
              </>
            ) : null}
          </Svg>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  readout: { minHeight: 40, justifyContent: "center", paddingHorizontal: 4, marginBottom: 2 },
});
