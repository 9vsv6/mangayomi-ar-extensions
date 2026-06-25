// prettier-ignore
const mangayomiSources = [{
    "id": 984572230,
    "name": "Manga Spark",
    "lang": "ar",
    "baseUrl": "https://manga-spark.net",
    "apiUrl": "",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://manga-spark.net",
    "typeSource": "single",
    "itemType": 0,
    "version": "0.2.0",
    "isNsfw": false,
    "pkgPath": "manga/src/ar/mangaspark.js"
}];

class DefaultExtension extends MProvider {
  toStatus(status) {
    if (status.includes("مستمر") || status.includes("مستمرة") || status.includes("Ongoing")) {
      return 0; // ongoing
    }
    if (status.includes("مكتمل") || status.includes("مكتملة") || status.includes("Completed")) {
      return 1; // completed
    }
    if (status.includes("متوقف") || status.includes("متوقفة") || status.includes("On Hold")) {
      return 2; // on hold
    }
    if (status.includes("ملغي") || status.includes("ملغية") || status.includes("Canceled")) {
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
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    };
  }

  async request(url) {
    if (!this.client) {
      this.client = new Client();
    }
    let res = await this.client.get(url, this.getHeaders(url));
    return new Document(res.body);
  }

  mangaFromElements(doc, selector) {
    const elements = doc.select(selector);
    const list = [];
    for (const el of elements) {
      const postTitle = el.selectFirst("div.post-title a");
      if (!postTitle) continue;
      
      const name = postTitle.text.trim();
      const link = postTitle.getHref;
      
      const host = this.getBaseUrl().replace("https://", "").replace("http://", "").split("/")[0];
      if (link && !link.includes(host) && link.includes("://")) {
        continue;
      }
      
      const imgEl = el.selectFirst("img");
      let imageUrl = "";
      if (imgEl) {
        imageUrl = imgEl.attr("data-src") || imgEl.attr("data-lazy-src") || imgEl.attr("srcset")?.split(" ")[0] || imgEl.getSrc || "";
        imageUrl = imageUrl.trim().split(" ")[0];
      }
      
      list.push({
        name: name,
        imageUrl: imageUrl,
        link: link
      });
    }
    return list;
  }

  async getPopular(page) {
    const url = `${this.getBaseUrl()}/manga/page/${page}/?m_orderby=views`;
    const doc = await this.request(url);
    const list = this.mangaFromElements(doc, "div.page-item-detail, div.manga__item");
    return { list: list, hasNextPage: list.length > 0 };
  }

  async getLatestUpdates(page) {
    const url = `${this.getBaseUrl()}/manga/page/${page}/?m_orderby=latest`;
    const doc = await this.request(url);
    const list = this.mangaFromElements(doc, "div.page-item-detail, div.manga__item");
    return { list: list, hasNextPage: list.length > 0 };
  }

  async search(query, page, filters) {
    if (!query) {
      query = "";
    }
    let url = `${this.getBaseUrl()}/page/${page}/?s=${encodeURIComponent(query)}&post_type=wp-manga`;
    const doc = await this.request(url);
    const list = this.mangaFromElements(doc, "div.c-tabs-item__content");
    return { list: list, hasNextPage: list.length > 0 };
  }

