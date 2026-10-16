import { SymbolView, type SymbolViewProps, type SymbolWeight } from "expo-symbols";
import type { ColorValue } from "react-native";

// SF Symbols on iOS (the same glyphs as Pocket for Mac); Material Symbols on Android and web.
const MATERIAL: Record<string, string> = {
  "gamecontroller": "sports_esports",
  "repeat": "repeat",
  "bolt": "bolt",
  "square.grid.2x2": "apps",
  "cup.and.saucer": "local_cafe",
  "bag": "shopping_bag",
  "sparkles": "auto_awesome",
  "bus": "directions_bus",
  "ellipsis.circle": "more_horiz",
  "banknote": "payments",
  "gift": "redeem",
  "arrow.uturn.backward": "undo",
  "arrow.down.left": "south_west",
  "arrow.up.right": "north_east",
  "clock": "schedule",
  "plus": "add",
  "minus": "remove",
  "chevron.right": "chevron_right",
  "chevron.left": "chevron_left",
  "chevron.down": "expand_more",
  "gearshape": "settings",
  "house": "home",
  "chart.xyaxis.line": "show_chart",
  "chart.bar": "bar_chart",
  "calendar": "calendar_today",
  "tag": "sell",
  "checkmark": "check",
  "checkmark.circle.fill": "check_circle",
  "xmark": "close",
  "trash": "delete",
  "pause": "pause",
  "play": "play_arrow",
  "arrow.triangle.2.circlepath": "sync",
  "iphone": "smartphone",
  "laptopcomputer": "laptop",
  "square.and.arrow.up": "ios_share",
  "square.and.arrow.down": "download",
  "exclamationmark.triangle": "warning",
  "star": "star",
  "link": "link",
  "wifi.slash": "wifi_off",
  "icloud": "cloud",
  "lock": "lock",
  "arrow.up": "arrow_upward",
  "arrow.down": "arrow_downward",
  "pencil": "edit",
  "hand.tap": "touch_app",
  "questionmark.circle": "help",
};

export function Icon({ name, size = 18, color, weight = "medium" }: { name: string; size?: number; color: ColorValue; weight?: SymbolWeight }) {
  const md = MATERIAL[name] ?? "circle";
  return (
    <SymbolView
      name={{ ios: name, android: md, web: md } as SymbolViewProps["name"]}
      size={size}
      tintColor={color}
      weight={weight}
      resizeMode="scaleAspectFit"
      style={{ width: size, height: size }}
    />
  );
}
