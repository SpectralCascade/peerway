import { CommonActions } from "@react-navigation/native";
import React from "react";
import { StyleSheet, ScrollView, TextInput, TouchableOpacity, View, Keyboard } from "react-native";
import ButtonText from "../Components/ButtonText";
import HandleEffect from "../Components/HandleEffect";
import Text from "../Components/Text";
import Constants from "../Constants";
import Database from "../Database";
import { Log } from "../Log";
import Colors from "../Stylesheets/Colors";
import StyleMain from "../Stylesheets/StyleMain";

export default class CreatePost extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            text: "",
            media: []
        };

        this.Init();
    }

    Init() {
        // TODO
    }

    OnOpen() {
        Log.Debug("OPENED POST CREATION SCREEN");
        this.Init();
        // Auto-close when keyboard is hidden if no text input given
        this.sub = Keyboard.addListener("keyboardDidHide", () => {
            if (this.state.text.length == 0) {
                this.sub.remove();
                this.state = {};
                this.props.navigation.goBack();
            }
        });
    }

    // Create the post in the database and publish it
    PublishPost() {
        Log.Debug("PUBLISHING POST...");
        Database.CreatePost(this.state.text, this.state.media);
        this.sub.remove();
        this.props.navigation.goBack();
    }

    render() {
        return (
            <View style={[StyleMain.background, {backgroundColor: "white"}]}>
                <HandleEffect navigation={this.props.navigation} effect="focus" callback={() => { this.OnOpen() }}/>

                <ScrollView style={{padding: 10}}>
                    <TextInput
                        onChangeText={(text) => this.setState({text: text}) } 
                        style={[{
                            textAlignVertical: "top",
                            color: "black",
                            fontSize: 18
                        }]}
                        value={this.state.text}
                        autoFocus
                        placeholder="Wazzup?"
                        placeholderTextColor="#999"
                        multiline={true}
                    />
                </ScrollView>

                <TouchableOpacity
                    disabled={this.state.text.length == 0}
                    style={[StyleMain.button, {
                        backgroundColor: this.state.text.length == 0 ? Colors.buttonDisabled : Colors.button
                    }]}
                    onPress={() => this.PublishPost()}
                >
                    <ButtonText style={{
                        color: this.state.text.length == 0 ? Colors.buttonTextDisabled : Colors.buttonText,
                        fontSize: 18
                    }}>Publish</ButtonText>
                </TouchableOpacity>
            </View>
        );
    }
}

const styles = StyleSheet.create({
});
