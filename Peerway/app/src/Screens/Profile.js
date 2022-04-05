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
            bioLines: 3
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
            this.state.name = profile.name;
            this.state.dob = profile.dob;
            this.state.location = profile.location;
            this.state.website = profile.website;
            this.state.bio = profile.bio;
            this.state.avatar = profile.avatar.ext;
            this.state.updated = profile.updated;
        } else {
            let query = Database.Execute("SELECT * FROM Peers WHERE id='" + this.peerId + "'");
            if (query.data.length > 0) {
                let peer = query.data[0];
                this.state.name = peer.name;
                this.state.dob = peer.dob;
                this.state.location = peer.location;
                this.state.website = peer.website;
                this.state.bio = peer.bio;
                this.state.avatar = peer.avatar;
                this.state.updated = peer.updated;
            } else {
                // TODO request info via server (and/or other peers)
                Log.Warning("No such peer." + this.peerId);
            }
        }
        this.forceUpdate();
    }

    // Go to the profile editing screen
    GoEditProfile() {
        this.props.navigation.navigate("EditProfile");
    }

    // Go to the post creation screen
    GoCreatePost() {
        this.props.navigation.navigate("CreatePost");
    }

    OnAvatarPress() {
        // TODO show modal with avatar image full size
    }

    render() {
        const renderEditButton = () => {
            if (this.peerId === this.activeId) {
                return (
                    <TouchableOpacity style={[StyleMain.button, styles.editButton]} onPress={() => this.GoEditProfile()}>
                        <ButtonText>Edit Profile</ButtonText>
                    </TouchableOpacity>
                );
            }
            return (<></>);
        }

        let dob = new Date(this.state.dob);

        const renderHeader = () => (
            <View style={StyleMain.background}>
                <ScrollView>
                    <HandleEffect navigation={this.props.navigation} effect="focus" callback={() => { this.OnOpen() }}/>

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
                        {renderEditButton()}
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