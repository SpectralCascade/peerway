import 'react-native-get-random-values';
import 'react-native-quick-sqlite';
import { MMKV } from 'react-native-mmkv';
import {v1 as uuidv1, v4 as uuidv4 } from 'uuid';
import AppKeys from './AppKeys';
import RNFS from "react-native-fs";
import { Log } from './Log';
import { Buffer } from 'buffer';
import Constants from './Constants';

// This entity example shows what the different key-value fields are used for.
// Note that the actual storage stores non-primitive objects as JSON strings.
// Also note that content data is not stored in the entity storage object itself.
const ExampleEntity = {
    // The unique id of this entity.
    id: "<uuid-generated-id>",
    // The storage encryption key for this entity.
    encryptionKey: "<uuid-generated-key>",
    // Information displayed on the entity profile.
    profile: {
        name: "Alex",
        dob: "<serialised-date>",
        location: "UK",
        website: "https://example.com",
        bio: "I enjoy reading and writing code."
    },
    // A digital signature, used to verify that messages etc. are genuinely from this entity.
    signature: {
        public: "<public-signature-key>",
        private: "<private-signature-key>",
        expires: "<serialised-date-timestamp>"
    },
    // Array of all peer entity IDs this entity has interactions with, ordered by most recent interaction.
    peers: [],
    // Metadata regarding other peers this entity has interacted with historically.
    // Example peer with unique id
    "peer.<peer-entity-id>": {
        // Name of the peer
        name: "Bob",
        // Path to the peer avatar image file
        avatar: "<path-to-avatar-image>",
        // Is this peer a mutual?
        mutual: "<boolean>",
        // Is this peer blocked?
        blocked: "<boolean>",
        // The time at which this peer was last synced with
        sync: "<serialised-date-timestamp>",
        // A public verification key for checking digital signatures from this peer.
        verifier: "<public-signature-key>"
    },
    // Array of all chats this entity is part of, ordered by most recent interaction.
    chats: [],
    // Metadata for direct messaging with other entities.
    // Example chat with unique id
    "chat.<uuid-generated-id>": {
        // Name of the chat.
        name: "John Smith",
        // Which entities are part of the chat along with permission keys.
        members: [
            {
                // ID of the listed entity.
                id: "<entity-id>",
                // Key chat permissions.
                keys: {
                    // Key for verifying identity, only shared with this member.
                    id: "<generated-key>",
                    // Key for reading messages in the chat.
                    rx: "<generated-key>",
                    // Key for sending messages in the chat.
                    tx: "<generated-key>",
                    // This key indicates whether the listed entity has administrator privileges.
                    // Only a select few entities have this key.
                    admin: "<generated-key>"
                }
            }
        ],
        // When was the last message received from this chat?
        received: "<serialised-date>",
        // When was the last update to this chat (considers last message received time)?
        updated: "<serialised-date>",
        // Is this chat flagged as read?
        read: false,
        // Is this chat muted?
        muted: false,
        // Is this chat blocked?
        blocked: false,
        // The image used as the chat icon.
        icon: "<icon-image-base64-string>"
    }
};

// Automagically converts string into an SQL escaped single quote wrapped string.
// Non-strings are unaffected by this function.
function wrapSQL(value) {
    if (typeof(value) === "string") {
        // Escape single quotes
        let escaped = "";
        for (let i = 0, counti = value.length; i < counti; i++) {
            if (value[i] === "'") {
                escaped += "'";
            }
            escaped += value[i];
        }
        return "'" + value + "'";
    }
    return value;
}

// Get comma separated list of values from keys
// Helper for SQL statements
function ToCSV(obj, keys) {
    let sql = keys[0] in obj ? wrapSQL(obj[keys[0]]) : "";
    for (let i = 1, counti = keys.length; i < counti; i++) {
        if (keys[i] in obj) {
            sql += ", " + wrapSQL(obj[keys[i]]);
        }
    }
    return sql;
}

export default class Database {

    // All entities, by entity ID.
    static entities = {};
    static active = null;

    // Name of the open SQLite database.
    static db = null;

    // Local user data, tracking entities and general app settings.
    static userdata = new MMKV({ id: "userdata", encryptionKey: AppKeys.userdata });

