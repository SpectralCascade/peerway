import React from 'react';
import { NavigationContainer } from "@react-navigation/native";
import { MainStack } from './app/src/Navigators/StackNavigators';

export default function App() {
    return (
        <NavigationContainer>
          <MainStack />
        </NavigationContainer>
    );
}
