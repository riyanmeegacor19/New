import { Text, View } from "react-native";

export default function Diag() {
  return (
    <View style={{ flex: 1, backgroundColor: "#0A0F0D", alignItems: "center", justifyContent: "center" }}>
      <View style={{ backgroundColor: "#00FF66", padding: 24, borderRadius: 16 }}>
        <Text style={{ color: "#0A0F0D", fontSize: 28, fontWeight: "800" }}>DIAG OK</Text>
      </View>
      <Text style={{ color: "#E2ECE6", marginTop: 16, fontSize: 16 }}>Plain render works</Text>
    </View>
  );
}
