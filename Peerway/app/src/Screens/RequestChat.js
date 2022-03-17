import React, { Component } from 'react';
import { Dimensions, FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import Avatar from '../Components/Avatar';
import HandleEffect from '../Components/HandleEffect';
import Text from '../Components/Text';
import Colors from '../Stylesheets/Colors';
import StyleMain from '../Stylesheets/StyleMain';
import Database from '../Database';
import { CommonActions } from '@react-navigation/native';
import Peerway from '../Peerway';

const dimensions = Dimensions.get('window');
const avatarSize = dimensions.width * 0.2;
const paddingAmount = 8;

// TODO: Reuse this screen for editing members of an existing chat
export default class RequestChat extends Component {

    constructor(props) {
        super(props);

        this.state = {
            profiles: [],
            selected: {},
            chatID: "",
        }
    }

    // Callback handler for listing entities
    onListEntitiesResponse(listing) {
        this.state.profiles = listing.slice();
        this.forceUpdate();
    }

    // Callback when this screen is opened.
    onOpen() {
        // TODO: Load up first X peers found on the network
        // TODO: In future, only list friends unless search terms are entered.
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
        if (item.clientId in this.state.selected) {
            delete this.state.selected[item.clientId];
        } else {
            this.state.selected[item.clientId] = item.id;
        }
        this.forceUpdate();
    }

    // Callback when the invitations are confirmed.
    // For now this always creates a new chat
    onConfirm() {
        // TODO REMOVE ME debug only
        Database.active.delete("chats");
        Database.active.delete("peers");

        // Create a chat entry in the database
        let selected = this.state.profiles.filter(item => item.clientId in this.state.selected);
        let id = Database.CreateChat(selected);
        let chats = Database.active.contains("chats") ? JSON.parse(Database.active.getString("chats")) : [];
        // Add chat to top
        chats = [id].concat(chats);
        Database.active.set("chats", JSON.stringify(chats));

        // Add peer entries when necessary
        for (i in selected) {
            console.log("Adding peer " + selected[i].id);
            Database.AddPeer(selected[i].id);
            let peer = JSON.parse(Database.active.getString("peer." + selected[i].id));
            // This will be the most up-to-date data, so overwrite.
            peer.name = selected[i].name;
            peer.avatar = selected[i].avatar;
            //Database.active.set("peer." + selected[i].id, JSON.stringify(peer));
        }

        console.log("Created chat with id " + id);

        this.setState({chatID: id});
        // TODO: Open chat instead of messaging overview
        this.props.navigation.dispatch(
            CommonActions.reset({
                index: 1,
                routes: [{ name: 'MessagingOverview' }]
            })
        );
        //this.props.navigation.navigate("Chat", { chatID: id });
    }

    render() {
        let didSelect = Object.keys(this.state.selected).length != 0;
        return (
            <View style={StyleMain.background}>
                {/* Handles screen opening callback */}
                <HandleEffect navigation={this.props.navigation} effect="focus" callback={() => this.onOpen()}/>

                {/* List of entities that the user can invite to chat */}
                <FlatList
                    data={this.state.profiles}
                    keyExtractor={item => item.clientId}
                    renderItem={({ item }) => {
                        // Don't list the active entity...
                        return item.id === Database.active.getString("id") ? (<></>) : 
                        (
                        <View style={styles.item}>
                        <TouchableOpacity onPress={() => this.onSelect(item)} style={styles.selectable}>
                            <Avatar avatar={item.avatar} size={avatarSize} style={styles.avatar}></Avatar>
                            <Text
                                numberOfLines={1}
                                style={styles.nameText}>
                                {item.name}
                            </Text>
                            <View style={[
                                styles.checkbox,
                                item.clientId in this.state.selected ? styles.checked : styles.unchecked
                            ]}>
                            </View>
                        </TouchableOpacity>
                        <View style={[StyleMain.edge, {backgroundColor: "#ccc"}]}></View>
                        </View>
                        );
                    }}
                />

                {/* Confirmation button invites or removes users from the chat */}
                <View style={styles.confirmButtonContainer}>
                    <TouchableOpacity
                        disabled={!didSelect}
                        onPress={() => { this.onConfirm(); }}
                        style={[StyleMain.button, styles.confirmButton]}
                    >
                        <Text style={[
                            StyleMain.buttonText,
                            { color: (didSelect ?
                                Colors.buttonText : Colors.buttonTextDisabled)}
                            ]}>Confirm</Text>
                    </TouchableOpacity>
                </View>
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
    checkbox: {
        position: "absolute",
        right: paddingAmount,
        width: avatarSize * 0.5,
        height: avatarSize * 0.5
    },
    checked: {
        backgroundColor: "#afa"
    },
    unchecked: {
        backgroundColor: "#777"
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
