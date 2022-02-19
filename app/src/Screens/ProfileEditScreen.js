import React, { Component, createRef, useState } from 'react';
import { Button, Dimensions, Image, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import Text from '../Components/Text';
import StyleMain from '../Stylesheets/StyleMain';
import AvatarIcon from "../../assets/icons/account.svg";
import DatePicker from 'react-native-modern-datepicker';
import Modal from 'react-native-modalbox';
import LogBoxInspectorContainer from 'react-native/Libraries/LogBox/LogBoxInspectorContainer';

const dimensions = Dimensions.get('window');
const avatarSize = dimensions.width * 0.6;

/*

*/

export default class ProfileEditScreen extends Component {
    constructor(props) {
        super(props);
        this.datePickerRef = React.createRef();
        this.state = {
            selectedDate: "",
            isOpen: false,
        };
    }

    render() {
        return (
            <View style={[StyleMain.background]}>

                <Modal
                    style={[styles.modal]}
                    position={"center"}
                    ref={this.datePickerRef}
                >
                    <DatePicker
                        onSelectedChange={date => {
                            if (this.state.selectedDate != date) {
                                this.setState({ selectedDate: date });
                            }
                        }}
                        mode="calendar"
                    />

                    <Button title="Set Date" onPress={() => { 
                        this.datePickerRef.current.close();
                        this.setState({isOpen: false});
                    }} />
                </Modal>

                <View style={[StyleMain.topContent, StyleMain.center]}>
                    <View style={[StyleMain.avatar, StyleMain.centerContent, styles.avatar, {marginTop: 10}]}>
                        <Image source={require("../../assets/favicon.png")} style={styles.avatar} />
                        <AvatarIcon width={avatarSize} height={avatarSize} style={{position: "absolute"}} />
                    </View>
                </View>

                <View style={StyleMain.mainContent}>
                    
                    <Text style={styles.text}>Name:</Text>
                    <TextInput style={StyleMain.textInput}></TextInput>

                    <Text style={styles.text}>Date of birth:</Text>
                    <TouchableOpacity style={StyleMain.textInput} onPress={() => this.datePickerRef.current.open()}>
                        <Text>{new Date(Date.parse(this.state.selectedDate)).toLocaleDateString()}</Text>
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
