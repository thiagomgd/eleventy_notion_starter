const fetch = require("node-fetch");
const fs = require("fs");
const domain = require("./metadata.json").domain;
// const { readFromCache, writeToCache, getLocalImageLink } = require("../_11ty/helpers");
const { fetchFromNotion, getNotionProps, getLocalImages, updateTweet, updateReddit } = require("../_11ty/notionHelpers");

const { Client } = require('@notionhq/client');
// https://github.com/souvikinator/notion-to-md
const { NotionToMarkdown } = require("notion-to-md");

// Define Cache Location and API Endpoint
const CACHE_FILE_PATH = "src/_cache/notes.json";
const DATABASE_ID = "";
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

const getEmbed = (note) => {
  return note.properties.Embed.url;
}

const getFormat = (note) => {
  return note.properties.Format.select ? note.properties.Format.select.name : 'text';
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
  if (!DATABASE_ID || !TOKEN) {
    console.warn(">>> unable to fetch notes: missing token or db id");
    return null;
  }

  // const filters = since
  //   ? {
  //       property: "Edited",
  //       date: { after: since },
  //     }
  //   : {};

  const results = await fetchFromNotion(notion, DATABASE_ID, undefined);

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

// Append fresh notes to cached entries
function mergeNotes(a={}, b={}) {
  return { ...a, ...b };
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

// module.exports = async function () {
//   console.log(">>> Reading notes from cache...");
//   const cache = readFromCache(CACHE_FILE_PATH);

//   if (cache.notes && Object.keys(cache.notes).length) {
//     console.log(`>>> ${Object.keys(cache.notes).length} notes loaded from cache`);
//   }

//   // Only fetch new notes in production
//   // if (process.env.ELEVENTY_ENV === "development") return processAndReturn(cache.notes);

//   console.log(">>> Checking for new notes...");
//   const newNotes = await fetchNotes(cache.lastFetched);

//   if (newNotes) {
//     const notes = {
//       lastFetched: new Date().toISOString(),
//       notes: mergeNotes(cache.notes, newNotes),
//     };

//     if (process.env.ELEVENTY_ENV === "devbuild") {
//       writeToCache(notes, CACHE_FILE_PATH, "notes");
//     }
    
//     return processAndReturn(notes.notes);
//   }

//   return processAndReturn(cache.notes);
// };
