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

export default class Profile extends React.Component {
    constructor(props) {
        super(props);
        this.init();

        let initTime = (new Date(0)).toISOString();
        this.state = {
            name: "",
            avatar: "",
            dob: initTime,
            location: "",
            website: "",
            bio: "",
            avatar: "",
            updated: initTime,
            bioLines: 3,
            subscribed: 0,
            forceReload: false
        }
    }

    init() {
        this.activeId = Database.active.getString("id");
        this.peerId = this.props.route.params && this.props.route.params.peerId ? 
            this.props.route.params.peerId : this.activeId;
    }

    OnOpen() {
        Log.Debug("OPENED USER PROFILE");

        this.init();

        // Load up top profile bits
        if (this.peerId === this.activeId) {
            let profile = JSON.parse(Database.active.getString("profile"));
            this.setState({
                name: profile.name,
                dob: profile.dob,
                location: profile.location,
                website: profile.website,
                bio: profile.bio,
                avatar: profile.avatar.ext,
                updated: profile.updated,
            });
        } else {
            this.OnPostReceived = Peerway.addListener(
                "post.response.end",
                (from, data) => this.OnPostResponse(from, data)
            );
            let query = Database.Execute("SELECT * FROM Peers WHERE id='" + this.peerId + "'");
            if (query.data.length > 0) {
                let peer = query.data[0];
                query = Database.Execute(
                    "SELECT * FROM Subscriptions WHERE " +
                        "pub='" + this.peerId + "' AND sub='" + this.activeId + "'"
                );
                this.setState({
                    name: peer.name,
                    dob: peer.dob,
                    location: peer.location,
                    website: peer.website,
                    bio: peer.bio,
                    avatar: peer.avatar,
                    updated: peer.updated,
                    subscribed: query.data.length > 0 ? 1 : 0
                });
            } else {
                // TODO request info via server (and/or other peers)
                Log.Warning("No such peer." + this.peerId);
            }
        }

        this.setState({forceReload: true});
    }

    OnClose() {
        Log.Debug("CLOSED USER PROFILE");

        if (this.OnPostReceived) {
            this.OnPostReceived.remove();
            this.OnPostReceived = undefined;
        }
    }

    OnPostResponse(from, data) {
        if (from === this.peerId) {
            this.setState({forceReload: true});
            if (this.onSyncComplete) {
                this.onSyncComplete();
            }
        }
    }

    // Go to the profile editing screen
    GoEditProfile() {
        this.props.navigation.navigate("EditProfile");
    }

    // Toggle follow/unfollow of the entity
    GoToggleSubscribe() {
        if (this.peerId !== this.activeId) {
            if (this.state.subscribed) {
                // TODO show confirmation popup
                this.setState({subscribed: 0});
                Database.Execute(
                    "DELETE FROM Subscriptions WHERE " + 
                        "pub='" + this.peerId + "' AND sub='" + this.activeId + "'"
                );
                Peerway.NotifyEntities([this.peerId], {
                    type: "peer.unsub"
                });
                Log.Debug("Unsubscribed from peer." + this.peerId);
            } else {
                this.setState({subscribed: 1});
                Database.Execute(
                    "INSERT INTO Subscriptions (pub,sub) VALUES ('" + this.peerId + "','" + this.activeId + "')"
                );
                Peerway.NotifyEntities([this.peerId], {
                    type: "peer.sub"
                });
                Log.Debug("Subscribed to peer." + this.peerId);
            }
        } else {
            Log.Warning("Unexpected behaviour, cannot toggle subscription to self.");
        }
    }

    // Go to the post creation screen
    GoCreatePost() {
        this.props.navigation.navigate("CreatePost");
    }

    OnAvatarPress() {
        // TODO show modal with avatar image full size
    }

