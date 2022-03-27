# eleventy_notion_starter

11ty starter: uses md and notion as data sources. Based on https://github.com/siakaramalegos/11ty-sia-blog.

Used to power http://geekosaur.com.

## General Info / Getting Started

This uses md files + notion as CMS. Besides blog posts, it also uses notion for "notes" and "books". __Note that the default field for DBs on notion is Name, and I renamed it to Title in all DBs, since I think it makes more sense__. For all databases, you need to share them with the API user that is created when you get API access.

__Images__: Any pictures will be optimized. External images (like IMGUR) are going to be downloaded and versioned if you run `build:local`. Notion images not. Reason: every time you fetch the page, Notion will provide a new link, that is only live for 1 hour, and I don't wanna mess with that now and risk versioning duplicates. Since they are on Notion, I consider them saved. IMGUR is download to avoid the risk of it being deleted.

Also, if you use `(blur) some text` as the image caption, it will use the `blur` shortcode instead of the regular `figure` shortcode.

__Links/Embeds/Shortcodes__: Addind a link as `bookmark` or `embed` is going to use the `anyEmbed` shortcode. That will use the appropriate embed for `youtube`, `twitter`, etc, and the `unfurl` shortcode if there's nothing specific for that domain.

### Regular posts

For regular posts, create a database like this

![](https://i.imgur.com/cFzcRKg.png)

Description: used for twitter card/social sharing.

Lead: post lead, appears under the title.

Published + Date published: post is published if published is `true` and current date is > `date published` - so you can schedule posts.

Thumbnail: used for twitter card/social sharing.

Tweet/Reddit: If 'tweet' url (full url) is present, it changes the footer of the post, with a link to it. You can update your footer to also include Reddit (this is a TODO on the post template for me)

Notes: notes for you. Not used on the actual blog.

### Notes

Notes I use for short posts, and they are rendered in it's entirety on the "Notes" page. They are automatically published - no draft status or future date. The url is Notion's page ID. See it live here: https://geekosaur.com/notes/. The reason: this is similar to a Tweet, but that I don't want to lose, and also want the ability to tag, so I can find it later on. Not supposed to be a long post, just a quick share.

Create a database like that:

![](https://i.imgur.com/qEVQuSP.png)

Created and Edited are fields controlled by Notion - you just need to add them from the list.

Embed: used for the `anyEmbed` shortcode;

Images: will post the images, and use the first as thumbnail - TODO is to actually generate a gallery with the images.

Format: not used yet. Defaults to `text`. Idea would be so have filters, and icons to identify the type of post (text/video/gallery), like Tumblr.

Tags/Tweet/Reddit: same as for posts.

### Books

Books is a page with all books read, separated by year. See it live here: https://geekosaur.com/books-per-year/ 

For me, I export data from Goodreads, and then have a script to update my Notion Database. I do that for 2 reasons: being able to export to the blog; being able to have my own notes and extra data, and reorganize how I see fit.

Fields you need: Title, Status (should be `read` for finished books), Type (should be `book`), Date Read, My Rating, Link, Review. Link is the Goodreads URL, and Review is a link to your own review. Type I use because I also track manga and comics, and I don't want them to show on the same page.

## Files

- _11ty: contains filters and shortcodes;
- _cache: cached images (external images), posts, webmentions and books. For now, I've disabled cache for posts and notes because of the 'image' thing mentioned above. Other than that, `npm start` always uses the cached version, `npm run build:local` will update them, `npm run build` (prod build) will get new info but not update cache files
- _data: files for the external data. Go there to add your Notion Database IDs, and make any changes you'd like. Also your webmention token from Webmention.io
    - To use webmentions for twitter/reddit/mastodon, go to webmention.io and https://brid.gy/
    - Also update metadata.json with your info
    - __Note__: There's a method used by notion_posts and notes to search Reddit and update Notion with the URL. They are automatically published by IFTTT. I need to make it work for Twitter too, but need some time to get to it. (Feel free to open a PR if you wanna add Twitter API support for getting the tweet url)
- _includes: layouts, etc

## Other Notes

- There are things I'm still slowly improving, but feel free to open an issue to discuss improvements or a PR to fix any issues you find :). I'll update this starter occasionally as I make changes on my own blog.

## Learning Resources

Still new to Eleventy? Try out these learning resources:

- Start from scratch to learn the key features of Eleventy with the [Itsiest, Bitsiest Eleventy Tutorial](https://sia.codes/posts/itsiest-bitsiest-eleventy-tutorial/)
- Understand the fundamentals of templating with [Templating: Eleventy's Superpower](https://www.youtube.com/watch?v=rZyNBd1WgVM) from  Mike Aparicio

Also, get familiar with the 11ty docs!

Once you understand the fundamentals a bit more, dive into data with [Architecting data in Eleventy](https://sia.codes/posts/architecting-data-in-eleventy/). Then you can start building some more complex features like:

- [Optimize Images in Eleventy Using Cloudinary](https://sia.codes/posts/eleventy-and-cloudinary-images/)
- [An In-Depth Tutorial of Webmentions + Eleventy](https://sia.codes/posts/webmentions-eleventy-in-depth/)
- [Show conditional Twitter intents with Eleventy](https://sia.codes/posts/conditional-twitter-intents-with-eleventy/)
