function update_status(status) {
    document.getElementById("status").innerText = status;
}

function init_honoka(file, android, newDomain) {
    async function onloaded() {
        if (newDomain.endsWith("/")) newDomain = newDomain.slice(0, -1);
        if (!file) {
            console.log("downloading");
            update_status("Downloading...");
            if (android) {
                file = await (await fetch("https://ethanthesleepy.one/public/lovelive/lovelive-community.apk")).blob();
            } else {
                file = await (await fetch("https://ethanthesleepy.one/public/lovelive/lovelive-community.ipa")).blob();
            }
            console.log("downloaded");
        }
        console.log("loaded");
        update_status("Opening file");
        const zip = new JSZip();
        await zip.loadAsync(file);
        update_status("Getting current config");
        let server_file;
        if (android) {
            let server_info = await zip.file("assets/AppAssets.zip").async("arraybuffer");
            const zip2 = new JSZip();
            await zip2.loadAsync(server_info);
            server_file = await zip2.file("config/server_info.json").async("arraybuffer");
        } else {
            server_file = await zip.file("Payload/LoveLive.app/ProjectResources/config/server_info.json").async("arraybuffer");
        }
        //console.log(server_file);
        FS.writeFile("/server_info.json", new Uint8Array(server_file));
        update_status("Decrypting");
        Module.callMain(["server_info.json"]);
        update_status("Patching domain");
        const data = FS.readFile("/server_info.json", {encoding: 'utf8'});
        const currentData = JSON.parse(data);
        const currentDomain = currentData.domain;
        const newData = data.split(currentDomain).join(newDomain);
        FS.writeFile("/server_info.json", newData);
        update_status("Encrypting");
        Module.callMain(["-e", "-j", "server_info.json"]);
        const new_server_info = FS.readFile("/server_info.json");
        let type;
        let ext;
        update_status("Applying changes");
        if (android) {
            let server_info = await zip.file("assets/AppAssets.zip").async("arraybuffer");
            const zip2 = new JSZip();
            await zip2.loadAsync(server_info);
            zip2.file("config/server_info.json", new_server_info);
            const appAssets = await zip2.generateAsync({type: "uint8array"});
            zip.file("assets/AppAssets.zip", appAssets);
            zip.file("assets/version", "MD5 (AppAssets.zip) = " + CryptoJS.MD5(appAssets).toString());
            type = "application/vnd.android.package-archive";
            ext = "apk";
        } else {
            zip.file("Payload/LoveLive.app/ProjectResources/config/server_info.json", new_server_info);
            type = "application/octet-stream";
            ext = "ipa";
        }
        let finalized = await zip.generateAsync({type: "uint8array"});
        update_status("Finalizing");
        const downloadUrl = URL.createObjectURL(new Blob([finalized], {type: type}));
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.innerText = "Download";
        a.download = "lovelive."+ext;
        document.body.appendChild(a);
        update_status("Done!");
        if (android) {
            const p = document.createElement("p");
            p.innerHTML = "Package is not signed. It will not install. Sign it with the command `apksigner sign -ks sifkey.keystore lovelive.apk`. Make sure to download <a href=\"https://codeberg.org/arina999999997/nozomi/raw/branch/master/sifkey.keystore\">this keystore</a>.";
            document.body.appendChild(p);
        }
    }
    window.Module = {
        noInitialRun: true,
        onRuntimeInitialized: async function() {
            try {
                await onloaded();
            } catch(e) {
                document.getElementById("status").innerText = "It didnt work. Are your files/options invalid?";
            }
        },
        arguments: [],
        preRun: [],
        postRun: [],
        print: (msg) => {
            console.log(msg);
        },
        printErr: (msg) => {
            console.log(msg);
        },
        totalDependencies: 0,
        monitorRunDependencies: () => {},
        locateFile: function(fileName) {
            console.log("locateFile", fileName);
            return fileName;
        }
    };
    const script = document.createElement("script")
    script.src = "libhonoka.js";
    document.body.appendChild(script);
};
