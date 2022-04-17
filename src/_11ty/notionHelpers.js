const util = require("util");
const luxon = require("luxon");
const { getLocalImageLink } = require("./helpers");
const { generateDiscussionLink } = require("./filters");
const fetch = require("node-fetch");
const cheerio = require("cheerio");
const metadata = require("../_data/metadata.json");
const TWITTER_TOKEN = process.env.TWITTER_API_KEY;

const getLocalImages = async (note, property = "Images", folder) => {
  const imagesNotion = note.properties[property].files;
  const images = [];
  for (const img of imagesNotion) {
    const imageUrl = img.type === "external" ? img.external.url : img.file.url;
    const fileName = `${note.id.substr(0, note.id.indexOf("-"))}-${img.name}`;

    // if (img.file.url.includes("secure.notion-static.com") && !process.env.ELEVENTY_ENV === "devbuild") break;

    // if (!process.env.ELEVENTY_ENV === "devbuild") {
    //   images.push(img.file.url);
    //   break;
    // }
    const imagePath = getLocalImageLink(imageUrl, fileName, folder);

    images.push(imagePath);
  }

  return images;
};

async function updateNotion(notion, itemId, fields) {
  notion.pages.update({
    page_id: itemId,
    properties: fields,
  });
}

// TODO: add delay for another call
async function fetchFromNotion(
  notion,
  dbId,
  filter = undefined,
  cursor = undefined
) {
  const payload = {
    database_id: dbId,
    start_cursor: cursor,
    filter: filter,
  };

  // it enters here with {}, but for some reason, removing this gives me an error
  // if (filter) {
  //   payload['filter'] = filter;
  // }

  const response = await notion.databases.query(payload);

  if (response.results) {
    if (response.next_cursor) {
      return response.results.concat(
        await fetchFromNotion(notion, dbId, filter, response.next_cursor)
      );
    }

    return response.results;
  }
  return [];
}

function _title(prop) {
  // console.log(prop);
  return prop["title"][0]["plain_text"];
}

function _rich_text(prop) {
  if (prop["rich_text"] && prop["rich_text"].length > 0) {
    return prop["rich_text"][0]["plain_text"];
  }
  return "";
}

function _number(prop) {
  return prop["number"];
}

function _url(prop) {
  return prop["url"];
}

function _checkbox(prop) {
  return prop["checkbox"];
}

function _date(prop) {
  const dt = prop["date"];
  if (!dt || !dt.start) return undefined;

  // TODO: read end date?
  return new Date(dt.start);

  // if (!dt) return null;

  // const text = dt["start"];

  // if text == None or text == '':
  //     return None

  // date = datetime.strptime(text[:10], "%Y-%m-%d")
  // return date
}

function _files(prop) {
  files = prop["files"];

  if (files.length == 0) return [];

  const images = [];
  for (const img of files) {
    const imageUrl = img.type === "external" ? img.external.url : img.file.url;
    // const imagePath = getLocalImageLink(imageUrl, fileName, folder)

    images.push(imageUrl);
  }

  return images;
}

function _select(prop) {
  const val = prop["select"];
  if (!val) return "";

  return val["name"];
}

function _multi_select(prop) {
  if (!prop["multi_select"]) return [];

  return prop["multi_select"].map((item) => item["name"]);
}

function _relation(prop) {
  if (!prop["relation"]) return [];

  return prop["relation"].map((item) => item["id"]);
}

function _created_time(prop) {
  return prop["created_time"];
}

const NOTION_TO_DICT = {
  number: _number,
  date: _date,
  files: _files,
  select: _select,
  title: _title,
  rich_text: _rich_text,
  multi_select: _multi_select,
  url: _url,
  checkbox: _checkbox,
  relation: _relation,
  created_time: _created_time,
};

function getNotionProps(thing, normalize = true) {
  const parsed = {};

  for (const key of Object.keys(thing.properties)) {
    const prop = thing.properties[key];

    if (prop && NOTION_TO_DICT[prop.type]) {
      parsed[normalize ? key.replace(" ", "_").toLowerCase() : key] =
        NOTION_TO_DICT[prop.type](prop);
    }
  }
  return parsed;
}

