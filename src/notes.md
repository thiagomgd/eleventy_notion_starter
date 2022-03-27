---
layout: layouts/home.njk
permalink: /notes/
eleventyNavigation:
  key: Notes
  order: 2
---

<section class="content-780">
<h1>Notes</h1>

{% for note in notes | reverse -%}

[{{ note.title }}](/note/{{ note.id }}/) - {{ note.created_time | readableDate }}

{% anyEmbed note.embed %}

{{ note.content | safe }}

{% for image in note.images %}

{% figure image %}

{% endfor %}

<hr/>

{% endfor -%}


</section>