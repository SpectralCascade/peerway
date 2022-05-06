import { CommonActions } from "@react-navigation/native";
import React from "react";
import { StyleSheet, ScrollView, TextInput, TouchableOpacity, View, Keyboard } from "react-native";
import ButtonText from "../Components/ButtonText";
import HandleEffect from "../Components/HandleEffect";
import Text from "../Components/Text";
import Constants from "../Constants";
import Database from "../Database";
import { Log } from "../Log";
import Peerway from "../Peerway";
import Colors from "../Stylesheets/Colors";
import StyleMain from "../Stylesheets/StyleMain";

export default class CreatePost extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            content: "",
            media: []
        };

        this.Init();
    }

    Init() {
        this.activeId = Database.active.getString("id");
        if (this.props.route.params && this.props.route.params.post) {
            this.state = JSON.parse(JSON.stringify(this.props.route.params.post));
        } else {
            this.state = {
                content: "",
                media: []
            }
        }
    }

    OnOpen() {
        Log.Debug("OPENED POST CREATION SCREEN");
        this.Init();
        if (this.state.id) {
            this.props.navigation.setOptions({ title: "Edit Post"});
        } else if (this.state.parentPost && this.state.parentAuthor) {
            let parentName = "[unknown]";
            if (this.state.parentAuthor === this.activeId) {
                let profile = JSON.parse(Database.active.getString("profile"));
                parentName = profile.name;
            } else {
                let query = Database.Execute("SELECT name FROM Peers WHERE id=?", [this.state.parentAuthor]);
                parentName = (query.data.length > 0 ? query.data[0].name : parentName);
            }
            this.props.navigation.setOptions({ title: "Reply to " + parentName});
        } else {
            this.props.navigation.setOptions({ title: "Publish Post" });
        }
        // Auto-close when keyboard is hidden if no text input given
        this.sub = Keyboard.addListener("keyboardDidHide", () => {
            if (this.state.content.length == 0) {
                this.sub.remove();
                this.state = {};
                this.props.navigation.goBack();
            }
        });
        this.forceUpdate();
    }

    // Create the post in the database and publish it
    PublishPost() {

        let post = this.state;
        if (this.state.id) {
            Log.Debug("PUBLISHING POST WITH CHANGES...");
            post.version = post.version + 1;
            post.edited = (new Date()).toISOString();
            post.media = JSON.stringify(post.media);
            Database.CachePost(post);
            post.media = [];
        } else if (this.state.parentPost && this.state.parentAuthor) {
            Log.Debug("PUBLISHING REPLY POST...");
            post = Database.CreatePost(
                this.state.content,
                this.state.media,
                Constants.visibility.mutuals,
                this.state.parentPost,
                this.state.parentAuthor
            );
        } else {
            Log.Debug("PUBLISHING POST...");
            post = Database.CreatePost(this.state.content, this.state.media, Constants.visibility.mutuals);
        }

        // Notify subscribers
        let query = Database.Execute("SELECT sub FROM Subscriptions WHERE pub=?", [this.activeId]);
        let subs = query.data.map(x => x.sub);
        Peerway.MulticastRequest(subs, {
            type: "post.publish",
            id: post.id,
            created: post.created
        });

        this.sub.remove();
        this.props.navigation.goBack();
    }

    render() {
        let disabledButton = this.state.content.length == 0 || 
            (this.state.id && this.state.content === this.props.route.params.post.content);

        return (
            <View style={[StyleMain.background, {backgroundColor: "white"}]}>
                <HandleEffect navigation={this.props.navigation} effect="focus" callback={() => { this.OnOpen() }}/>

                <ScrollView style={{padding: 10}}>
                    <TextInput
                        onChangeText={(text) => this.setState({content: text}) } 
                        style={[{
                            textAlignVertical: "top",
                            color: "black",
                            fontSize: 18
                        }]}
                        value={this.state.content}
                        autoFocus
                        placeholder="Wazzup?"
                        placeholderTextColor="#999"
                        multiline={true}
                    />
                </ScrollView>

                <TouchableOpacity
                    disabled={disabledButton}
                    style={[StyleMain.button, {
                        backgroundColor: disabledButton ? Colors.buttonDisabled : Colors.button
                    }]}
                    onPress={() => this.PublishPost()}
                >
                    <ButtonText style={{
                        color: disabledButton ? Colors.buttonTextDisabled : Colors.buttonText,
                        fontSize: 18
                    }}>{this.state.id ? "Publish Changes" : "Publish"}</ButtonText>
                </TouchableOpacity>
            </View>
        );
    }
}

const styles = StyleSheet.create({
});
