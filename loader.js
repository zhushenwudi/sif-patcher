function update_status(status) {
    console.log(status);
    document.getElementById("status").innerText = status;
}

async function downloadFile(url) {
    const response = await fetch(url);
    const contentLength = response.headers.get('Content-Length');
    const total = parseInt(contentLength, 10);
    let loaded = 0;

    const reader = response.body.getReader();
    const chunks = [];

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        loaded += value.length;

        // 计算并显示下载进度
        const progress = (loaded / total) * 100;
        update_status(`下载中... ${progress.toFixed(2)}%`);
    }

    // 将所有块合并为一个 Blob
    return new Blob(chunks);
}

async function patch(android, newDomain, patches) {
    if (newDomain.endsWith("/")) newDomain = newDomain.slice(0, -1);

    console.log("downloading");
    update_status("下载中...");
    let file = await downloadFile("https://file.zhushenwudi.top/pd/1/SIF_CLIENT/lovelive-community." + (android ? "apk" : "ipa"));
    console.log("downloaded");
    console.log("loaded");
    update_status("解压客户端...");
    const zip = new JSZip();
    await zip.loadAsync(file);
    update_status("获取当前配置...");

    let basePath = android ? "" : "Payload/LoveLive.app/";
    let server_file;
    if (android) {
        let server_info = await zip.file("assets/AppAssets.zip").async("arraybuffer");
        const zip2 = new JSZip();
        await zip2.loadAsync(server_info);
        server_file = await zip2.file("config/server_info.json").async("arraybuffer");
    } else {
        server_file = await zip.file("Payload/LoveLive.app/ProjectResources/config/server_info.json").async("arraybuffer");
    }

    let postPatches = [];
    for (let i=0; i<patches.length; i++) {
        let patch = patches[i];
        if (!patch.checked) continue;
        for (let j=0; j<patch.files.length; j++) {
            let file = patch.files[j];
            if (android && file.outpath.startsWith("assets/")) {
                postPatches.push(file);
                continue;
            }
            console.log("Downloading patch", file.path);
            let res = await fetch(file.path);
            if (!res.ok) {
                console.warn("Error downloading patch");
                continue;
            }
            zip.file(basePath + file.outpath, await res.blob());
        }
    }

    //console.log(server_file);
    FS.writeFile("/server_info.json", new Uint8Array(server_file));
    update_status("解密中...");
    Module.callMain(["server_info.json"]);
    update_status("修补地址中...");
    const data = FS.readFile("/server_info.json", {encoding: 'utf8'});
    const currentData = JSON.parse(data);
    const currentDomain = currentData.domain;
    const newData = data.split(currentDomain).join(newDomain);
    FS.writeFile("/server_info.json", newData);
    update_status("加密中...");
    Module.callMain(["-e", "-j", "server_info.json"]);
    const new_server_info = FS.readFile("/server_info.json");

    let type;
    let ext;
    update_status("打包中...");
    if (android) {
        let server_info = await zip.file("assets/AppAssets.zip").async("arraybuffer");
        const zip2 = new JSZip();
        await zip2.loadAsync(server_info);
        zip2.file("config/server_info.json", new_server_info);

        for (let i=0; i<postPatches.length; i++) {
            let file = postPatches[i];
            console.log("Downloading patch", file.path);
            let res = await fetch(file.path);
            if (!res.ok) {
                console.warn("Error downloading patch");
                continue;
            }
            zip2.file(basePath + file.outpath, await res.blob());
        }

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
    update_status("请选择下载成果物");
    const downloadUrl = URL.createObjectURL(new Blob([finalized], {type: type}));
    const b = document.createElement("a");
    b.href = URL.createObjectURL(new Blob([new_server_info], {type: "application/json"}))
    b.innerText = "修补文件：server_info.json（你可能不需要这个）";
    b.download = "server_info.json";
    document.body.appendChild(b);

    document.body.appendChild(document.createElement("br"));
    document.body.appendChild(document.createElement("br"));

    const a = document.createElement("a");
    a.href = downloadUrl;
    a.innerText = "下载客户端";
    a.download = "lovelive-patched."+ext;
    document.body.appendChild(a);
    update_status("完成！");
    if (android) {
        const p = document.createElement("p");
        p.innerHTML = "修补的安装包未签名，可以使用 <a href=\"https://github.com/patrickfav/uber-apk-signer/releases\">uber-apk-signer</a>, 使用如下命令 `java -jar uber-apk-signer-<version>.jar -a lovelive.apk` 进行签名.";
        document.body.appendChild(p);
    }
}

function init_honoka(android, newDomain, patches) {
    window.Module = {
        noInitialRun: true,
        onRuntimeInitialized: async function() {
            try {
                await patch(android, newDomain, patches);
            } catch(e) {
                console.warn(e);
                document.getElementById("status").innerText = "失败。您的文件/选项无效吗？";
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
