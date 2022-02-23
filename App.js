import React from 'react';
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SetupScreen from './app/src/Screens/SetupScreen';
import ProfileEdit from './app/src/Screens/ProfileEdit';
import Chat from './app/src/Screens/Chat';
import MessagingOverview from './app/src/Screens/MessagingOverview';

const Stack = createNativeStackNavigator();

export default function App() {
    return (
        <NavigationContainer>
          <Stack.Navigator
            initialRouteName='Setup'
            screenOptions={{
              headerShown: false,
            }}>
            <Stack.Screen
              name="Setup"
              component={SetupScreen}
            />
            <Stack.Screen
              name="EditProfile"
              component={ProfileEdit}
              options={{title: "Edit Profile", animation: 'slide_from_right', headerShown: true,}}
            />
            <Stack.Screen
              name="MessagingOverview"
              component={MessagingOverview}
            />
            <Stack.Screen
              name="Chat"
              component={Chat}
              options={{title: "Chat", headerShown: true,}}
            />
          </Stack.Navigator>
        </NavigationContainer>
    );
}
