import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop, Text as SvgText } from "react-native-svg";
import { line, lineForChange } from "../core/lines";
import { store, useMoney, type Change } from "../data/store";
import { DISPLAY, useColors } from "./theme";

// The pocket-and-coin character from the app icon, drawn the same way as on the web and the Mac.
export type Face = "happy" | "worried" | "joy" | "oof" | "hope" | "sleep";

const INK = "#3b2a1a";
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);

function Front({ face, blink }: { face: Face; blink: boolean }) {
  const show = (parts: Face[]) => (parts.includes(face) ? 1 : 0);
  const eyesOpen = !blink;
  return (
    <Svg viewBox="0 0 560 430" width="100%" height="100%">
      <Defs>
        <LinearGradient id="pkShade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#fffdf7" />
          <Stop offset="1" stopColor="#ebe0c8" />
        </LinearGradient>
      </Defs>
      <Path d="M0 0H560V256Q560 292 528 308L308 416Q280 430 252 416L32 308Q0 292 0 256Z" fill="url(#pkShade)" />
      <Rect width="560" height="14" fill="#000" opacity={0.08} />
      <Path d="M42 48H518V242Q518 268 495 280L294 378Q280 385 266 378L65 280Q42 268 42 242Z" fill="none" stroke="#cdb68c" strokeWidth={10} strokeDasharray="26 18" strokeLinecap="round" />
      <Ellipse cx="160" cy="236" rx="32" ry="16" fill="#f4a6a0" opacity={0.55} />
      <Ellipse cx="400" cy="236" rx="32" ry="16" fill="#f4a6a0" opacity={0.55} />
      <G opacity={show(["worried"])} stroke={INK} strokeWidth={12} strokeLinecap="round">
        <Path d="M178 136 232 116" /><Path d="M382 136 328 116" />
      </G>
      {eyesOpen ? (
        <>
          <G opacity={show(["happy", "worried"])} fill={INK}>
            <Circle cx="210" cy="172" r="25" /><Circle cx="350" cy="172" r="25" />
            <Circle cx="219" cy="163" r="8" fill="#fff" /><Circle cx="359" cy="163" r="8" fill="#fff" />
          </G>
          <G opacity={show(["joy"])} fill="none" stroke={INK} strokeWidth={13} strokeLinecap="round">
            <Path d="M184 184Q210 148 236 184" /><Path d="M324 184Q350 148 376 184" />
          </G>
          <G opacity={show(["oof"])} fill="none" stroke={INK} strokeWidth={13} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M190 152 230 172 190 192" /><Path d="M370 152 330 172 370 192" />
          </G>
          <G opacity={show(["hope"])} fill={INK}>
            <Path d="M210 138Q216 166 244 172Q216 178 210 206Q204 178 176 172Q204 166 210 138Z" />
            <Path d="M350 138Q356 166 384 172Q356 178 350 206Q344 178 316 172Q344 166 350 138Z" />
          </G>
        </>
      ) : null}
      <G opacity={blink || face === "sleep" ? 1 : 0} fill="none" stroke={INK} strokeWidth={12} strokeLinecap="round">
        <Path d="M186 170Q210 192 234 170" /><Path d="M326 170Q350 192 374 170" />
      </G>
      <Path opacity={show(["happy", "hope"])} d="M248 234Q280 266 312 234" fill="none" stroke={INK} strokeWidth={12} strokeLinecap="round" />
      <G opacity={show(["joy"])}>
        <Path d="M238 228Q280 232 322 228Q318 284 280 286Q242 284 238 228Z" fill={INK} />
        <Path d="M256 266Q280 250 304 266Q298 284 280 285Q262 284 256 266Z" fill="#f07c7c" />
      </G>
      <Path opacity={show(["worried"])} d="M244 254Q262 236 280 254Q298 272 316 254" fill="none" stroke={INK} strokeWidth={12} strokeLinecap="round" />
      <Ellipse opacity={show(["oof"])} cx="280" cy="252" rx="17" ry="21" fill={INK} />
      <Path opacity={show(["sleep"])} d="M264 248Q280 258 296 248" fill="none" stroke={INK} strokeWidth={11} strokeLinecap="round" />
      <Path opacity={show(["worried"])} d="M446 92Q466 124 459 140Q452 156 437 152Q422 146 428 128Q434 110 446 92Z" fill="#8fd0f5" />
    </Svg>
  );
}

