// prettier-ignore
const mangayomiSources = [{
    "name": "مركز الروايات",
    "lang": "ar",
    "baseUrl": "https://markazriwayat.com",
    "apiUrl": "",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://markazriwayat.com",
    "typeSource": "single",
    "itemType": 2,
    "version": "0.0.3",
    "pkgPath": "novel/src/ar/markazriwayat.js",
    "notes": ""
}];

class DefaultExtension extends MProvider {
  headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "ar,en-US;q=0.9,en;q=0.8",
  };

  nonce = "";
  restUrl = "";

  getHeaders(url) {
    return this.headers;
  }

  cleanTitle(title) {
    title = title.replace(/[-–_&@#%^)(*+،؛:]+/g, " ");
    title = title.replace(/\s+/g, " ").trim();
    return title;
  }

  async getNonceAndRestUrl() {
    if (this.nonce && this.restUrl) {
      return { nonce: this.nonce, restUrl: this.restUrl };
    }

    const res = await new Client().get(this.getBaseUrl(), this.headers);
    if (res.statusCode !== 200) {
      throw new Error(`Failed to load homepage for initialization: ${res.statusCode}`);
    }

    const html = res.body;
    const idx = html.indexOf("THEAM_APP");
    if (idx === -1) {
      throw new Error("Could not find THEAM_APP configuration on homepage");
    }

    const startIdx = html.indexOf("{", idx);
    if (startIdx === -1) {
      throw new Error("Could not find start of THEAM_APP JSON");
    }

    let braceCount = 0;
    let inString = false;
    let escape = false;
    let jsonStr = "";

    for (let i = startIdx; i < html.length; i++) {
      const char = html[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (char === "\\") {
        escape = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (char === "{") {
          braceCount++;
        } else if (char === "}") {
          braceCount--;
          if (braceCount === 0) {
            jsonStr = html.substring(startIdx, i + 1);
            break;
          }
        }
      }
    }

    if (!jsonStr) {
      throw new Error("Failed to parse THEAM_APP JSON structure");
    }

    const theamApp = JSON.parse(jsonStr);
    this.nonce = theamApp.nonce || "";
    this.restUrl = theamApp.restUrl || `${this.getBaseUrl()}/wp-json/theam/v1`;
    return { nonce: this.nonce, restUrl: this.restUrl };
  }

  async getApiHeaders() {
    const { nonce } = await this.getNonceAndRestUrl();
    return Object.assign({}, this.headers, {
      "X-WP-Nonce": nonce,
      "Accept": "application/json",
    });
  }

  async getPopular(page) {
    if (page === 1) {
      const res = await new Client().get(`${this.getBaseUrl()}/popular/`, this.headers);
      if (res.statusCode !== 200) {
        throw new Error(`Failed to fetch popular page: ${res.statusCode}`);
      }
      const doc = new Document(res.body);
      const elements = doc.select("a.lib-card");
      const list = [];
      for (const el of elements) {
        const titleEl = el.selectFirst(".lib-card__title");
        const name = titleEl ? titleEl.text.trim() : "";
        const imgEl = el.selectFirst("img");
        const imageUrl = imgEl ? (imgEl.attr("data-src") || imgEl.attr("src") || "") : "";
        const link = el.attr("href") || "";
        if (name && link) {
          list.push({ name, imageUrl, link });
        }
      }
      return { list, hasNextPage: true };
    }

    const { restUrl } = await this.getNonceAndRestUrl();
    const apiHeaders = await this.getApiHeaders();
    const res = await new Client().get(
      `${restUrl}/library?page=${page}&per_page=24&sort=views`,
      apiHeaders
    );
    const data = JSON.parse(res.body);
    const items = Array.isArray(data?.items) ? data.items : [];
    const list = items.map((item) => ({
      name: item.title,
      imageUrl: item.cover,
      link: item.link,
    }));
    const totalPages = parseInt(data?.totalPages || 0, 10) || 0;
    const hasNextPage = page < totalPages;
    return { list, hasNextPage };
  }

  async getLatestUpdates(page) {
    if (page === 1) {
      const res = await new Client().get(this.getBaseUrl(), this.headers);
      if (res.statusCode !== 200) {
        throw new Error(`Failed to fetch homepage: ${res.statusCode}`);
      }
      const doc = new Document(res.body);
      const elements = doc.select("article.latest-card");
      const list = [];
      for (const el of elements) {
        const titleEl = el.selectFirst("a.latest-title");
        const name = titleEl ? titleEl.text.trim() : "";
        const imgEl = el.selectFirst("a.latest-cover img");
        const imageUrl = imgEl ? (imgEl.attr("data-src") || imgEl.attr("src") || "") : "";
        const link = titleEl ? (titleEl.attr("href") || "") : "";
        if (name && link) {
          list.push({ name, imageUrl, link });
        }
      }
      return { list, hasNextPage: true };
    }

    const { restUrl } = await this.getNonceAndRestUrl();
    const apiHeaders = await this.getApiHeaders();
    const res = await new Client().get(
      `${restUrl}/latest-chapters?page=${page}&per_page=15`,
      apiHeaders
    );
    const data = JSON.parse(res.body);
    const items = Array.isArray(data?.items) ? data.items : [];
    const list = items.map((item) => ({
      name: item.title,
      imageUrl: item.cover,
      link: item.permalink,
    }));
    const hasNextPage = items.length >= 15;
    return { list, hasNextPage };
  }

  async search(query, page, filters) {
    const { restUrl } = await this.getNonceAndRestUrl();
    const apiHeaders = await this.getApiHeaders();
    const keyword = query.trim();

    if (keyword) {
      const res = await new Client().get(
        `${restUrl}/novel-search?term=${encodeURIComponent(keyword)}&per_page=20`,
        apiHeaders
      );
      const data = JSON.parse(res.body);
      const items = Array.isArray(data?.items) ? data.items : [];
      const list = items.map((item) => ({
        name: item.title,
        imageUrl: item.cover,
        link: item.link,
      }));
      return { list, hasNextPage: false };
    }

    let url = `${restUrl}/library?page=${page}&per_page=24`;
    let status = "";
    let sort = "";
    let genres = [];
    let tags = [];

    filters.forEach((filter) => {
      if (filter.type === "GenreFilter") {
        const selected = filter.state.filter((e) => e.state);
        selected.forEach((gen) => genres.push(gen.value));
      } else if (filter.type === "StatusFilter") {
        if (filter.values?.[filter.state]?.value) {
          status = filter.values[filter.state].value;
        }
      } else if (filter.type === "SortFilter") {
        if (filter.values?.[filter.state]?.value) {
          sort = filter.values[filter.state].value;
        }
      } else if (filter.type === "TagFilter") {
        const selected = filter.state.filter((e) => e.state);
        selected.forEach((tag) => tags.push(tag.value));
      }
    });

    if (status) url += `&status=${status}`;
    if (sort) url += `&sort=${sort}`;
    if (genres.length > 0) url += `&genres=${genres.join(",")}`;
    if (tags.length > 0) url += `&tags=${tags.join(",")}`;

    const res = await new Client().get(url, apiHeaders);
    const data = JSON.parse(res.body);
    const items = Array.isArray(data?.items) ? data.items : [];
    const list = items.map((item) => ({
      name: item.title,
      imageUrl: item.cover,
      link: item.link,
    }));
    const totalPages = parseInt(data?.totalPages || 0, 10) || 0;
    const hasNextPage = page < totalPages;
    return { list, hasNextPage };
  }

  toStatus(statusStr) {
    statusStr = statusStr.trim();
    if (statusStr.includes("مستمر")) return 0;
    if (statusStr.includes("مكتمل")) return 1;
    if (statusStr.includes("متوقف")) return 2;
    return 5; // unknown
  }

  async getDetail(url) {
    const res = await new Client().get(url, this.headers);
    const doc = new Document(res.body);

    const titleEl = doc.selectFirst("h1.manga-title");
    const name = titleEl ? titleEl.text.trim() : "";

    const coverWrap = doc.selectFirst("div.manga-cover-wrap img");
    const imageUrl = coverWrap ? (coverWrap.attr("data-src") || coverWrap.attr("src")) : "";

    const authorEl = doc.selectFirst("div.manga-author:contains('مؤلف') a");
    const author = authorEl ? authorEl.text.trim() : "";

    const translatorEl = doc.selectFirst("div.manga-author:contains('مترجم') a");
    const translator = translatorEl ? translatorEl.text.trim() : "";

    const statusEl = doc.selectFirst("span.status-pill");
    const status = statusEl ? this.toStatus(statusEl.text) : 5;

    const descEl = doc.selectFirst("div.manga-summary");
    let description = descEl ? descEl.text.trim() + "\n\n" : "";
    if (translator) {
      description += `المترجم: ${translator}\n`;
    }

    const genre = doc.select("a.pill[href*='/tasnif/']").map((el) => el.text.trim());

    const mangaIdMatch = res.body.match(/"mangaId"\s*:\s*(\d+)/) || res.body.match(/data-manga-id="(\d+)"/);
    if (!mangaIdMatch) {
      throw new Error("Could not find mangaId on detail page");
    }
    const mangaId = mangaIdMatch[1];

    const { restUrl } = await this.getNonceAndRestUrl();
    const apiHeaders = await this.getApiHeaders();

    const chapters = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const apiRes = await new Client().get(
        `${restUrl}/manga-chapters?manga_id=${mangaId}&order=desc&page=${page}&per_page=100`,
        apiHeaders
      );
      if (apiRes.statusCode !== 200) {
        throw new Error(`Failed to fetch chapters API: ${apiRes.statusCode}`);
      }
      const data = JSON.parse(apiRes.body);
      const items = Array.isArray(data?.items) ? data.items : [];

      for (const item of items) {
        const title = item.label || item.num;
        const url = item.url;
        const dateUpload = item.date ? new Date(item.date).getTime().toString() : "";
        chapters.push({ name: title, url, dateUpload, scanlator: translator });
      }

      // The chapters API returns `total` + `has_more`, not `totalPages`.
      // Rely on `has_more` (with the per_page count as a fallback) so every
      // chapter is fetched, not just the first page.
      const hasMoreFlag = data?.has_more === true || data?.has_more === "true";
      if (!hasMoreFlag || items.length < 100) {
        hasMore = false;
      } else {
        page++;
      }
    }

    return {
      name,
      imageUrl,
      description,
      genre,
      author,
      status,
      chapters,
    };
  }

  async getHtmlContent(name, url) {
    const res = await new Client().get(url, this.headers);
    if (res.statusCode !== 200) {
      throw new Error(`Failed to fetch chapter content: ${res.statusCode}`);
    }

    const doc = new Document(res.body);
    const titleEl =
      doc.selectFirst("div.reader-chapter") ||
      doc.selectFirst("h2.wp-manga-chapter-title") ||
      doc.selectFirst("h1.entry-title") ||
      doc.selectFirst("h1");
    const title = titleEl ? titleEl.text.trim() : name;

    // The actual chapter text lives in `div.reading-content`. Older themes
    // used `.epcontent` / `.entry-content`, kept as fallbacks.
    const contentEl =
      doc.selectFirst("div.reading-content") ||
      doc.selectFirst("div.epcontent") ||
      doc.selectFirst("div.entry-content") ||
      doc.selectFirst("div.entry-content_wrap");
    if (!contentEl) {
      throw new Error("Could not find chapter content in HTML");
    }

    // Strip hidden anti-scraping watermark spans injected between paragraphs
    // (e.g. <span class="theam-chobf">...مركز الروايات...</span>). Element
    // nodes in this engine have no .remove(), so remove them from the HTML.
    const html = contentEl.outerHtml.replace(
      /<span\b[^>]*class="[^"]*\btheam-chobf\b[^"]*"[^>]*>[\s\S]*?<\/span>/gi,
      ""
    );

    return `<h2 style="text-align: center;">${this.cleanTitle(title)}</h2><hr><br>${html}`;
  }

  getFilterList() {
    return [
      {
        type: "StatusFilter",
        name: "الحالة",
        type_name: "SelectFilter",
        values: [
          { type_name: "SelectOption", name: "الكل", value: "" },
          { type_name: "SelectOption", name: "مستمر", value: "on-going" },
          { type_name: "SelectOption", name: "مكتملة", value: "end" },
          { type_name: "SelectOption", name: "متوقفة", value: "canceled" },
          { type_name: "SelectOption", name: "متوقفة مؤقتًا", value: "on-hold" },
        ],
        state: 0,
      },
      {
        type: "SortFilter",
        name: "ترتيب حسب",
        type_name: "SelectFilter",
        values: [
          { type_name: "SelectOption", name: "الافتراضي", value: "" },
          { type_name: "SelectOption", name: "ترتيب حسب الاسم", value: "name" },
          { type_name: "SelectOption", name: "ترتيب حسب عدد المشاهدات", value: "views" },
          { type_name: "SelectOption", name: "ترتيب حسب التقييم", value: "rank" },
          { type_name: "SelectOption", name: "ترتيب حسب عدد الفصول", value: "chapters" },
        ],
        state: 0,
      },
      {
        type_name: "GroupFilter",
        type: "GenreFilter",
        name: "التصنيفات",
        state: [
          { type_name: "CheckBox", name: "خيال", value: "خيال" },
          { type_name: "CheckBox", name: "فنون قتالية", value: "فنون-قتالية" },
          { type_name: "CheckBox", name: "قوى خارقة", value: "قوى-خارقة" },
          { type_name: "CheckBox", name: "مهارات القتال", value: "مهارات-القتال" },
        ],
      },
      {
        type_name: "GroupFilter",
        type: "TagFilter",
        name: "الوسوم",
        state: [
          { type_name: "CheckBox", name: "رواية صينية", value: "رواية-صينية" },
        ],
      },
    ];
  }

  getBaseUrl() {
    const preference = new SharedPreferences();
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
          dialogMessage: `Default URL ${this.source.baseUrl}`,
        },
      },
    ];
  }
}
