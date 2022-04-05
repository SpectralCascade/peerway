import React from 'react';
import HandleEffect from '../Components/HandleEffect';
import { TouchableHighlight, TouchableOpacity, Image, View, ScrollView, StyleSheet, FlatList } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Database from '../Database';
import StyleMain from '../Stylesheets/StyleMain';
import Avatar from '../Components/Avatar';
import Peerway from '../Peerway';
import Text from '../Components/Text';
import { Log } from '../Log';
import Colors from '../Stylesheets/Colors';
import ButtonText from '../Components/ButtonText';
import Constants from '../Constants';

const avatarSize = Constants.avatarMedium;
const footerButtonSize = 36;

export default class Feed extends React.Component {
    constructor(props) {
        super(props);
        this.init();

        this.state = {
            posts: [
                {
                    author: this.activeId,
                    created: (new Date()).toISOString(),
                    liked: 0,
                    text: "bla bla bla",
                    media: []
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

    OpenPost(post) {
        // TODO
        Log.Debug("Opened post: " + JSON.stringify(post));
    }

    // Go to a specific peer profile
    GoProfile(id) {
        // TODO
        Log.Debug("Go to profile of peer." + id);
        if (this.props.route.name === "Profile"
        && this.props.route.params && this.props.route.params.peerId !== id) {
            this.props.navigation.push("Profile", { peerId: id });
        }
    }

    GoReply(post) {
    }

    GoToggleLike(post) {
        post.liked = post.liked == 0 ? 1 : 0;
        this.setState({posts: this.state.posts})
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
                                style={[StyleMain.avatar, { width: avatarSize, height: avatarSize }]}
                                onPress={() => this.GoProfile(item.author)}
                            >
                                <Avatar
                                    avatar={Peerway.GetAvatarPath(item.author, author.avatar, "file://")}
                                    size={avatarSize}
                                />
                            </TouchableOpacity>
                            <View style={{paddingHorizontal: 5, flexDirection: "column"}}>
                                <TouchableOpacity onPress={() => this.GoProfile(item.author)}>
                                    <Text style={styles.authorName}>{author.name}</Text>
                                </TouchableOpacity>
                                <Text style={styles.dateText}>{(new Date(item.created)).toLocaleDateString("en-GB")}</Text>
                            </View>
                        </View>

                        {/* TODO post content */}
                        <TouchableHighlight underlayColor={"#fff4"} onPress={() => this.OpenPost(item)} style={styles.postContent}>
                            <Text>{item.text}</Text>
                        </TouchableHighlight>

                        {/* TODO add this back (after MVP)
                        <View style={styles.postFooter}>
                            <TouchableOpacity onPress={() => this.GoReply(item)}>
                                <Icon
                                    name="comment-outline"
                                    size={footerButtonSize}
                                    color={Colors.button}
                                />
                            </TouchableOpacity>

                            <TouchableOpacity onPress={() => this.GoToggleLike(item)}>
                                <Icon
                                    name={item.liked ? "thumb-up" : "thumb-up-outline"}
                                    size={footerButtonSize}
                                    color={Colors.button}
                                />
                            </TouchableOpacity>
                        </View>
                        */}

                        <View style={{paddingBottom: 1, backgroundColor: "#999"}} />

                        {/* TODO show relevant reply posts (after MVP) */}

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
        paddingHorizontal: edgePadding,
        paddingVertical: innerPadding
    },
    postHeader: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: edgePadding,
        paddingTop: edgePadding,
        paddingBottom: innerPadding
    },
    postFooter: {
        flexDirection: "row",
        justifyContent: "space-evenly"
    }
});