    render() {
        const renderProfileButton = () => {
            let buttonText = "";
            let onPress = () => {};

            if (this.peerId === this.activeId) {
                buttonText = "Edit Profile";
                onPress = () => this.GoEditProfile();
            } else {
                buttonText = this.state.subscribed ? "Unfollow" : "Follow";
                onPress = () => this.GoToggleSubscribe();
            }
            return (
                <TouchableOpacity style={[StyleMain.button, styles.editButton]} onPress={onPress}>
                    <ButtonText>{buttonText}</ButtonText>
                </TouchableOpacity>
            );
        }

        let dob = new Date(this.state.dob);

        const renderHeader = () => (
            <View style={StyleMain.background}>
                <ScrollView>
                    <HandleEffect navigation={this.props.navigation} effect="focus" callback={() => { this.OnOpen() }}/>
                    <HandleEffect navigation={this.props.navigation} effect="blur" callback={() => { this.OnClose() }}/>

                    {/*<Image source={""}/>*/}
                    <View style={[styles.banner]}>

                    </View>

                    <View style={[styles.header]}>
                        <TouchableOpacity style={[StyleMain.avatar, {width: Constants.avatarStandard, height: Constants.avatarStandard}]}>
                            <Avatar
                                avatar={Peerway.GetAvatarPath(this.peerId, this.state.avatar, "file://")}
                                size={Constants.avatarStandard}
                            />
                        </TouchableOpacity>
                        <Text style={[styles.nameText]}>{this.state.name}</Text>
                        {renderProfileButton()}
                    </View>

                    <TouchableOpacity onPress={() => this.setState({bioLines: this.state.bioLines != 0 ? 0 : 3})}
                        style={[styles.bio]}>
                        <Text numberOfLines={this.state.bioLines}>{this.state.bio}</Text>
                    </TouchableOpacity>

                    <View style={[styles.headerBottom]}>
                        {/* TODO only show these to peers with permissions */}
                        <Text>{this.state.location}</Text>
                        <Text>{dob.toLocaleDateString("en-GB")}</Text>
                        <Text>{this.state.website}</Text>
                    </View>

                </ScrollView>
                <View style={{paddingBottom: 3, backgroundColor: Colors.avatarBackground}} />
            </View>
        );

        return (
            <SafeAreaView style={StyleMain.background}>
                <Feed
                    route={this.props.route}
                    navigation={this.props.navigation}
                    ListHeaderComponent={() => renderHeader()}
                    forceReload={this.state.forceReload}
                    syncPosts={(onComplete) => {
                        this.onSyncComplete = onComplete;
                        if (this.peerId !== this.activeId) {
                            let config = Peerway.GetSyncConfigPosts(this.peerId);
                            config.sub = this.state.subscribed;
                            config.selectedPeers = [this.peerId];
                            Peerway.SyncPeers(config);
                        }
                        if (this.onSyncComplete) {
                            this.onSyncComplete();
                        }
                    }}
                    loadPosts={(posts) => {
                        if (this.state.forceReload) {
                            posts = [];
                        }
                        let query = Database.Execute(
                            "SELECT * FROM Posts WHERE author='" + this.peerId + "' " +
                            (posts.length > 0 ?
                                ("AND created < '" + posts[posts.length - 1].created + "' ") :
                                ""
                            ) +
                            "ORDER BY created DESC LIMIT 10"
                        );
                        if (query.data.length > 0) {
                            for (let i in query.data) {
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
            </SafeAreaView>
        );
    }
    
}

const styles = StyleSheet.create({
    banner: {
        height: 128,
        backgroundColor: Colors.avatarBackground
    },
    bio: {
        padding: 10
    },
    content: {
    },
    editButton: {
        height: 32,
        width: undefined,
        position: "absolute",
        right: 5,
        top: -14,
        padding: 5,
        borderRadius: 50,
        borderColor: Colors.avatarBackground,
        borderWidth: 1
    },
    header: {
        alignItems: "center",
        flexDirection: "row",
        paddingTop: 10,
        paddingLeft: 10
    },
    headerBottom: {
        padding: 5,
        flexDirection: "row"
    },
    nameText: {
        marginLeft: 10,
        fontSize: 18,
        fontWeight: "bold"
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
    }
});