export function Coin({ size, symbol = "$" }: { size: number; symbol?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 50 50">
      <Defs>
        <RadialGradient id="coinFace" cx="34%" cy="28%" r="80%">
          <Stop offset="0" stopColor="#fff4c4" />
          <Stop offset="0.1" stopColor="#ffe48a" />
          <Stop offset="0.4" stopColor="#ffd866" />
          <Stop offset="0.85" stopColor="#eba83a" />
          <Stop offset="1" stopColor="#d48e2a" />
        </RadialGradient>
      </Defs>
      <Circle cx="25" cy="25" r="25" fill="#c98a22" />
      <Circle cx="25" cy="24" r="24" fill="url(#coinFace)" />
      <Circle cx="25" cy="24" r="22.5" fill="none" stroke="rgba(176,112,26,0.45)" strokeWidth={3} />
      <SvgText x="25" y="33" fontSize={symbol.length > 1 ? 17 : 26} fontWeight="800" fill="#a86a16" textAnchor="middle" fontFamily={DISPLAY}>
        {symbol}
      </SvgText>
    </Svg>
  );
}

function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}

const haptic = (kind: "in" | "out" | "tap") => {
  if (Platform.OS === "web") return;
  if (kind === "in") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  else if (kind === "out") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  else void Haptics.selectionAsync();
};

/**
 * The pocket reacts to money: a coin drops in for money in, pops out for money out, and it
 * says something about it. Tapping it pokes it.
 */
