import React, { Component } from 'react';
import { Dimensions, FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import Avatar from '../Components/Avatar';
import HandleEffect from '../Components/HandleEffect';
import Text from '../Components/Text';
import Colors from '../Stylesheets/Colors';
import StyleMain from '../Stylesheets/StyleMain';
import {v1 as uuidv1} from 'uuid';
import Database from '../Database';
import Globals from '../Globals';

const dimensions = Dimensions.get('window');
const avatarSize = dimensions.width * 0.3;

// TODO: Reuse this screen for editing members of an existing chat
export default class RequestChat extends Component {

    constructor(props) {
        super(props);

        this.state = {
            profiles: [],
            selected: [],
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
        Globals.connection.current.on("ListEntitiesResponse", listing => this.onListEntitiesResponse(listing));

        // TODO: More data should be requested as user scrolls
        Globals.connection.current.emit("ListEntities");
        //this.forceUpdate();
    }

    // Callback when the invitations are confirmed.
    // For now this always creates a new chat
    onConfirm() {
        var id = uuidv1();
        console.log("Creating chat with id " + id);
        this.setState({chatID: id});
        this.props.navigation.navigate('Chat', { chatID: id });
    }
//disabled={this.state.selected.length == 0}
    render() {
        return (
            <View style={StyleMain.background}>
                {/* Handles screen opening callback */}
                <HandleEffect navigation={this.props.navigation} effect="focus" callback={() => this.onOpen()}/>

                {/* List of entities that the user can invite to chat */}
                <FlatList
                    data={this.state.profiles}
                    keyExtractor={item => item.id}
                    renderItem={({ item }) => (
                        <TouchableOpacity>
                            <Avatar avatar={item.avatar} size={avatarSize}></Avatar>
                        </TouchableOpacity>
                    )}
                />

                {/* Confirmation button invites or removes users from the chat */}
                <View style={styles.confirmButtonContainer}>
                    <TouchableOpacity
                        onPress={() => this.onConfirm()}
                        style={[StyleMain.button, styles.confirmButton]}
                    >
                        <Text style={[
                            StyleMain.buttonText,
                            { color: (this.state.selected.length == 0 ?
                                Colors.buttonTextDisabled : Colors.buttonText)}
                            ]}>Confirm</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }
}

const styles = StyleSheet.create({
    confirmButton: {
    },
    confirmButtonContainer: {
        flex: 1,
        position: "absolute",
        width: "100%",
        bottom: 0,
        paddingVertical: 30
    },
    avatar: {
        width: avatarSize,
        height: avatarSize,
        borderRadius: 10000
    },
});
