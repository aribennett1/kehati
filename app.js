const state = {
  index: null,
  loadedMasechtot: new Map(),
  currentId: 1,
  introNextId: null,
  visible: {
    kehati: true,
    bartenura: true,
    english: false,
  },
};

const els = {
  nav: document.querySelector("#nav"),
  menuButton: document.querySelector("#menuButton"),
  drawerBackdrop: document.querySelector("#drawerBackdrop"),
  sidebar: document.querySelector("#sidebar"),
  search: document.querySelector("#search"),
  breadcrumb: document.querySelector("#breadcrumb"),
  title: document.querySelector("#title"),
  prev: document.querySelector("#prev"),
  next: document.querySelector("#next"),
  mishnaText: document.querySelector("#mishnaText"),
  kehatiText: document.querySelector("#kehatiText"),
  bartenuraText: document.querySelector("#bartenuraText"),
  englishText: document.querySelector("#englishText"),
  introText: document.querySelector("#introText"),
  introPanel: document.querySelector("#introPanel"),
  mishnaPanel: document.querySelector("#mishnaPanel"),
  kehatiPanel: document.querySelector("#kehatiPanel"),
  bartenuraPanel: document.querySelector("#bartenuraPanel"),
  englishPanel: document.querySelector("#englishPanel"),
};

function byId(list) {
  return new Map(list.map((item) => [item.id, item]));
}

function normalize(value) {
  return String(value || "").toLocaleLowerCase();
}

function setHash(id) {
  history.replaceState(null, "", `#mishna-${id}`);
}

function setMenuOpen(open) {
  document.body.classList.toggle("menu-open", open);
  els.menuButton.setAttribute("aria-expanded", String(open));
  els.menuButton.setAttribute("aria-label", open ? "סגור תפריט" : "פתח תפריט");
  els.drawerBackdrop.hidden = !open;
}

function closeMenuOnMobile() {
  if (window.matchMedia("(max-width: 760px)").matches) {
    setMenuOpen(false);
  }
}

function parseHash() {
  const introMatch = location.hash.match(/intro-(\d+)/);
  if (introMatch) return { type: "intro", id: Number(introMatch[1]) };
  const match = location.hash.match(/mishna-(\d+)/);
  return { type: "mishna", id: match ? Number(match[1]) : 1 };
}

function mishnaMeta(id) {
  return state.index.mishnayot.find((item) => item.id === id) || state.index.mishnayot[0];
}

function hebrewNumber(number) {
  const letters = {
    1: "א",
    2: "ב",
    3: "ג",
    4: "ד",
    5: "ה",
    6: "ו",
    7: "ז",
    8: "ח",
    9: "ט",
    10: "י",
    11: "יא",
    12: "יב",
    13: "יג",
    14: "יד",
    15: "טו",
    16: "טז",
    17: "יז",
    18: "יח",
    19: "יט",
    20: "כ",
    21: "כא",
    22: "כב",
    23: "כג",
    24: "כד",
    25: "כה",
    26: "כו",
    27: "כז",
    28: "כח",
    29: "כט",
    30: "ל",
  };
  return letters[number] || String(number);
}

function hasIntro(masechet) {
  const introText = masechet.hakdama_txt || "";
  const introPlain = introText.replace(/<[^>]*>/g, "").replace(/\s|\uFEFF/g, "");
  return Boolean(introPlain && introPlain !== ".");
}

async function loadMasechet(massechetId) {
  if (!state.loadedMasechtot.has(massechetId)) {
    const rows = await fetch(`data/masechtot/${massechetId}.json`).then((response) => response.json());
    state.loadedMasechtot.set(massechetId, rows);
  }
  return state.loadedMasechtot.get(massechetId);
}

function renderNav(filter = "") {
  const sedarimById = byId(state.index.sedarim);
  const current = mishnaMeta(state.currentId);
  const currentMasechet = state.index.masechtot.find((item) => item.id === current.massechet_id);
  const masechtot = state.index.masechtot.filter((masechet) => {
    if (!filter) return true;
    const needle = normalize(filter);
    return normalize(`${masechet.he_name} ${masechet.en_name}`).includes(needle);
  });
  const groups = new Map();

  for (const masechet of masechtot) {
    const seder = sedarimById.get(masechet.seder_id);
    if (!groups.has(seder.id)) groups.set(seder.id, { seder, items: [] });
    groups.get(seder.id).items.push(masechet);
  }

  els.nav.innerHTML = "";
  for (const group of groups.values()) {
    const sederDetails = document.createElement("details");
    sederDetails.className = "seder-group";
    sederDetails.open = Boolean(filter) || group.seder.id === currentMasechet?.seder_id;

    const heading = document.createElement("summary");
    heading.className = "seder";
    heading.textContent = `${group.seder.he_name} · ${group.seder.en_name}`;
    sederDetails.append(heading);

    for (const masechet of group.items) {
      const perakim = state.index.perakim.filter((perek) => perek.massechet_id === masechet.id);
      const details = document.createElement("details");
      details.className = "masechet-group";
      details.open = Boolean(filter) || masechet.id === current.massechet_id;
      const summary = document.createElement("summary");
      summary.className = "nav-item";
      summary.innerHTML = `${masechet.he_name} <small>${masechet.en_name}</small>`;
      details.append(summary);

      if (hasIntro(masechet)) {
        const introButton = document.createElement("button");
        introButton.className = "nav-item";
        introButton.type = "button";
        introButton.dataset.intro = masechet.id;
        introButton.textContent = "הקדמה";
        introButton.addEventListener("click", () => {
          showIntro(masechet.id);
        });
        details.append(introButton);
      }

      for (const perek of perakim) {
        const perekDetails = document.createElement("details");
        perekDetails.className = "perek-group";
        perekDetails.open = Boolean(filter) || (
          masechet.id === current.massechet_id && perek.perek_num === current.perek
        );

        const perekSummary = document.createElement("summary");
        perekSummary.className = "nav-item";
        perekSummary.dataset.id = perek.from_mishna;
        perekSummary.textContent = `פרק ${perek.perek_num}`;
        perekDetails.append(perekSummary);

        const mishnayot = state.index.mishnayot.filter((mishna) => {
          return mishna.massechet_id === masechet.id && mishna.perek === perek.perek_num;
        });

        for (const mishna of mishnayot) {
          const button = document.createElement("button");
          button.className = "nav-item mishna-link";
          button.type = "button";
          button.dataset.id = mishna.id;
          button.textContent = `משנה ${hebrewNumber(mishna.mishna_num)}`;
          button.addEventListener("click", () => {
            showMishna(mishna.id);
          });
          perekDetails.append(button);
        }

        details.append(perekDetails);
      }

      sederDetails.append(details);
    }

    els.nav.append(sederDetails);
  }
}

