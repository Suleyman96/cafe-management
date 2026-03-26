import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import { Pressable, StyleSheet } from 'react-native';

export function DrawerMenuButton() {
  const navigation = useNavigation();

  return (
    <Pressable
      onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
      style={styles.button}
      hitSlop={8}
    >
      <MaterialCommunityIcons name="menu" size={24} color="#333" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    marginLeft: 12,
    padding: 4,
  },
});
