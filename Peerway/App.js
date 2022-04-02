import React from 'react';
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SetupScreen from './app/src/Screens/SetupScreen';
import ProfileEdit from './app/src/Screens/ProfileEdit';
import Chat from './app/src/Screens/Chat';
import MessagingOverview from './app/src/Screens/MessagingOverview';
import RequestChat from './app/src/Screens/RequestChat';
import SplashScreen from './app/src/Screens/SplashScreen';
import Settings from './app/src/Screens/Settings';
import Profile from './app/src/Screens/Profile';

const Stack = createNativeStackNavigator();

export default function App() {
    return (
        <NavigationContainer>
          <Stack.Navigator
            initialRouteName='Splash'
            screenOptions={{
              headerShown: false,
            }}>
            <Stack.Screen
              name="Splash"
              component={SplashScreen}
            />
            <Stack.Screen
              name="Setup"
              component={SetupScreen}
            />
            <Stack.Screen
              name="Profile"
              component={Profile}
              options={{title: "User Profile", headerShown: true,}}
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
              name="Settings"
              component={Settings}
              options={{title: "Settings", animation: 'slide_from_right', headerShown: true,}}
            />
            <Stack.Screen
              name="Chat"
              component={Chat}
              options={{title: "Chat", headerShown: true,}}
            />
            <Stack.Screen
              name="RequestChat"
              component={RequestChat}
              options={{title: "Chat Invitations", animation: 'slide_from_right', headerShown: true,}}
            />
          </Stack.Navigator>
        </NavigationContainer>
    );
}
