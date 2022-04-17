const markdownIt = require("markdown-it");
const EleventyFetch = require("@11ty/eleventy-fetch");
const outdent = require("outdent")({ newline: " " });

const { getLocalImageLink } = require("../_11ty/helpers");
const { youtube, youtube_parser, reddit } = require("./shortcodes");
const {
  defaultTweet,
  cachedTweet,
  twitterDefaults,
  extractTweetInfo,
} = require("./tweetEmbed");

const EMPTY = ``;

const Image = require("@11ty/eleventy-img");

function isVertical(width, height) {
  // square and slightly wide counts as vertical for style purposes
  return width / height <= 1.25;
}

function getMetadata(metadata) {
  let outputs;
  if ("webp" in metadata) {
    outputs = metadata["webp"];
  } else if ("gif" in metadata) {
    outputs = metadata["gif"];
  } else if ("png" in metadata) {
    outputs = metadata["png"];
  } else {
    outputs = metadata["jpeg"];
  }
  return outputs[outputs.length - 1];
}

async function imageShortcode(src, alt, options = {}) {
  if (alt === undefined) {
    // You bet we throw an error on missing alt (alt="" works okay)
    throw new Error(`Missing \`alt\` on myImage from: ${src}`);
  }

  const fileSource = src.startsWith("/img") ? `./src${src}` : src;

  const extraProps = src.includes(".gif")
    ? {
        formats: ["webp", "gif"],
        sharpOptions: {
          animated: true,
        },
      }
    : {};

  let metadata = await Image(fileSource, {
    widths: [1200],
    outputDir: "_site/img",
    cacheOptions: {
      duration: "8w",
    },
    ...extraProps,
  });

  const data = getMetadata(metadata);
  const bridgyClass = options.shareBridgy ? "u-photo" : "";
  const isVerticalClassname =
    !options["novertical"] && isVertical(data.width, data.height)
      ? "vertical"
      : "";
  let className = "";
  if (bridgyClass || isVerticalClassname) {
    className = `class="${bridgyClass} ${isVerticalClassname}"`;
  }

  return `<img src="${data.url}" width="${data.width}" height="${data.height}" alt="${alt}" ${className} loading="lazy" decoding="async">`;
}

function uuidv4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function figure(image, caption = "", className = "", alt = "") {
  const localSrc = getLocalImageLink(image);

  const mdCaption = caption ? markdownIt().renderInline(caption) : EMPTY;
  const classMarkup =
    className && className !== "u-photo" ? ` class="${className}"` : "";
  const captionMarkup = caption ? `<figcaption>${mdCaption}</figcaption>` : "";
  const imgOptions =
    className && className === "u-photo" ? { shareBridgy: true } : {};
  const imgTag = await imageShortcode(localSrc, alt, imgOptions);
  return `<figure${classMarkup}>${imgTag}${captionMarkup}</figure>`;
}

async function blur(src, caption, className = "", alt = "") {
  const uuid = uuidv4();

  const figureTag = await figure(src, caption, className, alt);
  return `<div class="blurDiv blurred" id="${uuid}" onclick="document.getElementById('${uuid}').className = 'blurDiv';" >${figureTag}</div>`;
}

async function card(title, imgParam, rating, review_link, goodreads) {
  let img = imgParam;
  if (typeof imgParam !== "string") {
    img = imgParam.length > 0 ? imgParam[0] : "";
  }

  const localImg = getLocalImageLink(img);

  const badge = rating ? `<div class="card-badge">${rating}</div>` : EMPTY;
  const imgTagInner = localImg
    ? await imageShortcode(localImg, "", { novertical: true })
    : EMPTY;
  const imgTag = imgTagInner
    ? `<div class="card-image-div">${imgTagInner}</div>`
    : EMPTY;
  const reviewTag = review_link
    ? `<p><a href="${review_link}">Review</a></p>`
    : EMPTY;
  // todo: extract domain and use as link text
  const goodreadsTag = goodreads
    ? `<p><a href="${goodreads}" target="_blank" rel="noopener noreferrer">Goodreads</a></p>`
    : EMPTY;

  return `<div class="card">
${badge}  
${imgTag}
<div class="card-content">
<p class="card-title">${title}</p>
${reviewTag} 
${goodreadsTag}
</div>
</div>`;
}

const template = ({
  image,
  title,
  url,
  publisher,
  description,
  logo,
  author,
  date,
}) => {
  const imageEl = image
    ? `<img
class="unfurl__image"
src="${image.url}"
width="${image.width}"
height="${image.height}"
alt=""
/>`
    : "";

  const titleEl = `<h4 class="unfurl__heading"><a class="unfurl__link" href="${url}">${title}</a></h4>`;

  const descriptionEl = `<p class="unfurl__description">${description}</p>`;
  const logoEl = logo
    ? outdent`<img
class="unfurl__logo"
src="${logo.url}"
width="${logo.width}"
height="${logo.height}"
alt=""
/>`
    : "";
  // const dateEl = `
  //     <time class="unfurl__date" datetime="${date}">
  //       Posted ${formatDate(date)}
  //     </time>
  //   `;
  const publisherEl = `<span class="unfurl__publisher">${publisher}</span>`;

  return `<div class="unfurl">
${titleEl}
${image ? imageEl : ""}
${description ? descriptionEl : ""}
<small class="unfurl__meta">
${logo ? logoEl : ""}
${publisher ? publisherEl : ""}
</small>
</div>`;
};

// https://github.com/daviddarnes/eleventy-plugin-unfurl
const unfurl = async (url) => {
  const metadata = await EleventyFetch(`https://api.microlink.io/?url=${url}`, {
    duration: "8w",
    type: "json",
  });

  return template(metadata.data);
};

async function tweet(tweetUrl, options = {}, index = 0) {
  const mergedOptions = {
    ...twitterDefaults,
    ...options,
  };
  const tweet = extractTweetInfo(tweetUrl);
  let output;
  if (mergedOptions.cacheText) {
    // cached oembed version
    output = await cachedTweet(tweet, mergedOptions, index);
  } else {
    // default version
    output = defaultTweet(tweet, mergedOptions, index);
  }
  return output;
}

async function anyEmbed(url) {
  if (!url) return ``;

  if (
    url.startsWith("https://www.youtube.com/") ||
    url.startsWith("https://youtu.be/")
  ) {
    const id = youtube_parser(url);
    return youtube(id);
  }

  if (url.startsWith("https://www.reddit.com/")) return reddit(url);

  if (url.startsWith("https://twitter.com/")) return tweet(url);

  return await unfurl(url);
}

module.exports = {
  figure,
  blur,
  card,
  tweet,
  anyEmbed,
  unfurl,
};
