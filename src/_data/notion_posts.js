const {fetchFromNotion, getNotionProps, updateReddit, updateTweet} = require("../_11ty/notionHelpers");
const {DateTime} = require('luxon');

const jsToDateTime = (date, lang = 'en') =>
    DateTime.fromJSDate(date, {setZone: true})
        .setZone('America/Vancouver')
        .setLocale(lang);

const {Client} = require("@notionhq/client");
// https://github.com/souvikinator/notion-to-md
const {NotionToMarkdown} = require("notion-to-md");
const metadata = require("./metadata.json");

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

    const results = await fetchFromNotion(notion, metadata["notion_posts"], undefined);

    if (results) {
        const newPosts = {};
        console.log(`>>> ${results.length} new posts fetched`);

        for (const post of results) {
            const content = await fetchPage(post.id);
            const props = getNotionProps(post);
            props['thumbnail'] = props['thumbnail'][0];//getLocalImages(post, 'Thumbnail', 'notion_post')[0];
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
    console.log(">>> Checking for new posts...");
    const posts = await fetchPosts();

    await updateReddit(notion, posts, 'post');
    await updateTweet(notion, posts, 'post');
    const publishedPosts = filterDrafts(posts);
    // updateReplyTo(notion, publishedPosts, 'post');
    return publishedPosts;
};
