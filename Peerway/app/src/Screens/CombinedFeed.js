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
        if (this.feed.current.state.syncing || this.feed.current.state.scrollPos <= 0) {
            this.LoadNewPosts(false);
        } else {
            this.setState({hasNewPosts: true});
        }
        if (this.onSyncComplete) {
            this.onSyncComplete();
        }
    }

    LoadNewPosts(autoScroll = true) {
        this.feed.current.LoadNewPosts(autoScroll);
        this.setState({hasNewPosts: false});
    }

    // Toggle follow/unfollow of an entity
    // TODO merge with similar code in Profile.js
    GoToggleSubscribe(peer) {
        if (this.state.subscribed) {
            // TODO show confirmation popup
            this.setState({subscribed: 0});
            Database.Execute("DELETE FROM Subscriptions WHERE pub=? AND sub=?", [peer, this.activeId]);
            Peerway.SendRequest(peer, {
                type: "peer.unsub"
            });
            Log.Debug("Unsubscribed from peer." + peer);
        } else {
            this.setState({subscribed: 1});
            Database.Execute("INSERT INTO Subscriptions (pub,sub) VALUES (?,?)", [peer, this.activeId]);
            Peerway.SendRequest(peer, {
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
                        Peerway.SyncPeers(Peerway.GetSyncOptions(false, false, true, true));

                        if (this.onSyncComplete) {
                            this.onSyncComplete();
                        }
                    }}
                    loadPosts={(posts) => {
                        let query = Database.Execute(
                            "SELECT * FROM Posts WHERE parentPost='' " +
                            (posts.length > 0 ?
                                ("AND created < ? ") :
                                ""
                            ) +
                            "ORDER BY created DESC LIMIT 10",
                            posts.length > 0 ? [posts[posts.length - 1].created] : []
                        );
                        let loadedPosts = query.data.map(post => {
                            post.media = JSON.parse(post.media);
                            return post;
                        });
                        return loadedPosts;
                    }}
                    onLoadComplete={() => {
                        this.setState({hasNewPosts: false});
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
