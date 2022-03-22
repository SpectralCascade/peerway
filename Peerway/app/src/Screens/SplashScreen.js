import { CommonActions } from '@react-navigation/native';
import React from 'react';
import { Image, View } from 'react-native';
import AppState from '../AppState';
import HandleEffect from '../Components/HandleEffect';
import Text from '../Components/Text';
import Database from '../Database';
import { Log } from '../Log';
import StyleMain from '../Stylesheets/StyleMain';

export default class SplashScreen extends React.Component {

    OpenSetup() {
        setTimeout(() => {
            this.props.navigation.dispatch(
                CommonActions.reset({
                    index: 1,
                    routes: [{ name: 'Setup' }]
                })
            );
        }, 1000);
    }

    onOpen() {
        Log.Debug("Opened splash screen...");
        // Check if there is an active entity
        let active = "";
        if (Database.userdata.contains("active")) {
            active = Database.userdata.getString("active");
        }
        
        if (active && active.length > 0) {
            Log.Info("Switching to active entity " + active);
            Database.SwitchActiveEntity(active);
            this.props.navigation.dispatch(
                CommonActions.reset({
                    index: 1,
                    routes: [{ name: 'MessagingOverview' }]
                })
            );
        } else {
            this.OpenSetup();
        }
    }

    render() {
        return (
            <View style={[StyleMain.background, {justifyContent: "center", alignItems: "center"}]}>
                <HandleEffect navigation={this.props.navigation} effect="focus" callback={() => this.onOpen()}/>
                
                <Image source={require("../../assets/Logo.png")} />
                <Text style={{fontSize: 24, fontWeight: "bold", fontFamily: "monospace"}}>Peerway</Text>
            </View>
        );
    }
}
