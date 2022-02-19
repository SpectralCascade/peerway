import React from 'react';
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SetupScreen from './app/src/Screens/SetupScreen';
import ProfileEditScreen from './app/src/Screens/ProfileEditScreen';

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
              component={ProfileEditScreen}
              options={{title: "Edit Profile", animation: 'slide_from_right', headerShown: true,}}
            />
          </Stack.Navigator>
        </NavigationContainer>
    );
}
