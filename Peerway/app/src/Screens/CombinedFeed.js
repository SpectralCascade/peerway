import React from 'react';
import HandleEffect from '../Components/HandleEffect';
import { TouchableOpacity, Image, View, ScrollView, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Database from '../Database';
import StyleMain from '../Stylesheets/StyleMain';
import Avatar from '../Components/Avatar';
import Peerway from '../Peerway';
import Text from '../Components/Text';
import { Log } from '../Log';
import Colors from '../Stylesheets/Colors';
import ButtonText from '../Components/ButtonText';
import Feed from '../Components/Feed';
import Constants from '../Constants';
import { SafeAreaView } from 'react-native-safe-area-context';

export default class CombinedFeed extends React.Component {
    constructor(props) {
        super(props);
        this.init();

        this.state = {
            hasNewPosts: false
        }

        this.feed = React.createRef();
    }

    init() {
        this.activeId = Database.active.getString("id");
    }

    OnOpen() {
        Log.Debug("OPENED COMBINED FEED");

        this.init();

        this.OnPostReceived = Peerway.addListener(
            "post.response.end",
            (from, data) => this.OnPostResponse(from, data)
        );
    }

    OnClose() {
        Log.Debug("CLOSED COMBINED FEED");

        if (this.OnPostReceived) {
            this.OnPostReceived.remove();
            this.OnPostReceived = undefined;
        }
    }

    OnPostResponse(from, data) {
        this.setState({hasNewPosts: true});
        if (this.onSyncComplete) {
            this.onSyncComplete();
        }
    }

    LoadNewPosts() {
        this.feed.current.LoadNewPosts();
        this.setState({hasNewPosts: false});
    }

    // Toggle follow/unfollow of an entity
    // TODO merge with similar code in Profile.js
    GoToggleSubscribe(peer) {
        if (this.state.subscribed) {
            // TODO show confirmation popup
            this.setState({subscribed: 0});
            Database.Execute(
                "DELETE FROM Subscriptions WHERE " + 
                    "pub='" + peer + "' AND sub='" + this.activeId + "'"
            );
            Peerway.NotifyEntities([peer], {
                type: "peer.unsub"
            });
            Log.Debug("Unsubscribed from peer." + peer);
        } else {
            this.setState({subscribed: 1});
            Database.Execute(
                "INSERT INTO Subscriptions (pub,sub) VALUES ('" + peer + "','" + this.activeId + "')"
            );
            Peerway.NotifyEntities([peer], {
                type: "peer.sub"
            });
            Log.Debug("Subscribed to peer." + peer);
        }
    }

    // Go to the post creation screen
    GoCreatePost() {
        this.props.navigation.navigate("CreatePost");
    }

    render() {
        // TODO
        const renderHeader = () => (
            <View style={StyleMain.background}>
                <HandleEffect navigation={this.props.navigation} effect="focus" callback={() => { this.OnOpen() }}/>
                <HandleEffect navigation={this.props.navigation} effect="blur" callback={() => { this.OnClose() }}/>
                <View style={{paddingBottom: 3, backgroundColor: Colors.avatarBackground}} />
            </View>
        );

        const renderLoadPostsButton = () => {
            return this.state.hasNewPosts ? (
                <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center"}}>
                    <TouchableOpacity onPress={() => this.LoadNewPosts()} style={styles.loadNewPostsButton}>
                        <ButtonText>Load new posts</ButtonText>
                    </TouchableOpacity>
                </View>
            ) : (<></>);
        };

        return (
            <SafeAreaView style={StyleMain.background}>
                <Feed
                    ref={this.feed}
                    route={this.props.route}
                    navigation={this.props.navigation}
                    ListHeaderComponent={() => renderHeader()}
                    syncPosts={(onComplete) => {
                        this.onSyncComplete = onComplete;

                        let query = Database.Execute(
                            "SELECT pub FROM Subscriptions WHERE sub='" + this.activeId + "'"
                        );

                        for (let i in query.data) {
                            let peer = query.data[i].pub;

                            let config = Peerway.GetSyncConfigPosts(peer);
                            config.sub = 1;
                            config.selectedPeers = [peer];
                            Peerway.SyncPeers(config);
                        }

                        if (this.onSyncComplete) {
                            this.onSyncComplete();
                        }
                    }}
                    loadPosts={(posts) => {
                        /*
                        "SELECT * FROM (" +
                            "SELECT Chats.id, Chats.name, Chats.read, Chats.lastMessage, Messages.created " +
                            "FROM Chats INNER JOIN Messages " + 
                                "ON Messages.id=Chats.lastMessage AND Messages.chat=Chats.id" +
                        ")"
                        */
                        let query = Database.Execute(
                            "SELECT * FROM (" + 
                                "SELECT * FROM Posts INNER JOIN Subscriptions " + 
                                    "ON Subscriptions.sub='" + this.activeId + "' " + 
                                    "AND Subscriptions.pub=Posts.author" +
                            ") " +
                            (posts.length > 0 ?
                                ("WHERE created < '" + posts[posts.length - 1].created + "' ") :
                                ""
                            ) +
                            "ORDER BY created DESC LIMIT 10"
                        );
                        if (query.data.length > 0) {
                            for (let i in query.data) {
                                query.data[i].media = JSON.parse(query.data[i].media);
                                posts.push(query.data[i]);
                            }
                        }
                        return posts;
                    }}
                    style={styles.content}
                />
                
                <TouchableOpacity onPress={() => this.GoCreatePost()} style={styles.newPostButton}>
                    <Icon name="plus" size={Constants.floatingButtonSize * 0.6} color="white" />
                </TouchableOpacity>

                {renderLoadPostsButton()}

            </SafeAreaView>
        );
    }
    
}

const styles = StyleSheet.create({
    content: {
    },
    newPostButton: {
        position: "absolute",
        right: Constants.paddingGap * 2,
        bottom: Constants.paddingGap * 2,
        width: Constants.floatingButtonSize,
        height: Constants.floatingButtonSize,
        borderRadius: 10000,
        backgroundColor: Colors.button,
        justifyContent: "center",
        alignItems: "center"
    },
    loadNewPostsButton: {
        top: Constants.paddingGap * 2,
        padding: 10,
        borderRadius: 10000,
        backgroundColor: Colors.button,
        justifyContent: "center",
        alignItems: "center"
    }
});
