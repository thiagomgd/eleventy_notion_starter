const fs = require("fs");
const pluginRss = require("@11ty/eleventy-plugin-rss");
// const pluginSyntaxHighlight = require("@11ty/eleventy-plugin-syntaxhighlight");
const pluginNavigation = require("@11ty/eleventy-navigation");
const pluginTOC = require('eleventy-plugin-toc')
const markdownIt = require("markdown-it");
const markdownItAnchor = require("markdown-it-anchor");
const markdownItFootnote = require("markdown-it-footnote");
const filters = require('./src/_11ty/filters');
const helpers = require('./src/_11ty/helpers');
const shortcodes = require('./src/_11ty/shortcodes');
const pairedShortcodes = require('./src/_11ty/pairedShortcodes');
const asyncShortcodes = require('./src/_11ty/asyncShortcodes');
const {anyEmbed, figure, blur, tweet} = require('./src/_11ty/asyncShortcodes');
const cheerio = require("cheerio");

function hasBodyTag(content) {
  const hasBody = /<\s*body(\w|\s|=|"|-)*>/gm;
  return hasBody.test(content);
}

async function replaceSpecialLinks(content, options) {
  const $ = cheerio.load(content);
  // TODO: only block links
  const replace = ['bookmark', 'embed','textTweet'];
  let links = $("a").filter((i, el) => {
    const text = $(el).text();
    return replace.includes(text);
  });

  const promises = [];
  for (let i = 0; i < links.length; i++) {
    const link = links[i];
    const url = $(link).attr('href');
    const text = $(link).text();

    if (text === 'textTweet') {
      promises[i] = tweet(url, {twitterScriptEnabled: false});  
    } else {
      promises[i] = anyEmbed(url);
    }
  }

  const embeds = await Promise.all(promises);

  embeds.forEach((embed, i) => {
    $(links[i]).replaceWith(embed);
  });

  return hasBodyTag(content) ? $.html() : $("body").html();
}

async function imgToFigure(content, options) {
  const $ = cheerio.load(content);
  // TODO: only block links
  // TODO: images from notion are surrounded by empty paragraphs. Eliminate them
  let images = $("p img")
    .not("picture img"); // Ignore images wrapped in <picture>
    // .not("[data-img2picture-ignore]") // Ignore excluded images

    const promises = [];
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      const attrs = $(img).attr();

      const caption = attrs.alt.startsWith('(blur)') ? attrs.alt.replace('(blur)','').trim() : attrs.alt;

      if (attrs.alt.startsWith('(blur)')) {
        promises[i] = blur(attrs.src, caption, "", "");
      } else {
        promises[i] = figure(attrs.src, caption, "", "");   
      }
    }
  
    const pictures = await Promise.all(promises);
  
    pictures.forEach((picture, i) => {
      $(images[i]).replaceWith(picture);
    });

  return hasBodyTag(content) ? $.html() : $("body").html();
}

