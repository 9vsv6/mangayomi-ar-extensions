// prettier-ignore
const mangayomiSources = [{
    "id": 811311576,
    "name": "Azora",
    "lang": "ar",
    "baseUrl": "https://azoramoon.com",
    "apiUrl": "",
    "iconUrl": "https://raw.githubusercontent.com/kodjodevf/mangayomi-extensions/main/dart/manga/multisrc/madara/src/ar/azora/icon.png",
    "typeSource": "single",
    "itemType": 0,
    "version": "0.2.1",
    "isNsfw": false,
    "pkgPath": "manga/src/ar/azora.js"
}];

class DefaultExtension extends MProvider {
  toStatus(status) {
    if (!status) return 5; // unknown
    const s = status.toUpperCase();
    if (s.includes("مستمر") || s.includes("مستمرة") || s.includes("ONGOING") || s.includes("ON_GOING")) {
      return 0; // ongoing
    }
    if (s.includes("مكتمل") || s.includes("مكتملة") || s.includes("COMPLETED") || s.includes("COMPLETE")) {
      return 1; // completed
    }
    if (s.includes("متوقف") || s.includes("متوقفة") || s.includes("ON_HOLD") || s.includes("ON HOLD") || s.includes("HIATUS")) {
      return 2; // on hold
    }
    if (s.includes("ملغي") || s.includes("ملغية") || s.includes("CANCELLED") || s.includes("CANCELED")) {
      return 3; // canceled
    }
    return 5; // unknown
  }

  getBaseUrl() {
    const preference = new SharedPreferences();
    var base_url = preference.get("domain_url");
    if (!base_url || base_url.length == 0) {
      return this.source.baseUrl;
    }
    if (base_url.endsWith("/")) {
      return base_url.slice(0, -1);
    }
    return base_url;
  }

  getHeaders(url) {
    url = url || this.getBaseUrl();
    return {
      Referer: `${url}/`,
    };
  }

  utf8Decode(str) {
    if (!str) return str;
    try {
      const map = {};
      let counter = 0;
      const sanitized = str.replace(/[^\x00-\xFF]/g, (match) => {
        const key = `__UNI_${counter++}__`;
        map[key] = match;
        return key;
      });
      const escalated = escape(sanitized);
      const decoded = decodeURIComponent(escalated);
      return decoded.replace(/__UNI_\d+__/g, (match) => map[match] || "");
    } catch (e) {
      return str;
    }
  }

  async request(url) {
    if (!this.client) {
      this.client = new Client();
    }
    let res = await this.client.get(url, this.getHeaders(url));
    let body = this.utf8Decode(res.body);
    return new Document(body);
  }

  async getPosts() {
    const now = Date.now();
    if (this.cachedPosts && (now - this.lastFetchTime < 60000)) {
      return this.cachedPosts;
    }
    if (!this.client) {
      this.client = new Client();
    }
    const res = await this.client.get(`https://api.azoramoon.com/api/posts?page=1&perPage=2000`, this.getHeaders());
    const data = JSON.parse(res.body);
    this.cachedPosts = data.posts || [];
    this.lastFetchTime = now;
    return this.cachedPosts;
  }

  async getPopular(page) {
    const posts = await this.getPosts();
    const sorted = [...posts].sort((a, b) => {
      const vA = a.totalViews || 0;
      const vB = b.totalViews || 0;
      return vB - vA;
    });
    
    const perPage = 24;
    const startIndex = (page - 1) * perPage;
    const paginated = sorted.slice(startIndex, startIndex + perPage);
    
    const list = paginated.map(post => ({
      name: post.postTitle,
      imageUrl: post.featuredImage,
      link: `${this.getBaseUrl()}/series/${post.slug}`
    }));
    
    return { list: list, hasNextPage: startIndex + perPage < sorted.length };
  }