export function PocketCharacter({ size = 96, negative, greeting, interactive = true, sleeping = false }: {
  size?: number; negative?: boolean; greeting?: string | null; interactive?: boolean; sleeping?: boolean;
}) {
  const c = useColors();
  const money = useMoney();
  const reduce = useReduceMotion();
  const s = size / 104;
  const base: Face = sleeping ? "sleep" : negative ? "worried" : "happy";
  const [transient, setTransient] = useState<Face | null>(null);
  const [blink, setBlink] = useState(false);
  const [bubble, setBubble] = useState<string | null>(null);
  const [floatText, setFloatText] = useState<{ text: string; neg: boolean } | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const [idle] = useState(() => new Animated.Value(0));
  const [squish] = useState(() => new Animated.Value(0));
  const [bubbleAnim] = useState(() => new Animated.Value(0));
  const [drop] = useState(() => new Animated.Value(0));
  const [dropOpacity] = useState(() => new Animated.Value(0));
  const [floatAnim] = useState(() => new Animated.Value(0));
  const [dropMode, setDropMode] = useState<"in" | "out">("in");

  const later = (fn: () => void, ms: number) => { timers.current.push(setTimeout(fn, ms)); };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // The coin turns slowly in the slot.
  useEffect(() => {
    if (reduce || sleeping) { idle.setValue(0.5); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(idle, { toValue: 1, duration: 3600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(idle, { toValue: 0, duration: 3600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [reduce, sleeping, idle]);

  // Blinks now and then (sometimes twice).
  useEffect(() => {
    if (reduce || sleeping) return;
    let t: ReturnType<typeof setTimeout>;
    const schedule = () => {
      t = setTimeout(() => {
        setBlink(true);
        setTimeout(() => setBlink(false), 150);
        if (Math.random() < 0.25) setTimeout(() => { setBlink(true); setTimeout(() => setBlink(false), 150); }, 280);
        schedule();
      }, 2400 + Math.random() * 3400);
    };
    schedule();
    return () => clearTimeout(t);
  }, [reduce, sleeping]);

  const faceFor = (f: Face, ms = 1500) => {
    setTransient(f);
    later(() => setTransient(null), ms);
  };

  const say = (text: string) => {
    setBubble(text);
    bubbleAnim.stopAnimation();
    bubbleAnim.setValue(0);
    Animated.sequence([
      Animated.timing(bubbleAnim, { toValue: 1, duration: 260, easing: EASE_OUT, useNativeDriver: true }),
      Animated.delay(1600),
      Animated.timing(bubbleAnim, { toValue: 2, duration: 220, useNativeDriver: true }),
    ]).start(({ finished }) => { if (finished) setBubble(null); });
  };

  const doSquish = () => {
    if (reduce) return;
    squish.setValue(0);
    Animated.timing(squish, { toValue: 1, duration: 420, easing: Easing.linear, useNativeDriver: true }).start();
  };

  const showFloat = (cents: number) => {
    if (reduce) return;
    setFloatText({ text: money.string(cents, true), neg: cents < 0 });
    floatAnim.setValue(0);
    Animated.timing(floatAnim, { toValue: 1, duration: 1300, easing: EASE_OUT, useNativeDriver: true }).start(() => setFloatText(null));
  };

  const coinMove = (dir: "in" | "out", then: () => void) => {
    if (reduce) { then(); return; }
    setDropMode(dir);
    drop.setValue(0);
    dropOpacity.setValue(0);
    Animated.parallel([
      Animated.timing(drop, { toValue: 1, duration: dir === "in" ? 640 : 560, easing: dir === "in" ? Easing.bezier(0.55, 0, 0.9, 0.4) : EASE_OUT, useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(dropOpacity, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.delay(dir === "in" ? 420 : 240),
        Animated.timing(dropOpacity, { toValue: 0, duration: dir === "in" ? 100 : 200, useNativeDriver: true }),
      ]),
    ]).start(then);
  };

  // React to every change in the money.
  useEffect(() => store.onChange((ch: Change) => {
    const { diff, reason } = ch;
    if (reason === "skip") { faceFor("happy", 1000); say(line("skip")); haptic("tap"); return; }
    if (reason === "paused") { faceFor("sleep", 1400); say(line("paused")); haptic("tap"); return; }
    if (reason === "resumed") { faceFor("joy", 1400); say(line("resumed")); haptic("tap"); return; }
    if (reason === "planned" && diff === 0) {
      faceFor((ch.amount ?? 0) > 0 ? "hope" : "happy", 1800);
      say(line((ch.amount ?? 0) > 0 ? "waiting" : "planned"));
      haptic("tap");
      return;
    }
    if (diff === 0) return;
    const after = store.get().balance;
    const before = after - diff;
    const intoRed = before >= 0 && after < 0;
    const outOfRed = before < 0 && after >= 0;
    haptic(diff > 0 ? "in" : "out");
    coinMove(diff > 0 ? "in" : "out", () => {
      doSquish();
      if (reason === "delete") { faceFor(diff > 0 ? "joy" : "oof", 1200); say(line("deleted")); }
      else if (reason === "undo") { faceFor("happy", 1000); say(line("undo")); }
      else if (outOfRed) { faceFor("joy", 2600); say("We're out of the red!"); }
      else if (intoRed) { faceFor("oof", 1200); later(() => say("Uh oh, we're in the red"), 500); }
      else { faceFor(diff > 0 ? "joy" : "oof"); say(lineForChange(diff, ch.category)); }
    });
    later(() => showFloat(diff), diff > 0 ? 380 : 120);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [money.currency, reduce]);

  useEffect(() => {
    if (greeting) later(() => { faceFor(greeting.endsWith("?") ? "hope" : "happy", 2200); say(greeting); }, 900);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [greeting]);

  const poke = () => {
    haptic("tap");
    doSquish();
    faceFor(Math.random() < 0.5 ? "joy" : "hope", 1100);
    say(line("poke"));
  };

  const face = transient ?? base;
  const rotateY = idle.interpolate({ inputRange: [0, 1], outputRange: ["-28deg", "28deg"] });
  const lift = idle.interpolate({ inputRange: [0, 1], outputRange: [0, -2 * s] });
  const sx = squish.interpolate({ inputRange: [0, 0.35, 0.7, 1], outputRange: [1, 1.06, 0.98, 1] });
  const sy = squish.interpolate({ inputRange: [0, 0.35, 0.7, 1], outputRange: [1, 0.9, 1.03, 1] });
  const dropY = drop.interpolate({ inputRange: [0, 1], outputRange: dropMode === "in" ? [-120 * s, 44 * s] : [20 * s, -70 * s] });
  const dropSpin = drop.interpolate({ inputRange: [0, 1], outputRange: ["0deg", dropMode === "in" ? "720deg" : "-540deg"] });

  const body = (
    <View style={{ width: 104 * s, height: 112 * s }}>
      <Animated.View style={{ position: "absolute", left: 41 * s, top: 2 * s, transform: [{ perspective: 520 }, { translateY: lift }, { rotateY }] }}>
        <Coin size={50 * s} symbol={money.symbol.length <= 2 ? money.symbol : "$"} />
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={{ position: "absolute", left: 41 * s, top: 2 * s, opacity: dropOpacity, transform: [{ perspective: 520 }, { translateY: dropY }, { rotateY: dropSpin }] }}
      >
        <Coin size={50 * s} symbol={money.symbol.length <= 2 ? money.symbol : "$"} />
      </Animated.View>
      <Animated.View
        style={[styles.front, {
          left: 4 * s, top: 38 * s, width: 96 * s, height: 74 * s,
          transform: [{ scaleX: sx }, { scaleY: sy }], transformOrigin: "50% 100%",
        }]}
      >
        <Front face={face} blink={blink} />
      </Animated.View>
      {floatText ? (
        <Animated.Text
          pointerEvents="none"
          style={[styles.float, {
            color: floatText.neg ? c.neg : c.pos, top: 40 * s,
            opacity: floatAnim.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 1, 0] }),
            transform: [{ translateY: floatAnim.interpolate({ inputRange: [0, 0.25, 1], outputRange: [6, -10, -44] }) }],
          }]}
        >
          {floatText.text}
        </Animated.Text>
      ) : null}
      {bubble ? (
        <View pointerEvents="none" style={styles.bubbleWrap}>
          <Animated.View
            style={[styles.bubble, {
              backgroundColor: c.surface, borderColor: c.line,
              opacity: bubbleAnim.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 1, 0] }),
              transform: [
                { translateY: bubbleAnim.interpolate({ inputRange: [0, 1, 2], outputRange: [8, 0, -4] }) },
                { scale: bubbleAnim.interpolate({ inputRange: [0, 1, 2], outputRange: [0.7, 1, 0.96] }) },
              ],
            }]}
          >
            <Text style={[styles.bubbleText, { color: c.ink }]} numberOfLines={2}>{bubble}</Text>
          </Animated.View>
        </View>
      ) : null}
    </View>
  );

  if (!interactive) return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{body}</View>;
  return (
    <Pressable onPress={poke} accessibilityRole="button" accessibilityLabel="Your pocket" accessibilityHint="Pokes it">
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  front: { position: "absolute" },
  float: { position: "absolute", right: 0, fontFamily: DISPLAY, fontSize: 15, fontWeight: "800" },
  // Wider than the pocket so a line never gets cut; it grows leftward from the pocket's right edge.
  bubbleWrap: { position: "absolute", right: -2, bottom: "100%", marginBottom: 4, width: 240, alignItems: "flex-end" },
  bubble: {
    maxWidth: 240, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, paddingHorizontal: 11, paddingVertical: 6,
    shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 9, shadowOffset: { width: 0, height: 8 }, elevation: 4,
  },
  bubbleText: { fontSize: 13, fontWeight: "600" },
});