module.exports = function(eleventyConfig) {
  // Add plugins
  eleventyConfig.addPlugin(pluginRss);
  // eleventyConfig.addPlugin(pluginSyntaxHighlight);
  eleventyConfig.addPlugin(pluginNavigation);
  eleventyConfig.addPlugin(pluginTOC, {
    flat: false,
    ul: true,
    wrapper: 'nav'
  })

  // Add filters
  Object.keys(filters).forEach(filterName => {
    eleventyConfig.addFilter(filterName, filters[filterName])
  })

  eleventyConfig.addNunjucksAsyncFilter('getOptimizedImageUrl', async function(value, callback) {
    const url = await helpers.optimizeImage(value);
    callback(null, url);
   });

  // Add shortcodes
  Object.keys(shortcodes).forEach(codeName => {
    eleventyConfig.addShortcode(codeName, shortcodes[codeName])
  })

  // Add shortcodes
  Object.keys(pairedShortcodes).forEach(codeName => {
    eleventyConfig.addPairedShortcode(codeName, pairedShortcodes[codeName])
  })

  // Add shortcodes
  Object.keys(asyncShortcodes).forEach(codeName => {
    eleventyConfig.addNunjucksAsyncShortcode(codeName, asyncShortcodes[codeName])
  })

  // This function is reused in this config, so declaring the filter here instead:
  function filterTagList(tags) {
    return (tags || []).filter(tag => ["all", "nav", "post", "posts", 'note'].indexOf(tag) === -1);
  }
  eleventyConfig.addFilter("filterTagList", filterTagList)

  // https://www.11ty.dev/docs/data-deep-merge/
  eleventyConfig.setDataDeepMerge(true);

  // Alias `layout: post` to `layout: layouts/post.njk`
  eleventyConfig.addLayoutAlias("post", "layouts/post.njk");

  // https://11ta.netlify.app/2020/09/20/v110-brings-draft-posts/
  /**
	 * Collections
	 * ============================
	 *
	 * POST Collection set so we can check status of "draft:" frontmatter.
	 * If set "true" then post will NOT be processed in PRODUCTION env.
	 * If "false" or NULL it will be published in PRODUCTION.
	 * Every Post will ALWAYS be published in DEVELOPMENT so you can preview locally.
	 */
  // eleventyConfig.addCollection('posts', collection => {
  //   return collection.getSortedByDate()
  //     .filter(livePosts);
  // });
  eleventyConfig.addCollection('posts', collection => {
    return collection.getFilteredByTag('post')
      // .filter(post => post.data.eleventyExcludeFromCollections !== true)
      .sort(function(a, b) {
        const timeA = a.data.created_date ? a.data.created_date.getTime() : 0;
        const timeB = b.data.created_date ? b.data.created_date.getTime() : 0;
        // console.log(a.data.title, b.data.title, timeA, timeB);
        return timeA - timeB;
      });
  });

  eleventyConfig.addCollection('allthings', collection => {
    const posts = collection.getFilteredByTag('post');
    const notes = collection.getFilteredByTag('note');
    const all = [...posts, ...notes];

    return all.sort(function (a, b) {
      const timeA = a.data.created_date
        ? a.data.created_date.getTime()
        : 0;

      const timeB = b.data.created_date
        ? b.data.created_date.getTime()
        : 0;

      // if (
      //   a.data.title === "" ||
      //   b.data.title === ""
      // ) {
      //   console.log(a.data.title, b.data.title, timeA, timeB, a.data.created_date, b.data.created_date);
      // }

      return timeA - timeB;
    });
  });

  // Create an array of all tags
  eleventyConfig.addCollection("tagList", function(collection) {
    let tagSet = new Set();
    collection.getAll().forEach(item => {
      (item.data.tags || []).forEach(tag => tagSet.add(tag));
    });

    return filterTagList([...tagSet]);
  });

  // https://shivjm.blog/colophon/how-i-create-an-article-series-in-eleventy/
  eleventyConfig.addCollection("series", (collection) => {
    // get all posts in chronological order
    const posts = collection.getSortedByDate();
  
    // this will store the mapping from series to lists of posts; it can be a
    // regular object if you prefer
    const mapping = new Map();
  
    // loop over the posts
    for (const post of posts) {
      // get any series data for the current post, and store the date for later
      const { series, seriesDescription, date } = post.data;
  
      // ignore anything with no series data
      if (series === undefined) {
        continue;
      }
  
      // if we haven’t seen this series before, create a new entry in the mapping
      // (i.e. take the description from the first post we encounter)
      if (!mapping.has(series)) {
        mapping.set(series, {
          posts: [],
          description: seriesDescription,
          date,
        });
      }
  
      // get the entry for this series
      const existing = mapping.get(series);
  
      // add the current post to the list
      existing.posts.push(post.url);
  
      // update the date so we always have the date from the latest post
      existing.date = date;
    }
  
    // now to collect series containing more than one post as an array that
    // Eleventy can paginate
    const normalized = [];
  
    // loop over the mapping (`k` is the series title)
    for (const [k, { posts, description, date }] of mapping.entries()) {
      // if (posts.length > 1) {
        // add any series with multiple posts to the new array
        normalized.push({ title: k, posts, description, date });
      // }
    }
  
    // return the array
    return normalized;
  });

  eleventyConfig.addTransform('replace-special-links', async function(content){
    if (this.outputPath && this.outputPath.endsWith(".html")) {
      return await replaceSpecialLinks(content, {});
    }

    return content;
  });

  eleventyConfig.addTransform('img2figure', async function(content){
    if (this.outputPath && this.outputPath.endsWith(".html")) {
      return await imgToFigure(content, {});
    }

    return content;
  });

  // Copy the `img` and `css` folders to the output
  eleventyConfig.addPassthroughCopy("src/img");

  // Customize Markdown library and settings:
  const markdownLibrary = markdownIt({
    html: true,
    breaks: true,
    linkify: true
  }).use(markdownItAnchor, {
    permalink: markdownItAnchor.permalink.ariaHidden({
      placement: "after",
      class: "direct-link",
      symbol: "#",
      level: [1,2,3,4],
    }),
    slugify: eleventyConfig.getFilter("slugify")
  }).use(markdownItFootnote);

  eleventyConfig.setLibrary("md", markdownLibrary);

  // Override Browsersync defaults (used only with --serve)
  eleventyConfig.setBrowserSyncConfig({
    callbacks: {
      ready: function(err, browserSync) {
        const content_404 = fs.readFileSync('_site/404.html');

        browserSync.addMiddleware("*", (req, res) => {
          // Provides the 404 content without redirect.
          res.writeHead(404, {"Content-Type": "text/html; charset=UTF-8"});
          res.write(content_404);
          res.end();
        });
      },
    },
    ui: false,
    ghostMode: false
  });

  return {
    // Control which files Eleventy will process
    // e.g.: *.md, *.njk, *.html, *.liquid
    templateFormats: [
      "js",
      "md",
      "njk",
      "html",
      "liquid"
    ],

    // -----------------------------------------------------------------
    // If your site deploys to a subdirectory, change `pathPrefix`.
    // Don’t worry about leading and trailing slashes, we normalize these.

    // If you don’t have a subdirectory, use "" or "/" (they do the same thing)
    // This is only used for link URLs (it does not affect your file structure)
    // Best paired with the `url` filter: https://www.11ty.dev/docs/filters/url/

    // You can also pass this in on the command line using `--pathprefix`

    // Optional (default is shown)
    pathPrefix: "/",
    // -----------------------------------------------------------------

    // Pre-process *.md files with: (default: `liquid`)
    markdownTemplateEngine: "njk",

    // Pre-process *.html files with: (default: `liquid`)
    htmlTemplateEngine: "njk",

    // Opt-out of pre-processing global data JSON files: (default: `liquid`)
    dataTemplateEngine: false,

    // These are all optional (defaults are shown):
    dir: {
      input: "src",
      includes: "_includes",
      data: "_data",
      output: "_site"
    }
  };
};