  async getLatestUpdates(page) {
    const posts = await this.getPosts();
    const sorted = [...posts].sort((a, b) => {
      const tA = a.lastChapterAddedAt ? new Date(a.lastChapterAddedAt).getTime() : 0;
      const tB = b.lastChapterAddedAt ? new Date(b.lastChapterAddedAt).getTime() : 0;
      return tB - tA;
    });
    
    const perPage = 24;
    const startIndex = (page - 1) * perPage;
    const paginated = sorted.slice(startIndex, startIndex + perPage);
    
    const list = paginated.map(post => ({
      name: post.postTitle,
      imageUrl: post.featuredImage,
      link: `${this.getBaseUrl()}/series/${post.slug}`
    }));
    
    return { list: list, hasNextPage: startIndex + perPage < sorted.length };
  }

  async search(query, page, filters) {
    if (!query) {
      query = "";
    }
    const posts = await this.getPosts();
    const queryLower = query.toLowerCase().trim();
    let filtered = posts;
    if (queryLower.length > 0) {
      filtered = posts.filter(post => 
        (post.postTitle && post.postTitle.toLowerCase().includes(queryLower)) ||
        (post.alternativeTitles && post.alternativeTitles.toLowerCase().includes(queryLower)) ||
        (post.slug && post.slug.toLowerCase().includes(queryLower))
      );
    }
    
    const perPage = 24;
    const startIndex = (page - 1) * perPage;
    const paginated = filtered.slice(startIndex, startIndex + perPage);
    
    const list = paginated.map(post => ({
      name: post.postTitle,
      imageUrl: post.featuredImage,
      link: `${this.getBaseUrl()}/series/${post.slug}`
    }));
    
    return { list: list, hasNextPage: startIndex + perPage < filtered.length };
  }