function getUrl(post, type, useDomain=false) {
  if (type === "note") {
    return `${useDomain ? metadata.domain : metadata.url}/note/${post.id}/`;
  }

  return `${useDomain ? metadata.domain : metadata.url}/post/${post.slug}/`;
}

async function searchReddit(url) {
  const searchUrl = `https://www.reddit.com/r/${metadata.subreddit}/search.json?q=${url}&restrict_sr=on&include_over_18=on&sort=relevance&t=all`;
  const response = await fetch(searchUrl);
  if (!response.ok) {
    console.error("### not able to load from reddit");
    return "";
  }
  const responseJson = await response.json();

  if (!responseJson || !Array.isArray(responseJson)) return "";
  for (const list of responseJson) {
    for (const post of list.data.children) {
      // console.log('!@#!@#',post);
      if (post && post.data && post.data.url && post.data.url) {
        return `https://www.reddit.com${post.data.permalink}`;
      }
    }
  }
  return "";
}

async function updateReddit(notion, posts, type) {
  if (!metadata.subreddit || process.env.ELEVENTY_ENV === "development") return;

  const toUpdate = Object.values(posts).filter((post) => !post.reddit);
  // console.log('TO UPDATE REDDIT!');
  // console.log(toUpdate);
  // console.log(posts);
  if (toUpdate.length === 0) return;

  // console.log('>>>>>>> U')
  const response = await fetch(
    `https://www.reddit.com/r/${metadata.subreddit}.json`
  );
  if (!response.ok) {
    console.error("### not able to load from reddit");
  }
  const responseJson = await response.json();
  const redditPostsArray = responseJson.data.children
    .filter((post) => post.data.domain === metadata.domain)
    .map((post) => ({
      [post.data.url]: `https://www.reddit.com${post.data.permalink}`,
    }));

  const redditPosts = Object.assign({}, ...redditPostsArray);

  toUpdate.forEach(async (post) => {
    const postUrl = getUrl(post, type);

    let redditUrl;

    if (!postUrl in redditPosts) {
      redditUrl = redditPosts[postUrl];
    } else {
      // redditUrl = await searchReddit(postUrl);
      redditUrl = await searchReddit(postUrl);

      if (!redditUrl) return;
    }

    // TODO: don't mutate original object, create copy
    posts[post.id].reddit = redditUrl;

    updateNotion(notion, post.id, { Reddit: redditUrl });
  });

  // return posts;
}

function randomString(length) {
  var text = "";
  var possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

function lessThanSevenDays(postDate) {
  if (!postDate) return false;

  const today = luxon.DateTime.now();
  const date2 = luxon.DateTime.fromJSDate(postDate);
  const diffDays = today.diff(date2, "days").toObject().days;
  // console.log(
  //   "date diff",
  //   today.toLocaleString(),
  //   date2.toLocaleString(),
  //   postDate,
  //   diffDays
  // );
  return diffDays <= 7;
}

async function updateTweet(notion, posts, type) {
  if (!TWITTER_TOKEN || process.env.ELEVENTY_ENV === "development") return;
  const toUpdate = Object.values(posts).filter((post) => {
    return !post.tweet && lessThanSevenDays(post.date_published || new Date(post.created_time));
  });

  // if (type === 'note') {
  //   console.log('TO UPDATE', toUpdate);
  // }

  if (toUpdate.length === 0) return;

  toUpdate.forEach(async (post) => {
    const link = getUrl(post, type, true);
    const resp = await fetch(`https://api.twitter.com/2/tweets/search/recent?query=${link}`,{
      headers: {
        "authorization": `Bearer ${TWITTER_TOKEN}`
    }
    });

    if (!resp.ok) return;

    const responseJson = await resp.json();

    if (responseJson.data && responseJson.data.length > 0) {
      const tweet = `https://twitter.com/${metadata.author.twitter_handle}/status/${responseJson.data[0].id}`;
      console.log(tweet);
      // TODO: don't mutate original object, create copy
      posts[post.id].tweet = tweet;

      updateNotion(notion, post.id, { Tweet: tweet });
    }
  });
}

module.exports = {
  fetchFromNotion,
  getNotionProps,
  getLocalImages,
  updateTweet,
  updateReddit,
};
