import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { makeStyles, useTheme } from "@/src/theme";

type ToastKind = "success" | "error" | "info";
type ToastItem = { id: number; message: string; kind: ToastKind };

const ToastContext = createContext<{ show: (message: string, kind?: ToastKind) => void }>({
  show: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [toast, setToast] = useState<ToastItem | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (message: string, kind: ToastKind = "info") => {
      if (timer.current) clearTimeout(timer.current);
      setToast({ id: Date.now(), message, kind });
      opacity.setValue(0);
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(() =>
          setToast(null),
        );
      }, 2800);
    },
    [opacity],
  );

  const value = useMemo(() => ({ show }), [show]);

  const bg =
    toast?.kind === "success"
      ? colors.brandPrimary
      : toast?.kind === "error"
        ? colors.error
        : colors.surfaceInverse;
  const fg =
    toast?.kind === "success" || toast?.kind === "error" ? colors.onBrandPrimary : colors.onSurfaceInverse;

  return (
    <ToastContext.Provider value={value}>
      <View style={styles.flex}>
        {children}
        {toast ? (
          <Animated.View
            testID="toast"
            pointerEvents="none"
            style={[styles.host, { opacity, backgroundColor: bg }]}
          >
            <Text style={[styles.message, { color: fg }]} numberOfLines={3}>
              {toast.message}
            </Text>
          </Animated.View>
        ) : null}
      </View>
    </ToastContext.Provider>
  );
}

const useStyles = makeStyles((colors) => ({
  flex: { flex: 1 },
  host: {
    position: "absolute",
    top: 64,
    alignSelf: "center",
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 12,
    maxWidth: "88%",
    shadowColor: "#000000",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  message: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
}));
