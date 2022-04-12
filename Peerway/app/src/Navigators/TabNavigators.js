import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import MessagingOverview from "../Screens/MessagingOverview";
import CombinedFeed from "../Screens/CombinedFeed";
import Profile from "../Screens/Profile";
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Colors from "../Stylesheets/Colors";
import { Log } from "../Log";

const Tab = createBottomTabNavigator();
const iconSize = 32;

export default function MainTabs() {
    return (
        <Tab.Navigator screenOptions={{
            tabBarStyle: {
                height: 58,
                paddingBottom: 5
            },
            tabBarLabelStyle: {
                fontSize: 14
            },
            tabBarIconStyle: {
                color: Colors.button
            },
            tabBarActiveTintColor: Colors.button,
            tabBarInactiveTintColor: Colors.buttonTextDisabled
        }}>
            <Tab.Screen
                name="MessagingOverview"
                component={MessagingOverview}
                options={{
                    title: "Chats",
                    headerShown: false,
                    tabBarIcon: (params) => (
                        <Icon
                            name={"chat"}
                            size={iconSize}
                            color={params.color}
                        />
                    )
                }}
            />
            <Tab.Screen
                name="Feeds"
                component={CombinedFeed}
                options={{
                    title: "Activity",
                    headerShown: false,
                    tabBarIcon: (params) => (
                        <Icon
                            name={"account-group"}
                            size={iconSize}
                            color={params.color}
                        />
                    )
                }}
            />
            <Tab.Screen
                name="Profile"
                component={Profile}
                options={{
                    title: "Profile",
                    headerShown: false,
                    tabBarIcon: (params) => (
                        <Icon
                            name={"account-circle"}
                            size={iconSize}
                            color={params.color}
                        />
                    )
                }}
            />
        </Tab.Navigator>
    );
};
