const { fetchFromNotion, getNotionProps, updateTweet, updateReddit } = require("../_11ty/notionHelpers");

const { Client } = require('@notionhq/client');
// https://github.com/souvikinator/notion-to-md
const { NotionToMarkdown } = require("notion-to-md"); const metadata = require("./metadata.json");

// Define Cache Location and API Endpoint
const CACHE_FILE_PATH = "src/_cache/notes.json";
const TOKEN = process.env.NOTION_API_KEY

const notion = new Client({ auth: TOKEN });
const n2m = new NotionToMarkdown({ notionClient: notion });

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

  const results = await fetchFromNotion(notion, metadata["notion_notes"], undefined);

  if (results) {
    console.log(
      `>>> ${results.length} new notes fetched`
    );

    const newNotes = {}

    for (const note of results) {
      const noteContent = await fetchPage(note.id)
      const props = getNotionProps(note)
      // props['images'] = //getLocalImages(note, 'Images' , 'notes')
      const newNote = {
        ...getMetadata(note),
        ...props,
        content: noteContent,
      }
      newNotes[note.id] = newNote;
    }

    return newNotes;
  }

  return null;
}

function processAndReturn(notes) {
  return Object.values(notes)
    .sort(function(a, b) {
      const timeA = a.created_time ? new Date(a.created_time).getTime() : 0;
      const timeB = b.created_time ? new Date(b.created_time).getTime() : 0;
      return timeA - timeB;
    })
}

module.exports = async function () {
  console.log(">>> Checking for new notes...");
  const newNotes = await fetchNotes();

  await updateReddit(notion, newNotes, 'note');
  await updateTweet(notion, newNotes, 'note');
  const publishedNotes = processAndReturn(newNotes);
  return publishedNotes;
};
