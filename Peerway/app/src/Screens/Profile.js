import React from 'react';
import HandleEffect from '../Components/HandleEffect';
import { Image, View, ScrollView, StyleSheet } from 'react-native';
import Database from '../Database';
import StyleMain from '../Stylesheets/StyleMain';
import Avatar from '../Components/Avatar';
import Peerway from '../Peerway';
import Text from '../Components/Text';
import { Log } from '../Log';

const avatarSize = 128;

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
            updated: initTime
        }
    }

    init() {
        this.peerId = this.props.route.params.peerId;
        this.activeId = Database.active.getString("id");
    }

    OnOpen() {
        this.init();

        // Load up top profile bits
        if (this.peerId === this.activeId) {
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

    render() {
        return (
            <View style={StyleMain.background}>
                <HandleEffect navigation={this.props.navigation} effect="focus" callback={() => { this.OnOpen() }}/>

                <View style={[styles.header]}>
                    {/*<Image source={""}/>*/}
                    <Avatar avatar={(() => {
                        let path = Peerway.GetAvatarPath(this.peerId, this.state.avatar);
                        if (path.length > 0) {
                            path = "file://" + path;
                        }
                        return path;
                    })()} size={avatarSize} />
                    <Text style={[styles.nameText]}>{this.state.name}</Text>
                </View>

                <ScrollView>
                    {/* TODO */}
                </ScrollView>
            </View>
        );
    }
    
}

const styles = StyleSheet.create({
    header: {
    },
    nameText: {
    }
});
