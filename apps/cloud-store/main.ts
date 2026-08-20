// Basic bucket setup
let bucket:Bun.S3Client = new Bun.S3Client({
    bucket: "demo",
    accessKeyId: "minio",
    secretAccessKey: "ffa@minio",
    region: "us-west-1",
    endpoint: "http://ffa-db.diandian.info:9000",
});

// ping
try {
    await bucket.exists("$$NOT_EXIST_FILE$$");
} catch (error: any) {
    console.error("Failed to ping bucket:", error.code);
    process.exit(1);
}

// 预签名 URL
// const file = bucket.file("/idle-slot/ffb_icon.png");
// const url = file.presign({
//     expiresIn: 60 * 60 * 24, // 1 天
//     acl: "public-read",
// });
// console.log("Presigned URL:", url);

const files = await bucket.list({ prefix: "/idle-slot/index" });
if (files.keyCount == 0 || !files.contents) {
    console.error("Failed to list files", files);
    process.exit(1);
}

const fileList = files.contents.map((file) => file.key);
fileList.sort((a, b) => a.localeCompare(b));
const latestFile = fileList[fileList.length - 1];
console.log("latest index file", latestFile);

// 读取远程文件的方式跟本地一样
const idxFile = bucket.file(latestFile!);
const stat = await idxFile.stat();
console.log("Last modified:", stat.lastModified);

const content = await idxFile.json();
console.log("File content length:", content?.versionName);
