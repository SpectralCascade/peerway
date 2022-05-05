import PushNotification from "react-native-push-notification";
import { Log } from "./Log";

class PushNotifications {
    constructor() {
        this.showMessages = true;

        // Must be outside of any component LifeCycle (such as `componentDidMount`).
        PushNotification.configure({
            // (optional) Called when Token is generated (iOS and Android)
            onRegister: function (token) {
                //console.log("TOKEN:", token);
            },
        
            // (required) Called when a remote is received or opened, or local notification is opened
            onNotification: function (notification) {
                //console.log("NOTIFICATION:", notification);
        
                // process the notification
            
                // (required) Called when a remote is received or opened, or local notification is opened
                //notification.finish(PushNotificationIOS.FetchResult.NoData);
            },
        
            // (optional) Called when Registered Action is pressed and invokeApp is false, if true onNotification will be called (Android)
            onAction: function (notification) {
                //console.log("ACTION:", notification.action);
                //console.log("NOTIFICATION:", notification);
            
                // process the action
            },
        
            // (optional) Called when the user fails to register for remote notifications. Typically occurs when APNS is having issues, or the device is a simulator. (iOS)
            onRegistrationError: function(err) {
                console.error(err.message, err);
            },
        
            // IOS ONLY (optional): default: all - Permissions to register.
            permissions: {
                alert: true,
                badge: true,
                sound: true,
            },
        
            // Should the initial notification be popped automatically
            // default: true
            popInitialNotification: true,
        
            /**
             * (optional) default: true
             * - Specified if permissions (ios) and token (android and ios) will requested or not,
             * - if not, you must call PushNotificationsHandler.requestPermissions() later
             * - if you are not using remote notification or do not have Firebase installed, use this:
             *     requestPermissions: Platform.OS === 'ios'
             */
            requestPermissions: Platform.OS === 'ios'
        });

        PushNotification.createChannel({
            channelId: "chat.message", // (required)
            channelName: "Chat Message", // (required)
            playSound: false, // (optional) default: true
            importance: PushNotification.Importance.HIGH // (optional) default: Importance.HIGH. Int value of the Android notification importance
        });
    }

    EnableMessages() {
        this.showMessages = true;
    }

    DisableMessages() {
        this.showMessages = false;
    }

    Message(chat, message, peer, avatar) {
        if (!this.showMessages) {
            return;
        }

        let name = peer.name ? peer.name : "[Unknown]";

        PushNotification.localNotification({
            channelId: "chat.message",
            largeIconUrl: avatar,
            title: chat.name && chat.name.length != 0 ? chat.name : name,
            message: (chat.type ? name + ": " : "") + message.content
        });
    }

    // Clear all notifications
    Clear() {
        PushNotification.cancelAllLocalNotifications();
    }

};

let Notif = new PushNotifications();
export default Notif;
