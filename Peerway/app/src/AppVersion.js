const version = 2022;
const versionMajor = 0;
const versionMinor = 0;
const buildType = "a"
const versionText = version + "." + versionMajor + "." + versionMinor + buildType;

const AppVersion = {
    text: versionText,
    number: version,
    major: versionMajor,
    minor: versionMinor
}

export default AppVersion;
