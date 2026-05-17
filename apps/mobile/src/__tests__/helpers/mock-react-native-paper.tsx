// Stub for react-native-paper — the real package ships Flow / RN-specific
// source that Vitest cannot parse. Tests that need richer Paper behavior
// override via `vi.mock('react-native-paper', () => …)` per-file; this stub
// is the baseline so non-mocking tests still render.
import type { ReactNode } from 'react';

interface PassthroughProps {
  children?: ReactNode;
  style?: unknown;
  testID?: string;
  accessibilityLabel?: string;
  numberOfLines?: number;
  onPress?: () => void;
  disabled?: boolean;
  [key: string]: unknown;
}

function passthrough(displayName: string) {
  const Component = ({
    children,
    style,
    testID,
    accessibilityLabel,
    onPress,
    disabled,
    numberOfLines: _numberOfLines,
    ...rest
  }: PassthroughProps) => (
    <span
      data-testid={testID}
      data-accessibility-label={accessibilityLabel}
      style={style as React.CSSProperties}
      onClick={onPress}
      data-disabled={disabled ? 'true' : undefined}
      {...rest}
    >
      {children}
    </span>
  );
  Component.displayName = displayName;
  return Component;
}

export const Text = passthrough('Text');
export const TextInput = Object.assign(passthrough('TextInput'), {
  Icon: passthrough('TextInput.Icon'),
  Affix: passthrough('TextInput.Affix'),
});
export const Button = passthrough('Button');
export const Dialog = Object.assign(passthrough('Dialog'), {
  Title: passthrough('Dialog.Title'),
  Content: passthrough('Dialog.Content'),
  Actions: passthrough('Dialog.Actions'),
});
export const Portal = passthrough('Portal');
export const ActivityIndicator = passthrough('ActivityIndicator');
export const Card = Object.assign(passthrough('Card'), {
  Title: passthrough('Card.Title'),
  Content: passthrough('Card.Content'),
  Actions: passthrough('Card.Actions'),
});
export const Chip = passthrough('Chip');
export const Icon = passthrough('Icon');
export const IconButton = passthrough('IconButton');
export const ProgressBar = passthrough('ProgressBar');
export const Surface = passthrough('Surface');
export const Switch = passthrough('Switch');
export const Snackbar = passthrough('Snackbar');
export const SegmentedButtons = passthrough('SegmentedButtons');
export const FAB = passthrough('FAB');
export const HelperText = passthrough('HelperText');
export const Menu = Object.assign(passthrough('Menu'), {
  Item: passthrough('Menu.Item'),
});
export const Modal = passthrough('Modal');
export const Provider = passthrough('PaperProvider');
export const RadioButton = Object.assign(passthrough('RadioButton'), {
  Group: passthrough('RadioButton.Group'),
});
export const Checkbox = Object.assign(passthrough('Checkbox'), {
  Item: passthrough('Checkbox.Item'),
});
export const List = Object.assign(passthrough('List'), {
  Item: passthrough('List.Item'),
  Subheader: passthrough('List.Subheader'),
  Icon: passthrough('List.Icon'),
  Accordion: passthrough('List.Accordion'),
});
export const Divider = passthrough('Divider');
export const Avatar = Object.assign(passthrough('Avatar'), {
  Image: passthrough('Avatar.Image'),
  Icon: passthrough('Avatar.Icon'),
  Text: passthrough('Avatar.Text'),
});
export const Banner = passthrough('Banner');
export const Tooltip = passthrough('Tooltip');
export const MD3LightTheme = { colors: {} };
export const MD3DarkTheme = { colors: {} };
export const useTheme = () => ({ colors: {}, dark: false });
export const configureFonts = (config: unknown) => config;
