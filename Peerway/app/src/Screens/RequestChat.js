import React, { Component } from 'react';
import { Dimensions, FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import Avatar from '../Components/Avatar';
import HandleEffect from '../Components/HandleEffect';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Text from '../Components/Text';
import Colors from '../Stylesheets/Colors';
import StyleMain from '../Stylesheets/StyleMain';
import Database from '../Database';
import { CommonActions } from '@react-navigation/native';
import Peerway from '../Peerway';
import { Log } from '../Log';

const dimensions = Dimensions.get('window');
const avatarSize = dimensions.width * 0.2;
const paddingAmount = 8;

// TODO: Reuse this screen for editing members of an existing chat
export default class RequestChat extends Component {

    constructor(props) {
        super(props);

        this.state = {
            profiles: []
        }

        this.activeId = Database.active.getString("id");
    }

    // Callback handler for listing entities
    // TODO don't use the server listing, just known peers
    onListEntitiesResponse(listing) {
        this.state.profiles = listing.filter(x => x.id != this.activeId);

        // List all known peers as well, even if they're offline
        let query = Database.Execute("SELECT id,name,avatar FROM Peers");
        let mapped = query.data.map(peer => ({
            id: peer.id,
            name: peer.name,
            avatar: Peerway.GetAvatarPath(peer.id, peer.avatar, "file://")
        }));
        let idList = mapped.map(y => y.id);
        // Now merge the arrays
        this.state.profiles = this.state.profiles.filter(x => !(idList.includes(x.id))).concat(mapped);

        this.forceUpdate();
    }

    // Callback when this screen is opened.
    onOpen() {
        this.activeId = Database.active.getString("id");

        // CONSIDER: In future, only list friends?
        console.log("OPENED REQUEST CHAT");
        // Handle retrieval of entities list
        // TODO: Check if slice() copy is needed or not
        Peerway.server.off("ListEntitiesResponse");
        Peerway.server.on("ListEntitiesResponse", listing => this.onListEntitiesResponse(listing));

        // TODO: More data should be requested as user scrolls
        // TODO: Only list entities that the user knows of, i.e. mutuals and
        // other entities that they share a chat with.
        Peerway.server.emit("ListEntities", {
            page: 1,
            sort: "alphanumeric"
        });
    }

    // Callback when an entity is selected
    onSelect(item) {
        // Find an existing private chat with the peer
        let query = Database.Execute(
            "SELECT * FROM (" + 
                "SELECT Chats.type, ChatMembers.peer, ChatMembers.chat FROM Chats " +
                "INNER JOIN ChatMembers ON ChatMembers.peer='" + item.id + "') " +
            "WHERE type = 0"
        );
        Log.Debug("Query result = " + JSON.stringify(query.data));

        let meta = {};
        if (query.data.length > 0) {
            // Private chat already exists with this peer, open it
            meta.id = query.data[0].chat;
            Log.Debug("Private chat already exists, opening chat." + meta.id + " ...");
        } else {            
            // Private chat creation, type 0, using the entity ID as the chat ID
            let allMembers = [this.activeId, item.id];
            meta = Database.CreateChat(
                allMembers,
                { id: item.id, type: 0, read: 1 }
            );

            // TODO make sure this is secure, connect to the peer and verify or issue cert first?
            let sendChatRequest = (id) => {
                Log.Debug("Sending chat request to peer." + id);
                Peerway.NotifyEntities([id], {
                    type: "chat.request",
                    chatId: meta.id,
                    from: this.activeId,
                    name: meta.name,
                    members: allMembers,
                    key: meta.key,
                    version: meta.version,
                    group: 0 // Not a group chat, but a private chat
                });
            };

            // Issue a certificate to the peer if necessary - by requesting to chat with them,
            // you are implicitly trusting them.
            let query = Database.Execute(
                "SELECT id FROM Peers WHERE id='" + item.id + "' AND verifier!=''"
            );
            if (query.data.length != 0) {
                sendChatRequest(item.id);
            } else {
                Peerway.IssueCertificate(item.id).then(() => {
                    Log.Debug("Certificate issued!");
                    sendChatRequest(item.id);
                }).catch((e) => Log.Error(e));
            }

            console.log("Created chat with id " + meta.id);
        }

        this.props.navigation.dispatch(
            CommonActions.reset({
                index: 2,
                routes: [{ name: 'Overview' }, { name: 'Chat', params: { chatId: meta.id } }]
            })
        );
    }

    onCreateGroupChat() {
        this.props.navigation.navigate("CreateGroupChat");
    }

    render() {
        return (
            <View style={StyleMain.background}>
                {/* Handles screen opening callback */}
                <HandleEffect navigation={this.props.navigation} effect="focus" callback={() => this.onOpen()}/>

                {/* List of entities that the user can request to chat */}
                <FlatList
                    ListHeaderComponent={(props) => (
                        <View style={{backgroundColor: Colors.button}}>
                        <TouchableOpacity onPress={() => this.onCreateGroupChat()} style={styles.selectable}>
                            <View style={styles.avatar}>
                                <Icon name="account-multiple-plus" size={avatarSize} color={"#fff"} />
                            </View>
                            <Text
                                numberOfLines={1}
                                style={[styles.nameText, {color: "white", fontSize: 18}]}>
                                {"Create a group chat"}
                            </Text>
                        </TouchableOpacity>
                        <View style={[StyleMain.edge, {backgroundColor: "#ccc"}]}></View>
                        </View>
                    )}
                    data={this.state.profiles}
                    keyExtractor={item => item.id}
                    renderItem={({ item }) => (
                        <View style={styles.item}>
                        <TouchableOpacity onPress={() => this.onSelect(item)} style={styles.selectable}>
                            <Avatar avatar={item.avatar} size={avatarSize} style={styles.avatar}></Avatar>
                            <Text
                                numberOfLines={1}
                                style={styles.nameText}>
                                {item.name}
                            </Text>
                        </TouchableOpacity>
                        <View style={[StyleMain.edge, {backgroundColor: "#ccc"}]}></View>
                        </View>
                    )}
                />
            </View>
        );
    }
}

const styles = StyleSheet.create({
    avatar: {
        position: "absolute",
        left: paddingAmount,
        top: paddingAmount,
    },
    selectable: {
        padding: paddingAmount,
        justifyContent: "center",
        height: paddingAmount * 2 + avatarSize
    },
    nameText: {
        left: paddingAmount + paddingAmount + avatarSize,
        width: dimensions.width - (paddingAmount * 4 + avatarSize * 2),
    },
    confirmButton: {
    },
    confirmButtonContainer: {
        flex: 1,
        position: "absolute",
        width: "100%",
        bottom: 0,
        paddingVertical: 30
    },
    item: {
        backgroundColor: "#fff"
    }
});
