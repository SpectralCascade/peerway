import React from 'react';
import { Button, Dimensions, Image, StyleSheet, TextInput, TouchableOpacity, View, ScrollView } from 'react-native';
import Text from '../Components/Text';
import StyleMain from '../Stylesheets/StyleMain';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import DatePicker, { getFormatedDate } from 'react-native-modern-datepicker';
import Modal from 'react-native-modalbox';
import ButtonText from '../Components/ButtonText';
import ImagePicker from 'react-native-image-crop-picker';
import Database from '../Database';
import Colors from '../Stylesheets/Colors';
import { CommonActions } from '@react-navigation/native';
import Avatar from '../Components/Avatar';
import { Log } from '../Log';
import RNFS from "react-native-fs";
import Peerway from '../Peerway';
import Constants from '../Constants';

const dimensions = Dimensions.get('window');
const avatarSize = Constants.avatarLarge;

export default class ProfileEdit extends React.Component {
    constructor(props) {
        super(props);
        this.datePickerModalRef = React.createRef();
        this.state = {
            selectedDate: "",
            name: "",
            location: "",
            website: "",
            bio: "",
            avatar: {}
        };
    }

    componentDidMount() {
        this.onOpen();
    }

    onOpen() {
        if (this.state)
        {
            ImagePicker.clean();
            console.log("Opened profile edit screen");
            if (Database.active != null) {
                // Load active entity data
                profile = JSON.parse(Database.active.getString("profile"));
                this.setState({
                    name: profile.name,
                    selectedDate: getFormatedDate(new Date(profile.dob)),
                    location: profile.location,
                    website: profile.website,
                    bio: profile.bio,
                    avatar: {
                        path: Peerway.GetAvatarPath(
                            Database.active.getString("id"),
                            profile.avatar.ext,
                            "file://"
                        ),
                        mime: profile.mime,
                        ext: profile.ext
                    }
                });
            } else {
                // No entity is loaded, must be part of entity creation flow.
                this.setState({
                    name: "",
                    selectedDate: "",
                    location: "",
                    website: "",
                    bio: "",
                    avatar: {}
                });
            }
        }
    }

    render() {
        return (
            <View style={StyleMain.background}>
                <Modal style={[styles.modal]} position={"center"} ref={this.datePickerModalRef}>
                    <DatePicker
                        onSelectedChange={date => {
                            if (this.state.selectedDate != date) {
                                this.setState({ selectedDate: date });
                            }
                        }}
                        mode="calendar"
                    />

                    <Button title="Set Date" disabled={this.state.selectedDate == ""} onPress={() => {
                        this.datePickerModalRef.current.close();
                        this.setState({isOpen: false});
                    }} />
                </Modal>

                <View style={[StyleMain.mainContent]}>
                    <ScrollView>
                        <View style={StyleMain.center}>
                            <TouchableOpacity
                                style={[StyleMain.avatar, { width: avatarSize, height: avatarSize, marginTop: 10 }]}
                                onPress={() => {
                                    ImagePicker.openPicker({
                                        width: 400,
                                        height: 400,
                                        cropping: true,
                                        writeTempFile: true,
                                        avoidEmptySpaceAroundImage: true,
                                        cropperCircleOverlay: true
                                    }).then(image => {
                                        this.setState({
                                            avatar: {
                                                path: image.path,
                                                mime: image.mime
                                            }
                                        });
                                    }, () => {
                                        // Do nothing if cancelled
                                    });
                                }}
                            >
                                <Avatar avatar={"path" in this.state.avatar ? this.state.avatar.path : ""} size={avatarSize} />
                                <Icon
                                    name="image-plus"
                                    size={avatarSize / 3}
                                    color="black"
                                    style={{position: "absolute", bottom: 0, right: 0}}
                                />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.text}>Name:</Text>
                        <TextInput
                            onChangeText={(text) => this.setState({name: text}) } 
                            style={StyleMain.textInput}
                            value={this.state.name}
                            placeholder="Required field..."
                        />

                        <Text style={styles.text}>Date of birth:</Text>
                        <TouchableOpacity style={StyleMain.textInput} onPress={() => {
                            this.setState({selectedDate: ""});
                            this.datePickerModalRef.current.open();
                        }}>
                            <Text>{(() => {
                                if (this.state.selectedDate == "") {
                                    return "Select date...";
                                }
                                return new Date(Date.parse(this.state.selectedDate)).toLocaleDateString();
                            })()}</Text>
                        </TouchableOpacity>

                        <Text style={styles.text}>Location:</Text>
                        <TextInput
                            onChangeText={(text) => this.setState({location: text}) }
                            style={StyleMain.textInput}
                            value={this.state.location}
                        />

                        <Text style={styles.text}>Website:</Text>
                        <TextInput
                            onChangeText={(text) => this.setState({website: text})}
                            style={StyleMain.textInput}
                            value={this.state.website}
                        />

                        <Text style={styles.text}>About you:</Text>
                        <TextInput
                            onChangeText={(text) => this.setState({bio: text})}
                            multiline={true}
                            numberOfLines={3}
                            style={[StyleMain.textInputMultiline, {height: 80}]}
                            value={this.state.bio}
                        />
                    </ScrollView>
                    
                    <TouchableOpacity
                        disabled={this.state.name == ""}
                        style={[StyleMain.button, {backgroundColor: (this.state.name != "" ? Colors.button : Colors.buttonDisabled), height: 40, marginTop: 12}]}
                        onPress={() => {
                            if (Database.active == null) {
                                Database.SwitchActiveEntity(Database.CreateEntity());
                            }
                            let id = Database.active.getString("id");

                            if ("path" in this.state.avatar) {
                                // Copy profile image to app documents path
                                this.state.avatar.ext = this.state.avatar.path.split('.').pop();
                                let path = RNFS.DocumentDirectoryPath + "/" + id + "." + this.state.avatar.ext;
                                RNFS.moveFile(this.state.avatar.path, path).then(() => {
                                    return RNFS.exists(path);
                                }).then((exists) => { Log.Debug("path = " + path + " | exists = " + exists); }).catch((e) => {
                                    Log.Error(e);
                                });
                                // Remove path as it can be obtained using the entity ID
                                delete this.state.avatar.path;
                            }

                            // Extract state
                            let timeNow = (new Date()).toISOString();
                            var profile = {
                                name: this.state.name,
                                dob: (this.state.selectedDate != "" ? 
                                    (new Date(Date.parse(this.state.selectedDate))).toISOString() : timeNow),
                                location: this.state.location,
                                website: this.state.website,
                                bio: this.state.bio,
                                avatar: this.state.avatar,
                                updated: timeNow
                            };
                            // Save profile in database
                            Database.active.set("profile", JSON.stringify(profile));
                            this.props.navigation.dispatch(
                                CommonActions.reset({
                                    index: 1,
                                    routes: [{ name: 'Overview' }]
                                })
                            );
                        }}
                    >
                        <ButtonText style={{color: (this.state.name != "" ? Colors.buttonText : Colors.buttonTextDisabled)}}>Save Profile</ButtonText>
                    </TouchableOpacity>

                </View>

            </View>
        );
    }
}

const styles = StyleSheet.create({
    modal: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    text: {
        marginTop: 12,
        marginBottom: 4
    }
})
