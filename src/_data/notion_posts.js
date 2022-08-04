const {fetchFromNotion, getNotionProps, updateReddit, updateTweet, updateReplyTo} = require("../_11ty/notionHelpers");
const {DateTime} = require('luxon');

const jsToDateTime = (date, lang = 'en') =>
    DateTime.fromJSDate(date, {setZone: true})
        .setZone('America/Vancouver')
        .setLocale(lang);

const {Client} = require("@notionhq/client");
// https://github.com/souvikinator/notion-to-md
const {NotionToMarkdown} = require("notion-to-md");
const metadata = require("./metadata.json");
const {downloadNotionImage, deleteNotionLocalImages, readFromCache, writeToCache} = require("../_11ty/helpers");

// Define Cache Location and API Endpoint
const CACHE_FILE_PATH = "src/_cache/notion_posts.json";
const TOKEN = process.env.NOTION_API_KEY;

const notion = new Client({auth: TOKEN});
const n2m = new NotionToMarkdown({notionClient: notion});

const getMetadata = (post) => {
    return {
        id: post.id,
        created_time: post.created_time,
        last_edited_time: post.last_edited_time,
        cover: post.cover,
        icon: post.icon,
    };
};

async function fetchPage(pageId) {
    if (process.env.ELEVENTY_ENV === "devbuild") {
        // only way to set customTransformer and use pageId
        n2m.setCustomTransformer('image', async (block) => {
            let blockContent = block.image;
            const image_caption_plain = blockContent.caption
                .map((item) => item.plain_text)
                .join("");
            const image_type = blockContent.type;
            if (image_type === "external")
                return `![${image_caption_plain}](${blockContent.external.url})`
            if (image_type === "file") {
                const localImage = await downloadNotionImage(pageId, blockContent.file.url);
                return `![${image_caption_plain}](${localImage})`
            }
        });
    }

    const mdblocks = await n2m.pageToMarkdown(pageId);

    // console.debug(`---------------`);
    // console.debug(mdblocks);
    const mdString = n2m.toMarkdownString(mdblocks);
    // console.debug(`---------------`);
    // console.debug(mdString);
    // console.debug(`---------------`);

    return mdString;
    // return replaceNotionMarkdown(mdString);
}

// TODO: this won't delete posts deleted on notion
async function fetchPosts(since) {
    // If we dont have a domain name or token, abort
    if (!metadata["notion_posts"] || !TOKEN) {
        console.warn(">>> unable to fetch posts: missing token or db id");
        return null;
    }

    const filters = {property: "Edited", date: {after: since}};

    const results = await fetchFromNotion(notion, metadata["notion_posts"], filters);

    if (results) {
        const newPosts = {};
        console.log(`>>> ${results.length} new posts fetched`);

        for (const post of results) {
            deleteNotionLocalImages(post.id);
            const content = await fetchPage(post.id);
            const props = getNotionProps(post);
            props['thumbnail'] = await downloadNotionImage(post.id, props['thumbnail'][0]);

            newPosts[post.id] = {
                ...getMetadata(post),
                ...props,
                content: content,
            };
        }

        return newPosts;
    }

    return null;
}

const todaysDate = jsToDateTime(new Date());

function showPost(data) {
    // FOR NOW: also filter posts without slug - don't want to have it change over time
    const hasSlug = "slug" in data && data.slug !== '';
    const isPublished = "published" in data && data.published === true;
    const isFutureDate = !data.date_published || data.date_published > todaysDate;
    return hasSlug && isPublished && !isFutureDate;
}

function filterDrafts(posts) {
    const isDevEnv = process.env.ELEVENTY_ENV === "development";

    if (isDevEnv) return Object.values(posts);

    return Object.values(posts).filter(post => showPost(post) === true);
}


// TODO: Find duplicate slugs and error/warning

module.exports = async function () {
    console.log(">>> Reading posts from cache...");
    const cache = readFromCache(CACHE_FILE_PATH);

    if (cache.data && Object.keys(cache.data).length) {
        console.log(`>>> ${Object.keys(cache.data).length} posts loaded from cache`);
    }

    console.log(">>> Checking for new posts...");
    const newPosts = await fetchPosts(cache.lastFetched);

    // maybe update reddit/twitter here
    // if (!newPosts) {
    //     return filterDrafts(cache.data);
    // }

    const newData = {...cache.data, ...newPosts}

    const newCache = {
        lastFetched: new Date().toISOString(),
        data: newData,
    };

    if (process.env.ELEVENTY_ENV === "devbuild") {
        writeToCache(newCache, CACHE_FILE_PATH, "notes");
    }

    // TODO: only process these for published notes
    await updateReddit(notion, newData, 'post');
    await updateTweet(notion, newData, 'post');
    await updateReplyTo(notion, newData, "post");

    return filterDrafts(newData);
};
