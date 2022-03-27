---
layout: layouts/post.njk
# date: "2022-04-20"
title: "Books Read"
toc: true
templateClass: tmpl-post
permalink: /books-per-year/
tweetId: "1393699018597797893"
reddit: https://www.reddit.com/r/geekosaur/comments/ndaaoc/books_per_year/
eleventyNavigation:
  key: Books Read
  order: 4
---

{%- for year, bookList in books | dictsort | reverse -%}

### {{ year }} ({{ bookList | length }} read)

<div class="cards">
<!-- TODO: sort by rating and date -->
{% for book in bookList -%}
{% card book.title,book.cover,book.rating,book.review %}
{% endfor -%}
</div>

{% endfor -%}