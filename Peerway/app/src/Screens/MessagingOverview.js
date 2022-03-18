import { StyleSheet, View, Image, TouchableOpacity, ScrollView, FlatList, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import React, { Component } from 'react';
import StyleMain from '../Stylesheets/StyleMain';
import Text from '../Components/Text';
import Database from '../Database';
import Icon from 'react-native-vector-icons/MaterialIcons'; 
import Colors from '../Stylesheets/Colors';
import HandleEffect from '../Components/HandleEffect';
import Constants from '../Constants';
import Log from "../Log";
import Peerway from '../Peerway';

const topbarHeight = 56;
const iconSize = 56;
const paddingAmount = 8;

export default class MessagingOverview extends Component {

    // List of peers that need to be connected.
    peersToConnect = [];
    // Peer entities that have been requested to connect, keyed by client id.
    peersPending = {};
    // ICE candidates that need to be sent once a peer has accepted the connection.
    pendingCandidates = {};

    // Setup initial state
    constructor(props) {
        super(props);
        this.state = {
            chats: []
        }
    }

    // Callback on navigating to this screen.
    OnOpen() {
        Log.Debug("OPENED MESSAGING OVERVIEW");
        Peerway.ConnectToSignalServer("http://" + Constants.server_ip + ":" + Constants.port);

        // Load up cached chats
        let chatIds = [];
        // Metadata about chats for syncing purposes
        let chatSyncMeta = [];
        if (Database.active.contains("chats")) {
            chatIds = JSON.parse(Database.active.getString("chats"));
            Log.Debug("Chats = " + JSON.stringify(chatIds));
        }
        this.state.chats = [];
        for (let i in chatIds) {
            let id = chatIds[i];
            if (Database.active.contains("chat." + id)) {
                let meta = JSON.parse(Database.active.getString("chat." + id));

                // Add relevant data required for syncing
                chatSyncMeta.push({
                    id: id,
                    received: meta.received,
                    updated: meta.updated
                });

                // Create a chat entry for the UI
                this.state.chats.push({
                    id: id,
                    name: meta.name,
                    message: {
                        from: meta.lastFrom,
                        content: meta.lastMessage,
                        timestamp: (new Date(meta.received)).toLocaleDateString("en-GB")
                    },
                    icon: meta.icon,
                    read: meta.read
                });
            } else {
                Log.Error("Chat " + id + " does not exist, but is listed!");
            }
        }

        // Connect to peers to update chats
        // TODO only synchronise messages, not feeds
        Peerway.SyncPeers({
            config: {
                chats: chatSyncMeta
            }
        });

        this.forceUpdate();
    }

    render() {
        const onCreateChat = () => {
            this.props.navigation.navigate("RequestChat");
        };

        const onOpenChat = (chat) => {
            chat = chat != null ? this.state.chats.find((item) => item.id === chat.id) : null;
            if (chat != null) {
                chat.read = true;
                this.forceUpdate();
                this.props.navigation.navigate("Chat");
            }
        };

        return (
            <SafeAreaView style={StyleMain.background}>
                
                <HandleEffect navigation={this.props.navigation} effect="focus" callback={() => { this.OnOpen() }}/>

                <View style={styles.topbar}>
                    <TouchableOpacity style={[styles.menuButton]}>
                        <Icon name="menu" size={topbarHeight * 0.9} color="black" style={[]} />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.settingsButton]}>
                        <Icon name="settings" size={topbarHeight * 0.9} color="black" style={[]} />
                    </TouchableOpacity>
                </View>
                <View style={styles.edge}></View>

                <FlatList
                    data={this.state.chats}
                    keyExtractor={item => item.id}
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
                                    {item.message.from + item.message.content}
                                </Text>
                            </View>
                            <Text style={styles.chatTimestamp}>{item.message.timestamp}</Text>
                        </TouchableOpacity>
                        <View style={[StyleMain.edge, {backgroundColor: "#ccc"}]}></View>
                        </View>
                    )}
                />

                <TouchableOpacity onPress={() => onCreateChat()} style={styles.newChatButton}>
                    <Icon name="chat" size={iconSize * 0.8} color="white" />
                </TouchableOpacity>

            </SafeAreaView>
        );
    }
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
