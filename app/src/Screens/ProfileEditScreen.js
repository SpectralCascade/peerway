import React, { useState } from 'react';
import { Dimensions, Image, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import Text from '../Components/Text';
import StyleMain from '../Stylesheets/StyleMain';
import AvatarIcon from "../../assets/icons/account.svg"
import DatePicker from "react-native-date-picker"

const dimensions = Dimensions.get('window');
const avatarSize = dimensions.width * 0.6;

function ProfileEditScreen({ navigation }) {
    const [date, setDate] = useState(new Date())
    const [open, setOpen] = useState(false)

    return (
        <View style={[StyleMain.background]}>
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
                <TouchableOpacity style={StyleMain.textInput} onPress={() => setOpen(true)}>
                    <Text>{date.toLocaleDateString()}</Text>
                </TouchableOpacity>
                <DatePicker
                    modal
                    open={open}
                    date={date}
                    onConfirm={(date) => {
                        setOpen(false)
                        setDate(date)
                    }}
                        onCancel={() => {
                        setOpen(false)
                    }}
                />
            </View>

        </View>
    );
}

const styles = StyleSheet.create({
    avatar: {
        width: avatarSize,
        height: avatarSize,
        borderRadius: 10000
    },
    text: {
        marginTop: 12,
        marginBottom: 4
    }
})

export default ProfileEditScreen;