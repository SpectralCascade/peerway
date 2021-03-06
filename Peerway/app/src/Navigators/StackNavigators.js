import React from "react";
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SetupScreen from '../Screens/SetupScreen';
import ProfileEdit from '../Screens/ProfileEdit';
import Chat from '../Screens/Chat';
import RequestChat from '../Screens/RequestChat';
import SplashScreen from '../Screens/SplashScreen';
import Settings from '../Screens/Settings';
import SharingPrivacySettings from "../Screens/SharingPrivacySettings";
import StorageCacheSettings from "../Screens/StorageCacheSettings";
import NetworkSettings from "../Screens/NetworkSettings";
import Profile from '../Screens/Profile';
import MainTabs from "./TabNavigators";
import CreatePost from "../Screens/CreatePost";
import EditGroupChatMembers from "../Screens/EditGroupChatMembers";
import ChatRequests from "../Screens/ChatRequests";

const Stack = createNativeStackNavigator();

function MainStack(props) {
    return (
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
                options={{title: "User Profile", headerShown: true}}
            />
            <Stack.Screen
                name="EditProfile"
                component={ProfileEdit}
                options={{title: "Edit Profile", animation: 'slide_from_right', headerShown: true}}
            />
            <Stack.Screen name="Overview" component={MainTabs} />
            <Stack.Screen
                name="Chat"
                component={Chat}
                options={{title: "Chat", headerShown: true}}
            />
            <Stack.Screen
                name="RequestChat"
                component={RequestChat}
                options={{title: "Find Chat", animation: 'slide_from_right', headerShown: true}}
            />
            <Stack.Screen
                name="CreateGroupChat"
                component={EditGroupChatMembers}
                options={{title: "Create Group Chat", animation: 'slide_from_right', headerShown: true}}
            />
            <Stack.Screen
                name="ChatRequests"
                component={ChatRequests}
                options={{title: "Chat Requests", animation: 'slide_from_right', headerShown: true}}
            />
            <Stack.Screen
                name="Settings"
                component={Settings}
                options={{title: "Settings", animation: 'slide_from_right', headerShown: true}}
            />
            <Stack.Screen
                name="SharingPrivacySettings"
                component={SharingPrivacySettings}
                options={{title: "Sharing & Privacy Settings", animation: 'slide_from_right', headerShown: true}}
            />
            <Stack.Screen
                name="StorageCacheSettings"
                component={StorageCacheSettings}
                options={{title: "Storage & Cache Settings", animation: 'slide_from_right', headerShown: true}}
            />
            <Stack.Screen
                name="NetworkSettings"
                component={NetworkSettings}
                options={{title: "Network Settings", animation: 'slide_from_right', headerShown: true}}
            />
            <Stack.Screen
                name="CreatePost"
                component={CreatePost}
                options={{title: "Publish Post", animation: "slide_from_bottom", headerShown: true}}
            />
        </Stack.Navigator>
    );
}

export { MainStack }
