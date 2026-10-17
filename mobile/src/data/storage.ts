import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// Plain settings and the ledger live in AsyncStorage; the server access key lives in the
// Keychain / Keystore (SecureStore). The web build has no secure store, so it falls back.

export const KEYS = {
  ledger: "pocket.ledger",
  backups: "pocket.backups",
  onboarded: "pocket.onboarded",
  mode: "pocket.mode",
  server: "pocket.server",
  accessKey: "pocket.key",
  queue: "pocket.queue",
  displayCurrency: "pocket.currency",
  range: "pocket.range",
  everyday: "pocket.everyday",
  greeted: "pocket.greeted",
} as const;

export async function getItem(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function setItem(key: string, value: string | null): Promise<void> {
  if (value === null) await AsyncStorage.removeItem(key);
  else await AsyncStorage.setItem(key, value);
}

export async function getJSON<T>(key: string): Promise<T | null> {
  const raw = await getItem(key);
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export const setJSON = (key: string, value: unknown) => setItem(key, value == null ? null : JSON.stringify(value));

const secureAvailable = Platform.OS !== "web";

export async function getSecret(key: string): Promise<string | null> {
  try {
    return secureAvailable ? await SecureStore.getItemAsync(key) : await getItem(key);
  } catch {
    return null;
  }
}

export async function setSecret(key: string, value: string | null): Promise<void> {
  if (!secureAvailable) return setItem(key, value);
  if (value === null) await SecureStore.deleteItemAsync(key);
  else await SecureStore.setItemAsync(key, value);
}
