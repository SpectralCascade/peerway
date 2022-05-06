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
import ContextMenu from './ContextMenu';
import Popup from './Popup';
import moment from 'moment';

const avatarSize = Constants.avatarMedium;
const footerButtonSize = 36;

export default class Feed extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            posts: [],
            loading: false,
            syncing: false,
            contextOptions: [],
            popup: {
                title: "",
                content: ""
            },
            scrollPos: 0
        };

        this.contextMenu = React.createRef();
        this.popup = React.createRef();
        this.list = React.createRef();

        this.Init();
    }

    Init() {
        this.activeId = Database.active.getString("id");
        this.peers = {};
        this.peers[this.activeId] = JSON.parse(Database.active.getString("profile"));
        this.peers[this.activeId].avatar = this.peers[this.activeId].avatar.ext;
        this.onLoadComplete = this.props.onLoadComplete ? this.props.onLoadComplete : () => {};
        this.loadPosts = this.props.loadPosts ? this.props.loadPosts : (posts) => posts;
        this.syncPosts = this.props.syncPosts ? this.props.syncPosts : (onComplete) => onComplete();
        this.state.posts = this.Load(this.state.posts);
    }

    OnOpen() {
        Log.Debug("OPENED FEED");
        this.Init();
        this.SyncPosts();
    }

    OnSyncDone() {
        this.setState({syncing: false});
        Log.Debug("Feed syncing complete.");
    }

    Load(posts) {
        posts = this.loadPosts(posts);
        this.onLoadComplete();
        return posts;
    }

    // Get the latest posts
    SyncPosts() {
        this.setState({syncing: true});
        Log.Debug("Syncing feed...");
        this.syncPosts(() => this.OnSyncDone());
    }

    // View the post by itself
    OpenPost(post) {
        // TODO
        Log.Debug("Opened post." + post.id);
    }

    // Open the post options menu
    OpenContextMenu(post) {
        // TODO
        Log.Debug("Opened post context menu options");
        if (post.author === this.activeId) {
            this.setState({contextOptions: [
                {
                    name: "Delete post",
                    onPress: () => {
                        this.setState({popup: {
                            title: "Delete post",
                            content: "Are you sure you wish to delete this post? Doing so is only guaranteed to delete the post on your own device.",
                            positiveText: "Yes",
                            negativeText: "No",
                            positiveOnPress: () => {
                                Database.DeletePost(post.id);
                                this.contextMenu.current.Hide();
                                this.SyncPosts();
                            }
                        }});
                        this.popup.current.Show();
                    }
                },
                {
                    name: "Edit post",
                    onPress: () => {
                        this.props.navigation.navigate("CreatePost", { post: post });
                        this.contextMenu.current.Hide();
                    }
                }
            ]});
        } else {
            this.setState({contextOptions: [
                {
                    name: "Save post",
                    onPress: () => {
                        Log.Debug("TODO save/unsave post");
                    }
                }
            ]});
        }
        this.contextMenu.current.Show();
    }

    // Go to a specific peer profile
    GoProfile(id) {
        Log.Debug("Go to profile of peer." + id);
        let profileCanGo = this.props.route.name === "Profile"
            && (!this.props.route.params || this.props.route.params.peerId !== id);

        if (profileCanGo || this.props.route.name === "Feeds") {
            this.props.navigation.push("Profile", { peerId: id });
        }
    }

    GoReply(post) {
        this.props.navigation.navigate("CreatePost", { post: {
            content: "",
            media: [],
            parentPost: post.id,
            parentAuthor: post.author
        }});
    }

    GoToggleLike(post) {
        post.liked = post.liked ? 0 : 1;
        this.setState({posts: this.state.posts})
    }

    LoadNewPosts(autoScroll = true) {
        this.setState({ posts: this.Load([]) });
        if (autoScroll) {
            this.list.current.scrollToOffset({animated: true, offset: 0});
        }
    }

    render() {
        const RenderReplyInfo = (item) => {
            let isReply = item.parentPost && item.parentAuthor;
            let replyName = "[unknown]";
            if (item.parentAuthor === this.activeId) {
                let profile = JSON.parse(Database.active.getString("profile"));
                replyName = profile.name;
            } else {
                let query = Database.Execute("SELECT name FROM Peers WHERE id=?", [item.parentAuthor]);
                replyName = (query.data.length > 0 ? query.data[0].name : replyName);
            }
            return isReply ? (
                <TouchableOpacity
                    style={{flexDirection: "row"}}
                    onPress={() => this.GoProfile(item.parentAuthor)}
                >
                    <Icon name="reply-circle" size={avatarSize / 3} color="black" />
                    <Text style={{paddingLeft: 5}}>{"replying to "}</Text>
                    <Text style={{fontWeight: "bold"}}>{replyName}</Text>
                </TouchableOpacity>
            ) : (<></>);
        }

        return (
        <>
        <HandleEffect navigation={this.props.navigation} effect="focus" callback={() => { this.OnOpen() }}/>

        <ContextMenu
            title="Post Options"
            options={this.state.contextOptions}
            ref={this.contextMenu}
        />

        <Popup
            title={this.state.popup.title}
            content={this.state.popup.content}
            positiveText={this.state.popup.positiveText}
            positiveOnPress={this.state.popup.positiveOnPress}
            negativeText={this.state.popup.negativeText}
            negativeOnPress={this.state.popup.negativeOnPress}
            ref={this.popup}
        />

        <FlatList {...this.props} style={[StyleMain.background, this.props.style]}
            ref={this.list}
            onScroll={(event) => {
                this.setState({scrollPos: event.nativeEvent.contentOffset.y });
            }}
            onRefresh={() => {
                this.SyncPosts();
                this.LoadNewPosts();
            }}
            refreshing={this.state.syncing}
            onEndReached={() => {
                this.setState({posts: this.Load(this.state.posts)});
            }}
            data={this.state.posts}
            keyExtractor={item => item.id}
            renderItem={({ item }) => {
                let author = this.peers[item.author];
                if (!author) {
                    let query = Database.Execute("SELECT * FROM Peers WHERE id=?", [item.author]);
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
                                <Text style={styles.dateText}>{moment(new Date(item.created)).format("DD/MM/YYYY [at] HH:mm")}</Text>
                                {RenderReplyInfo(item)}
                            </View>
                            <TouchableOpacity style={{position: 'absolute', right: 10}} onPress={() => this.OpenContextMenu(item)}>
                                <Icon
                                    name="dots-vertical"
                                    size={avatarSize / 2}
                                    color="black"
                                />
                            </TouchableOpacity>
                        </View>

                        <TouchableHighlight underlayColor={"#fff4"} onPress={() => this.OpenPost(item)} style={styles.postContent}>
                            <Text style={styles.postContentText}>{item.content}</Text>
                        </TouchableHighlight>

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

                        <View style={{paddingBottom: 1, backgroundColor: "#999"}} />

                        {/* TODO show relevant reply posts (after MVP) */}

                    </View>
                    <View style={[StyleMain.edge, {backgroundColor: "#ccc"}]}></View>
                </View>
                );
            }
        }
        />
        </>
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
        paddingVertical: innerPadding,
        backgroundColor: "white"
    },
    postContentText: {
    },
    postHeader: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: edgePadding,
        paddingTop: edgePadding,
        paddingBottom: innerPadding,
        backgroundColor: "#eee"
    },
    postFooter: {
        flexDirection: "row",
        justifyContent: "space-evenly",
        backgroundColor: "#eee"
    }
});
