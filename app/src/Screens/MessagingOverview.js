import { StyleSheet, View, Image, TouchableOpacity, ScrollView, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState } from 'react';
import StyleMain from '../Stylesheets/StyleMain';
import ButtonText from '../Components/ButtonText';
import Text from '../Components/Text';
import Database from '../Database';
import { MaterialIcons } from '@expo/vector-icons'; 
import Colors from '../Stylesheets/Colors';

const topbarHeight = 56;
const iconSize = 56;
const paddingAmount = 8;

export default function MessagingOverview(props) {
    React.useEffect(() => {
        return props.navigation.addListener('focus', () => {
            console.log("OPENED MESSAGING OVERVIEW");
        });
    });

    const [chats, setChats] = useState([
        {
            id: '1',
            name: "L. Farquad",
            message: {
                content: "The muffin man on Drury Lane?",
                timestamp: (new Date()).toLocaleDateString("en-GB")
            },
            icon: "",
            read: false
        },
        {
            id: '2',
            name: "Walter's donut party",
            message: {
                content: "Kleiner: The administrator is not interes...",
                timestamp: (new Date()).toLocaleDateString("en-GB")
            },
            icon: "",
            read: true
        }
    ]);

    const onOpenChat = (chat) => {
        props.navigation.navigate("Chat");
    };

    return (
        <SafeAreaView style={StyleMain.background}>
            <View style={styles.topbar}>
                <TouchableOpacity style={[styles.menuButton]}>
                    <MaterialIcons name="menu" size={topbarHeight * 0.9} color="black" style={[]} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.settingsButton]}>
                    <MaterialIcons name="settings" size={topbarHeight * 0.9} color="black" style={[]} />
                </TouchableOpacity>
            </View>
            <View style={styles.edge}></View>

            <FlatList
                data={chats}
                renderItem={({ item }) => (
                    <View>
                    <TouchableOpacity onPress={() => onOpenChat(item)} style={styles.chatContainer}>
                        <View style={styles.chatIcon}></View>
                        <View style={styles.chatContent}>
                            <Text style={styles.chatContentHeader}>{item.name}</Text>
                            <Text style={styles.chatContentMessage}>{item.message.content}</Text>
                        </View>
                        <View style={styles.chatTimestamp}></View>
                    </TouchableOpacity>
                    <View style={[styles.edge, {backgroundColor: "#ccc"}]}></View>
                    </View>
                )}
            />

        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    chatContainer: {
        height: 70,
        backgroundColor: "#fff",
        justifyContent: "center",
    },
    chatContent: {
        position: "absolute",
        left: paddingAmount + paddingAmount + iconSize
    },
    chatContentHeader: {
        fontSize: 16,
        color: "#000"
    },
    chatContentMessage: {
        color: "#999"
    },
    chatIcon: {
        position: "absolute",
        left: paddingAmount,
        width: iconSize,
        height: iconSize,
        backgroundColor: Colors.avatarBackground,
        borderRadius: 10000
    },
    chatTimestamp: {

    },
    edge: {
        height: 1,
        backgroundColor: "#000"
    },
    menuButton: {
        position: "absolute",
        left: 0
    },
    settingsButton: {
        position: "absolute",
        right: 0
    },
    topbar: {
        height: topbarHeight,
        backgroundColor: "#fff",
        justifyContent: "center"
    },
})
