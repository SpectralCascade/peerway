import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import MessagingOverview from "../Screens/MessagingOverview";
import Profile from "../Screens/Profile";

const Tab = createBottomTabNavigator();

export default function MainTabs() {
    return (
        <Tab.Navigator>
            <Tab.Screen
                name="MessagingOverview"
                component={MessagingOverview}
                options={{ title: "Chats", headerShown: false }}
            />
            <Tab.Screen
                name="Profile"
                component={Profile}
                options={{ title: "Profile", headerShown: false }}
            />
        </Tab.Navigator>
    );
};
