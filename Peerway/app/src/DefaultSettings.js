import Constants from "./Constants";

export default {
    // URL of the server to be used to setup communication with peers
    SignalServerURL: "http://" + Constants.server_ip + ":" + Constants.port,
    // How many posts to be cached per user
    CachePostLimitPerUser: 3,
    // Allow chat requests from unknown peers
    AllowUnknownChatRequests: 1
};
