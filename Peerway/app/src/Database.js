import 'react-native-get-random-values';
import 'react-native-quick-sqlite';
import { MMKV } from 'react-native-mmkv';
import {v1 as uuidv1, v4 as uuidv4 } from 'uuid';
import AppKeys from './AppKeys';
import RNFS from "react-native-fs";
import { Log } from './Log';
import { Buffer } from 'buffer';
import Constants from './Constants';
import DefaultSettings from './DefaultSettings';

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
        
        // Initialise the settings
        Object.keys(DefaultSettings).forEach((key) => {
            this.userdata.set(key, DefaultSettings[key].toString());
        });

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
                    "avatar TEXT," + // The avatar file extension
                    "mutual INTEGER," + // Is this peer a mutual?
                    "blocked INTEGER," + // Is this peer blocked?
                    "sync TEXT," + // Time of last sync; UTC timestamp in ISO-8601 format
                    "interaction TEXT," + // Time of last interaction; UTC timestamp in ISO-8601 format
                    "certificate TEXT," + // Digital certificate to present to the peer to verify connection
                    "verifier TEXT," + // Private key for verifying the peer's issued certificate.
                    "issued TEXT," + // Certificate that has been issued to this peer.
                    "updated TEXT" + // Last time the peer profile was updated
                ")"],
                // Table of chats
                ["CREATE TABLE IF NOT EXISTS " + "Chats" + "(" +
                    "id TEXT PRIMARY KEY," + // Chat UUID
                    "name TEXT," + // Name of this chat
                    "read INTEGER," + // Has this chat been read by the user?
                    "muted INTEGER," + // Is this chat muted?
                    "blocked INTEGER," + // Is this chat blocked?
                    "lastMessage TEXT," + // UUID of the last message sent/received in this chat
                    "key TEXT," + // The current symmetric encryption/decryption key for this chat
                    "version TEXT," + // The timestamp at which the key was generated
                    "accepted INTEGER," + // Whether the entity has accepted this chat request or not
                    "type INTEGER" + // Whether this is a group chat (1) or private chat (0)
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
                    "[from] TEXT," + // Sender UUID
                    "created TEXT," + // When the message was created; UTC timestamp in ISO-8601 format
                    "content TEXT," + // Text content
                    "mime TEXT," + // MIME type of the content
                    "PRIMARY KEY (chat, id)" + // Composite primary key
                    "FOREIGN KEY (chat) " +
                        "REFERENCES Chats (id) " +
                            "ON DELETE CASCADE " +
                            "ON UPDATE NO ACTION" +
                ")"],
                // Table of posts
                ["CREATE TABLE IF NOT EXISTS " + "Posts" + "(" +
                    "id TEXT," + // Post UUID
                    "author TEXT," + // Author UUID
                    "parentPost TEXT," + // Reply/comment posts only
                    "parentAuthor TEXT," + // Reply/comment posts only
                    "created TEXT," + // When the post was created; UTC ISO-8601 format
                    "edited TEXT," + // When the post was last edited by the author; UTC ISO-8601 format
                    "updated TEXT," + // When the post was last updated from the author; UTC ISO-8601 format
                    "version INTEGER," + // Which version of the post is this? Increments on each edit
                    "content TEXT," + // Text content
                    "media TEXT," + // JSON array of all media content (e.g. images, videos etc.)
                    "visibility INTEGER," + // Enumeration of visibility level, e.g. public, followers only, private, etc.
                    "PRIMARY KEY (id, author)" + // Composite primary key
                ")"],
                // Table linking subscribers to post publishers.
                ["CREATE TABLE IF NOT EXISTS " + "Subscriptions" + "(" +
                    "pub TEXT," + // Publisher UUID
                    "sub TEXT," + // Subscriber UUID
                    "PRIMARY KEY (pub, sub)," + // Composite primary key
                    "FOREIGN KEY (pub) " +
                        "REFERENCES Peers (id) " +
                            "ON DELETE CASCADE " +
                            "ON UPDATE NO ACTION," +
                    "FOREIGN KEY (sub) " + 
                        "REFERENCES Peers (id) " +
                            "ON DELETE CASCADE " +
                            "ON UPDATE NO ACTION" +
                ")"],
                ["CREATE TABLE IF NOT EXISTS " + "MediaCache" + "(" +
                    "id TEXT," + // ID given to the file
                    "hash TEXT," + // MD5 hash of the file
                    "ext TEXT," + // File extension
                    "author TEXT," + // Who originally uploaded/generated this file?
                    "mime TEXT," + // MIME type
                    "PRIMARY KEY (id)" +
                ")"]
            ];

            let result = sqlite.executeSqlBatch(id, commands);
            if (result.status) {
                Log.Error("Failed to setup database tables. " + result.message);
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
    static Execute(sql, params=[]) {
        //Log.Debug("Executing SQL command:\n" + sql);
        let query = sqlite.executeSql(this.db, sql, params);
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
        let chat = {
            id: meta.id,
            name: "name" in meta ? meta.name : "",
            read: "read" in meta ? meta.read : 0,
            muted: "muted" in meta ? meta.muted : 0,
            blocked: "blocked" in meta ? meta.blocked : 0,
            lastMessage: "",
            key: "key" in meta ? meta.key : "", // TODO generate symmetric key
            version: "version" in meta ? meta.version : "", // TODO generate version text
            accepted: "accepted" in meta ? meta.accepted : 1,
            type: "type" in meta ? meta.type : 1
        };

        // TODO batch these SQL commands

        // Create a chat entry
        this.Execute(
            "INSERT INTO Chats (id,name,read,muted,blocked,lastMessage,key,version,accepted,type) " + 
                "VALUES (?,?,?,?,?,?,?,?,?,?)",
            [
                chat.id,
                chat.name,
                chat.read,
                chat.muted,
                chat.blocked,
                chat.lastMessage,
                chat.key,
                chat.version,
                chat.accepted,
                chat.type
            ]
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
                "INSERT INTO ChatMembers (chat,peer) VALUES (?,?)",
                [meta.id, members[i]]
            );
        }

        return chat;
    }

    static CreatePost(content, media, visibility=1, parentPost="", parentAuthor="") {
        let timeNow = (new Date()).toISOString();
        let post = {
            id: uuidv1(),
            author: this.active.getString("id"),
            parentPost: parentPost,
            parentAuthor: parentAuthor,
            created: timeNow,
            edited: timeNow,
            updated: timeNow,
            version: 0,
            content: content,
            media: JSON.stringify(media),
            visibility: visibility
        }

        // Create a post entry in the database
        this.Execute(
            "INSERT INTO Posts (id,author,parentPost,parentAuthor,created,edited,updated,version,content,media,visibility) " + 
                "VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            [
                post.id,
                post.author,
                post.parentPost,
                post.parentAuthor,
                post.created,
                post.edited,
                post.updated,
                post.version,
                post.content,
                post.media,
                post.visibility
            ]
        );

        return post;
    }

    // TODO future work
    static EditPost(id, post) {
        post.version = post.version + 1;
        this.Execute(
            "UPDATE Posts SET content=?,media=?,version=?",
            [post.content,post.media,post.version]
        );
    }

    // Cache a post from a remote peer
    static CachePost(post) {
        let query = this.Execute("SELECT version FROM Posts WHERE id='" + post.id + "' AND author='" + post.author + "'");
        
        if (query.data.length == 0) {
            Log.Debug("Caching post." + post.id);
            this.Execute(
                "INSERT INTO Posts (id,author,parentPost,parentAuthor,created,edited,updated,version,content,media,visibility) " + 
                    "VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                [
                    post.id,
                    post.author,
                    post.parentPost,
                    post.parentAuthor,
                    post.created,
                    post.edited,
                    post.updated,
                    post.version,
                    post.content,
                    post.media,
                    post.visibility
                ]
            );

            // TODO delete older posts (and associated media files) outside of the cache limit
        } else if (query.data[0].version != post.version) {
            Log.Debug("Updating cached post." + post.id);
            this.Execute(
                "UPDATE Posts SET " + 
                    "edited=?, " + 
                    "version=?, " + 
                    "content=?, " +
                    "media=? " +
                "WHERE id=? AND author=?",
                [post.edited, post.version, post.content, post.media, post.id, post.author]
            );
        } else {
            Log.Debug("No version change detected in received post, no need to recache.");
        }
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
            let initialDate = (new Date(0)).toISOString();
            peer = {
                id: id,
                name: "name" in peer ? peer.name : "",
                avatar: "avatar" in peer && "ext" in peer.avatar ? peer.avatar.ext : "",
                mutual: "mutual" in peer ? peer.mutual : 0,
                blocked: "blocked" in peer ? peer.blocked : 0,
                sync: "sync" in peer ? peer.sync : initialDate,
                interaction: "interaction" in peer ? peer.interaction : dateNow,
                certificate: "certificate" in peer ? peer.certificate : "",
                verifier: "verifier" in peer ? peer.verifier : "",
                issued: "issued" in peer ? peer.issued : "",
                updated: "updated" in peer ? peer.updated : initialDate
            };
            // Insert blank peer entry
            this.Execute(
                "INSERT INTO Peers (id,name,avatar,mutual,blocked,sync,interaction,certificate,verifier,issued,updated) " + 
                    "VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                [
                    peer.id,
                    peer.name,
                    peer.avatar,
                    peer.mutual,
                    peer.blocked,
                    peer.sync,
                    peer.interaction,
                    peer.certificate,
                    peer.verifier,
                    peer.issued,
                    peer.updated
                ]
            );
        }
        return peer;
    }

    // Delete a particular peer, along with all associated cached data (including messages & posts)
    static DeletePeer(id) {
        Log.Debug("Attempting to delete peer." + id);
        Database.Execute("DELETE FROM Messages WHERE [from]=?", [id]);
        Database.Execute("DELETE FROM Posts WHERE author=?", [id]);
        Database.Execute("DELETE FROM Peers WHERE id=?", [id]);
    }

    static DeleteChat(id) {
        Log.Debug("Attempting to delete chat." + id);
        Database.Execute("DELETE FROM Chats WHERE id=?", [id]);
    }

    static DeletePost(id) {
        Log.Debug("Attempting to delete post." + id);
        Database.Execute("DELETE FROM Posts WHERE id=?", [id]);
    }

}
