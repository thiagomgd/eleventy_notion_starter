const fetch = require("node-fetch");
const fs = require("fs");
const metadata = require("./metadata.json");
const { readFromCache, writeToCache } = require("../_11ty/helpers");
const { fetchFromNotion, getNotionProps } = require("../_11ty/notionHelpers");

const { Client } = require("@notionhq/client");

// Define Cache Location and API Endpoint
const CACHE_FILE_PATH = "src/_cache/links.json";
const TOKEN = process.env.NOTION_API_KEY;

const notion = new Client({ auth: TOKEN });

const getMetadata = (link) => {
  return {
    id: link.id,
    created_time: link.created_time,
    last_edited_time: link.last_edited_time,
    cover: link.cover,
    icon: link.icon,
  };
};

async function fetchLinks(since) {
  if (!metadata["notion_links"] || !TOKEN) {
    console.warn(">>> unable to fetch links: missing token or db id");
    return null;
  }

  const filters = since
    ? {
        and: [
          { property: "Edited", date: { after: since } },
          {
            property: "Private",
            checkbox: {equals: false},
          },
        ],
      }
    : {
      property: "Private",
      checkbox: {equals: false},
    };

  const results = await fetchFromNotion(
    notion,
    metadata["notion_links"],
    filters
  );

  if (results) {
    console.log(`>>> ${results.length} new links fetched`);

    const newLinks = {};

    for (const link of results) {
      const props = getNotionProps(link);
      // props['images'] = //getLocalImages(link, 'Images' , 'links')
      const newLink = {
        ...getMetadata(link),
        ...props,
      };
      newLinks[link.id] = newLink;
    }

    return newLinks;
  }

  return null;
}

// Append fresh links to cached entries
function mergeNotes(a = {}, b = {}) {
  return { ...a, ...b };
}

function processAndReturn(links) {
  return Object.values(links).sort(function (a, b) {
    const timeA = a.created_time ? new Date(a.created_time).getTime() : 0;
    const timeB = b.created_time ? new Date(b.created_time).getTime() : 0;
    return timeA - timeB;
  });
}

module.exports = async function () {
  console.log(">>> Reading links from cache...");
  const cache = readFromCache(CACHE_FILE_PATH);

  if (cache.links && Object.keys(cache.links).length) {
    console.log(
      `>>> ${Object.keys(cache.links).length} links loaded from cache`
    );
  }

  // Only fetch new links in production
  if (process.env.ELEVENTY_ENV === "development") return processAndReturn(cache.links);

  console.log(">>> Checking for new links...");
  const newLinks = await fetchLinks(cache.lastFetched);

  if (newLinks) {
    const links = {
      lastFetched: new Date().toISOString(),
      links: mergeNotes(cache.links, newLinks),
    };

    if (process.env.ELEVENTY_ENV === "devbuild") {
      writeToCache(links, CACHE_FILE_PATH, "links");
    }

    return processAndReturn(links.links);
  }

  return processAndReturn(cache.links);
};
