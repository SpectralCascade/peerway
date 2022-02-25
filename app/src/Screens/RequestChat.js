import React, { Component } from 'react';
import { Dimensions, FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import HandleEffect from '../Components/HandleEffect';
import Text from '../Components/Text';
import Colors from '../Stylesheets/Colors';
import StyleMain from '../Stylesheets/StyleMain';

const dimensions = Dimensions.get('window');
const avatarSize = dimensions.width * 0.3;

export default class RequestChat extends Component {

    constructor(props) {
        super(props);

        this.state = {
            profiles: [],
            selected: [],
        }
    }

    // Refresh connection to peers.
    refresh() {
    }

    // Callback when this screen is opened.
    onOpen() {
        // TODO: Load up first X peers found on the network
        // TODO: In future, only list friends unless search terms are entered.
        console.log("OPENED REQUEST CHAT");
        this.forceUpdate();
    }

    // Callback when the invitations are confirmed.
    onInviteToChat() {
    }

    render() {
        return (
            <View style={StyleMain.background}>
                <HandleEffect navigation={this.props.navigation} effect="focus" callback={() => {
                    this.onOpen();
                }}/>

                <FlatList
                    data={this.state.profiles}
                    keyExtractor={item => item.id}
                    renderItem={({ item }) => (
                        <TouchableOpacity>

                        </TouchableOpacity>
                    )}
                />

                <View style={styles.confirmButtonContainer}>
                    <TouchableOpacity
                        disabled={this.state.selected.length == 0}
                        onPress={() => this.onInviteToChat()}
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
