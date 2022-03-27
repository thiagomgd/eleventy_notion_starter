const groupBy = require("lodash/groupBy");
const fs = require("fs");
const domain = require("./metadata.json").domain;
const { readFromCache, writeToCache } = require("../_11ty/helpers");
const { fetchFromNotion, getNotionProps } = require("../_11ty/notionHelpers");

const { Client } = require("@notionhq/client");
// // https://github.com/souvikinator/notion-to-md
// const { NotionToMarkdown } = require("notion-to-md");

// // Define Cache Location and API Endpoint
const CACHE_FILE_PATH = "src/_cache/books.json";
const DATABASE_ID = "";
const TOKEN = process.env.NOTION_API_KEY;
// const imageFolder = "/img/books/"

const notion = new Client({ auth: TOKEN });

// const getImages = (note) => {
//   const imagesNotion = note.properties.Images.files;
//   const images = []
//   for (const img of imagesNotion) {
//     const fileName = `${note.id.substr(0, note.id.indexOf("-"))}-${img.name}`;
//     const path = `./src${imageFolder}${fileName}`;
//     const imagePath = `${imageFolder}${fileName}`;

//     if (img.file.url.includes("secure.notion-static.com") && !process.env.ELEVENTY_ENV === "devbuild") break;

//     if (!process.env.ELEVENTY_ENV === "devbuild") {
//       images.push(img.file.url);
//       break;
//     }

//     if (!fs.existsSync(path)) {
//       fetch(img.file.url)
//         .then(res =>
//           res.body.pipe(fs.createWriteStream(path))
//         )
//     }
//     images.push(imagePath);
//   }

//   return images;
// }

// TODO: filter by updated since last sync
async function fetchBooks() {
  // If we dont have a domain name or token, abort
  if (!DATABASE_ID || !TOKEN) {
    console.warn(">>> unable to fetch notes: missing token or db id");
    return null;
  }

  const p = {
    and: [
      {
        property: "Status",
        select: {
          equals: "read",
        },
      },
      {
        or: [
          {
            property: "Type",
            select: {
              equals: "book",
            },
          },
          {
            property: "Type",
            select: {
              equals: "light novel",
            },
          },
        ],
      },
    ],
  };

  const results = await fetchFromNotion(notion, DATABASE_ID, p);

  if (results) {
    const newBooks = [];
    console.log(`>>> ${results.length} new books fetched`);

    for (const book of results) {
      const newBook = getNotionProps(book, false);

      newBooks.push({
        title: newBook["Title"],
        cover: newBook["Cover"],
        rating: newBook["My Rating"],
        review: newBook["Review"],
        date_read: newBook["Date Read"],
        year_read: newBook["Date Read"] ? newBook["Date Read"].getFullYear() : 0,
      });
    }

    return groupBy(newBooks, "year_read");
  }

  return null;
}

module.exports = async function () {
  // return [];
  console.log(">>> Reading books from cache...");
  const cache = readFromCache(CACHE_FILE_PATH);

  if (cache.length) {
    console.log(`>>> Books loaded from cache`);
  }

  // Only fetch new mentions in production
  if (process.env.ELEVENTY_ENV === "development") return cache;
  // if (process.env.ELEVENTY_ENV !== "devbuild") return cache;

  console.log(">>> Checking for new books...");
  const newBooks = await fetchBooks();
  // console.log(newBooks);
  // TODO: after getting only new items, merge cache and new

  if (newBooks) {
    if (process.env.ELEVENTY_ENV === "devbuild") {
      writeToCache(newBooks, CACHE_FILE_PATH, "books");
    }

    return newBooks;
  }

  return cache;
  // return [];
};
