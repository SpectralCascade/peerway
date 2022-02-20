import React from 'react';
import { Button, Dimensions, Image, Keyboard, StyleSheet, TextInput, TouchableOpacity, View, ScrollView } from 'react-native';
import Text from '../Components/Text';
import StyleMain from '../Stylesheets/StyleMain';
import AvatarIcon from "../../assets/icons/account.svg";
import DatePicker from 'react-native-modern-datepicker';
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
            name: ""
        };
    }

    componentDidMount() {
        this.onOpen();
    }

    onOpen() {
        if (typeof this.state !== 'undefined')
        {
            console.log("Opened profile edit screen");
            // Load active entity data
            if (Database.active != null) {
                this.setState({ name: Database.active.getString("profile.name") });
            } else {
                this.setState({ name: "" });
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
                                        cropping: true
                                    }).then(image => {
                                        console.log(image);
                                    });
                                }}
                            >
                                <Image source={require("../../assets/favicon.png")} style={styles.avatar} />
                                <AvatarIcon width={avatarSize} height={avatarSize} style={{position: "absolute"}} />
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
                                return new Date(Date.parse(this.state.selectedDate)).toLocaleDateString()
                            })()}</Text>
                        </TouchableOpacity>

                        <Text style={styles.text}>Location:</Text>
                        <TextInput style={StyleMain.textInput} />

                        <Text style={styles.text}>Website:</Text>
                        <TextInput style={StyleMain.textInput} />

                        <Text style={styles.text}>About you:</Text>
                        <TextInput
                            multiline={true}
                            numberOfLines={3}
                            style={[StyleMain.textInputMultiline, {height: 80}]}
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
