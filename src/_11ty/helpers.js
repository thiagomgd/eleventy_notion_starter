const fs = require("fs");
const fetch = require("node-fetch");
const Image = require("@11ty/eleventy-img");

const IMG_CACHE_FILE_PATH = "src/_cache/images.json";
const external = /https?:\/\/((?:[\w\d-]+\.)+[\w\d]{2,})/i;
// Matches bookmark links that are not inline
const mdBookmarkRegex = /^\[bookmark]\(([^)]+)\)$/gm;
// TODO: test
const mdImageRegex = /^\!\[\]\(((?:\/|https?:\/\/)[\w\d./?=#]+)\)$/;

// function replaceNotionBookmark(markdownString) {
//   console.log("!!!!!!!!!!!!!!!!");
//   console.log(markdownString.match(mdBookmarkRegex));
//   return markdownString.replace(mdBookmarkRegex, `{% anyEmbed '$1' %}`);
// }

// function replaceNotionMarkdown(markdownString) {
//   const newString = replaceNotionBookmark(markdownString);
//   console.log(newString);
//   return newString;
// }

// get cache contents from json file
function readFromCache(cacheFilePath) {
    if (fs.existsSync(cacheFilePath)) {
        const cacheFile = fs.readFileSync(cacheFilePath);
        return JSON.parse(cacheFile);
    }

    // no cache found.
    return {
        lastFetched: null,
    };
}

// save combined webmentions in cache file
function writeToCache(data, cacheFilePath, descriptor) {
    // Don't actually write to cache on dev or cloudflare
    if (process.env.ELEVENTY_ENV !== "devbuild") return;

    const dir = "src/_cache";
    const fileContent = JSON.stringify(data, null, 2);
    // create cache folder if it doesnt exist already
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
    // write data to cache json file
    fs.writeFileSync(cacheFilePath, fileContent, (err) => {
        if (err) throw err;
        console.log(`>>> ${descriptor} cached to ${cacheFilePath}`);
    });
}

function hash(text) {
    "use strict";

    var hash = 5381,
        index = text.length;

    while (index) {
        hash = (hash * 33) ^ text.charCodeAt(--index);
    }

    const hashNumber = hash >>> 0;
    return hashNumber.toString();
}

function shortHash(text) {
    return hash(text).substring(0, 7);
}

function isNotionImage(imgUrl) {
    return imgUrl.includes('secure.notion-static.com');
}

function getFileName(url) {
    // get the filename from the path
    const pathComponents = url.split("/");

    // break off cache busting string if there is one
    let filename = pathComponents[pathComponents.length - 1].split("?");
    return `${shortHash(url)}-${filename[0]}`;
}

function getFolder(imgUrl, folder, slug) {
    if (isNotionImage) return `notion/${slug}`;
    if (imgUrl.includes('photo.goodreads.com')) return 'goodreads';

    return folder;
}

function getLocalImageLink(imgUrl, fileName = "") {
    if (!imgUrl) return "";

    if (process.env.ELEVENTY_ENV !== "devbuild") return imgUrl;

    // skip local images, notion images
    if (!external.test(imgUrl) || isNotionImage(imgUrl)) {
        return imgUrl;
    }

    const cache = readFromCache(IMG_CACHE_FILE_PATH);

    if (cache[imgUrl]) {
        const filePath = `./src${cache[imgUrl].url}`
        if (fs.existsSync(filePath)) {
            return cache[imgUrl].url;
        }
        // it's probably downloading, fallback to remote url
        return imgUrl;
    }

    const folder = getFolder(imgUrl, "ext");

    const fn = fileName || getFileName(imgUrl);
    const imagePath = `/img/${folder}/${fn}`;
    const path = `./src${imagePath}`;

    if (!fs.existsSync(path)) {
        fetch(imgUrl).then((res) => res.body.pipe(fs.createWriteStream(path)));
        cache[imgUrl] = {url: imagePath};
        writeToCache(cache, IMG_CACHE_FILE_PATH, "images");
        // TODO: return local. For now, since download is async, first run needs to use external url
        return imgUrl;
    } else {
        console.error("> collision downloading image", imgUrl);
    }

    return imagePath;
}

// function downloadImage(url, filepath) {
//     if (!fs.existsSync(filepath)) {
//         return new Promise((resolve, reject) => {
//             fetch(url).then((res) => {
//                     res.body.pipe(fs.createWriteStream(filepath)).on('error', reject)
//                         .once('close', () => resolve(filepath));
//                 }
//             )
//         });
//     }
//     console.error("> collision downloading image", url, filepath);
// }

async function downloadNotionImage(notionId, imgUrl) {
    if (!imgUrl || !isNotionImage(imgUrl)) return imgUrl;

    const folder = getFolder(imgUrl, "", notionId);

    const fn = getFileName(imgUrl);
    const imagePath = `/img/${folder}/${fn}`;
    const path = `./src${imagePath}`;
    const dir = `./src/img/${folder}`;

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }

    // since the original images are on Notion, no need to keep original here
    const res = await getOptimizedUrl(imgUrl, dir, "outputPath");
    // console.log("RES", res);
    return res.replace('src', '');
}

function getOptimizeMetadata(metadata) {
    let outputs;
    if ("webp" in metadata) {
        outputs = metadata["webp"];
    } else if ("gif" in metadata) {
        outputs = metadata["gif"];
    } else if ("png" in metadata) {
        outputs = metadata["png"];
    } else {
        outputs = metadata["jpeg"];
    }
    return outputs[outputs.length - 1];
}

async function optimizeImage(src, outputDir = "_site/img",) {
    if (!src) {
        return src;
    }

    const fileSource = src.startsWith("/img") ? `./src${src}` : src;

    const extraProps = src.includes(".gif")
        ? {
            formats: ["gif"],//["webp", "gif"],
            sharpOptions: {
                animated: true,
            },
        }
        : {formats: ["jpeg"]};

    let metadata = await Image(fileSource, {
        widths: [1200],
        outputDir: outputDir,
        cacheOptions: {
            duration: "8w",
        },
        ...extraProps,
    });

    return getOptimizeMetadata(metadata);
}

async function getOptimizedUrl(src, outputDir = "_site/img", toReturn = "url") {
    // console.log("!!!!!!getOptimizedUrl", src, outputDir, toReturn);
    const data = await optimizeImage(src, outputDir);
    return data[toReturn];
}

function deleteNotionLocalImages(postId) {
    if (process.env.ELEVENTY_ENV !== "devbuild") return;

    const dir = `./src/img/notion/${postId}`; // TODO: don't duplicate this with the download function
    if (fs.existsSync(dir)) {
        fs.rmdirSync(dir, {recursive: true});
    }
}

module.exports = {
    // replaceNotionMarkdown,
    readFromCache,
    writeToCache,
    getLocalImageLink,
    getOptimizeMetadata,
    getOptimizedUrl,
    optimizeImage,
    deleteNotionLocalImages,
    downloadNotionImage
};
