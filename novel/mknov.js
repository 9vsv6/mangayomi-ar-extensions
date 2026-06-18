// prettier-ignore
const mangayomiSources = [{
    "name": "مملكة الروايات",
    "lang": "ar",
    "baseUrl": "https://www.mknov.com",
    "apiUrl": "",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://www.mknov.com",
    "typeSource": "single",
    "itemType": 2,
    "version": "0.0.2",
    "pkgPath": "novel/src/ar/mknov.js",
    "notes": ""
}];

class DefaultExtension extends MProvider {
  headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "ar,en-US;q=0.9,en;q=0.8",
  };

  getHeaders(url) {
    return this.headers;
  }

  unescapeRsc(str) {
    return str.replace(/\\(["\\\/bfnrt])/g, "$1").replace(/\\u([0-9a-fA-F]{4})/g, function (_, h) { return String.fromCharCode(parseInt(h, 16)); });
  }

  extractRscPayload(html) {
    var parts = html.split('self.__next_f.push([1,"');
    var combined = "";
    for (var p = 1; p < parts.length; p++) {
      var i = 0;
      while (i < parts[p].length) {
        if (parts[p][i] === "\\") {
          i += 2;
        } else if (parts[p][i] === '"' && parts[p].substring(i, i + 3) === '"])') {
          combined += this.unescapeRsc(parts[p].substring(0, i));
          break;
        } else {
          i++;
        }
      }
    }
    return combined;
  }

  extractJsonValue(str, key) {
    var searchKey = '"' + key + '":';
    var idx = str.indexOf(searchKey);
    if (idx === -1) return null;
    var i = idx + searchKey.length;
    while (i < str.length && (str[i] === " " || str[i] === "\t" || str[i] === "\n" || str[i] === "\r")) i++;
    if (i >= str.length) return null;
    var first = str[i];
    if (first !== "{" && first !== "[") return null;
    var open = first;
    var close = open === "{" ? "}" : "]";
    var depth = 0;
    var inStr = false;
    var escape = false;
    var start = i;
    for (; i < str.length; i++) {
      if (escape) { escape = false; continue; }
      if (str[i] === "\\") { escape = true; continue; }
      if (str[i] === '"') { inStr = !inStr; continue; }
      if (!inStr) {
        if (str[i] === open) depth++;
        else if (str[i] === close) {
          depth--;
          if (depth === 0) return JSON.parse(str.substring(start, i + 1));
        }
      }
    }
    return null;
  }

  parseSearchResults(html) {
    var rsc = this.extractRscPayload(html);
    var data = this.extractJsonValue(rsc, "searchResults");
    if (!data) return { list: [], hasNextPage: false };
    var works = Array.isArray(data.works) ? data.works : [];
    var list = [];
    for (var w = 0; w < works.length; w++) {
      var imgUrl = works[w].image_url || "";
      if (imgUrl.startsWith("/")) {
        imgUrl = this.getBaseUrl() + imgUrl;
      }
      list.push({
        name: works[w].name || "",
        imageUrl: imgUrl,
        link: this.getBaseUrl() + "/novel/" + works[w].id,
      });
    }
    var hasNextPage = data.pagination ? data.pagination.hasMore === true : false;
    return { list: list, hasNextPage: hasNextPage };
  }

  async getPopular(page) {
    var res = await new Client().get(this.getBaseUrl() + "/search?sort=views&page=" + page, this.headers);
    if (res.statusCode !== 200) throw new Error("Failed to fetch popular page: " + res.statusCode);
    return this.parseSearchResults(res.body);
  }

  async getLatestUpdates(page) {
    var res = await new Client().get(this.getBaseUrl() + "/search?sort=latest&page=" + page, this.headers);
    if (res.statusCode !== 200) throw new Error("Failed to fetch latest page: " + res.statusCode);
    return this.parseSearchResults(res.body);
  }

  async search(query, page, filters) {
    var keyword = query.trim();
    var url;
    if (keyword) {
      url = this.getBaseUrl() + "/search?q=" + encodeURIComponent(keyword) + "&page=" + page;
    } else {
      url = this.getBaseUrl() + "/search?page=" + page;
    }
    var res = await new Client().get(url, this.headers);
    if (res.statusCode !== 200) throw new Error("Failed to fetch search page: " + res.statusCode);
    return this.parseSearchResults(res.body);
  }

  toStatus(status) {
    if (status === "completed") return 1;
    if (status === "ongoing") return 0;
    if (status === "hiatus" || status === "onhold") return 2;
    return 5;
  }

  async getDetail(url) {
    if (url.startsWith("/")) {
      url = this.getBaseUrl() + url;
    }
    var res = await new Client().get(url, this.headers);
    if (res.statusCode !== 200) throw new Error("Failed to fetch detail page: " + res.statusCode);
    var rsc = this.extractRscPayload(res.body);

    var novel = this.extractJsonValue(rsc, "novel");
    if (!novel) {
      var chunks = rsc.split('"novel":');
      if (chunks.length > 1) {
        var chunk = chunks[1];
        var braceDepth = 0;
        var inStr = false;
        var escape = false;
        var end = 0;
        for (var i = 0; i < chunk.length; i++) {
          if (escape) { escape = false; continue; }
          if (chunk[i] === "\\") { escape = true; continue; }
          if (chunk[i] === '"') { inStr = !inStr; continue; }
          if (!inStr) {
            if (chunk[i] === "{") { braceDepth++; if (braceDepth === 1) end = i; }
            else if (chunk[i] === "}") { braceDepth--; if (braceDepth === 0) { novel = JSON.parse(chunk.substring(end, i + 1)); break; } }
          }
        }
      }
    }
    if (!novel) throw new Error("Could not find novel data in page");

    var name = novel.name || "";
    var imageUrl = novel.image_url || "";
    if (imageUrl.startsWith("/")) {
      imageUrl = this.getBaseUrl() + imageUrl;
    }
    var description = (novel.story || "") + "\n\n";
    var genre = Array.isArray(novel.tags) ? novel.tags : [];
    var author = novel.author || "";
    var status = this.toStatus(novel.status);

    var chaptersData = this.extractJsonValue(rsc, "chapters");
    var chapters = [];
    if (Array.isArray(chaptersData)) {
      for (var c = 0; c < chaptersData.length; c++) {
        var ch = chaptersData[c];
        var chNum = ch.chapter_number || "";
        var chTitle = ch.chapter_title || "";
        var chName = chNum ? (chNum + (chTitle ? ": " + chTitle : "")) : (chTitle || "?");
        var chapterUrl = this.getBaseUrl() + "/novel/" + ch.work_id + "/chapter/" + ch.id;
        var dateUpload = ch.publish_datetime ? new Date(ch.publish_datetime).getTime().toString() : "";
        chapters.push({ name: chName, url: chapterUrl, dateUpload: dateUpload, scanlator: "" });
      }
    }

    return { name: name, imageUrl: imageUrl, description: description, genre: genre, author: author, status: status, chapters: chapters };
  }

  async getHtmlContent(name, url) {
    if (url.startsWith("/")) {
      url = this.getBaseUrl() + url;
    }
    var res = await new Client().get(url, this.headers);
    if (res.statusCode !== 200) throw new Error("Failed to fetch chapter content: " + res.statusCode);

    var doc = new Document(res.body);
    var title = name;
    var titleEl = doc.selectFirst("h1");
    if (titleEl) {
      var t = titleEl.text.trim();
      if (t.length > 0) title = t;
    }

    var contentEl = doc.selectFirst("div.reading-content");
    if (!contentEl || contentEl.text.trim().length === 0) {
      contentEl = doc.selectFirst("div.reading-area");
    }

    var html = "";
    if (contentEl) {
      html = contentEl.outerHtml;
    } else {
      var marker = 'reading-content prose prose-lg max-w-none';
      var startIdx = res.body.indexOf(marker);
      if (startIdx !== -1) {
        var tagStart = res.body.lastIndexOf("<div", startIdx);
        if (tagStart !== -1) {
          var depth = 0;
          var j = tagStart;
          for (; j < res.body.length; j++) {
            if (res.body[j] === "<") {
              if (res.body.substring(j, j + 4) === "<div") {
                depth++;
                j += 3;
              } else if (res.body.substring(j, j + 6) === "</div>") {
                depth--;
                j += 5;
                if (depth === 0) {
                  html = res.body.substring(tagStart, j + 1);
                  break;
                }
              }
            }
          }
        }
      }
    }

    if (!html || html.trim().length === 0) {
      throw new Error("Could not find chapter content in HTML");
    }

    return '<h2 style="text-align: center;">' + title + '</h2><hr><br>' + html;
  }

  getFilterList() {
    return [];
  }

  getBaseUrl() {
    var preference = new SharedPreferences();
    var base_url = preference.get("base_url");
    if (base_url.length == 0) {
      return this.source.baseUrl;
    }
    if (base_url.endsWith("/")) {
      return base_url.slice(0, -1);
    }
    return base_url;
  }

  getSourcePreferences() {
    return [
      {
        key: "base_url",
        editTextPreference: {
          title: "تعديل الرابط",
          summary: "",
          value: this.source.baseUrl,
          dialogTitle: "تعديل",
          dialogMessage: "Default URL " + this.source.baseUrl,
        },
      },
    ];
  }
}
