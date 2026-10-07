import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Checkbox, Input, Switch } from './controls';
import { useTheme } from '@/hooks/use-theme';
import { useAppTheme } from '@/providers/app-theme-provider';
import tw from '@/lib/tw';

/** Interactive examples for the starter's Explore screen. */
export function ComponentPreview() {
  const colors = useTheme();
  const { colorScheme, mode, setTheme, toggleTheme } = useAppTheme();
  const [name, setName] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [accepted, setAccepted] = useState(false);
  const [saved, setSaved] = useState(false);
  return <View style={tw`w-full gap-4`}>
    <Text style={[tw`text-2xl font-semibold`, { color: colors.text }]}>Basic components</Text>
    <Input label="Name" value={name} onChangeText={(value) => { setName(value); setSaved(false); }} placeholder="Enter your name" helperText="Used in this example only." />
    <Switch label="Enable notifications" value={enabled} onValueChange={setEnabled} />
    <Checkbox label="Confirm this example" value={accepted} onValueChange={setAccepted} />
    <Button label={saved ? 'Saved' : 'Save example'} disabled={!name.trim() || !accepted} onPress={() => setSaved(true)} />
    <Button label={`Use ${colorScheme === 'dark' ? 'light' : 'dark'} theme`} variant="tonal" onPress={() => { void toggleTheme(); }} />
    <Button label="Follow device theme" variant="outlined" disabled={mode === 'system'} onPress={() => { void setTheme('system'); }} />
  </View>;
}
