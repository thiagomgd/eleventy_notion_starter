const groupBy = require("lodash/groupBy");
const fs = require("fs");
const domain = require("./metadata.json").domain;
const {readFromCache, writeToCache} = require("../_11ty/helpers");
const {fetchFromNotion, getNotionProps} = require("../_11ty/notionHelpers");

const {Client} = require("@notionhq/client");
const metadata = require("./metadata.json");
// // https://github.com/souvikinator/notion-to-md
// const { NotionToMarkdown } = require("notion-to-md");

// // Define Cache Location and API Endpoint
const CACHE_FILE_PATH = "src/_cache/books.json";
const TOKEN = process.env.NOTION_API_KEY;
// const imageFolder = "/img/books/"

const notion = new Client({auth: TOKEN});

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
async function fetchBooks(since) {
    // If we dont have a domain name or token, abort
    if (!metadata["notion_books"] || !TOKEN) {
        console.warn(">>> unable to fetch notes: missing token or db id");
        return null;
    }

    const p = {
        and: [
            {property: "Edited", date: {after: since}},
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

    const results = await fetchFromNotion(notion, metadata["notion_books"], p);

    if (results) {
        const newBooks = {};
        console.log(`>>> ${results.length} new books fetched`);

        for (const book of results) {
            const newBook = getNotionProps(book, false);

            newBooks[book.id] = {
                title: newBook["Title"],
                cover: newBook["Cover"],
                rating: newBook["My Rating"],
                review: newBook["Review"],
                date_read: newBook["Date Read"],
                year_read: newBook["Date Read"] ? newBook["Date Read"].year : 0,
            };
        }

        return newBooks;
    }

    return null;
}

function sortBooks(books) {
    const sorted = {}
    const groupedBooks = groupBy(books, "year_read")

    for (year in groupedBooks) {
        const yearBooks = groupedBooks[year];
        yearBooks.sort((a, b) => {
            // books[year].sort((a, b)=>{
            if (a.rating !== b.rating) {
                return b.rating - a.rating;
            }

            if (a.date_read && b.date_read) {
                return new Date(b.date_read) - new Date(a.date_read);
            }

            return 0; // todo
        })
        sorted[year] = yearBooks;
    }

    return sorted;
}

module.exports = async function () {
    // return [];
    console.log(">>> Reading books from cache...");
    const cache = readFromCache(CACHE_FILE_PATH);

    if (Object.keys(cache.data).length) {
        console.log(`>>> Books loaded from cache`);
    }

    // Only fetch new mentions in production
    if (process.env.ELEVENTY_ENV === "development") return sortBooks(cache.data);

    console.log(">>> Checking for new books...");
    const newBooks = await fetchBooks(cache.lastFetched);

    if (!newBooks) {
        return sortBooks(cache.data);
    }

    const newData = {...cache.data, ...newBooks}

    const newCache = {
        lastFetched: new Date().toISOString(),
        data: newData,
    };

    if (process.env.ELEVENTY_ENV === "devbuild") {
        writeToCache(newCache, CACHE_FILE_PATH, "books");
    }

    return sortBooks(newData);
};
