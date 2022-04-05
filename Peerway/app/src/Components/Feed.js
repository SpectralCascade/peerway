import React from 'react';
import HandleEffect from '../Components/HandleEffect';
import { TouchableOpacity, Image, View, ScrollView, StyleSheet, FlatList } from 'react-native';
import Database from '../Database';
import StyleMain from '../Stylesheets/StyleMain';
import Avatar from '../Components/Avatar';
import Peerway from '../Peerway';
import Text from '../Components/Text';
import { Log } from '../Log';
import Colors from '../Stylesheets/Colors';
import ButtonText from '../Components/ButtonText';
import Constants from '../Constants';

const iconSize = Constants.avatarMedium;

export default class Feed extends React.Component {
    constructor(props) {
        super(props);
        this.init();

        this.state = {
            posts: [
                {
                    author: this.activeId,
                    created: (new Date()).toISOString()
                }
            ],
        };
    }

    init() {
        this.activeId = Database.active.getString("id");
        this.peers = {};
        this.peers[this.activeId] = JSON.parse(Database.active.getString("profile"));
        this.peers[this.activeId].avatar = this.peers[this.activeId].avatar.ext;
    }

    OnOpen() {
        Log.Debug("OPENED FEED");

        this.init();
    }

    OnOpenPost(post) {
        // TODO
        Log.Debug("Opened post: " + JSON.stringify(post));
    }

    // Go to a specific peer profile
    OnGoProfile(id) {
        // TODO
        Log.Debug("Go to profile of peer." + id);
        if (this.props.route.name === "Profile"
        && this.props.route.params && this.props.route.params.peerId !== id) {
            this.props.navigation.push("Profile", { peerId: id });
        }
    }

    render() {
        return (
        <FlatList {...this.props} style={[StyleMain.background, this.props.style]}
            data={this.state.posts}
            keyExtractor={item => item.author}
            renderItem={({ item }) => {
                let author = this.peers[item.author];
                if (!author) {
                    let query = Database.Execute("SELECT * FROM Peers WHERE id='" + item.author + "'");
                    if (query.data.length > 0) {
                        Log.Debug("Loaded data for peer." + item.author);
                        this.peers[item.author] = query.data[0];
                        author = this.peers[item.author];
                    } else {
                        // TODO in these cases, request peer information
                        Log.Debug("No such known peer." + item.author);
                        author = {
                            name: "",
                            avatar: ""
                        }
                    }
                }

                return (
                <View>
                    <View style={styles.post}>
                        {/* Post header */}
                        <View style={styles.postHeader}>
                            <TouchableOpacity
                                style={[StyleMain.avatar, { width: iconSize, height: iconSize }]}
                                onPress={() => this.OnGoProfile(item.author)}
                            >
                                <Avatar
                                    avatar={Peerway.GetAvatarPath(item.author, author.avatar, "file://")}
                                    size={iconSize}
                                />
                            </TouchableOpacity>
                            <View style={{paddingHorizontal: 5, flexDirection: "column"}}>
                                <TouchableOpacity onPress={() => this.OnGoProfile(item.author)}>
                                    <Text style={styles.authorName}>{author.name}</Text>
                                </TouchableOpacity>
                                <Text style={styles.dateText}>{(new Date(item.created)).toLocaleDateString("en-GB")}</Text>
                            </View>
                        </View>

                        {/* TODO post content */}
                        <TouchableOpacity onPress={() => this.OnOpenPost(item)} style={styles.postContent}>
                        </TouchableOpacity>

                        {/* TODO post footer */}
                        <View style={styles.postFooter}>
                            {/* TODO UI buttons */}
                            <View style={{paddingBottom: 1, backgroundColor: "#999"}} />
                        </View>

                    </View>
                    <View style={[StyleMain.edge, {backgroundColor: "#ccc"}]}></View>
                </View>
                );
            }
        }
        />
        );
    }

}

const edgePadding = 10;
const innerPadding = 5;

const styles = StyleSheet.create({
    authorName: {
        fontWeight: "bold",
        color: "black",
        fontSize: 16
    },
    dateText: {
        color: "#555"
    },
    post: {},
    postContent: {
        paddingVertical: innerPadding,
        backgroundColor: Colors.avatarBackground
    },
    postHeader: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: edgePadding,
        paddingTop: edgePadding,
        paddingBottom: innerPadding
    },
    postFooter: {
    }
});
