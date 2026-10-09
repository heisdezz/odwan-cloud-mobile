import { Pressable, Text, View } from "react-native";
import { SymbolView } from "expo-symbols";
import { router } from "expo-router";
import { useStore } from "zustand";
import { useUploadQueue } from "@/providers/upload-queue-context";
import { useBackupSummary } from "@/hooks/use-backup-summary";
import { useServerStore } from "@/stores/server-store";
import { useTheme } from "@/hooks/use-theme";
import { uploadProgressStore } from "@/stores/upload-progress-store";
import tw from "@/lib/tw";

export function BackupStatusCard({ compact = false }: { compact?: boolean }) {
  const colors = useTheme();
  const connected = useServerStore(
    (state) => !!state.verifiedUrl && !!state.account,
  );
  const summary = useBackupSummary();
  const queue = useUploadQueue();
  const percent = useStore(
    uploadProgressStore,
    (state) => state.progress?.percent,
  );
  const remaining = Math.max(
    0,
    (summary.data?.total ?? 0) - (summary.data?.backedUp ?? 0),
  );
  const pending = queue.jobs.filter((job) => job.state !== "success").length;
  const failed = queue.jobs.filter((job) => job.state === "error").length;
  const title = !connected
    ? "Connect to back up your photos"
    : queue.paused && pending
      ? "Backup paused"
      : queue.waitingForConnection
        ? "Waiting for your server"
        : failed
          ? `${failed} uploads need attention`
          : queue.phase
            ? "Backing up"
            : summary.isError
              ? "Backup status unavailable"
              : !summary.data || !summary.data.total
                ? "Your backup overview"
                : remaining
                  ? `${remaining.toLocaleString()} items not backed up`
                  : "Everything backed up";
  const detail = queue.phase
    ? `${pending.toLocaleString()} queued${typeof percent === "number" ? ` · ${Math.round(percent)}% sent` : ""}`
    : summary.data?.total
      ? `${summary.data.backedUp.toLocaleString()} of ${summary.data.total.toLocaleString()} device items backed up`
      : connected
        ? "Select items in a device album to start backing up."
        : "Open Settings to connect and sign in.";
  if (compact) return <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${detail}`} onPress={() => router.push(connected ? '/uploads/current' : '/settings')}
    style={({ pressed }) => tw.style('min-h-11 max-w-[55%] flex-row items-center gap-2 px-3 rounded-full', { backgroundColor: colors.backgroundElement, opacity: pressed ? 0.7 : 1 })}>
    <SymbolView name={{ ios: 'icloud', android: 'cloud', web: 'cloud' }} size={20} tintColor={colors.primary} />
    <Text numberOfLines={1} style={tw.style('shrink text-xs', { color: colors.textSecondary })}>{queue.phase && typeof percent === 'number' ? `${Math.round(percent)}% sent` : title}</Text>
  </Pressable>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${detail}`}
      onPress={() => router.push(connected ? "/uploads/current" : "/settings")}
      style={({ pressed }) =>
        tw.style(
          "mx-4 mb-3 px-4 py-3 rounded-2xl flex-row items-center gap-3",
          {
            backgroundColor: colors.backgroundElement,
            opacity: pressed ? 0.7 : 1,
          },
        )
      }
    >
      <SymbolView
        name={{ ios: "icloud", android: "cloud", web: "cloud" }}
        size={24}
        tintColor={colors.primary}
      />
      <View style={tw`flex-1 gap-1 flex-row items-center gap-1`}>
        <Text style={tw.style("text-sm font-semibold", { color: colors.text })}>
          {/*{title}*/}
        </Text>
        <Text style={tw.style("text-xs", { color: colors.textSecondary })}>
          {detail}
        </Text>
      </View>
      <SymbolView
        name={{
          ios: "chevron.right",
          android: "chevron_right",
          web: "chevron_right",
        }}
        size={18}
        tintColor={colors.textSecondary}
      />
    </Pressable>
  );
}