    // Changes the current active entity storage slot.
    static SwitchActiveEntity(id) {
        if (this.db) {
            sqlite.close(this.db);
            this.db = null;
        }

        if (id == null || id == "") {
            this.userdata.set("active", "");
            this.active = null;
        } else {
            this.userdata.set("active", id);
            // Load the MMKV instance if not already loaded
            let key = this.userdata.getString(id);
            if (!(id in this.entities)) {
                console.log("Loading active entity " + id + "...");
                this.entities[id] = new MMKV({
                    id: id,
                    encryptionKey: key
                });
            }
            this.active = this.entities[id];
            // Open SQLite database
            let location = RNFS.DocumentDirectoryPath;
            let result = sqlite.open(id, location);
            if (result.status) {
                Log.Error("Failed to open SQLite database " + id + " at " + location);
            } else {
                this.db = id;
            }
        }
        return this.active;
    }

    // Creates a new entity storage slot and automatically sets the active slot.
    static CreateEntity() {
        // Generated ID for this entity, based on timestamp & MAC address.
        let id = uuidv1();
        
        // Randomly generated encryption key for the entity data.
        // This way, if another user gets access to the entity data, they need the key to access it.
        // In future, this could be a user password or pin instead of RNG UUID.
        let key = uuidv4();

        // Create new entity storage slot
        this.entities[id] = new MMKV({
            id: id,
            encryptionKey: key
        });
        this.entities[id].set("id", id);

        // Add entity to userdata.
        this.userdata.set(id, key);

        // Setup SQLite database tables
        let location = RNFS.DocumentDirectoryPath;
        let result = sqlite.open(id, location);
        if (result.status) {
            Log.Error("Failed to open SQLite database " + id + " at " + location);
        } else {
            // Setup the database tables
            let commands = [
                // Table of peers
                ["CREATE TABLE IF NOT EXISTS " + "Peers" + "(" +
                    "id TEXT PRIMARY KEY," + // Peer UUID
                    "name TEXT," + // The name of this peer
                    "mutual INTEGER," + // Is this peer a mutual?
                    "blocked INTEGER," + // Is this peer blocked?
                    "sync TEXT," + // Time of last sync; UTC timestamp in ISO-8601 format
                    "interaction TEXT," + // Time of last interaction; UTC timestamp in ISO-8601 format
                    "verifier TEXT" + // Digital signature verification key
                ")"],
                // Table of chats
                ["CREATE TABLE IF NOT EXISTS " + "Chats" + "(" +
                    "id TEXT PRIMARY KEY," + // Chat UUID
                    "name TEXT," + // Name of this chat
                    "read INTEGER," + // Has this chat been read by the user?
                    "muted INTEGER," + // Is this chat muted?
                    "blocked INTEGER," + // Is this chat blocked?
                    "lastMessage TEXT" + // UUID of the last message sent/received in this chat
                ")"],
                // Table linking many peers to many chats
                ["CREATE TABLE IF NOT EXISTS " + "ChatMembers" + "(" +
                    "chat TEXT," + // Chat UUID
                    "peer TEXT," + // Peer UUID
                    "PRIMARY KEY (chat, peer)," + // Composite primary key
                    "FOREIGN KEY (chat) " +
                        "REFERENCES Chats (id) " +
                            "ON DELETE CASCADE " +
                            "ON UPDATE NO ACTION," +
                    "FOREIGN KEY (peer) " + 
                        "REFERENCES Peers (id) " +
                            "ON DELETE CASCADE " +
                            "ON UPDATE NO ACTION" +
                ")"],
                // Table of many messages each linked to a particular chat
                ["CREATE TABLE IF NOT EXISTS " + "Messages" + "(" +
                    "chat TEXT," + // Chat UUID
                    "id TEXT," + // Message UUID
                    "peer TEXT," + // Sender UUID
                    "created TEXT," + // When the message was created; UTC timestamp in ISO-8601 format
                    "content TEXT," + // Text content
                    "mime TEXT," + // MIME type of the content
                    "PRIMARY KEY (chat, id)" + // Composite primary key
                    "FOREIGN KEY (chat) " +
                        "REFERENCES Chats (id) " +
                            "ON DELETE CASCADE " +
                            "ON UPDATE NO ACTION" +
                ")"]
                // TODO table of posts
            ];

            let result = sqlite.executeSqlBatch(id, commands);
            if (result.status) {
                Log.Error("Failed to setup database tables");
            } else {
                Log.Info("Setup database tables successfully.");
            }

            sqlite.close(id);
        }

        return id;
    }

