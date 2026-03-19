import { createStackNavigator } from '@react-navigation/stack';
import FeedbackListScreen from '@/screens/feedback/FeedbackListScreen';
import type { FeedbackStackParamList } from '@/types';

const Stack = createStackNavigator<FeedbackStackParamList>();

export function FeedbackStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="FeedbackList"
        component={FeedbackListScreen}
        options={{ title: 'Feedback' }}
      />
    </Stack.Navigator>
  );
}
