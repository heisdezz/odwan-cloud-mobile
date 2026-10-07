import { useEffect } from 'react';
import { View } from 'react-native';
import { Host, Button as MaterialButton, FilledTonalButton, OutlinedButton, TextButton, Text, OutlinedTextField, Switch as MaterialSwitch, Checkbox as MaterialCheckbox, Row, useNativeState } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, semantics } from '@expo/ui/jetpack-compose/modifiers';
import { useAppTheme } from '@/providers/app-theme-provider';
import type { ButtonProps, InputProps, ToggleProps } from './types';

function MaterialHost({ children, style }: React.PropsWithChildren<{ style?: ButtonProps['style'] }>) {
  const { colorScheme } = useAppTheme();
  return <Host colorScheme={colorScheme} matchContents={{ vertical: true }} style={style}>{children}</Host>;
}

export function Button({ label, onPress, variant = 'filled', disabled, loading, style }: ButtonProps) {
  const Component = { filled: MaterialButton, tonal: FilledTonalButton, outlined: OutlinedButton, text: TextButton }[variant];
  return <MaterialHost style={style}><Component onClick={onPress} enabled={!disabled && !loading} modifiers={[fillMaxWidth()]}><Text>{loading ? `${label}…` : label}</Text></Component></MaterialHost>;
}

export function Input({ label, value, onChangeText, placeholder, helperText, error, disabled, secureTextEntry, keyboardType = 'default', onSubmitEditing, style }: InputProps) {
  const text = useNativeState(value);
  useEffect(() => { if (text.get() !== value) text.set(value); }, [text, value]);
  const keyboard = { default: 'text', 'email-address': 'email', numeric: 'number', 'phone-pad': 'phone' } as const;
  return <MaterialHost style={style}>
    <OutlinedTextField value={text} onValueChange={onChangeText} enabled={!disabled} singleLine isError={!!error}
      visualTransformation={secureTextEntry ? 'password' : 'none'}
      keyboardOptions={{ keyboardType: secureTextEntry ? 'password' : keyboard[keyboardType], imeAction: 'done' }}
      keyboardActions={{ onDone: onSubmitEditing }} modifiers={[fillMaxWidth()]}>
      <OutlinedTextField.Label><Text>{label}</Text></OutlinedTextField.Label>
      {placeholder && <OutlinedTextField.Placeholder><Text>{placeholder}</Text></OutlinedTextField.Placeholder>}
      {(error || helperText) && <OutlinedTextField.SupportingText><Text>{error || helperText}</Text></OutlinedTextField.SupportingText>}
    </OutlinedTextField>
  </MaterialHost>;
}

function Toggle({ label, value, onValueChange, disabled, style, checkbox }: ToggleProps & { checkbox?: boolean }) {
  const Component = checkbox ? MaterialCheckbox : MaterialSwitch;
  return <View style={style}><MaterialHost>
    <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 12 }}>
      <Component value={value} onCheckedChange={onValueChange} enabled={!disabled} modifiers={[semantics({ contentDescription: label })]} />
      <Text>{label}</Text>
    </Row>
  </MaterialHost></View>;
}
export function Switch(props: ToggleProps) { return <Toggle {...props} />; }
export function Checkbox(props: ToggleProps) { return <Toggle {...props} checkbox />; }