function showIntro(masechetId) {
  const masechet = state.index.masechtot.find((item) => item.id === masechetId);
  const seder = state.index.sedarim.find((item) => item.id === masechet.seder_id);
  const firstMishna = state.index.mishnayot.find((item) => item.massechet_id === masechetId);

  state.currentId = firstMishna?.id || state.currentId;
  history.replaceState(null, "", `#intro-${masechet.id}`);

  els.breadcrumb.textContent = `${seder.he_name} / ${masechet.he_name}`;
  els.title.textContent = `${masechet.he_name} הקדמה`;
  els.introText.innerHTML = masechet.hakdama_txt || "";

  els.introPanel.hidden = false;
  els.mishnaPanel.hidden = true;
  els.kehatiPanel.hidden = true;
  els.bartenuraPanel.hidden = true;
  els.englishPanel.hidden = true;

  els.prev.disabled = true;
  els.next.disabled = !firstMishna;
  state.introNextId = firstMishna?.id || null;

  document.querySelectorAll(".nav-item.active").forEach((item) => item.classList.remove("active"));
  const navItem = document.querySelector(`.nav-item[data-intro="${masechet.id}"]`);
  if (navItem) navItem.classList.add("active");
  closeMenuOnMobile();
}

async function showMishna(id) {
  const meta = mishnaMeta(id);
  const rows = await loadMasechet(meta.massechet_id);
  const mishna = rows.find((item) => item.id === meta.id) || rows[0];
  const masechet = state.index.masechtot.find((item) => item.id === mishna.massechet_id);
  const seder = state.index.sedarim.find((item) => item.id === masechet.seder_id);

  state.currentId = mishna.id;
  setHash(mishna.id);

  els.breadcrumb.textContent = `${seder.he_name} / ${masechet.he_name}`;
  els.title.textContent = `${masechet.he_name} פרק ${mishna.perek} משנה ${mishna.mishna_num}`;
  els.mishnaText.innerHTML = mishna.mishna_sdura || mishna.mishna_txt;
  els.kehatiText.innerHTML = mishna.kehati_txt || "";
  els.bartenuraText.innerHTML = mishna.bartenura_txt || "";
  els.englishText.innerHTML = mishna.english_txt || "";

  els.introPanel.hidden = true;
  els.mishnaPanel.hidden = false;
  els.kehatiPanel.hidden = !state.visible.kehati;
  els.bartenuraPanel.hidden = !state.visible.bartenura;
  els.englishPanel.hidden = !state.visible.english;

  els.prev.disabled = mishna.id <= state.index.mishnayot[0].id;
  els.next.disabled = mishna.id >= state.index.mishnayot[state.index.mishnayot.length - 1].id;
  state.introNextId = null;

  document.querySelectorAll(".nav-item.active").forEach((item) => item.classList.remove("active"));
  const navItem = document.querySelector(`.nav-item[data-id="${mishna.id}"]`);
  if (navItem) navItem.classList.add("active");
  closeMenuOnMobile();
}

function setPanel(panel, visible) {
  state.visible[panel] = visible;
  document.querySelector(`[data-panel="${panel}"]`).classList.toggle("active", visible);
  els[`${panel}Panel`].hidden = !visible;
}

async function init() {
  const index = await fetch("data/index.json").then((response) => response.json());

  state.index = index;

  renderNav();
  const initial = parseHash();
  if (initial.type === "intro") {
    showIntro(initial.id);
  } else {
    await showMishna(initial.id);
  }

  els.search.addEventListener("input", () => renderNav(els.search.value));
  els.menuButton.addEventListener("click", () => {
    setMenuOpen(!document.body.classList.contains("menu-open"));
  });
  els.drawerBackdrop.addEventListener("click", () => setMenuOpen(false));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setMenuOpen(false);
  });
  els.prev.addEventListener("click", () => {
    showMishna(Math.max(state.index.mishnayot[0].id, state.currentId - 1));
  });
  els.next.addEventListener("click", () => {
    if (state.introNextId) {
      showMishna(state.introNextId);
      return;
    }
    showMishna(Math.min(state.index.mishnayot[state.index.mishnayot.length - 1].id, state.currentId + 1));
  });

  document.querySelectorAll("[data-panel]").forEach((button) => {
    button.addEventListener("click", () => {
      const panel = button.dataset.panel;
      setPanel(panel, !state.visible[panel]);
    });
  });
}

init().catch((error) => {
  els.title.textContent = "Could not load Mishnayot";
  els.mishnaText.textContent = error.message;
});
