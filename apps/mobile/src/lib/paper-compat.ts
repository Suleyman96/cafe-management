/**
 * Workaround for react-native-paper type incompatibility with @types/react@19.
 *
 * React.ComponentPropsWithRef<typeof NativeTextInput> resolves to {} with React 19,
 * causing native TextInput props (keyboardType, autoCapitalize, etc.) and
 * native Text props (numberOfLines, ellipsizeMode) to be lost from the types.
 *
 * Re-exports with the missing native props added back.
 */

import type { TextInputProps as RNTextInputProps, TextProps as RNTextProps } from 'react-native';
import type { TextInputProps } from 'react-native-paper';
import { Text as PaperText, TextInput as PaperTextInput } from 'react-native-paper';

type NativeTextInputCompat = Pick<
  RNTextInputProps,
  | 'keyboardType'
  | 'autoCapitalize'
  | 'autoComplete'
  | 'secureTextEntry'
  | 'onSubmitEditing'
  | 'returnKeyType'
  | 'maxLength'
>;

type NativeTextCompat = Pick<RNTextProps, 'numberOfLines' | 'ellipsizeMode'>;

export const TextInput = PaperTextInput as unknown as React.ForwardRefExoticComponent<
  (TextInputProps & NativeTextInputCompat) & React.RefAttributes<React.Component>
> & {
  Icon: typeof PaperTextInput.Icon;
  Affix: typeof PaperTextInput.Affix;
};

export const Text = PaperText as unknown as React.ForwardRefExoticComponent<
  (React.ComponentProps<typeof PaperText> & NativeTextCompat) & React.RefAttributes<React.Component>
>;
