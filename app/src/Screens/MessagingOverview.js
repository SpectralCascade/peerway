import { StyleSheet, View, Image, TouchableOpacity, ScrollView, FlatList, Dimensions } from 'react-native';
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
            // TODO refresh screen
        });
    });

    // Initial chats data loaded into the list
    const allChats = [
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
                content: "Kleiner: The administrator wants to get a conclusive analysis of today's sample. I gather they went to some lengths to get it.",
                timestamp: (new Date()).toLocaleDateString("en-GB")
            },
            icon: "",
            read: true
        }
    ];

    for (var i = 3; i <= 20; i++) {
        allChats.push({
            id: i.toString(),
            name: "Dummy Name",
            message: {
                content: "Dummy message content",
                timestamp: (new Date()).toLocaleDateString("en-GB")
            },
            icon: "",
            read: true
        })
    }

    const [chats, setChats] = useState(allChats);

    const onOpenChat = (chat) => {
        chat = allChats.find((item) => item.id === chat.id);
        if (chat != null) {
            chat.read = true;
            props.navigation.navigate("Chat");
        }
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
                            <Text
                                numberOfLines={1}
                                style={[styles.chatContentHeader, {fontWeight: item.read ? "normal" : "bold"}]}>
                                {item.name}
                            </Text>
                            <Text
                                numberOfLines={1}
                                style={[styles.chatContentMessage, {color: item.read ? "#999" : "#000", fontWeight: item.read ? "normal" : "bold"}]}
                            >
                                {item.message.content}
                            </Text>
                        </View>
                        <Text style={styles.chatTimestamp}>{item.message.timestamp}</Text>
                    </TouchableOpacity>
                    <View style={[styles.edge, {backgroundColor: "#ccc"}]}></View>
                    </View>
                )}
            />

            <TouchableOpacity onPress={() => onOpenChat()} style={styles.newChatButton}>
                <MaterialIcons name="chat" size={iconSize * 0.8} color="white" />
            </TouchableOpacity>

        </SafeAreaView>
    );
}

const dimensions = Dimensions.get("window");

const styles = StyleSheet.create({
    chatContainer: {
        height: 70,
        backgroundColor: "#fff",
        justifyContent: "center",
    },
    chatContent: {
        position: "absolute",
        left: paddingAmount + paddingAmount + iconSize,
        width: dimensions.width - (paddingAmount * 4 + iconSize * 2),
        flexWrap: "nowrap",
    },
    chatContentHeader: {
        fontSize: 16,
        color: "#000",
        flex: 1
    },
    chatContentMessage: {
        color: "#999",
        flex: 1,
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
        position: "absolute",
        right: paddingAmount,
        top: paddingAmount
    },
    edge: {
        height: 1,
        backgroundColor: "#000"
    },
    menuButton: {
        position: "absolute",
        left: 0
    },
    newChatButton: {
        position: "absolute",
        right: paddingAmount * 5,
        bottom: paddingAmount * 7,
        width: iconSize * 1.2,
        height: iconSize * 1.2,
        borderRadius: 10000,
        backgroundColor: Colors.button,
        justifyContent: "center",
        alignItems: "center"
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
