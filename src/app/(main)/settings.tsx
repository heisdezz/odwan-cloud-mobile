import { clearServerQueries } from "@/lib/server-query-cache";
import {
  logoutServerSession,
  restoreServerSession,
} from "@/lib/server-session";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SymbolView } from "expo-symbols";
import { router } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { toast } from "sonner-native";
import { Button, Input } from "@/components/ui";
import { BottomTabInset } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { testServerConnection } from "@/lib/server-connection";
import tw from "@/lib/tw";
import { useServerStore } from "@/stores/server-store";

export default function SettingsScreen() {
  const colors = useTheme();
  const server = useServerStore();
  const queryClient = useQueryClient();
  const logout = useMutation({
    mutationFn: logoutServerSession,
    onMutate: () => clearServerQueries(queryClient),
    onSuccess: () => toast.success("Logged out"),
    onError: () => toast.error("Could not remove saved login. Please retry."),
  });
  const connection = useMutation({
    mutationFn: async ({ input }: { input: string; revision: number }) => {
      const start = performance.now();
      const url = await testServerConnection(input);
      return { url, milliseconds: Math.round(performance.now() - start) };
    },
    onSuccess: ({ url, milliseconds }, { revision }) => {
      if (useServerStore.getState().verify(url, revision)) {
        toast.success(`Connected to server (${milliseconds} ms)`);
        void restoreServerSession(url, revision).catch(() => {
          if (useServerStore.getState().revision === revision)
            toast.error(
              "Connected, but saved login could not be restored. Please log in again.",
            );
        });
      }
    },
    onError: (error, { revision }) => {
      if (revision === useServerStore.getState().revision)
        toast.error(error.message);
    },
  });
  const error =
    connection.variables?.revision === server.revision
      ? connection.error?.message
      : undefined;
  return (
    <SafeAreaView
      edges={["top"]}
      style={tw.style("flex-1", { backgroundColor: colors.background })}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={tw.style("px-6 pt-6 gap-6", {
          paddingBottom: BottomTabInset + 24,
        })}
      >
        <Text
          style={tw.style("text-3xl font-semibold", { color: colors.text })}
        >
          Settings
        </Text>
        <View style={tw`gap-2`}>
          <Text style={tw.style("text-xl font-medium", { color: colors.text })}>
            Uploads
          </Text>
          {(
            [
              {
                title: "Current uploads",
                detail: "Manage pending uploads, pause, or retry",
                href: "/uploads/current",
              },
              {
                title: "Uploaded",
                detail: "Completed uploads saved in history",
                href: "/uploads/history",
              },
            ] as const
          ).map((entry) => (
            <Pressable
              key={entry.href}
              accessibilityRole="button"
              accessibilityLabel={entry.title}
              onPress={() => router.push(entry.href)}
              style={({ pressed }) =>
                tw.style("min-h-16 py-3 flex-row items-center gap-3", {
                  opacity: pressed ? 0.7 : 1,
                })
              }
            >
              <View style={tw`flex-1 gap-1`}>
                <Text
                  style={tw.style("text-base font-medium", {
                    color: colors.text,
                  })}
                >
                  {entry.title}
                </Text>
                <Text
                  style={tw.style("text-sm", { color: colors.textSecondary })}
                >
                  {entry.detail}
                </Text>
              </View>
              <SymbolView
                name={{
                  ios: "chevron.right",
                  android: "chevron_right",
                  web: "chevron_right",
                }}
                size={20}
                tintColor={colors.textSecondary}
              />
            </Pressable>
          ))}
        </View>
        <View style={tw`gap-3`}>
          <Text style={tw.style("text-xl font-medium", { color: colors.text })}>
            Server connection
          </Text>
          <Text style={tw.style("text-base", { color: colors.textSecondary })}>
            Enter your server URL, then test the connection to continue.
          </Text>
        </View>
        <Input
          label="Server URL"
          value={server.urlInput}
          placeholder="https://your-server.com"
          onChangeText={(value) => {
            logout.reset();
            server.setUrlInput(value);
            clearServerQueries(queryClient);
          }}
          error={error}
          helperText="Include http:// or https://. Use your computer’s LAN address for a local server."
        />
        <Button
          label="Test connection"
          loading={connection.isPending}
          disabled={!server.urlInput.trim()}
          onPress={() => {
            connection.reset();
            const revision = server.beginCheck();
            clearServerQueries(queryClient);
            connection.mutate({ input: server.urlInput, revision });
          }}
        />
        {server.verifiedUrl && (
          <View style={tw`gap-4`}>
            <Text
              accessibilityLiveRegion="polite"
              style={tw.style("text-base", { color: colors.text })}
            >
              Connected to {server.verifiedUrl}
            </Text>
            {server.account ? (
              <>
                <Text
                  style={tw.style("text-base", { color: colors.textSecondary })}
                >
                  Signed in as {server.account.email}
                </Text>
                <Button
                  label="Log out"
                  variant="outlined"
                  loading={logout.isPending}
                  onPress={() => logout.mutate()}
                />
              </>
            ) : (
              <Button label="Log in" onPress={() => router.push("/auth")} />
            )}
            {logout.isError && !server.account && (
              <Button
                label="Remove saved login"
                variant="outlined"
                loading={logout.isPending}
                onPress={() => logout.mutate()}
              />
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
