import React, { Component } from 'react';
import { Dimensions, FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import Avatar from '../Components/Avatar';
import HandleEffect from '../Components/HandleEffect';
import Text from '../Components/Text';
import Colors from '../Stylesheets/Colors';
import StyleMain from '../Stylesheets/StyleMain';
import {v1 as uuidv1} from 'uuid';
import Database from '../Database';
import AppState from '../AppState';
import { CommonActions } from '@react-navigation/native';

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
        AppState.connection.current.off("ListEntitiesResponse");
        AppState.connection.current.on("ListEntitiesResponse", listing => this.onListEntitiesResponse(listing));

        // TODO: More data should be requested as user scrolls
        // TODO: Only list entities that the user knows of, i.e. mutuals and
        // other entities that they share a chat with.
        AppState.connection.current.emit("ListEntities", {
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
        let selected = this.state.profiles.filter(item => item.clientId in this.state.selected);
        let id = Database.CreateChat(selected);
        console.log("CONTAINS CHATS = " + Database.active.contains("chats"));
        let chats = Database.active.contains("chats") ? JSON.parse(Database.active.getString("chats")) : [];
        chats.push(id);
        Database.active.set("chats", JSON.stringify(chats));
        console.log("Creating chat with id " + id + " to go with chats:\n" + JSON.stringify(chats));
        console.log("CONTAINS CHATS = " + Database.active.contains("chats"));
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
