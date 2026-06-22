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
    "version": "0.1.8",
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

  async request(url) {
    if (!this.client) {
      this.client = new Client();
    }
    let res = await this.client.get(url, this.getHeaders(url));
    return new Document(res.body);
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
    
    // Title
    let title = doc.selectFirst("title")?.text?.trim() || "";
    title = title.replace(/\s+مانهوا\s*-\s*Azora\s+Manga/gi, "")
                 .replace(/\s*-\s*Azora\s+Manga/gi, "")
                 .replace(/\s+مانهوا/gi, "");
                 
    // Cover Image
    let imageUrl = doc.selectFirst("meta[property='og:image']")?.attr("content") || "";
    
    // Description
    let description = doc.selectFirst("meta[name='description']")?.attr("content") || "";
    description = description.replace(/<[^>]+>/g, "").trim();
    
    // Author
    let author = "";
    const authorEl = doc.selectFirst("a[href*='/author/']");
    if (authorEl) {
      author = authorEl.text.trim();
    }
    
    // Status
    const statusMatch = doc.outerHtml.match(/&quot;seriesStatus&quot;:\[\d+,\s*&quot;([^&]+)&quot;\]/);
    const statusText = statusMatch ? statusMatch[1] : "";
    const status = this.toStatus(statusText);
    
    // Genres
    const genre = [];
    const genreEls = doc.select("a[href*='/genres/'], a[href*='/genre/']");
    if (genreEls) {
      for (const e of genreEls) {
        genre.push(e.text.trim());
      }
    }
    
    // Post ID
    const postIdMatch = doc.outerHtml.match(/&quot;postId&quot;:\[\d+,\s*(\d+)\]/);
    const postId = postIdMatch ? postIdMatch[1] : "";
    
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
    const elements = doc.select("img[alt*='Page']");
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
