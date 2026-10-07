import { clearServerQueries } from '@/lib/server-query-cache';
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Redirect, router } from "expo-router";
import { KeyboardAvoidingView, Platform, ScrollView, Text } from "react-native";
import { toast } from "sonner-native";
import { authenticateSuperuser } from "@/lib/authenticate-superuser";
import { Button, Input } from "@/components/ui";
import { useTheme } from "@/hooks/use-theme";
import tw from "@/lib/tw";
import { useServerStore } from "@/stores/server-store";

export default function LoginScreen() {
  const colors = useTheme();
  const { verifiedUrl, revision } = useServerStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const queryClient = useQueryClient();
  const login = useMutation({
    mutationFn: async () => {
      await authenticateSuperuser({ email, password, verifiedUrl, revision });
    },
    onSuccess: () => {
      setPassword("");
      clearServerQueries(queryClient);
      toast.success("Logged in");
      router.replace("/settings");
    },
    onError: (error) => toast.error(error.message),
  });
  if (!verifiedUrl) return <Redirect href="/settings" />;
  const submit = () => login.mutate();
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={tw.style("flex-1", { backgroundColor: colors.background })}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={tw`px-6 py-8 gap-6`}
      >
        <Text
          style={tw.style("text-3xl font-semibold", { color: colors.text })}
        >
          Superuser login
        </Text>
        <Text style={tw.style("text-base", { color: colors.textSecondary })}>
          Sign in to {verifiedUrl}
        </Text>
        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          disabled={login.isPending}
        />
        <Input
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          disabled={login.isPending}
          onSubmitEditing={() => {
            if (email.trim() && password && !login.isPending) submit();
          }}
        />
        {login.error && (
          <Text
            accessibilityRole="alert"
            style={tw.style("text-base", { color: colors.text })}
          >
            {login.error.message}
          </Text>
        )}
        <Button
          label="Log in"
          loading={login.isPending}
          disabled={!email.trim() || !password}
          onPress={submit}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
