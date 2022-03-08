import { CommonActions } from '@react-navigation/native';
import React from 'react';
import { Image, View } from 'react-native';
import AppState from '../AppState';
import HandleEffect from '../Components/HandleEffect';
import Text from '../Components/Text';
import Database from '../Database';
import StyleMain from '../Stylesheets/StyleMain';

export default class SplashScreen extends React.Component {

    onOpen() {
        console.log("Opened splash screen...");
        // Check if there is an active entity
        if (Database.userdata.contains("active")) {
            let active = Database.userdata.getString("active");
            console.log("Switching to active entity " + active);
            Database.SwitchActiveEntity(active);
            this.props.navigation.dispatch(
                CommonActions.reset({
                    index: 1,
                    routes: [{ name: 'MessagingOverview' }]
                })
            );
        } else {
            this.props.navigation.dispatch(
                CommonActions.reset({
                    index: 1,
                    routes: [{ name: 'Setup' }]
                })
            );
        }
    }

    render() {
        return (
            <View style={[StyleMain.background, {justifyContent: "center"}]}>
                <HandleEffect navigation={this.props.navigation} effect="focus" callback={() => this.onOpen()}/>
                
                <Image source={require("../../assets/Logo.png")} />
                <Text style={{fontSize: 24, fontWeight: "bold", fontFamily: "monospace"}}>Peerway</Text>
            </View>
        );
    }
}
