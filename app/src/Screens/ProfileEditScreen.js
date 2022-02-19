import React from 'react';
import { Button, Dimensions, Image, Keyboard, StyleSheet, TextInput, TouchableOpacity, View, ScrollView } from 'react-native';
import Text from '../Components/Text';
import StyleMain from '../Stylesheets/StyleMain';
import AvatarIcon from "../../assets/icons/account.svg";
import DatePicker from 'react-native-modern-datepicker';
import Modal from 'react-native-modalbox';

const dimensions = Dimensions.get('window');
const avatarSize = dimensions.width * 0.6;

export default class ProfileEditScreen extends React.Component {
    constructor(props) {
        super(props);
        this.datePickerModalRef = React.createRef();
        this.state = {
            selectedDate: "",
            isOpen: false,
        };
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

                <View style={[StyleMain.center, StyleMain.topContent]}>
                    <ScrollView>
                            <View style={[StyleMain.avatar, styles.avatar, {marginTop: 10}]}>
                                <Image source={require("../../assets/favicon.png")} style={styles.avatar} />
                                <AvatarIcon width={avatarSize} height={avatarSize} style={{position: "absolute"}} />
                            </View>
                    </ScrollView>
                </View>

                <View style={[StyleMain.mainContent]}>
                    <ScrollView>
                        
                        <Text style={styles.text}>Name:</Text>
                        <TextInput onPressOut={Keyboard.dismiss} style={StyleMain.textInput}></TextInput>

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

                    </ScrollView>
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
