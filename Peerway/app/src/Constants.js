import RNFS from "react-native-fs";

export default {
    authVersion: 1,
    server_ip: "86.3.206.225",//"192.168.0.59",
    port: 20222,
    website: "https://github.com/SpectralCascade/peerway",
    GetMediaPath: (id) => RNFS.DocumentDirectoryPath + "/" + id + "/media",
    GetDownloadPath: (id) => RNFS.DocumentDirectoryPath + "/" + id + "/download",
    maxMessageCharacters: 2048,
    messagesPerLoad: 50,
    maxBytesPerDataSend: 16384,
    avatarSmall: 32,
    avatarMedium: 56,
    avatarStandard: 64,
    avatarLarge: 128,
    avatarFull: 400,
    floatingButtonSize: 64,
    paddingGap: 8,
    visibility: {
        private: 0,
        mutuals: 1,
        public: 2
    },
    onboardingBotID: "peerbeebot",
    onboardingChatID: "OnboardingChat",
    onboardingSetting: "onboarded"
}
