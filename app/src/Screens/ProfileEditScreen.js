import React from 'react';
import { Button, Dimensions, Image, Keyboard, StyleSheet, TextInput, TouchableOpacity, View, ScrollView } from 'react-native';
import Text from '../Components/Text';
import StyleMain from '../Stylesheets/StyleMain';
import AvatarIcon from "../../assets/icons/account.svg";
import DatePicker, { getFormatedDate } from 'react-native-modern-datepicker';
import Modal from 'react-native-modalbox';
import ButtonText from '../Components/ButtonText';
import ImagePicker from 'react-native-image-crop-picker';
import Database from '../Database';
import Colors from '../Stylesheets/Colors';

const dimensions = Dimensions.get('window');
const avatarSize = dimensions.width * 0.3;

export default class ProfileEditScreen extends React.Component {
    constructor(props) {
        super(props);
        this.datePickerModalRef = React.createRef();
        this.state = {
            selectedDate: "",
            rawDate: "",
            name: "",
            location: "",
            website: "",
            bio: "",
            avatar: "", // Base-64 encoded string
        };
    }

    componentDidMount() {
        this.onOpen();
    }

    onOpen() {
        if (typeof this.state !== 'undefined')
        {
            ImagePicker.clean();
            console.log("Opened profile edit screen");
            if (Database.active != null) {
                // Load active entity data
                this.setState({ name: Database.active.getString("profile.name") });
                this.setState({ selectedDate: getFormatedDate(new Date(Database.active.getString("profile.dob"))) });
                this.setState({ location: Database.active.getString("profile.location") });
                this.setState({ website: Database.active.getString("profile.website") });
                this.setState({ bio: Database.active.getString("profile.bio") });
                this.setState({ avatar: Database.active.getString("profile.avatar") });
            } else {
                // No entity is loaded, must be part of entity creation flow.
                this.setState({ name: "" });
                this.setState({ selectedDate: "" });
                this.setState({ location: "" });
                this.setState({ website: "" });
                this.setState({ bio: "" });
                this.setState({ avatar: "" });
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
                                style={[StyleMain.avatar, styles.avatar, {marginTop: 10}]}
                                onPress={() => {
                                    ImagePicker.openPicker({
                                        width: 400,
                                        height: 400,
                                        cropping: true,
                                        writeTempFile: false,
                                        includeBase64: true,
                                        avoidEmptySpaceAroundImage: true,
                                        cropperCircleOverlay: true
                                    }).then(image => {
                                        this.setState({avatar: JSON.stringify(image)});
                                    }, () => {
                                        // Do nothing if cancelled
                                    });
                                }}
                            >
                                {
                                // Load avatar from database if available
                                (() => {
                                    if (this.state.avatar != "") {
                                        return (
                                        <Image
                                            source={{uri: "data:" + JSON.parse(this.state.avatar).mime + ";base64," + JSON.parse(this.state.avatar).data}}
                                            style={styles.avatar}
                                        />);
                                    }
                                    return <AvatarIcon width={avatarSize} height={avatarSize} style={{position: "absolute"}} />
                                })()
                                }
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
                            Database.active.set("profile.name", this.state.name);
                            Database.active.set("profile.dob",
                                this.state.selectedDate != "" ? 
                                    (new Date(Date.parse(this.state.selectedDate))).toJSON() : (new Date()).toJSON());
                            Database.active.set("profile.location", this.state.location);
                            Database.active.set("profile.website", this.state.website);
                            Database.active.set("profile.bio", this.state.bio);
                            Database.active.set("profile.avatar", this.state.avatar);
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
    avatar: {
        width: avatarSize,
        height: avatarSize,
        borderRadius: 10000
    },
    modal: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    text: {
        marginTop: 12,
        marginBottom: 4
    }
})
