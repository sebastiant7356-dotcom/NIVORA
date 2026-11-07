const fs = require("node:fs");
const path = require("node:path");
const manifest = path.join(__dirname, "..", "android", "app", "src", "main", "AndroidManifest.xml");
if (!fs.existsSync(manifest)) throw new Error("AndroidManifest.xml was not generated.");
let xml = fs.readFileSync(manifest, "utf8");
if (xml.includes('android:scheme="in.nivora.social"')) process.exit(0);
const activity = /(<activity\b[^>]*android:name="[^"]*MainActivity"[^>]*>)/;
if (!activity.test(xml)) throw new Error("MainActivity declaration was not found in AndroidManifest.xml.");
xml = xml.replace(activity, \`$1
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="in.nivora.social" android:host="auth" android:pathPrefix="/callback" />
            </intent-filter>\`);
fs.writeFileSync(manifest, xml);
