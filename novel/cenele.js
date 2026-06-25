const mangayomiSources = [{
    "id": 498162839,
    "name": "فضاء الروايات",
    "lang": "ar",
    "baseUrl": "https://cenele.com",
    "apiUrl": "",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://cenele.com",
    "typeSource": "single",
    "itemType": 2, // Novel
    "version": "0.0.1",
    "pkgPath": "novel/cenele.js",
    "notes": "Novel Space JS Extension"
}];

class DefaultExtension extends MProvider {
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://cenele.com/",
    };

    getHeaders(url) {
        return this.headers;
    }

    getBaseUrl() {
        const preference = new SharedPreferences();
        const baseUrl = preference.get("domain_url");
        if (!baseUrl || baseUrl.length === 0) {
            return this.source.baseUrl;
        }
        if (baseUrl.endsWith("/")) {
            return baseUrl.slice(0, -1);
        }
        return baseUrl;
    }

    toFormBody(details) {
        var formBody = [];
        for (var property in details) {
            var encodedKey = encodeURIComponent(property);
            var encodedValue = encodeURIComponent(details[property]);
            formBody.push(encodedKey + "=" + encodedValue);
        }
        return formBody.join("&");
    }

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

    parseArabicDate(dateStr) {
        if (!dateStr) return "0";
        const months = {
            "يناير": 0, "فبراير": 1, "مارس": 2, "أبريل": 3, "مايو": 4, "يونيو": 5,
            "يوليو": 6, "أغسطس": 7, "سبتمبر": 8, "أكتوبر": 9, "نوفمبر": 10, "ديسمبر": 11
        };
        let cleaned = dateStr.trim();
        const parts = cleaned.split(/\s+/);
        if (parts.length >= 3) {
            const monthName = parts[0];
            const day = parseInt(parts[1].replace(",", ""), 10);
            const year = parseInt(parts[2], 10);
            const month = months[monthName];
            if (month !== undefined && !isNaN(day) && !isNaN(year)) {
                return new Date(year, month, day).getTime().toString();
            }
        }
        return "0";
    }

    mangaFromElements(doc) {
        const list = [];
        const cards = doc.select("div.page-item-detail, div.c-tabs-item__content");
        for (const card of cards) {
            const titleEl = card.selectFirst("h3 a") || card.selectFirst(".post-title a") || card.selectFirst(".tab-thumb a") || card.selectFirst("a[title]");
            const imgEl = card.selectFirst("img");
            if (titleEl && imgEl) {
                const name = titleEl.text.trim();
                const link = titleEl.getHref;
                const imageUrl = imgEl.attr("data-src") || imgEl.attr("data-lazy-src") || imgEl.getSrc || imgEl.attr("src") || "";
                list.push({
                    name: name,
                    imageUrl: imageUrl.trim(),
                    link: link
                });
            }
        }
        return list;
    }

    async getPopular(page) {
        const url = `${this.getBaseUrl()}/cont/page/${page}/?m_orderby=views`;
        const client = new Client();
        const res = await client.get(url, this.getHeaders(url));
        if (res.statusCode !== 200) {
            throw new Error(`Failed to fetch popular list: ${res.statusCode}`);
        }
        const doc = new Document(res.body);
        const list = this.mangaFromElements(doc);
        return { list: list, hasNextPage: list.length > 0 };
    }

    async getLatestUpdates(page) {
        const url = `${this.getBaseUrl()}/cont/page/${page}/?m_orderby=latest`;
        const client = new Client();
        const res = await client.get(url, this.getHeaders(url));
        if (res.statusCode !== 200) {
            throw new Error(`Failed to fetch latest list: ${res.statusCode}`);
        }
        const doc = new Document(res.body);
        const list = this.mangaFromElements(doc);
        return { list: list, hasNextPage: list.length > 0 };
    }

    async search(query, page, filters) {
        if (!query) {
            query = "";
        }
        const url = `${this.getBaseUrl()}/page/${page}/?s=${encodeURIComponent(query)}&post_type=wp-manga`;
        const client = new Client();
        const res = await client.get(url, this.getHeaders(url));
        if (res.statusCode !== 200) {
            throw new Error(`Failed to fetch search list: ${res.statusCode}`);
        }
        const doc = new Document(res.body);
        const list = this.mangaFromElements(doc);
        return { list: list, hasNextPage: list.length > 0 };
    }

    async getDetail(url) {
        const client = new Client();
        const res = await client.get(url, this.getHeaders(url));
        if (res.statusCode !== 200) {
            throw new Error(`Failed to fetch detail: ${res.statusCode}`);
        }
        const html = res.body;
        const doc = new Document(html);
        
        const title = doc.selectFirst("div.post-title h1")?.text?.trim() || 
                      doc.selectFirst("div.post-title h3")?.text?.trim() || "";
                      
        const imgEl = doc.selectFirst("div.summary_image img");
        let imageUrl = "";
        if (imgEl) {
            imageUrl = imgEl.attr("data-src") || imgEl.attr("data-lazy-src") || imgEl.getSrc || imgEl.attr("src") || "";
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
        
        // Custom Volume & Chapters Extraction
        const mangaId = doc.selectFirst(".nhv-simple-rating, #nhv-synopsis-readmore, [data-post-id]")?.attr("data-post-id") || "";
        if (!mangaId) {
            throw new Error("Could not find novel ID on page");
        }
        
        const nonceMatch = html.match(/var nhvMangaSingleAjax\s*=\s*({[^}]+})/);
        let nonce = "";
        if (nonceMatch) {
            try {
                const config = JSON.parse(nonceMatch[1]);
                nonce = config.nonce || "";
            } catch (e) {}
        }
        
        const ajaxUrl = `${this.getBaseUrl()}/wp-admin/admin-ajax.php`;
        const ajaxHeaders = {
            "Content-Type": "application/x-www-form-urlencoded",
            "Referer": url,
            "User-Agent": this.headers["User-Agent"]
        };
        
        // Step 1: Fetch Volumes Meta
        const metaData = {
            action: "nhv_manga_single_chapters_page",
            nonce: nonce,
            manga_id: mangaId,
            meta_only: "1"
        };
        const mRes = await client.post(ajaxUrl, ajaxHeaders, this.toFormBody(metaData));
        const mJson = JSON.parse(mRes.body);
        if (!mJson || !mJson.success) {
            throw new Error("Failed to fetch volumes metadata");
        }
        
        const volumes = Array.isArray(mJson.volumes) ? mJson.volumes : [];
        const chapters = [];
        
        // Step 2: Fetch Chapters for each volume
        for (const vol of volumes) {
            const volNum = vol.num;
            let page = 1;
            let hasMore = true;
            while (hasMore) {
                const chapData = {
                    action: "nhv_manga_single_chapters_page",
                    nonce: nonce,
                    manga_id: mangaId,
                    volume: volNum.toString(),
                    page: page.toString(),
                    per_page: "200", // Large chunk to minimize requests
                    order: "asc" // Keep logical order
                };
                const cRes = await client.post(ajaxUrl, ajaxHeaders, this.toFormBody(chapData));
                const cJson = JSON.parse(cRes.body);
                if (!cJson || !cJson.success) break;
                
                const cDoc = new Document(cJson.html);
                const liElements = cDoc.select('li.wp-manga-chapter');
                for (const li of liElements) {
                    const aEl = li.selectFirst('a');
                    if (aEl) {
                        const href = aEl.getHref;
                        const spanSub = aEl.selectFirst('span.nhv-chapter-name');
                        const subtitle = spanSub ? spanSub.text.trim() : "";
                        
                        let mainTitle = aEl.text.trim();
                        if (subtitle && mainTitle.endsWith(subtitle)) {
                            mainTitle = mainTitle.slice(0, -subtitle.length).trim();
                        }
                        
                        // Clean up any trailing colons, dashes or spaces left over from splitting the subtitle
                        mainTitle = mainTitle.replace(/[\s:-]+$/, "").trim();
                        
                        let chapterName;
                        if (subtitle) {
                            const cleanedMain = mainTitle.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, "");
                            const cleanedSub = subtitle.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, "");
                            if (cleanedMain.includes(cleanedSub)) {
                                chapterName = mainTitle;
                            } else {
                                chapterName = `${mainTitle} : ${subtitle}`;
                            }
                        } else {
                            chapterName = mainTitle;
                        }
                        
                        const dateEl = li.selectFirst('.chapter-release-date');
                        const dateStr = dateEl ? dateEl.text.trim() : "";
                        const dateUpload = this.parseArabicDate(dateStr);
                        
                        chapters.push({
                            name: chapterName,
                            url: href,
                            dateUpload: dateUpload
                        });
                    }
                }
                hasMore = !!cJson.has_more;
                page++;
            }
        }
        
        // Reverse to have the latest chapter first in Mangayomi
        chapters.reverse();
        
        return {
            name: title,
            imageUrl: imageUrl,
            description: description,
            author: author,
            status: status,
            genre: genre,
            chapters: chapters
        };
    }

    async getHtmlContent(name, url) {
        const client = new Client();
        const res = await client.get(url, this.getHeaders(url));
        if (res.statusCode !== 200) {
            throw new Error(`Failed to fetch chapter content: ${res.statusCode}`);
        }
        const doc = new Document(res.body);
        const title = doc.selectFirst("h1.entry-title")?.text?.trim() || name;
        
        let contentEl = doc.selectFirst("div.reading-content") || doc.selectFirst("div.entry-content");
        if (!contentEl) {
            throw new Error("Could not find chapter content in HTML");
        }
        
        return `<h2 style="text-align: center;">${title}</h2><hr><br>${contentEl.outerHtml}`;
    }

    getFilterList() {
        return [];
    }

    getSourcePreferences() {
        return [
            {
                key: "domain_url",
                editTextPreference: {
                    title: "Override Base URL",
                    summary: "",
                    value: "https://cenele.com",
                    dialogTitle: "Override Base URL",
                    dialogMessage: ""
                }
            }
        ];
    }
}
