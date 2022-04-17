---
layout: layouts/note.njk
# add tags after changing layout and having a filter for note tags
# tags: ["detail"] 
pagination:
  data: notes
  size: 1  
  alias: note
  addAllPagesToCollections: true
eleventyComputed:
  tags_string: "{{ note.tags }}"
  title: "{{ note.title }}"
  # date: "{{ note.created_time }}"
  description: "{{ note.content | twitterExerpt }}"
  thumbnail:  "{{ note | getNoteThumbnail | getOptimizedImageUrl }}"
  created_time: "{{ note.created_time }}"
  id: "{{ note.id }}"
  tweetId: "{{ note.tweet | getTwitterId }}"
  replyTo: "{{ note.reply_to }}"
  permalink: "note/{{ note.id }}/"
---

{% anyEmbed note.embed %}

{{ note.content | safe }}

{% for image in note.images %}

{% figure image, "", "u-photo" %}

{% endfor %}
