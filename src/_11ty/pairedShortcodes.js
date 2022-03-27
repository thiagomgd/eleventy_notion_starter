const outdent = require("outdent")({ newline: " " });
const markdownIt = require("markdown-it")();

// const shortcodes = require("./shortcodes.js");

const EMPTY = ``;

const myembed = (content, props = {}) => {
  // TODO: default image?
  const { title, image, url, author, siteName, year, date, tags } = props;

  const metaDataInner =
    date || tags
      ? `<ul class="details">
{{ with .Get "author"}}
<li class="author">{{ . }}</li>
{{ end }}
{{ with .Get "date" }}
<li class="date">{{ . }}</li>
{{ end }}
{{ with .Get "tags" }}
<li class="tags">
<ul>
{{ $tags := split . ";" }}
{{ range $tags }}
<li>{{- . -}}</li>
{{ end }}
</ul>
</li>
{{ end }}
</ul>`
      : EMPTY;

  const siteNameSection = siteName ? `<h5 class="myEmbed">${siteName}</h5>` : EMPTY;
  const yearText = year ? ` (${year})` : EMPTY;

  const authorSection = author
    ? `<h5 class="myEmbed">${author}${yearText}</h5>`
    : EMPTY;
  const readMoreSection = url
    ? `<p class="read-more">
<a href='${url}'>Go To Link</a>
</p>`
    : EMPTY;

  return `<div class="blog-card">
<div class="meta">
<div class="photo" style='background-image: url(${image})'></div>
${metaDataInner}
</div>
<div class="description">
<h4 class="myEmbed">${title}</h4>
${siteNameSection}
${authorSection}
<hr>
<p>${content}</p>
${readMoreSection}
</div>
</div>`;
};

module.exports = {
  myembed
};


// GR EMBED CODE - bookmarklet
// const jsonData = document.querySelector('script[type="application/ld+json"]');
// const data = JSON.parse(jsonData.text);

// const title = data['name'];
// const image = data['image'];
// const author = data['author'][0]['name'];

// const url = document.querySelector('link[rel="canonical"]').href;

// const descriptionSelector = document.querySelector('div[data-testid="description"] > div > div > div > span');

// const description = descriptionSelector.innerText;

// const embedCode = `{% myembed {title:"${title}", author:"${author}", url:"${url}", image:"${image}"} %}
// ${description}
// {% endmyembed %}`; 
// navigator.clipboard.writeText(embedCode);
