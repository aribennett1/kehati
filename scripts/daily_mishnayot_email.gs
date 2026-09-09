const CONFIG = {
  dataBaseUrl: "https://aribennett1.github.io/kehati",
  recipient: PropertiesService.getScriptProperties().getProperty("RECIPIENT_EMAIL"),
  countPerEmail: 2,
};

function sendDailyMishnayot() {
  if (!CONFIG.recipient) throw new Error("Missing script property RECIPIENT_EMAIL");

  const index = fetchJson("data/index.json");
  const ordered = index.mishnayot;
  const lastSent = PropertiesService.getScriptProperties().getProperty("lastSent");
  const startIndex = getNextIndex(ordered, lastSent);
  const batch = ordered.slice(startIndex, startIndex + CONFIG.countPerEmail);

  if (!batch.length) {
    PropertiesService.getScriptProperties().deleteProperty("lastSent");
    return;
  }

  const masechtotById = mapById(index.masechtot);
  const sedarimById = mapById(index.sedarim);
  const loaded = {};
  const rows = batch.map((meta) => {
    if (!loaded[meta.massechet_id]) {
      loaded[meta.massechet_id] = fetchJson(`data/masechtot/${meta.massechet_id}.json`);
    }
    const mishna = loaded[meta.massechet_id].find((item) => item.id === meta.id);
    const masechet = masechtotById[mishna.massechet_id];
    const seder = sedarimById[masechet.seder_id];
    return { mishna, masechet, seder };
  });

  const last = rows[rows.length - 1].mishna;
  const subject = `Mishnayot: ${rows.map(({ mishna, masechet }) => `${masechet.he_name} ${mishna.perek}:${mishna.mishna_num}`).join(", ")}`;
  const htmlBody = renderEmail(rows);

  MailApp.sendEmail({
    to: CONFIG.recipient,
    subject,
    body: stripHtml(htmlBody),
    htmlBody,
  });
  console.log(`RemainingDailyQuota: ${MailApp.getRemainingDailyQuota()}`);
  PropertiesService.getScriptProperties().setProperty(
    "lastSent",
    `${last.massechet_id}:${last.perek}:${last.mishna_num}`
  );
}

function resetDailyMishnayot() {
  PropertiesService.getScriptProperties().deleteProperty("lastSent");
}

function getNextIndex(ordered, lastSent) {
  if (!lastSent) return 0;
  const parts = lastSent.split(":").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return 0;

  const index = ordered.findIndex((item) => {
    return item.massechet_id === parts[0] && item.perek === parts[1] && item.mishna_num === parts[2];
  });

  return index < 0 ? 0 : index + 1;
}

function fetchJson(path) {
  const base = CONFIG.dataBaseUrl.replace(/\/$/, "");
  const url = `${base}/${path}`;
  const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const status = response.getResponseCode();
  if (status < 200 || status >= 300) throw new Error(`Fetch failed (${status}): ${url}`);
  return JSON.parse(response.getContentText());
}

function mapById(items) {
  return items.reduce((map, item) => {
    map[item.id] = item;
    return map;
  }, {});
}

function renderEmail(rows) {
  return `
    <!doctype html>
    <html dir="rtl" lang="he">
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            margin: 0;
            padding: 24px;
            background: #fbfaf7;
            color: #1d2528;
            font-family: Arial, "Noto Sans Hebrew", sans-serif;
            direction: rtl;
            text-align: right;
          }
          .wrap {
            max-width: 760px;
            margin: 0 auto;
            direction: rtl;
          }
          .item {
            padding: 0 0 28px;
            margin: 0 0 28px;
            border-bottom: 1px solid #d9dddc;
          }
          .meta {
            color: #657174;
            font-size: 14px;
            margin: 0 0 6px;
            direction: rtl;
            unicode-bidi: isolate;
          }
          h1 {
            margin: 0 0 18px;
            font-size: 28px;
            line-height: 1.25;
            direction: rtl;
            text-align: right;
            unicode-bidi: isolate;
          }
          h2 {
            color: #176c5c;
            font-size: 17px;
            margin: 28px 0 8px;
          }
          .mishna {
            font-size: 22px;
            line-height: 1.8;
            font-weight: 700;
            direction: rtl;
            text-align: right;
            unicode-bidi: isolate;
          }
          .kehati {
            font-size: 21px;
            line-height: 1.9;
            direction: rtl;
            text-align: right;
            unicode-bidi: isolate;
          }
          .mishna p {
            display: inline;
            margin: 0;
          }
          .mishna p::after {
            content: " ";
          }
          .kehati .i {
            font-weight: 700;
          }
          .kehati .h,
          .kehati .k,
          .kehati .l,
          .kehati .m {
            font-weight: 400;
            color: #394346;
          }
          .kehati .k,
          .kehati .m {
            font-size: 0.9em;
          }
          p {
            margin: 0 0 0.55em;
          }
          img {
            max-width: 100%;
            height: auto;
          }
        </style>
      </head>
      <body>
        <div class="wrap" dir="rtl" style="direction: rtl; text-align: right;">
          ${rows.map(renderMishna).join("")}
        </div>
      </body>
    </html>
  `;
}

function renderMishna({ mishna, masechet, seder }) {
  const title = `${masechet.he_name} פרק ${mishna.perek} משנה ${mishna.mishna_num}`;
  return `
    <section class="item" dir="rtl" style="direction: rtl; text-align: right;">
      <p class="meta" dir="rtl" style="direction: rtl; text-align: right;">${seder.he_name} / ${masechet.en_name}</p>
      <h1 dir="rtl" style="direction: rtl; text-align: right;">${title}</h1>
      <h2>משנה</h2>
      <div class="mishna" dir="rtl" style="direction: rtl; text-align: right;">${fixAssetUrls(mishna.mishna_sdura || mishna.mishna_txt)}</div>
      <h2>קהתי</h2>
      <div class="kehati" dir="rtl" style="direction: rtl; text-align: right;">${fixAssetUrls(mishna.kehati_txt || "")}</div>
    </section>
  `;
}

function fixAssetUrls(html) {
  const base = CONFIG.dataBaseUrl.replace(/\/$/, "");
  return String(html || "")
    .replace(/file:\/\/\/android_asset\//g, `${base}/assets/`)
    .replace(/\b(src|href)=(["'])assets\//g, `$1=$2${base}/assets/`)
    .replace(/\b(src|href)=(["'])pics\//g, `$1=$2${base}/assets/pics/`)
    .replace(/<img\b[^>]*\bsrc=["']images\/[^"']+["'][^>]*>/g, "");
}

function stripHtml(html) {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}
