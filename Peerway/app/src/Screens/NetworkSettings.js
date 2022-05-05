import React from "react";
import { StyleSheet, ScrollView, View } from "react-native";
import HandleEffect from "../Components/HandleEffect";
import Database from "../Database";
import { Log } from "../Log";
import Colors from "../Stylesheets/Colors";
import StyleMain from "../Stylesheets/StyleMain";
import DefaultSettings from "../DefaultSettings";
import Popup from "../Components/Popup";
import Peerway from "../Peerway";
import Widget from "../Components/Widget";

export default class NetworkSettings extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            settings: JSON.parse(JSON.stringify(DefaultSettings)),
            popup: {
                title: "",
                content: ""
            },
        }

        this.popup = React.createRef();

        this.Init();
    }

    Init() {
        Object.keys(this.state.settings).forEach((key) => {
            if (Database.userdata.contains(key)) {
                let value = Database.userdata.getString(key);
                this.state.settings[key] = typeof(this.state.settings[key]) === "number" ? 
                    parseFloat(value) : value;
            } else {
                Database.userdata.set(key, this.state.settings[key]);
            }
        });
    }

    OnOpen() {
        Log.Debug("OPENED SHARING & PRIVACY SETTINGS SCREEN");
        this.Init();
    }

    render() {
        return (
            <View style={[StyleMain.background]}>
                <HandleEffect navigation={this.props.navigation} effect="focus" callback={() => { this.OnOpen() }}/>

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

                <ScrollView style={{padding: 10}}>
                    <Widget.Text title="Signal Server URL" name="SignalServerURL" parent={this}/>
                </ScrollView>
            </View>
        );
    }
}

const styles = StyleSheet.create({
    widgetButton: {
        backgroundColor: Colors.button,
        height: 40,
        marginTop: 12
    }
});