  async getDetail(url) {
    const doc = await this.request(url);
    
    const title = doc.selectFirst("div.post-title h1")?.text?.trim() || 
                  doc.selectFirst("div.post-title h3")?.text?.trim() || "";
                  
    const imgEl = doc.selectFirst("div.summary_image img");
    let imageUrl = "";
    if (imgEl) {
      imageUrl = imgEl.attr("data-src") || imgEl.attr("data-lazy-src") || imgEl.getSrc || "";
      imageUrl = imageUrl.trim();
    }
    
    const author = doc.selectFirst("div.author-content a")?.text?.trim() || "";
    
    const descEls = doc.select("div.description-summary div.summary__content, div.summary_content div.post-content_item > h5 + div, div.summary_content div.manga-excerpt, .manga-summary, div.c-page__content div.modal-contenido");
    let description = "";
    if (descEls && descEls.length > 0) {
      const pTexts = [];
      for (const e of descEls) {
        const pList = e.select("p");
        if (pList && pList.length > 0) {
          for (const p of pList) {
            if (p.text.trim().length > 0) {
              pTexts.push(p.text.replace(/<br>/g, "\n").trim());
            }
          }
        } else if (e.text.trim().length > 0) {
          pTexts.push(e.text.trim());
        }
      }
      description = pTexts.join("\n\n");
    }
    
    const statusText = doc.selectFirst(".summary-content > .tags-content, div.summary-content, div.summary-heading:contains(Status) + div")?.text?.trim() || "";
    const status = this.toStatus(statusText);
    
    const genreEls = doc.select("div.genres-content a");
    const genre = [];
    if (genreEls) {
      for (const e of genreEls) {
        genre.push(e.text.trim());
      }
    }
    
    const mangaId = doc.selectFirst("div[id^=manga-chapters-holder]")?.attr("data-id") || "";
    
    let chapters = [];
    if (mangaId) {
      const client = new Client();
      const headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        "Referer": `${this.getBaseUrl()}/`,
        "X-Requested-With": "XMLHttpRequest"
      };
      
      let res = await client.post(
        `${this.getBaseUrl()}/wp-admin/admin-ajax.php`,
        headers,
        `action=manga_get_chapters&manga=${mangaId}`
      );
      
      let chapDoc = new Document(res.body);
      chapters = this.getChaptersFromHtml(chapDoc);
      
      if (chapters.length === 0) {
        let ajaxUrl = url.endsWith('/') ? url + 'ajax/chapters/' : url + '/ajax/chapters/';
        res = await client.post(
          ajaxUrl,
          headers,
          ""
        );
        chapDoc = new Document(res.body);
        chapters = this.getChaptersFromHtml(chapDoc);
      }
    }
    
    const recommendations = [];
    const relEls = doc.select("div.related-reading-wrap");
    for (const el of relEls) {
      const aEl = el.selectFirst("a");
      if (aEl) {
        const name = aEl.attr("title")?.trim() || el.selectFirst("h5.widget-title")?.text?.trim() || "";
        const link = aEl.getHref;
        
        const imgEl = el.selectFirst("img");
        let imageUrl = "";
        if (imgEl) {
          imageUrl = imgEl.attr("data-src") || imgEl.attr("data-lazy-src") || imgEl.getSrc || imgEl.attr("src") || "";
          imageUrl = imageUrl.trim().split(" ")[0];
        }
        
        if (name && link) {
          recommendations.push({
            name: name,
            imageUrl: imageUrl,
            link: link
          });
        }
      }
    }
    
    console.log("Manga Spark Recommendations parsed count: " + recommendations.length);
    
    return {
      title,
      imageUrl,
      description,
      author,
      status,
      genre,
      chapters,
      recommendations
    };
  }

  getChaptersFromHtml(chapDoc) {
    const list = [];
    const elements = chapDoc.select("li.wp-manga-chapter");
    if (elements) {
      for (const el of elements) {
        const a = el.selectFirst("a");
        if (a) {
          let url = a.getHref || "";
          if (url.includes("?style=paged")) {
            url = url.split("?style=paged")[0] + "?style=paged";
          } else {
            url = url.split("?style=paged")[0];
          }
          
          let dateUpload = "0";
          const dateEl = el.selectFirst("span.chapter-release-date");
          if (dateEl && dateEl.text.trim().length > 0) {
            dateUpload = new Date().getTime().toString();
          }
          
          list.push({
            name: a.text.trim(),
            url: url,
            dateUpload: dateUpload
          });
        }
      }
    }
    return list;
  }

  async getPageList(url) {
    const doc = await this.request(url);
    const elements = doc.select("div.page-break img, li.blocks-gallery-item img, .reading-content .text-left img, .reading-content img");
    const pages = [];
    const seen = new Set();
    
    if (elements) {
      for (const e of elements) {
        let imageUrl = e.attr("data-src") || e.attr("data-lazy-src") || e.attr("srcset")?.split(" ")[0] || e.getSrc || "";
        imageUrl = imageUrl.trim();
        if (imageUrl.length > 0 && !seen.has(imageUrl)) {
          seen.add(imageUrl);
          pages.push({ url: imageUrl });
        }
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
          value: "https://manga-spark.net",
          dialogTitle: "URL",
          dialogMessage: "",
        },
      },
    ];
  }
}
