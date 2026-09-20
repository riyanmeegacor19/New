import { Pressable, Text, View } from "react-native";
import { makeStyles, radius, useTheme } from "@/src/theme";

export type SegmentedOption = { value: string; label: string };

export function Segmented({
  options,
  value,
  onChange,
  testIdPrefix,
}: {
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  testIdPrefix: string;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.row}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            testID={`${testIdPrefix}-${option.value}`}
            onPress={() => onChange(option.value)}
            style={[
              styles.chip,
              {
                borderColor: selected ? colors.borderStrong : colors.divider,
                backgroundColor: selected ? colors.brandTertiary : "transparent",
              },
            ]}
          >
            <Text
              style={[
                styles.label,
                { color: selected ? colors.onBrandTertiary : colors.muted },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  row: {
    flexDirection: "row",
    gap: 8,
  },
  chip: {
    flex: 1,
    height: 40,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
}));
