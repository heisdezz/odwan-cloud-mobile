import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BackupStatusCard } from "@/components/uploads/backup-status-card";
import DeviceGallery from "@/components/gallery/device-gallery";
import { useTheme } from "@/hooks/use-theme";
import tw from "@/lib/tw";
export default function GalleryScreen() {
  const colors = useTheme();
  return (
    <SafeAreaView
      edges={["top"]}
      style={tw.style("flex-1", { backgroundColor: colors.background })}
    >
      <View style={tw`px-4 pt-2 pb-2 flex-row items-center gap-3`}>
        <Text style={tw.style('flex-1 text-2xl font-semibold', { color: colors.text })}>Device</Text>
        <BackupStatusCard compact />
      </View>
      <DeviceGallery />
    </SafeAreaView>
  );
}
