
/*export default */class Log {
    // Which logs are enabled?
    static enabled = {
        debug: true,
        info: true,
        verbose: false,
        warning: true,
        error: true
    };

    static Info(data) {
        if (this.enabled.info) {
            console.log("Info: " + data);
        }
    }

    static Debug(data) {
        if (this.enabled.debug) {
            console.log("Debug: " + data);
        }
    }

    static Verbose(data) {
        if (this.enabled.verbose) {
            console.log("Verbose: " + data);
        }
    }
    
    static Warning(data) {
        if (this.enabled.warning) {
            console.log("Warning: " + data);
        }
    }
    
    static Error(data) {
        if (this.enabled.error) {
            console.log("Error: " + data);
        }
    }
}

module.exports = { Log };
