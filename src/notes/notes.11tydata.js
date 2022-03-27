const { getLocalImageLink, optimizeImage } = require("../_11ty/helpers");


module.exports = function () {
  return {
    eleventyComputed: {
      tags: function (data) {
        if (!data || !data.tags_string) return ['note'];

        return [...data.tags_string.split(","), 'note'];
      },
      created_date: function(data) {
				return new Date(data.created_time);
			},
    },
  };
};