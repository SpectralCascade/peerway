
class Log {
    // Which logs are enabled?
    static enabled = {
        debug: true,
        info: true,
        verbose: false,
        warning: true,
        error: true
    };

    static GetTime() {
        let timenow = new Date();
        return timenow.toTimeString().slice(0, 8) + "." + timenow.getMilliseconds().toString().padStart(3, "0");
    }

    static Info(data) {
        if (this.enabled.info) {
            console.log(this.GetTime() + " Info: " + data);
        }
    }

    static Debug(data) {
        if (this.enabled.debug) {
            console.log(this.GetTime() + " Debug: " + data);
        }
    }

    static Verbose(data) {
        if (this.enabled.verbose) {
            console.log(this.GetTime() + " Verbose: " + data);
        }
    }
    
    static Warning(data) {
        if (this.enabled.warning) {
            console.log(this.GetTime() + " Warning: " + data);
        }
    }
    
    static Error(data) {
        if (this.enabled.error) {
            console.log(this.GetTime() + " ERROR: " + data);
        }
    }
}

module.exports = { Log };
