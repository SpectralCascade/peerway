import React, { Component } from 'react';
import { View } from 'react-native';
import HandleEffect from '../Components/HandleEffect';
import StyleMain from '../Stylesheets/StyleMain';

export default class RequestChat extends Component {

    constructor(props) {
        super(props);
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

    render() {
        return (
            <View style={StyleMain.background}>
                <HandleEffect navigation={this.props.navigation} effect="focus" callback={() => {
                    this.onOpen();
                }}/>
            </View>
        );
    }

}