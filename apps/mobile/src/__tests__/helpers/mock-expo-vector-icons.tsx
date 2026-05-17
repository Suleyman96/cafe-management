// Stub for @expo/vector-icons — the real package loads bundled font assets
// (.ttf) via Metro-only resolvers that Vitest can't follow. Tests render
// icons as plain text spans with `data-icon={name}`.
interface IconProps {
  name?: string;
  size?: number;
  color?: string;
  style?: unknown;
}

function makeIconSet(family: string) {
  const Component = ({ name, size, color, style }: IconProps) => (
    <span
      data-icon={name}
      data-icon-family={family}
      style={{ fontSize: size, color, ...(style as object) }}
    />
  );
  Component.displayName = family;
  return Component;
}

export const MaterialCommunityIcons = makeIconSet('MaterialCommunityIcons');
export const MaterialIcons = makeIconSet('MaterialIcons');
export const Ionicons = makeIconSet('Ionicons');
export const FontAwesome = makeIconSet('FontAwesome');
export const FontAwesome5 = makeIconSet('FontAwesome5');
export const FontAwesome6 = makeIconSet('FontAwesome6');
export const AntDesign = makeIconSet('AntDesign');
export const Entypo = makeIconSet('Entypo');
export const EvilIcons = makeIconSet('EvilIcons');
export const Feather = makeIconSet('Feather');
export const Foundation = makeIconSet('Foundation');
export const Octicons = makeIconSet('Octicons');
export const SimpleLineIcons = makeIconSet('SimpleLineIcons');
export const Zocial = makeIconSet('Zocial');
export const createIconSet = (_glyphMap: unknown, family: string) => makeIconSet(family);
