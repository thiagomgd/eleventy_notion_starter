const { DateTime } = require("luxon");
const CleanCSS = require("clean-css");
const metadata = require("../_data/metadata.json");
const MarkdownIt = require("markdown-it");
const plainText = require("markdown-it-plain-text");

const { getLocalImageLink } = require("../_11ty/helpers");

const md = new MarkdownIt();

function getRelevance(postTags, matchingPost) {
  const commonTopics = matchingPost.data.tags.filter((element) =>
    postTags.includes(element)
  );
  const discount = matchingPost.url.includes("30-days") ? 0.5 : 0;
  return commonTopics.length - discount;
}

function unique(array) {
  return [...new Set(array)];
}

function readableDate(dateObj) {
  if (!dateObj) return;
  return new Date(dateObj).toLocaleDateString("en-us", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

module.exports = {
  cssmin: (code) => {
    return new CleanCSS({}).minify(code).styles;
  },
  generateDiscussionLink: (url) => {
    const postUrl = `${metadata.url}${url}`;
    return `https://twitter.com/search?f=tweets&src=typd&q=${encodeURI(
      postUrl
    )}`;
  },
  generateShareLink: (url, text) => {
    const shareText = `${text}`; // by @FalconSensei`;
    const shareUrl = `${metadata.url}${url}`;
    return `https://twitter.com/intent/tweet/?text=${encodeURI(
      shareText
    )}&url=${encodeURI(shareUrl)}`;
  },
  getSelect: (posts) => posts.filter((post) => post.data.isSelect),
  // Get the first `n` elements of a collection.
  head: (array, n) => {
    if (n < 0) {
      return array.slice(n);
    }

    return array.slice(0, n);
  },
  htmlDateString: (dateObj) => {
    return DateTime.fromJSDate(dateObj, { zone: "utc" }).toFormat("yyyy-LL-dd");
  },
  min: (...numbers) => {
    return Math.min.apply(null, numbers);
  },
  readableDate,
  simpleDate: (dateStr) => {
    if (!dateStr) return dateStr;
    return dateStr.substring(0, 9);
  },
  readableDateFromISO: (dateStr, formatStr = "dd LLL yyyy") => {
    return DateTime.fromISO(dateStr).toFormat(formatStr);
  },
  readableDateTimeFromISO: (dateStr, formatStr = "dd LLL yyyy 'at' hh:mma") => {
    return DateTime.fromISO(dateStr).toFormat(formatStr);
  },
  similarItems: (itemPath, tags, collections) => {
    const topicTags = tags.filter((tag) => !["post", "Popular"].includes(tag));

    let matches = [];
    topicTags.forEach((tag) => {
      matches = [...matches, ...collections[tag]];
    });

    let uniqueMatches = unique(matches).filter(
      (match) => match.url !== itemPath
    ); // remove self
    if (uniqueMatches.length < 3) {
      uniqueMatches = unique([...uniqueMatches, ...collections["Popular"]]);
    }
    const matchesByRelevance = uniqueMatches
      .filter((match) => match.url !== itemPath) // remove self
      .map((match) => {
        return { ...match, relevance: getRelevance(topicTags, match) };
      })
      .sort((a, b) => {
        if (a.relevance > b.relevance) {
          return -1;
        }
        if (a.relevance < b.relevance) {
          return 1;
        }
        return 0;
      });
    const size = 3;
    return matchesByRelevance.slice(0, size);
  },
  getWebmentionsForUrl: (webmentions, url) => {
    return webmentions.children.filter((entry) => entry["wm-target"] === url);
  },
  isOwnWebmention: (webmention) => {
    const urls = [
      metadata.url,
      `https://twitter.com/${metadata.author.twitter_handle}`,
    ];
    const authorUrl = webmention.author ? webmention.author.url : false;
    // check if a given URL is part of this site.
    return authorUrl && urls.includes(authorUrl);
  },
  sortWebmentions: (mentions) => {
    return mentions.sort((a, b) => {
      if (a["published"] < b["published"]) {
        return -1;
      } else if (a["published"] > b["published"]) {
        return 1;
      }
      // a must be equal to b
      return 0;
    });
  },
  webmentionsByType: (mentions, mentionType) => {
    return mentions.filter((entry) => !!entry[mentionType]);
  },
  truncate: (text) =>
    text.length > 300 ? `${text.substring(0, 300)}...` : text,
  twitterExerpt: (text) => {
    const maxLength = 245;
    md.use(plainText);
    md.render(text);
    const content = md.plainText;
    if (content.length <= maxLength) {
      return content;
    }
    return content.substr(0, content.lastIndexOf(" ", maxLength)) + "...";
  },
  size: (mentions) => {
    return !mentions ? 0 : mentions.length;
  },
  getNoteThumbnail: (note) => {
    if (note.images && note.images.length > 0) {
      return note.images[0];
    }
    return null;
  },
  getLocalImgUrl: (url) => {
    return getLocalImageLink(url);
  },
  toArray: (thing) => {
    if (typeof thing === "string") {
      thing.split(",");
    }
    // already an array?
    return thing;
  },
  getTwitterId: (url) => {
    if (!url) return "";
    return url.substring(url.lastIndexOf("/") + 1, url.length);
  },
  getWithTag: (posts, tag) => {
    return posts.filter((post) => post.data.tags.includes(tag));
  },
};