  async getDetail(url) {
    const doc = await this.request(url);
    
    let title = "";
    let imageUrl = "";
    let description = "";
    let author = "";
    let statusText = "";
    let genre = [];
    let postId = "";
    
    // Try to extract metadata from Astro serialized props
    let post = null;
    let urlSlug = "";
    try {
      const parts = url.split("/series/");
      if (parts.length > 1) {
        urlSlug = parts[1].split("/")[0].split("?")[0].split("#")[0].trim();
      }
    } catch (e) {}

    const htmlStr = doc.outerHtml;
    const propsRegex = /props=["'](\{[\s\S]*?\})["']/g;
    let match;
    const candidatePosts = [];
    while ((match = propsRegex.exec(htmlStr)) !== null) {
      const decodedProps = match[1].replace(/&quot;/g, '"')
                                    .replace(/&amp;/g, '&')
                                    .replace(/&lt;/g, '<')
                                    .replace(/&gt;/g, '>')
                                    .replace(/&#39;/g, "'");
      if (decodedProps.includes('"postContent"')) {
        try {
          const parsed = JSON.parse(decodedProps);
          const unwrap = (val) => {
            if (Array.isArray(val) && val.length === 2 && typeof val[0] === 'number') {
              return unwrap(val[1]);
            }
            if (val && typeof val === 'object') {
              if (Array.isArray(val)) {
                return val.map(unwrap);
              }
              const obj = {};
              for (const k in val) {
                obj[k] = unwrap(val[k]);
              }
              return obj;
            }
            return val;
          };
          const unwrapped = unwrap(parsed);
          if (unwrapped && unwrapped.post) {
            candidatePosts.push(unwrapped.post);
          }
        } catch (e) {}
      }
    }

    if (urlSlug) {
      post = candidatePosts.find(p => p.slug === urlSlug);
    }
    if (!post && candidatePosts.length > 0) {
      post = candidatePosts[0];
    }
    
    // Parse using properties if found, otherwise fall back to HTML selectors
    if (post) {
      title = post.postTitle || "";
      description = (post.postContent || "").replace(/<[^>]+>/g, "").trim();
      author = post.publishingTeam?.name || "";
      statusText = post.seriesStatus || "";
      genre = (post.genres || []).map(g => g.name);
      postId = post.id ? post.id.toString() : "";
    } else {
      // Fallback
      title = doc.selectFirst("title")?.text?.trim() || "";
      title = title.replace(/\s+مانهوا\s*-\s*Azora\s+Manga/gi, "")
                   .replace(/\s*-\s*Azora\s+Manga/gi, "")
                   .replace(/\s+مانهوا/gi, "");
                   
      description = doc.selectFirst("meta[name='description']")?.attr("content") || 
                    doc.selectFirst("meta[name='twitter:description']")?.attr("content") || 
                    doc.selectFirst("meta[property='og:description']")?.attr("content") || "";
      description = description.replace(/<[^>]+>/g, "").trim();
      
      const authorEl = doc.selectFirst("a[href*='/author/']");
      if (authorEl) {
        author = authorEl.text.trim();
      }
      
      const statusMatch = doc.outerHtml.match(/seriesStatus(?:&quot;|")?:\s*\[\d+,\s*(?:&quot;|")?([^"&\]\s]+)/);
      statusText = statusMatch ? statusMatch[1] : "";
      
      const genreEls = doc.select("a[href*='/genres/'], a[href*='/genre/']");
      if (genreEls) {
        for (const e of genreEls) {
          genre.push(e.text.trim());
        }
      }
      
      const postIdMatch = doc.outerHtml.match(/postId(?:&quot;|")?:\s*\[\d+,\s*(\d+)\]/);
      postId = postIdMatch ? postIdMatch[1] : "";
    }
    
    // Cover Image parsing (prioritizing og:image to get correct portrait cover)
    imageUrl = doc.selectFirst("meta[property='og:image']")?.attr("content") || "";
    if (!imageUrl) {
      const imgEl = doc.selectFirst("img[alt*='Cover']");
      if (imgEl) {
        imageUrl = imgEl.attr("data-src") || imgEl.attr("data-lazy-src") || imgEl.getSrc || imgEl.attr("src") || "";
      }
      if (imageUrl.includes("url=")) {
        const matched = imageUrl.match(/url=([^&]+)/);
        if (matched) {
          imageUrl = decodeURIComponent(matched[1]);
        }
      }
    }
    if (!imageUrl && post) {
      imageUrl = post.featuredImage || "";
    }
    
    const status = this.toStatus(statusText);
    
    let chapters = [];
    if (postId) {
      const client = new Client();
      const res = await client.get(`https://api.azoramoon.com/api/chapters?postId=${postId}`, this.getHeaders(url));
      const data = JSON.parse(res.body);
      const chList = data?.post?.chapters || [];
      
      for (const ch of chList) {
        const chSlug = ch.slug;
        const chNumber = ch.number;
        const chTitle = ch.title ? ch.title.trim() : "";
        let chName = `الفصل ${chNumber}`;
        if (chTitle) {
          chName += ` : ${chTitle}`;
        }
        
        let chUrl = url;
        if (chUrl.endsWith("/")) {
          chUrl = chUrl + chSlug;
        } else {
          chUrl = chUrl + "/" + chSlug;
        }
        
        let dateUpload = "0";
        if (ch.createdAt) {
          dateUpload = new Date(ch.createdAt).getTime().toString();
        }
        
        chapters.push({
          name: chName,
          url: chUrl,
          dateUpload: dateUpload
        });
      }
    }
    
    return {
      title,
      imageUrl,
      description,
      author,
      status,
      genre,
      chapters
    };
  }

  async getPageList(url) {
    const doc = await this.request(url);
    const elements = doc.select("img[data-reader-page-image], img[alt*='Page']");
    const pages = [];
    const seen = new Set();
    for (const e of elements) {
      let imageUrl = e.attr("data-src") || e.attr("data-lazy-src") || e.getSrc || e.attr("src") || "";
      imageUrl = imageUrl.trim();
      if (imageUrl.length > 0 && !seen.has(imageUrl)) {
        seen.add(imageUrl);
        pages.push({ url: imageUrl });
      }
    }
    return pages;
  }

  getFilterList() {
    return [];
  }

  getSourcePreferences() {
    return [
      {
        key: "domain_url",
        editTextPreference: {
          title: "تحرير الرابط",
          summary: "",
          value: "https://azoramoon.com",
          dialogTitle: "URL",
          dialogMessage: "",
        },
      },
    ];
  }
}
