// 启动新的浏览器实例
// const view = new Bun.WebView({
//     backend: { type: "chrome", url: false, path: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", stderr: "inherit", stdout: "inherit" },
//     dataStore: { directory: "./browser-profile" },
// });
// await using view = new Bun.WebView();

// 连接到现有的浏览器实例
// 通过 visit chrome://inspect/#remote-debugging 打开调试
const view = new Bun.WebView({
    backend: {
        type: "chrome",
        url: "ws://127.0.0.1:9222/devtools/browser",
    },
    dataStore: { directory: "./browser-profile" },
});

// await view.navigate("https://baidu.com/");
await view.navigate("https://mail.google.com/mail/u/0/#inbox");
await view.click("a[href]"); // waits for the link to be clickable
const title = await view.evaluate("document.title");
console.log(title);

await Bun.write("page.png", await view.screenshot());
view.close();
