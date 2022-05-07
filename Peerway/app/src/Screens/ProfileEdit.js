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
            avatar: {},
            modified: false,
            processing: false
        };
        this.initialState = {
        }
        this.initialAvatarPath = "";
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
                this.initialState = {
                    name: profile.name,
                    selectedDate: getFormatedDate(new Date(profile.dob)),
                    location: profile.location,
                    website: profile.website,
                    bio: profile.bio
                };
                this.initialAvatarPath = Peerway.GetAvatarPath(
                    Database.active.getString("id"),
                    profile.avatar.ext,
                    "file://"
                );
                this.setState({
                    name: this.initialState.name.slice(),
                    selectedDate: this.initialState.selectedDate.slice(),
                    location: this.initialState.location.slice(),
                    website: this.initialState.website.slice(),
                    bio: this.initialState.bio.slice(),
                    avatar: {
                        path: this.initialAvatarPath.slice(),
                        mime: profile.mime,
                        ext: profile.ext
                    },
                    modified: false
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

    OnChange(key, value) {
        this.state[key] = value;
        this.setState({modified: this.HasChanges()});
    }

    HasChanges() {
        let changed = false;
        Object.keys(this.initialState).forEach(key => {
            changed = changed || this.state[key] !== this.initialState[key];
        });
        return changed || this.state.avatar.path !== this.initialAvatarPath;
    }

    render() {
        return (
            <View style={StyleMain.background}>
                <Modal style={[styles.modal]} position={"center"} ref={this.datePickerModalRef}>
                    <DatePicker
                        onSelectedChange={date => {
                            if (this.state.selectedDate != date) {
                                this.OnChange("selectedDate", date);
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
                                        includeBase64: true,
                                        avoidEmptySpaceAroundImage: true,
                                        cropperCircleOverlay: true
                                    }).then(image => {
                                        this.OnChange("avatar", {
                                            path: image.path,
                                            mime: image.mime,
                                            base64: image.data
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
                            onChangeText={(text) => this.OnChange("name", text) } 
                            style={StyleMain.textInput}
                            value={this.state.name}
                            placeholder="Required field..."
                        />

                        <Text style={styles.text}>Date of birth:</Text>
                        <TouchableOpacity style={StyleMain.textInput} onPress={() => {
                            this.OnChange("selectedDate", "");
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
                            onChangeText={(text) => this.OnChange("location", text)}
                            style={StyleMain.textInput}
                            value={this.state.location}
                        />

                        <Text style={styles.text}>Website:</Text>
                        <TextInput
                            onChangeText={(text) => this.OnChange("website", text)}
                            style={StyleMain.textInput}
                            value={this.state.website}
                        />

                        <Text style={styles.text}>About you:</Text>
                        <TextInput
                            onChangeText={(text) => this.OnChange("bio", text)}
                            multiline={true}
                            numberOfLines={3}
                            style={[StyleMain.textInputMultiline, {height: 80}]}
                            value={this.state.bio}
                        />
                    </ScrollView>
                    
                    <TouchableOpacity
                        disabled={!this.state.processing && (this.state.name.trim().length == 0 || !this.state.modified)}
                        style={[StyleMain.button, {
                            backgroundColor: (this.state.name.trim().length == 0 || !this.state.modified ?
                                Colors.buttonDisabled : Colors.button),
                            height: 40,
                            marginTop: 12
                        }]}
                        onPress={() => {
                            const saveComplete = () => {
                                this.state.processing = false;
                                if (goBack) {
                                    this.props.navigation.goBack();
                                } else {
                                    this.props.navigation.dispatch(
                                        CommonActions.reset({
                                            index: 1,
                                            routes: [{ name: "Overview" }]
                                        })
                                    );
                                }
                            }

                            let goBack = true;
                            if (Database.active == null) {
                                Database.SwitchActiveEntity(Database.CreateEntity());
                                goBack = false;
                            }
                            let id = Database.active.getString("id");

                            let srcPath = this.state.avatar.path ? this.state.avatar.path.split("file://").pop().split("?").shift() : null;
                            if (srcPath) {
                                // Copy profile image to app documents path
                                this.state.avatar.ext = srcPath.split('.').pop();
                                let path = RNFS.DocumentDirectoryPath + "/" + id + "." + this.state.avatar.ext;
                                if (srcPath !== path) {
                                    // Overwrite existing file
                                    RNFS.exists(path).then((exists) => {
                                        if (!exists) {
                                            return RNFS.moveFile(srcPath, path);
                                        }
                                        return RNFS.unlink(path).then(() => {
                                            return RNFS.moveFile(srcPath, path);
                                        });
                                    }).then(() => RNFS.exists(path)).then((exists) => {
                                        Log.Debug("path = " + path + " | exists = " + exists);
                                        Peerway.MarkAvatarPathDirty(id);
                                    }).catch((e) => {
                                        Log.Error("Avatar overwrite error. " + e);
                                    });
                                }
                                // Remove path as it can be obtained using the entity ID
                                delete this.state.avatar.path;
                            } else {
                                // No avatar specified, use a default one
                                let dpath = RNFS.DocumentDirectoryPath + "/" + id + ".png";
                                this.state.avatar.ext = "png";
                                RNFS.copyFileAssets("davatar.png", dpath).then(() => {
                                    Log.Debug("Reading avatar...");
                                    return RNFS.readFile(dpath, "base64");
                                }).then((b64) => {
                                    Database.active.set("avatar", b64);
                                    Log.Debug("Setup default avatar successfully.");
                                    saveComplete();
                                }).catch((e) => {
                                    Log.Error("Could not setup default avatar. " + e);
                                }).finally(() => {
                                    this.state.processing = false;
                                });
                            }

                            // Extract avatar base64 string
                            hasBase64 = "base64" in this.state.avatar;
                            Database.active.set(
                                "avatar",
                                hasBase64 ? this.state.avatar.base64 : ""
                            );
                            if (hasBase64) {
                                delete this.state.avatar.base64;
                            }

                            // Extract other state into profile
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

                            this.state.processing = true;

                            if (srcPath) {
                                saveComplete();
                            }
                        }}
                    >
                        <ButtonText style={{color: (this.state.name.length == 0 || !this.state.modified ? Colors.buttonTextDisabled : Colors.buttonText)}}>Save Profile</ButtonText>
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
