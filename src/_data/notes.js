const {fetchFromNotion, getNotionProps, updateTweet, updateReddit, updateReplyTo} = require("../_11ty/notionHelpers");

const {Client} = require('@notionhq/client');
// https://github.com/souvikinator/notion-to-md
const {NotionToMarkdown} = require("notion-to-md");
const metadata = require("./metadata.json");
const {
    deleteNotionLocalImages,
    readFromCache,
    writeToCache,
    downloadNotionImage
} = require("../_11ty/helpers");

// Define Cache Location and API Endpoint
const CACHE_FILE_PATH = "src/_cache/notes.json";
const TOKEN = process.env.NOTION_API_KEY

const notion = new Client({auth: TOKEN});
const n2m = new NotionToMarkdown({notionClient: notion});

const getMetadata = (note) => {
    return {
        id: note.id,
        "created_time": note.created_time,
        "last_edited_time": note.last_edited_time,
        "cover": note.cover,
        "icon": note.icon,
    }
}

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

async function fetchNotes(since) {
    if (!metadata["notion_notes"] || !TOKEN) {
        console.warn(">>> unable to fetch notes: missing token or db id");
        return null;
    }

    const filters = {property: "Edited", date: {after: since}};

    const results = await fetchFromNotion(notion, metadata["notion_notes"], filters);

    if (!results) return null;

    console.log(
        `>>> ${results.length} new notes fetched`
    );

    const newNotes = {}

    for (const note of results) {
        deleteNotionLocalImages(note.id);
        const noteContent = await fetchPage(note.id)
        // console.log(noteContent);
        const props = getNotionProps(note)

        for (let [index, val] of props['images'].entries()) {
            props["images"][index] = await downloadNotionImage(note.id, val);
        }

        newNotes[note.id] = {
            ...getMetadata(note),
            ...props,
            content: noteContent,
        };
    }
    // console.log(asd);
    return newNotes;


}

function processAndReturn(notes) {
    return Object.values(notes)
        .sort(function (a, b) {
            const timeA = a.created_time ? new Date(a.created_time).getTime() : 0;
            const timeB = b.created_time ? new Date(b.created_time).getTime() : 0;
            return timeA - timeB;
        })
}

module.exports = async function () {
    console.log(">>> Reading notes from cache...");
    const cache = readFromCache(CACHE_FILE_PATH);

    if (Object.keys(cache.data).length) {
        console.log(`>>> ${Object.keys(cache.data).length} notes loaded from cache`);
    }

    console.log(">>> Checking for new notes...");
    const newNotes = await fetchNotes(cache.lastFetched);

    // if (!newNotes) {
    //     return processAndReturn(cache.data);
    // }

    const newData = {...cache.data, ...newNotes}

    const newCache = {
        lastFetched: new Date().toISOString(),
        data: newData,
    };

    if (process.env.ELEVENTY_ENV === "devbuild") {
        writeToCache(newCache, CACHE_FILE_PATH, "notes");
    }

    // TODO: only process these for published notes
    await updateReddit(notion, newData, 'note');
    await updateTweet(notion, newData, 'note');
    await updateReplyTo(notion, newData, "note");

    return processAndReturn(newData);
};
