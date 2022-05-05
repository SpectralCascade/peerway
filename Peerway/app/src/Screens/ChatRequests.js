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
import Popup from '../Components/Popup';

const dimensions = Dimensions.get('window');
const iconSize = dimensions.width * 0.2;
const paddingAmount = 8;

export default class ChatRequests extends Component {

    constructor(props) {
        super(props);

        this.state = {
            requests: [],
            popup: {
                title: "",
                content: ""
            }
        }

        this.activeId = Database.active.getString("id");
        this.popup = React.createRef();
    }

    // Callback when this screen is opened.
    onOpen() {
        this.activeId = Database.active.getString("id");
        Log.Debug("OPENED CHAT REQUESTS");

        // Load chat request entries
        let requests = Database.Execute(
            "SELECT id,name,type,accepted FROM Chats WHERE accepted=0"
        ).data.map((chat, index) => {
            Log.Debug("Chat = " + JSON.stringify(chat));
            let icon = chat.type ? "file://" + Peerway.GetChatPath(chat.id) : "";
            let name = chat.name;
            // Handle private chats
            if (chat.type == 0) {
                let query = Database.Execute(
                    "SELECT Peers.id, Peers.avatar, Peers.name FROM Peers " + 
                    "INNER JOIN ChatMembers ON ChatMembers.peer=Peers.id WHERE " + 
                        "ChatMembers.chat=? AND ChatMembers.peer!=?",
                    [chat.id, this.activeId]
                );
                if (query.data.length > 0) {
                    let peer = query.data[0];
                    name = peer.name;
                    icon = Peerway.GetAvatarPath(peer.id, peer.avatar, "file://");
                }
            }

            return {
                id: chat.id,
                index: index,
                type: chat.type,
                name: name,
                icon: icon
            }
        });
        
        this.setState({requests: requests});
    }

    // Callback when a request is accepted
    onRequestAccept(item) {
        Database.Execute("UPDATE Chats SET accepted=1 WHERE id=?", [item.id]);

        this.state.requests.splice(item.index, 1);
        this.setState({requests: this.state.requests});

        // Automatically back out once all requests are handled.
        if (this.state.requests.length <= 0) {
            this.props.navigation.goBack();
        }
    }

    // Handle response to chat request
    onRequestPressed(item) {
        this.setState({popup: {
            title: "Respond to request",
            content: "Would you like to accept or delete this chat request? Deleting does not notify the peer who made the chat request.",
            positiveText: "Accept",
            positiveOnPress: () => this.onRequestAccept(item),
            negativeText: "Delete",
            negativeOnPress: () => {
                Database.DeleteChat(item.id);
                this.state.requests.splice(item.index, 1);
                this.setState({requests: this.state.requests});
                this.popup.current.Hide();
            },
            onClose: () => Log.Debug("Closed popup")
        }});
        this.popup.current.Show();
    }

    render() {
        return (
            <View style={StyleMain.background}>
                {/* Handles screen opening callback */}
                <HandleEffect navigation={this.props.navigation} effect="focus" callback={() => this.onOpen()}/>

                <Popup
                    title={this.state.popup.title}
                    content={this.state.popup.content}
                    positiveText={this.state.popup.positiveText}
                    positiveOnPress={this.state.popup.positiveOnPress}
                    negativeText={this.state.popup.negativeText}
                    negativeOnPress={this.state.popup.negativeOnPress}
                    onClose={this.state.popup.onClose}
                    ref={this.popup}
                />

                {/* List of entities that the user can request to chat */}
                <FlatList
                    data={this.state.requests}
                    keyExtractor={item => item.id}
                    renderItem={({ item }) => (
                        <View style={styles.item}>
                        <TouchableOpacity onPress={() => this.onRequestPressed(item)} style={styles.selectable}>
                            <Avatar avatar={item.icon} size={iconSize} style={styles.icon} />
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
    icon: {
        position: "absolute",
        left: paddingAmount,
        top: paddingAmount,
    },
    selectable: {
        padding: paddingAmount,
        justifyContent: "center",
        height: paddingAmount * 2 + iconSize
    },
    nameText: {
        left: paddingAmount + paddingAmount + iconSize,
        width: dimensions.width - (paddingAmount * 4 + iconSize * 2),
    },
    item: {
        backgroundColor: "#fff"
    }
});