    // Deletes an existing entity storage slot.
    static DeleteEntity(id) {
        success = false;
        // First, delete the entity data
        if (id in this.entities) {
            if (this.entities[id] != null) {
                // This part actually clears the data from storage
                this.entities[id].clearAll();
                success = true;
            }
            delete this.entities[id];
        }
        // Then delete the entity entry from userdata
        if (this.userdata.contains(id)) {
            this.userdata.delete(id);
        }
        return success;
    }

    // Execute some arbitrary SQL command (synchronous)
    static Execute(sql) {
        Log.Debug("Executing SQL command:\n" + sql);
        let query = sqlite.executeSql(this.db, sql);
        if (query.status) {
            Log.Error("Failed to execute SQL command \"" + sql + "\":\n" + query.message);
            return { success: false, data: [] };
        }
        return { success: true, data: "rows" in query ? query.rows._array : [] };
    }

    // Create a new chat for the currently active entity with other entities.
    // Takes a list of members and optional meta to copy.
    static CreateChat(members, meta={}) {
        Log.Debug("Creating chat... members = " + JSON.stringify(members));

        if (meta == undefined) {
            meta = {};
        }

        if (!("id" in meta)) {
            // Generated ID for this chat, based on timestamp & MAC address.
            meta.id = uuidv1();
        }
        
        // Generate chat metadata
        let chatData = {
            id: meta.id,
            name: "name" in meta ? meta.name : "Untitled Chat",
            read: "read" in meta ? meta.read : 0,
            muted: "muted" in meta ? meta.muted : 0,
            blocked: "blocked" in meta ? meta.blocked : 0,
            lastMessage: ""
        };

        // TODO batch these SQL commands

        // Create a chat entry
        let csvData = ToCSV(chatData, ["id", "name", "read", "muted", "blocked", "lastMessage"]);
        this.Execute(
            "INSERT INTO Chats (id,name,read,muted,blocked,lastMessage) VALUES (" +
                csvData +
            ")"
        );
        
        let activeId = this.active.getString("id");
        for (let i in members) {
            if (members[i] === activeId) {
                // Skip self
                continue;
            }
            this.AddPeer(members[i]);

            // Link member to chat
            this.Execute(
                "INSERT INTO ChatMembers (chat,peer) VALUES ('" + meta.id + "','" + members[i] + "')"
            );
        }

        return chatData;
    }


    // Get the array index from the current year/month
    static GetLookupMonthIndex(start, current) {
        let split = start.split('/');
        let startYear = parseInt(split[0]);
        let startMonth = parseInt(split[1])
        split = current.split('/');
        let currentYear = parseInt(split[0]);
        let currentMonth = parseInt(split[1]);

        // Get the year index, then add the month difference
        return ((currentYear - startYear) * 12) + (currentMonth - startMonth);
    };

    static GetMonthYearTS(date) {
        return date.getUTCFullYear().toString() + "/" + date.getUTCMonth().toString();
    }

    static MarkPeerInteraction(id) {
        let dateNow = new Date();
        this.Execute(
            "UPDATE Peers SET interaction='" + dateNow.toISOString() + "' " +
            "WHERE id='" + id + "'"
        );
    }

    // Add a peer entry to the database, if it isn't already there
    static AddPeer(id, peer={}, markInteraction=true) {
        // Check if the peer already exists
        let query = this.Execute("SELECT * FROM Peers WHERE id='" + id + "'");
        if (query.data.length > 0) {
            Log.Debug("peer." + id + " already exists, no need to add to database.");
            if (markInteraction) {
                this.MarkPeerInteraction(id);
            }
            peer = query.data[0];
        } else {
            // Add to the database
            Log.Debug("Adding peer." + id);
            let dateNow = (new Date()).toISOString();
            peer = {
                id: id,
                name: "name" in peer ? peer.name : "",
                mutual: "mutual" in peer ? peer.mutual : 0,
                blocked: "blocked" in peer ? peer.blocked : 0,
                sync: "sync" in peer ? peer.sync : (new Date(0)).toISOString(),
                interaction: "interaction" in peer ? peer.interaction : dateNow,
                verifier: "verifier" in peer ? peer.verifier : ""
            };
            // Insert blank peer entry
            this.Execute(
                "INSERT INTO Peers (id,name,mutual,blocked,sync,interaction,verifier) VALUES (" +
                    ToCSV(
                        peer,
                        ["id", "name", "mutual", "blocked", "sync", "interaction", "verifier"]
                    ) +
                ")"
            );
        }
        return peer;
    }

}
