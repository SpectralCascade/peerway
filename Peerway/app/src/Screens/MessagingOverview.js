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
import { Log } from "../Log";
import Peerway from '../Peerway';
import RNFS from "react-native-fs";
import Avatar from '../Components/Avatar';

const topbarHeight = 56;
const iconSize = Constants.avatarMedium;
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
        this.activeId = "";
    }

    // Callback on navigating to this screen.
    OnOpen() {
        this.activeId = Database.active.getString("id");
        Log.Debug("OPENED MESSAGING OVERVIEW");
        Peerway.ConnectToSignalServer(
            Database.userdata.contains("SignalServerURL") ?
                Database.userdata.getString("SignalServerURL")
                : "http://" + Constants.server_ip + ":" + Constants.port
        );
        
        this.Refresh();

        // Handle all chat related events
        Peerway.removeAllListeners("chat.request");
        Peerway.removeAllListeners("chat.message");
        this.onChatRequest = Peerway.addListener("chat.request", (from, data) => {
            Log.Info("Received chat request from peer." + from);
            this.Refresh(false);
        });
        this.onChatMessage = Peerway.addListener("chat.message", (from, data) => {
            this.Refresh(false);
        });
    }

    OnClose() {
        Log.Debug("CLOSING MESSAGING OVERVIEW");
        if (this.onChatRequest) {
            this.onChatRequest.remove();
            this.onChatRequest = null;
        }
        if (this.onChatMessage) {
            this.onChatMessage.remove();
            this.onChatMessage = null;
        }
    }

    Refresh(doSync = true) {
        // Load up cached chats
        let chatIds = [];
        // Metadata about chats for syncing purposes
        let chatSyncMeta = [];
        let query = Database.Execute("SELECT id FROM Chats");
        if (query.data.length > 0) {
            chatIds = query.data.map(x => x.id);
        }
        this.state.chats = [];
        for (let i in chatIds) {
            let id = chatIds[i];

            let query = Database.Execute("SELECT * FROM Chats WHERE id='" + id + "'");
            if (query.data.length > 0) {
                let meta = query.data[0];

                // Add relevant data required for syncing
                if (doSync) {
                    chatSyncMeta.push({
                        id: id,
                        received: meta.received,
                        updated: meta.updated
                    });
                }

                // Get last message
                query = Database.Execute("SELECT * FROM Messages WHERE chat='" + id + "' AND id='" + meta.lastMessage + "'");
                let lastMessage = query.data.length > 0 ? query.data[0] : { peer: "", content: "", mime: "" };
                // Get peer who sent last message
                // TODO merge with above into single SQL query
                query = Database.Execute("SELECT * FROM Peers WHERE id='" + lastMessage.from + "'");
                let peer = query.data.length > 0 ? query.data[0] : {};

                // Generate chat name and grab the chat icon
                let chatName = meta.name;
                query = Database.Execute(
                    "SELECT * FROM (" + 
                    "SELECT Peers.id, Peers.name, Peers.avatar, ChatMembers.peer, ChatMembers.chat FROM Peers " +
                    "INNER JOIN ChatMembers ON ChatMembers.peer=Peers.id AND ChatMembers.chat='" + id + "') " +
                    "WHERE id != '" + this.activeId + "' "
                );

                if (query.data.length == 0) {
                    // CONSIDER: support/handle users messaging themselves?
                } else {
                    // Generate chat name if necessary
                    if (meta.name.length == 0) {
                        chatName = query.data[0].name;
                        for (let j = 1, countj = query.data.length; j < countj; j++) {
                            chatName += ", " + query.data[j].name;
                        }
                    }
                }

                // Create a chat entry for the UI
                // TODO load correct icon extension
                let icon = Peerway.GetChatPath(id) + ".png";
                let chatIndex = this.state.chats.length;
                this.state.chats.push({
                    id: id,
                    name: chatName,
                    icon: icon,
                    message: {
                        from: lastMessage.from === this.activeId ? "You: " : ("name" in peer ? peer.name + ": " : ""),
                        content: lastMessage.mime.startsWith("text/") ? lastMessage.content : lastMessage.mime,
                        // TODO instead of en-GB use device locale
                        timestamp: lastMessage.created ? (new Date(lastMessage.created)).toLocaleDateString("en-GB") : ""
                    },
                    read: meta.read
                });
                
                // Load up the chat icon if it exists
                RNFS.exists(icon).then((exists) => {
                    if (!exists && query.data.length == 1) {
                        // Use peer avatar as chat icon
                        icon = Peerway.GetPeerPath(query.data[0].id) + "." + query.data[0].avatar;
                        this.state.chats[chatIndex].icon = icon;
                        this.forceUpdate();
                    }
                }).catch((e) => {
                });

            } else {
                Log.Error("Chat " + id + " does not exist, but is listed!");
            }
        }

        if (doSync) {
            // Connect to peers to update chats
            // TODO only synchronise messages, not feeds
            Peerway.SyncPeers({
                chats: chatSyncMeta
            });
        }

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
                Database.Execute(
                    "UPDATE Chats SET read=1 WHERE id='" + chat.id + "'"
                );

                this.forceUpdate();
                this.props.navigation.navigate("Chat", { chatId: chat.id });
            }
        };

        const onOpenSettings = () => {
            this.props.navigation.navigate("Settings");
        }

        return (
            <SafeAreaView style={StyleMain.background}>
                
                <HandleEffect navigation={this.props.navigation} effect="focus" callback={() => { this.OnOpen() }}/>
                <HandleEffect navigation={this.props.navigation} effect="blur" callback={() => { this.OnClose() }}/>

                <View style={styles.topbar}>
                    <TouchableOpacity style={[styles.menuButton]}>
                        <Icon name="menu" size={topbarHeight * 0.9} color="black" style={[]} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => onOpenSettings()} style={[styles.settingsButton]}>
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
                            <View style={styles.chatIcon}>
                                <Avatar avatar={"file://" + item.icon} size={iconSize} />
                            </View>
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
