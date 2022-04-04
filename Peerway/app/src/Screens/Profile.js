import React from 'react';
import HandleEffect from '../Components/HandleEffect';
import { TouchableOpacity, Image, View, ScrollView, StyleSheet } from 'react-native';
import Database from '../Database';
import StyleMain from '../Stylesheets/StyleMain';
import Avatar from '../Components/Avatar';
import Peerway from '../Peerway';
import Text from '../Components/Text';
import { Log } from '../Log';
import Colors from '../Stylesheets/Colors';
import ButtonText from '../Components/ButtonText';

const avatarSize = 64;

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

    OnGoEdit() {
        this.props.navigation.navigate("EditProfile");
    }

    render() {
        const renderEditButton = () => {
            if (this.peerId === this.activeId) {
                return (
                    <TouchableOpacity style={[StyleMain.button, styles.editButton]} onPress={() => this.OnGoEdit()}>
                        <ButtonText>Edit Profile</ButtonText>
                    </TouchableOpacity>
                );
            }
            return (<></>);
        }

        return (
            <View style={StyleMain.background}>
                <HandleEffect navigation={this.props.navigation} effect="focus" callback={() => { this.OnOpen() }}/>

                {/*<Image source={""}/>*/}
                <View style={[styles.banner]}>

                </View>

                <View style={[styles.header]}>
                    <Avatar avatar={(() => {
                        let path = Peerway.GetAvatarPath(this.peerId, this.state.avatar);
                        if (path.length > 0) {
                            path = "file://" + path;
                        }
                        return path;
                    })()} size={avatarSize} />
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
                    <Text>{this.state.dob}</Text>
                    <Text>{this.state.website}</Text>
                </View>

                <ScrollView style={[styles.content]}>
                    {/* TODO */}
                </ScrollView>
            </View>
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
        backgroundColor: Colors.avatarBackground
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
    }
});
