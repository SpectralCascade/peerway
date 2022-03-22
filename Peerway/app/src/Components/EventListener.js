
export class EventListener {
    constructor(events, eventType, handle, callback) {
        if (!(eventType in events)) {
            events[eventType] = {};
        }
        events[eventType][handle] = this;
        this.events = events;
        this.handle = handle;
        this.eventType = eventType;
        this.callback = callback;
        this.valid = true;
    }
    
    remove() {
        if (this.events && this.eventType in this.events && this.handle in this.events[this.eventType]) {
            delete this.events[this.eventType][this.handle];
            this.valid = false;
        }
    }

    invoke(...args) {
        if (this.valid && this.callback) {
            this.callback(...args);
        } else {
            throw new Error("Cannot invoke invalidated event listener of type \"" + this.eventType + "\".");
        }
    }
}
