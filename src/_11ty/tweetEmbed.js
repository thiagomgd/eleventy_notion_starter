const EleventyFetch = require("@11ty/eleventy-fetch");
const { kebabCase } = require("lodash");

function extractTweetInfo(str) {
    const tweetUrl = str.indexOf('?') > 0 ? str.substring(0, str.indexOf('?')) : str;
    const match = tweetUrl.split('/');
    
    // TODO: throw error when can't find userHandle and tweetId
	return {
		userHandle: match[3],
		tweetId: match[5],
	};
};

const twitterDefaults = {
	align: undefined,
	embedClass: "eleventy-plugin-embed-twitter",
	cacheText: true,
	cacheDuration: "5y",
	cards: undefined,
	conversation: undefined,
	doNotTrack: false,
	lang: undefined,
	oEmbedUrl: "https://publish.twitter.com/oembed",
	theme: undefined,
	width: undefined,
  twitterScriptAsync: true,
  twitterScriptCharset: "utf-8",
  twitterScriptDefer: false,
  twitterScriptEnabled: true,
  twitterScriptSrc: "https://platform.twitter.com/widgets.js",
	
};

/**
 * Transform Twitter options object into an array of objects.
 * This is useful because each individual setting can later be
 * parsed in multiple ways, depending on required output.
 *
 * @param {Object} o — an object containing Twitter embed options
 * @returns {Array} — array of objects for each specific Twitter embed setting
 * @see https://developer.twitter.com/en/docs/twitter-for-websites/embedded-tweets/guides/embedded-tweet-parameter-reference
 * @see https://developer.twitter.com/en/docs/twitter-api/v1/tweets/post-and-engage/api-reference/get-statuses-oembed
 */
function parseOptions(o) {
  let out = [];

  if (o.theme === "dark") {
    out.push({ attr: "theme", value: "dark" });
  }

  if (o.doNotTrack) {
    out.push({ attr: "dnt", value: "true" });
  }

  // Only set this option if it's one of the three valid values: 'left', 'center', or 'right'
  if (o.align && ["left", "center", "right"].includes(o.align)) {
    out.push({ attr: "align", value: o.align });
  }

  if (o.cards === "hidden") {
    out.push({
      attr: "cards",
      oEmbedAttr: "hide_media",
      value: "hidden",
      oEmbedValue: "true",
    });
  }

  if (o.conversation === "none") {
    out.push({
      attr: "conversation",
      oEmbedAttr: "hide_thread",
      value: "none",
      oEmbedValue: "true",
    });
  }

  if (o.lang) {
    out.push({ attr: "lang", value: o.lang });
  }

  if (o.width && typeof o.width === "number") {
    out.push({ attr: "width", oEmbedAttr: "maxwidth", value: o.width });
  }

  // These last two are only used in the oEmbed context (`oEmbedOnly = true`)
  if (o.omit_script) {
    out.push({ attr: "omit_script", value: "true", oEmbedOnly: true });
  }

  if (o.tweetUrl) {
    out.push({ attr: "url", value: o.tweetUrl, oEmbedOnly: true });
  }

  return out;
}

/**
 * From the available Twitter options, return a string of custom HTML data attributes.
 * @param {Array} arr — Array of Twitter embed options
 * @returns {String}
 */
function buildCustomDataStr(arr) {
  let out = "";
  arr.forEach((el) => {
    if (!el.oEmbedOnly) {
      out += ` data-${el.attr}="${el.value}"`;
    }
  });
  return `${out.trim()}`;
}

/**
 * From the availble Twitter options, return a URL param string.
 * @param {Array} arr — Array of Twitter embed options
 * @returns
 */
function buildUrlParamString(arr) {
  // Node URL class requires a valid URL to operate. BUT only the `search` string is actually returned.
  const oEmbedUrl = new URL("https://publish.twitter.com/oembed");

  arr.forEach((el) => {
    let attr = el.oEmbedAttr ? el.oEmbedAttr : el.attr;
    let val = el.oEmbedValue ? el.oEmbedValue : el.value;
    oEmbedUrl.searchParams.set(attr, val);
  });
  return oEmbedUrl.search;
}

function buildOptions(obj, format = "html") {
	let opts = parseOptions(obj);
	return format === "url" ? buildUrlParamString(opts) : buildCustomDataStr(opts);
};

/**
 * Default embed, which does NOT make a network oEmbed call to save the Tweet text as static HTML.
 * @param {Object} tweet
 * @param {Object} options
 * @param {Number} index
 */
function defaultTweet(tweet, options, index) {
  let embedAttrs = buildOptions(options);
  const isScriptEnabled = index === 0 && options.twitterScriptEnabled;

  let out = `<div class="${options.embedClass}">`;
  out += `<blockquote id="tweet-${tweet.tweetId}" class="twitter-tweet"${
    embedAttrs ? ` ${embedAttrs}` : ""
  }>`;
  out += `<a href="https://twitter.com/${tweet.userHandle}/status/${tweet.tweetId}"></a>`;
  out += "</blockquote>";
  out += "</div>";

  let twitterScript = `<script src="${options.twitterScriptSrc}"`;
  twitterScript += ` charset="${options.twitterScriptCharset}"`;
  twitterScript += options.twitterScriptAsync ? " async" : "";
  twitterScript += options.twitterScriptDefer ? " defer" : "";
  twitterScript += ">";
  twitterScript += "</script>";

  if (isScriptEnabled) {
    out += twitterScript;
  }

  return out;
}
/**
 * Optional embed, which requires a network call to save the Tweet text as static HTML
 * @param {Object} tweet
 * @param {Object} options
 * @param {Number} index
 */
async function cachedTweet(tweet, options, index) {
  const oEmbedUrl = new URL(options.oEmbedUrl);
  const tweetUrl = `https://twitter.com/${tweet.userHandle}/status/${tweet.tweetId}`;
  const isScriptEnabled = index === 0 && options.twitterScriptEnabled;

  let optionsAmendedForOembed = {
      ...options, 
      tweetUrl: tweetUrl,
      omit_script: !isScriptEnabled,
  };

  let oEmbedParamString = buildOptions(optionsAmendedForOembed, "url");

  let oEmbedRequestUrl = oEmbedUrl + oEmbedParamString;

  try {
    const json = await EleventyFetch(oEmbedRequestUrl, {
      duration: options.cacheDuration,
      type: "json",
    });

    let out = `<div class="${options.embedClass}">`;
    out += json.html;
    out += "</div>";
    return out;
  } catch (err) {
    console.error("Error communicating with Twitter\u2019s servers: ", err);
    return tweetUrl;
  }
}

module.exports = {
    extractTweetInfo,
    twitterDefaults,
  defaultTweet,
  cachedTweet,
};
