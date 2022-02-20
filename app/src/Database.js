import 'react-native-get-random-values';
import { MMKV } from 'react-native-mmkv';
import {v1 as uuidv1, v4 as uuidv4 } from 'uuid';
import AppKeys from './AppKeys';

// Local user data, tracking entities and general app settings.
const userdata = new MMKV({ id: "userdata", encryptionKey: AppKeys.userdata });

export default class Database {

    static entities = {};
    static active = null;

    // Changes the current active entity storage slot.
    static SwitchActiveEntity(id) {
        if (id == null || id == "") {
            this.active = null;
        } else {
            this.active = this.entities[id];
        }
        return this.active;
    }

    // Creates a new entity storage slot and automatically sets the active slot.
    static CreateEntity() {
        // Generated ID for this entity, based on timestamp & MAC address.
        id = uuidv1();
        
        // Randomly generated encryption key for the entity data.
        // This way, if another user gets access to the entity data, they need the key to access it.
        // In future, this could be a user password or pin instead of RNG UUID.
        key = uuidv4();

        console.log("Created id " + id + " and key: " + key);
        // Create new entity storage slot
        this.entities[id] = new MMKV({
            id: id,
            encryptionKey: key
        });

        // Add entity to userdata.
        userdata.set(id, key);

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
        if (userdata.contains(id)) {
            userdata.delete(id);
        }
        return success;
    }

}
