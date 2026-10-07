import type { StyleProp, ViewStyle } from 'react-native';

export type ControlStyle = { style?: StyleProp<ViewStyle> };
export type ButtonProps = ControlStyle & {
  label: string;
  onPress: () => void;
  variant?: 'filled' | 'tonal' | 'outlined' | 'text';
  disabled?: boolean;
  loading?: boolean;
};
export type InputProps = ControlStyle & {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  helperText?: string;
  error?: string;
  disabled?: boolean;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  onSubmitEditing?: () => void;
};
export type ToggleProps = ControlStyle & {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
};
