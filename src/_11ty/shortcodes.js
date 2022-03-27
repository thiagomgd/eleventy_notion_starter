const markdownIt = require("markdown-it");
const outdent = require("outdent")({ newline: " " });

const { getLocalImageLink } = require("../_11ty/helpers");

const EMPTY = ``;

const youtube = (id) => {
  return outdent`<div class="video-wrapper">
<iframe src="https://www.youtube-nocookie.com/embed/${id}"
frameborder="0" 
allowfullscreen>
</iframe>
</div>`;
};

const reddit = (url) => {
  return `<blockquote class="reddit-card">
<a href="${url}">r/geekosaur Lounge</a>
from <a href="http://www.reddit.com/r/geekosaur">r/geekosaur</a></blockquote>
<script async src="//embed.redditmedia.com/widgets/platform.js" charset="UTF-8"></script>`;
};

function uuidv4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// TODO: not finished yet. Needs css
function spoiler(text) {
  const uuid = uuidv4();
  return outdent`<span class="spoilers" title="Click to show spoiler"
onclick="document.getElementById('${uuid}').className = 'spoiler-text spoiler-show';"><span
class="spoiler-alert">(spoilers)</span>
<span id="${uuid}" class="spoiler-text">${text}</span></span>`;
}

const blur = (src, caption, className="", alt="") => {
  const localSrc = getLocalImageLink(src);
  const uuid = uuidv4();

  const figureClass = className ? `class="${className}"` : EMPTY;
  // const altVal = alt ? `alt=${alt}` : EMPTY;

  // TODO: markdownify
  // {{ with (.Get "title") -}}
  // <h4>{{ . }}</h4>
  // {{- end -}}
  // {{- if or (.Get "caption") (.Get "attr") -}}<p>
  //     {{- .Get "caption" | markdownify -}}
  //     {{- with .Get "attrlink" }}
  //     <a href="{{ . }}">
  //         {{- end -}}
  //         {{- .Get "attr" | markdownify -}}
  //         {{- if .Get "attrlink" }}</a>{{ end }}</p>
  // {{- end }}
  const captionTag = caption ? `<figcaption>${caption}</figcaption>` : EMPTY;

  // TODO: style/width/height?
  const imgTag = `<img src="${localSrc}" alt="${alt}"/>`;

  return outdent`<div class="blurDiv blurred" id="${uuid}" >
<figure ${figureClass} onclick="document.getElementById('${uuid}').className = 'blurDiv';">
    ${imgTag}
    ${captionTag}    
</figure>
</div>`;
};

function card(title, img, rating, review_link, goodreads) {
  const localImg = getLocalImageLink(img);

  const badge = rating ? `<div class="card-badge">${rating}</div>` : EMPTY;
  const imgTag = localImg ? `<div class="card-image-div"><img src="${localImg}"/></div>` : EMPTY;
  const reviewTag = review_link ? `<p><a href="${review_link}">Review</a></p>` : EMPTY;
  // todo: extract domain and use as link text
  const goodreadsTag = goodreads ? `<p><a href="${goodreads}" target="_blank" rel="noopener noreferrer">Goodreads</a></p>` : EMPTY;

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

// FROM https://stackoverflow.com/a/8260383/4637883
// http://www.youtube.com/watch?v=0zM3nApSvMg&feature=feedrec_grec_index
// http://www.youtube.com/user/IngridMichaelsonVEVO#p/a/u/1/QdK8U-VIH_o
// http://www.youtube.com/v/0zM3nApSvMg?fs=1&amp;hl=en_US&amp;rel=0
// http://www.youtube.com/watch?v=0zM3nApSvMg#t=0m10s
// http://www.youtube.com/embed/0zM3nApSvMg?rel=0
// http://www.youtube.com/watch?v=0zM3nApSvMg
// http://youtu.be/0zM3nApSvMg
function youtube_parser(url){
  var regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  var match = url.match(regExp);
  return (match&&match[7].length==11)? match[7] : false;
}

function anyEmbed(url) {
  if (!url) return ``;

  if (url.startsWith('https://www.youtube.com/') || url.startsWith('https://youtu.be/')) {
    const id = youtube_parser(url);
    return youtube(id);
  }

  if (url.startsWith('https://www.reddit.com/')) return reddit(url);

  return ``;
}

module.exports = {
  youtube_parser,
  youtube,
  reddit,
  // blur,
  // card,
  // figure: (image, caption="", className="", alt="") => {
  //   const localSrc = getLocalImageLink(image);

  //   const mdCaption = caption ? markdownIt().renderInline(caption) : EMPTY;
  //   const classMarkup = className ? ` class="${className}"` : '';
  //   const captionMarkup = caption ? `<figcaption>${mdCaption}</figcaption>` : '';
  //   return `<figure${classMarkup}><img src="${localSrc}" alt="${alt}" />${captionMarkup}</figure>`;
  // }
};

