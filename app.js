"use strict";

const KEY = "blocklist-multi:v1";

// ====== LISTES PAR DÉFAUT : écris-les ici, un compte par ligne, avec ou sans @ ======
// Une liste par réseau (identifiants du réseau concerné : ce qui suit le @ dans l'adresse du profil).
const DEFAULT_USERS = {
  instagram: `
@marine_lepen
@jordanbardella
@ericzemmour_
@marionmarechal_
@sarahknafo1
@eciotti
@bruno_retailleau
@pascalpraud
@laurentjacobelli
@tanguyjeanphilippe
@cyrilhanouna
@milafique
@messiha.jean
@rachel_khan88
@davidlisnard
@emmanuelmacron
@bassem.6920
@louisemontangon
@jordanflorentin_
@adlaurent_fit
@tanguydavidofficiel_
@gerald_darmanin
@liamdibenedettooff
@alice_cordier_
@thefrenchitch
@rassemblementnational_fr
@frontieresmedia
@cnews
@bfmtv
@reconquete_officiel
@tbt9w9
@lesrepublicains
@partiudr
@valeurs_actuelles
@va_plus
@collectif.nemesis
@kalos.france
`,
  tiktok: `
@brunoretailleauoff
@cyrilhanouna_officiel
@milafique
@jeanmessiha
@emmanuelmacron
@ugogiljimenez
@bassem69.officiel
@jordanflorentinlevrai
@tanguydavid
@gdarmanin.officiel
@alex.hitchen98
@rnational_off
@frontieresmedia
@cnews
@bfmtv
@reconqueteofficiel
@tbt9_w9
@lesrepublicains
@partiudr
@valeursactuelles
@collectif.nemesis
@kalosfrance
`,
  x: `
@milafique
@jeanmessiha
@khannrachel
@davidlisnard
@emmanuelmacron
@papacitofdp
@bassemth69
@jordanflrtn
@tanguy_france
@gdarmanin
@cordieralice2
@rnational_off
@frontieresmedia
@cnews
@bfmtv
@reconquete_off
@tbt9_w9
@lesrepublicains
@deputeshorizons
@partiudr
@valeurs
@vaplus_
@coll_nemesis
`
};
// Quand tu modifies les listes ci-dessus, augmente ce numéro : les nouveaux comptes
// seront ajoutés chez ceux qui ont déjà l'extension (sans toucher à leurs statuts).
const LIST_VERSION = 1;
// ====================================================================================

const PLATFORM_KEYS = ["instagram", "tiktok", "x"];
const PREFIX = { instagram: "instagram", ig: "instagram", tiktok: "tiktok", tt: "tiktok", twitter: "x", x: "x" };

// Règles propres à chaque réseau. Les tâches (pageTask…) sont définies plus bas.
const PLATFORMS = {
  instagram: {
    label: "Instagram",
    fromUrl: /instagram\.com\/([^\/?#\s]+)/i,
    reserved: ["p", "reel", "reels", "explore", "stories", "accounts", "direct", "tv"],
    valid: (t) => /^[a-z0-9._]{1,30}$/.test(t) && /[a-z0-9_]/.test(t),
    url: (n) => "https://www.instagram.com/" + encodeURIComponent(n) + "/",
    task: pageTaskInstagram
  },
  tiktok: {
    label: "TikTok",
    fromUrl: /tiktok\.com\/@([^\/?#\s]+)/i,
    reserved: ["video", "tag", "discover", "foryou", "following", "live", "explore", "upload", "login", "music", "search", "friends", "messages"],
    valid: (t) => /^[a-z0-9._]{2,24}$/.test(t) && t.slice(-1) !== "." && /[a-z0-9_]/.test(t),
    url: (n) => "https://www.tiktok.com/@" + encodeURIComponent(n),
    task: pageTaskTikTok
  },
  x: {
    label: "X",
    fromUrl: /(?:^|[\/.])(?:x|twitter)\.com\/@?([^\/?#\s]+)/i,
    reserved: ["home", "explore", "notifications", "messages", "i", "search", "settings", "compose", "intent", "share", "hashtag", "login", "signup", "tos", "privacy", "about"],
    valid: (t) => /^[a-z0-9_]{1,15}$/.test(t),
    url: (n) => "https://x.com/" + encodeURIComponent(n),
    task: pageTaskX
  }
};

const LABELS = {
  todo: "À faire",
  running: "En cours",
  blocked: "Bloqué",
  already: "Déjà bloqué",
  missing: "Introuvable",
  failed: "Échec"
};
const DONE = ["blocked", "already", "missing"];

let state = { min: 20, max: 45, listVersion: 0, platforms: {} };
PLATFORM_KEYS.forEach((k) => {
  state.platforms[k] = { enabled: true, users: [] };
});
let running = false;
let stopRequested = false;
let tabId = null;
let winId = null;
const notes = {}; // message affiché sous chaque réseau pendant/après une exécution
let activePlatform = null; // réseau en cours de traitement (mis en évidence)
const lastActive = {}; // dernier compte traité par réseau (la liste défile jusqu'à lui)
const ui = {}; // éléments d'interface de chaque réseau

const $ = (id) => document.getElementById(id);

/* ---------- Minuteur fiable (Worker, non ralenti en arrière-plan) ---------- */

const ticker = new Worker("ticker.js");
const pending = new Map();
let seq = 0;
ticker.onmessage = (e) => {
  const resolve = pending.get(e.data);
  if (resolve) {
    pending.delete(e.data);
    resolve();
  }
};
function sleep(ms) {
  return new Promise((resolve) => {
    const id = ++seq;
    pending.set(id, resolve);
    ticker.postMessage({ id, ms });
  });
}

/* ---------- Lecture d'une liste (tous réseaux) ---------- */

// Reconnaît un compte écrit de plusieurs façons :
//   - un lien de profil (instagram.com/…, tiktok.com/@…, x.com/…, twitter.com/…)
//   - un préfixe : instagram:nom  tiktok:nom  x:nom  (ig: et tt: acceptés)
//   - un nom seul (@nom), rattaché au réseau « defaultPlatform » s'il est fourni
function parseTokens(text, defaultPlatform) {
  const lists = {};
  const seen = {};
  PLATFORM_KEYS.forEach((k) => {
    lists[k] = [];
    seen[k] = {};
  });
  const ignored = [];
  String(text || "")
    .split(/[\s,;]+/)
    .forEach((tok) => {
      let t = tok.trim();
      if (!t) return;
      let platform = null;
      for (let i = 0; i < PLATFORM_KEYS.length && !platform; i++) {
        const m = t.match(PLATFORMS[PLATFORM_KEYS[i]].fromUrl);
        if (m) {
          platform = PLATFORM_KEYS[i];
          t = m[1];
        }
      }
      if (!platform) {
        const m = t.match(/^(instagram|ig|tiktok|tt|twitter|x):@?(.+)$/i);
        if (m) {
          platform = PREFIX[m[1].toLowerCase()];
          t = m[2];
        }
      }
      if (!platform) platform = defaultPlatform || null;
      if (!platform) {
        ignored.push(tok);
        return;
      }
      t = t.replace(/^@+/, "").toLowerCase();
      const P = PLATFORMS[platform];
      if (P.valid(t) && P.reserved.indexOf(t) === -1) {
        if (!seen[platform][t]) {
          seen[platform][t] = true;
          lists[platform].push(t);
        }
      } else {
        ignored.push(tok);
      }
    });
  return { lists, ignored };
}

/* ---------- Stockage ---------- */

async function load() {
  const o = await chrome.storage.local.get(KEY);
  const s = o[KEY];
  if (s && s.platforms) {
    PLATFORM_KEYS.forEach((k) => {
      const sp = s.platforms[k];
      if (!sp || !Array.isArray(sp.users)) return;
      state.platforms[k].enabled = sp.enabled !== false;
      state.platforms[k].users = sp.users
        .filter((u) => u && typeof u.name === "string")
        .map((u) => ({ name: u.name, status: u.status === "running" || !LABELS[u.status] ? "todo" : u.status }));
    });
    if (Number.isFinite(s.min)) state.min = s.min;
    if (Number.isFinite(s.max)) state.max = s.max;
    if (Number.isFinite(s.listVersion)) state.listVersion = s.listVersion;
  }
  // Ajoute les listes par défaut au premier lancement, puis à chaque nouvelle LIST_VERSION.
  if (state.listVersion !== LIST_VERSION) {
    PLATFORM_KEYS.forEach((k) => {
      const have = {};
      state.platforms[k].users.forEach((u) => {
        have[u.name] = true;
      });
      parseTokens(DEFAULT_USERS[k] || "", k).lists[k].forEach((n) => {
        if (!have[n]) state.platforms[k].users.push({ name: n, status: "todo" });
      });
    });
    state.listVersion = LIST_VERSION;
    await save();
  }
}
function save() {
  return chrome.storage.local.set({ [KEY]: state });
}

/* ---------- Interface : sections par réseau ---------- */

function h(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text) e.textContent = text;
  return e;
}

function buildSections() {
  const host = $("networks");
  PLATFORM_KEYS.forEach((k) => {
    const P = PLATFORMS[k];
    const U = {};
    U.section = h("section", "net");

    const head = h("div", "net-head");
    const toggle = h("label", "net-toggle");
    U.enabled = document.createElement("input");
    U.enabled.type = "checkbox";
    U.enabled.addEventListener("change", async () => {
      state.platforms[k].enabled = U.enabled.checked;
      await save();
      render();
    });
    toggle.appendChild(U.enabled);
    toggle.appendChild(h("span", "net-name", P.label));
    U.count = h("span", "net-count");
    head.appendChild(toggle);
    head.appendChild(U.count);
    U.section.appendChild(head);

    U.note = h("p", "net-note");
    U.section.appendChild(U.note);

    U.ul = h("ul", "list");
    U.section.appendChild(U.ul);

    U.edit = h("details", "net-edit");
    U.edit.appendChild(h("summary", "", "Modifier la liste " + P.label));
    const panel = h("div", "panel");
    panel.appendChild(h("p", "", "Un compte par ligne, avec ou sans @. Les liens de profil sont acceptés. Les statuts déjà enregistrés sont conservés."));
    U.input = document.createElement("textarea");
    U.input.spellcheck = false;
    U.input.setAttribute("autocapitalize", "off");
    U.input.setAttribute("autocomplete", "off");
    U.input.setAttribute("aria-label", "Liste des comptes " + P.label);
    panel.appendChild(U.input);
    const actions = h("div", "actions");
    U.save = h("button", "btn solid", "Enregistrer la liste");
    U.save.type = "button";
    U.reset = h("button", "btn ghost", "Remettre tous les comptes à faire");
    U.reset.type = "button";
    actions.appendChild(U.save);
    actions.appendChild(U.reset);
    panel.appendChild(actions);
    U.msg = h("p", "msg");
    U.msg.setAttribute("role", "status");
    U.msg.setAttribute("aria-live", "polite");
    panel.appendChild(U.msg);
    U.edit.appendChild(panel);
    U.section.appendChild(U.edit);

    U.save.addEventListener("click", async () => {
      const raw = U.input.value;
      const res = parseTokens(raw, k);
      const mine = res.lists[k];
      const elsewhere = PLATFORM_KEYS.filter((o) => o !== k && res.lists[o].length).length;
      if (mine.length === 0 && raw.trim() !== "") {
        U.msg.textContent = "Aucun nom de compte valide pour " + P.label + ". Vérifie l’orthographe des @.";
        return;
      }
      const old = {};
      state.platforms[k].users.forEach((u) => {
        old[u.name] = u.status;
      });
      state.platforms[k].users = mine.map((n) => ({ name: n, status: old[n] || "todo" }));
      await save();
      render();
      fillEditor(k);
      let msg = "Liste enregistrée : " + mine.length + " compte" + (mine.length > 1 ? "s" : "") + ".";
      if (elsewhere) msg += " Des comptes d’un autre réseau ont été ignorés ici : utilise « Ajout rapide » pour les ajouter.";
      if (res.ignored.length) msg += " Ignoré : " + res.ignored.join(", ") + ".";
      U.msg.textContent = msg;
      if (mine.length) U.edit.open = false;
    });

    U.reset.addEventListener("click", async () => {
      state.platforms[k].users.forEach((u) => {
        u.status = "todo";
      });
      await save();
      render();
      U.msg.textContent = "Tous les comptes sont remis à faire.";
    });

    ui[k] = U;
    host.appendChild(U.section);
  });
}

function fillEditor(k) {
  ui[k].input.value = state.platforms[k].users.map((u) => "@" + u.name).join("\n");
}

// Pendant l'exécution, chaque liste défile toute seule jusqu'au compte en cours (ou au dernier traité).
// Le reste du temps, elle garde la position où tu l'as laissée.
function followList(U, k, keepScroll) {
  if (!running) {
    U.ul.scrollTop = keepScroll;
    return;
  }
  const target =
    U.ul.querySelector("li.running") ||
    (lastActive[k] ? U.ul.querySelector('li[data-name="' + lastActive[k] + '"]') : null);
  if (!target) {
    U.ul.scrollTop = keepScroll;
    return;
  }
  const top = target.offsetTop - (U.ul.clientHeight - target.offsetHeight) / 2;
  U.ul.scrollTop = Math.max(0, top);
}

function render() {
  let total = 0;
  let treated = 0;
  let todo = 0;
  PLATFORM_KEYS.forEach((k) => {
    const p = state.platforms[k];
    const U = ui[k];
    const n = p.users.length;
    const t = p.users.filter((u) => DONE.indexOf(u.status) !== -1).length;
    if (p.enabled) {
      total += n;
      treated += t;
      todo += p.users.filter((u) => u.status === "todo" || u.status === "failed").length;
    }
    U.enabled.checked = p.enabled;
    U.enabled.disabled = running;
    U.section.classList.toggle("off", !p.enabled);
    U.count.textContent = n ? t + " sur " + n + " traités" : "Aucun compte";
    U.note.textContent = notes[k] || (p.enabled ? "" : "Désactivé : ce réseau sera ignoré.");
    const keepScroll = U.ul.scrollTop;
    U.section.classList.toggle("active", running && k === activePlatform);
    U.ul.textContent = "";
    p.users.forEach((u) => {
      const li = h("li", u.status);
      li.dataset.name = u.name;
      li.appendChild(h("span", "user", "@" + u.name));
      li.appendChild(h("span", "status", LABELS[u.status]));
      const a = h("a", "open", "Ouvrir");
      a.href = PLATFORMS[k].url(u.name);
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.setAttribute("aria-label", "Ouvrir le profil de @" + u.name + " sur " + PLATFORMS[k].label);
      li.appendChild(a);
      U.ul.appendChild(li);
    });
    followList(U, k, keepScroll);
    U.save.disabled = running;
    U.reset.disabled = running;
  });

  $("count").textContent = total
    ? treated + " sur " + total + " traités (réseaux activés)"
    : "Aucun compte à traiter. Ouvre « Modifier la liste » d’un réseau, ou utilise « Ajout rapide ».";
  $("fill").style.width = total ? (treated / total) * 100 + "%" : "0%";
  $("bar").setAttribute("aria-valuemax", String(total));
  $("bar").setAttribute("aria-valuenow", String(treated));
  $("start").disabled = running || todo === 0;
  $("stop").hidden = !running;
  $("qaAdd").disabled = running;
  $("min").disabled = running;
  $("max").disabled = running;
}

function setLine(text) {
  $("line").textContent = text;
}
function log(msg) {
  const el = $("log");
  const t = new Date().toLocaleTimeString("fr-FR");
  el.textContent += "[" + t + "] " + msg + "\n";
  el.scrollTop = el.scrollHeight;
}

/* ---------- Onglet de travail ---------- */

function waitForLoad(id, timeout) {
  return new Promise((resolve, reject) => {
    let sawLoading = false;
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("Chargement de la page trop long."));
    }, timeout || 40000);
    function listener(tid, info) {
      if (tid !== id) return;
      if (info.status === "loading") sawLoading = true;
      if (info.status === "complete" && sawLoading) {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function navigate(url) {
  if (tabId === null) {
    const w = await chrome.windows.create({ url: "about:blank", focused: true, width: 1100, height: 850 });
    winId = w.id;
    tabId = w.tabs[0].id;
  }
  const loaded = waitForLoad(tabId);
  loaded.catch(() => {});
  await chrome.tabs.update(tabId, { url });
  await loaded;
}

async function reloadTab() {
  const loaded = waitForLoad(tabId);
  loaded.catch(() => {});
  await chrome.tabs.reload(tabId);
  await loaded;
}

async function exec(platform, mode, name) {
  try {
    const res = await chrome.scripting.executeScript({
      target: { tabId },
      func: PLATFORMS[platform].task,
      args: [mode, name]
    });
    return (res && res[0] && res[0].result) || { status: "failed", detail: "Aucune réponse de la page." };
  } catch (e) {
    const msg = String((e && e.message) || e);
    if (/No tab with id|tab was closed|The tab was closed/i.test(msg)) {
      return { status: "fatal", detail: "La fenêtre a été fermée." };
    }
    return { status: "failed", detail: msg };
  }
}

async function processUser(platform, name) {
  try {
    await navigate(PLATFORMS[platform].url(name));
  } catch (e) {
    const msg = String((e && e.message) || e);
    if (/No tab with id|tab was closed|No window/i.test(msg)) {
      return { status: "fatal", detail: "La fenêtre a été fermée." };
    }
    return { status: "failed", detail: msg };
  }
  let r = await exec(platform, "block", name);
  // Le réseau a lui-même affiché la confirmation : inutile de recharger la page pour vérifier.
  if (r.status === "clicked" && r.confirmed) return { status: "blocked" };
  if (r.status === "clicked") {
    await sleep(2500);
    try {
      await reloadTab();
    } catch (e) {
      return { status: "failed", detail: "Rechargement impossible : " + String((e && e.message) || e) };
    }
    r = await exec(platform, "verify", name);
  }
  return r;
}

/* ---------- Lancement ---------- */

function randomDelay() {
  const lo = Math.max(15, Math.min(state.min, state.max));
  const hi = Math.max(lo, state.max);
  return Math.floor(lo + Math.random() * (hi - lo + 1));
}

async function countdown(seconds) {
  for (let s = seconds; s > 0; s--) {
    if (stopRequested) return;
    setLine("Prochain compte dans " + s + " s");
    await sleep(1000);
  }
}

async function run() {
  const queues = {};
  const counts = [];
  PLATFORM_KEYS.forEach((k) => {
    const p = state.platforms[k];
    queues[k] = p.enabled ? p.users.filter((u) => u.status === "todo" || u.status === "failed") : [];
    notes[k] = "";
    if (queues[k].length) counts.push(queues[k].length + " sur " + PLATFORMS[k].label);
  });
  if (!counts.length) {
    setLine("Rien à faire : active un réseau qui a des comptes à traiter.");
    render();
    return;
  }
  const ok = confirm(
    "Bloquer " + counts.join(", ") + " ?\n\nUne fenêtre va s’ouvrir. Les blocages se font un par un, en alternant les réseaux, avec une pause entre chaque blocage d’un même réseau.\n\nUn réseau où tu n’es pas connecté sera simplement ignoré."
  );
  if (!ok) return;

  running = true;
  stopRequested = false;
  render();
  log("Début : " + counts.join(", ") + ".");

  const cooldown = {}; // heure à partir de laquelle on peut retraiter ce réseau
  const halted = {}; // réseau arrêté ou ignoré pour cette exécution : raison
  let fatal = false;

  while (!stopRequested && !fatal) {
    const open = PLATFORM_KEYS.filter((k) => queues[k].length && !halted[k]);
    if (!open.length) break;
    open.sort((a, b) => (cooldown[a] || 0) - (cooldown[b] || 0));
    const k = open[0];
    activePlatform = k;
    render();
    const wait = (cooldown[k] || 0) - Date.now();
    if (wait > 0) {
      await countdown(Math.ceil(wait / 1000));
      if (stopRequested) break;
    }

    const label = PLATFORMS[k].label;
    const u = queues[k].shift();
    lastActive[k] = u.name;
    u.status = "running";
    render();
    setLine("En cours : " + label + " @" + u.name);

    const r = await processUser(k, u.name);
    switch (r.status) {
      case "blocked":
        u.status = "blocked";
        cooldown[k] = Date.now() + randomDelay() * 1000;
        log(label + " @" + u.name + " : bloqué.");
        break;
      case "already":
        u.status = "already";
        cooldown[k] = Date.now() + 4000;
        log(label + " @" + u.name + " : déjà bloqué.");
        break;
      case "missing":
        u.status = "missing";
        cooldown[k] = Date.now() + 4000;
        log(label + " @" + u.name + " : profil introuvable (nom modifié, supprimé ou inaccessible).");
        break;
      case "login":
        u.status = "todo";
        halted[k] = "non connecté";
        notes[k] = "Ignoré : tu n’es pas connecté à " + label + " dans cette fenêtre (ou tu n’y as pas de compte).";
        log(label + " ignoré : non connecté. Les autres réseaux continuent.");
        break;
      case "limited":
        u.status = "todo";
        halted[k] = "limite";
        notes[k] = "Arrêté : " + label + " signale une limite ou demande une vérification. Attends plusieurs heures avant de relancer ce réseau.";
        log(label + " arrêté : limitation ou vérification affichée. Les autres réseaux continuent.");
        break;
      case "fatal":
        u.status = "todo";
        fatal = true;
        tabId = null;
        winId = null;
        setLine(r.detail || "Fenêtre fermée.");
        log("Arrêt : " + (r.detail || "fenêtre fermée") + ".");
        break;
      default: {
        const why = String(r.detail || "raison inconnue").replace(/\.+$/, "");
        u.status = "failed";
        halted[k] = "échec";
        notes[k] = "Arrêté sur @" + u.name + " : " + why + ".";
        log(label + " arrêté : échec sur @" + u.name + " — " + why + ".");
      }
    }
    await save();
    render();
  }

  running = false;
  activePlatform = null;
  const problems = PLATFORM_KEYS.filter((k) => halted[k]).map((k) => PLATFORMS[k].label + " (" + halted[k] + ")");
  if (fatal) {
    /* message déjà affiché */
  } else if (stopRequested) {
    setLine("Arrêté. Tu peux relancer plus tard.");
    log("Arrêt demandé.");
  } else if (problems.length) {
    setLine("Terminé, sauf : " + problems.join(", ") + ".");
    log("Terminé, sauf : " + problems.join(", ") + ".");
  } else {
    setLine("Terminé.");
    log("Terminé.");
  }
  if (!fatal && !problems.length && winId !== null) {
    try {
      await chrome.windows.remove(winId);
    } catch (e) {
      /* déjà fermée */
    }
    winId = null;
    tabId = null;
  }
  render();
}

/* ---------- Tâches exécutées DANS les pages des réseaux ----------
   Chaque tâche doit rester autonome : aucune variable extérieure n'y est accessible. */

/* ===== Instagram ===== */
async function pageTaskInstagram(mode, username) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const norm = (s) =>
    String(s || "")
      .replace(/[\u2018\u2019\u02bc\u0060]/g, "'")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  const user = norm(username);

  // Textes reconnus (français et anglais). Ajoute d'autres langues ici si besoin.
  const BLOCK = ["block", "bloquer"];
  const UNBLOCK = ["unblock", "débloquer", "debloquer"];
  const DISMISS = ["dismiss", "ignorer"];
  const OPTIONS = ["options", "more options", "plus d'options"];
  const NOT_FOUND = ["page isn't available", "n'est pas disponible", "page not found", "page introuvable"];
  const LIMITED = [
    "try again later",
    "réessayez plus tard",
    "action blocked",
    "action bloquée",
    "we restrict certain activity",
    "nous limitons certaines activités"
  ];

  const visible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  const label = (el) => norm(el.innerText || el.textContent);
  const find = (test) => {
    const all = Array.from(document.querySelectorAll('button, [role="button"]')).filter(visible);
    const hits = all.filter((el) => test(label(el)));
    return hits.find((a) => !hits.some((b) => b !== a && a.contains(b))) || null;
  };
  const isBlockLabel = (t) => {
    if (/new account|nouveaux? compte/.test(t)) return false;
    if (BLOCK.indexOf(t) !== -1) return true;
    return BLOCK.some((w) => t === w + " " + user || t === w + " @" + user);
  };
  const findOptions = () => {
    const svg = Array.from(document.querySelectorAll("svg[aria-label]")).find(
      (s) => OPTIONS.indexOf(norm(s.getAttribute("aria-label"))) !== -1 && visible(s)
    );
    return svg ? svg.closest('[role="button"], button') || svg.parentElement : null;
  };
  const pageText = () => norm(document.body ? document.body.innerText || document.body.textContent : "");
  const dialogText = () =>
    norm(
      Array.from(document.querySelectorAll('[role="dialog"]'))
        .map((d) => d.innerText || d.textContent)
        .join(" ")
    );
  const detect = () => {
    if (location.pathname.indexOf("/accounts/login") === 0 || document.querySelector('input[name="password"]')) {
      return "login";
    }
    if (find((t) => UNBLOCK.indexOf(t) !== -1)) return "unblock";
    const txt = pageText();
    if (NOT_FOUND.some((s) => txt.indexOf(s) !== -1)) return "missing";
    if (findOptions()) return "profile";
    return null;
  };
  const waitFor = async (fn, timeout, step) => {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      const v = fn();
      if (v) return v;
      await sleep(step || 300);
    }
    return null;
  };

  if (mode === "verify") {
    const s = await waitFor(
      () => {
        const d = detect();
        return d === "unblock" || d === "login" ? d : null;
      },
      20000,
      500
    );
    if (s === "unblock") return { status: "blocked" };
    if (s === "login") return { status: "login" };
    return { status: "failed", detail: "Le compte n’apparaît pas comme bloqué après rechargement." };
  }

  // mode "block"
  const st = await waitFor(detect, 25000, 400);
  if (!st) return { status: "failed", detail: "Profil non chargé ou bouton « Options » introuvable (délai dépassé)." };
  if (st === "login") return { status: "login" };
  if (st === "missing") return { status: "missing" };
  if (st === "unblock") return { status: "already" };

  const first = (location.pathname.split("/").filter(Boolean)[0] || "").toLowerCase();
  if (first !== user) return { status: "failed", detail: "Redirigé vers /" + first + "/ au lieu de /" + user + "/." };

  await sleep(1200 + Math.random() * 1200);

  let opened = false;
  let clicks = 0;
  let lastClick = 0;
  const end = Date.now() + 45000;
  while (Date.now() < end) {
    if (LIMITED.some((s) => dialogText().indexOf(s) !== -1)) return { status: "limited" };

    const dismiss = find((t) => DISMISS.indexOf(t) !== -1);
    const unblock = find((t) => UNBLOCK.indexOf(t) !== -1);
    if (clicks === 0 && unblock) return { status: "already" };
    if (clicks > 0 && (dismiss || unblock)) {
      if (dismiss) {
        await sleep(600);
        dismiss.click();
      }
      return { status: "clicked", confirmed: true };
    }

    const block = find(isBlockLabel);
    const since = Date.now() - lastClick;
    if (block && since > 2000 && clicks < 3) {
      await sleep(400 + Math.random() * 600);
      block.click();
      clicks++;
      lastClick = Date.now();
      await sleep(1000);
      continue;
    }
    if (!block && !opened) {
      const opt = findOptions();
      if (opt) {
        opt.click();
        opened = true;
        lastClick = Date.now();
        await sleep(1000);
        continue;
      }
    }
    if (!block && clicks > 0 && since > 6000) return { status: "clicked" };
    await sleep(400);
  }
  return {
    status: "failed",
    detail: clicks
      ? "Confirmation du blocage non détectée."
      : opened
      ? "Bouton « Bloquer » introuvable dans le menu."
      : "Bouton « Options » introuvable sur le profil."
  };
}

/* ===== TikTok ===== */
async function pageTaskTikTok(mode, username) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // Déclenche le vrai gestionnaire React de TikTok : un simple .click() ne suffit pas toujours.
  const reactPress = (el) => {
    if (!el) return false;
    let node = el;
    for (let i = 0; i < 6 && node; i++) {
      const key = Object.keys(node).find((n) => n.indexOf("__reactProps") === 0);
      const props = key ? node[key] : null;
      if (props && (props.onClick || props.onPointerDown)) {
        try { el.scrollIntoView({ block: "center" }); } catch (e) {}
        const r = el.getBoundingClientRect();
        const ev = { bubbles: true, cancelable: true, button: 0, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, currentTarget: el, target: el, preventDefault() {}, stopPropagation() {}, nativeEvent: {}, isDefaultPrevented: () => false, isPropagationStopped: () => false, persist() {} };
        try { if (props.onPointerDown) props.onPointerDown(ev); if (props.onClick) props.onClick(ev); return true; } catch (e) {}
      }
      node = node.parentElement;
    }
    if (typeof el.click === "function") el.click();
    return true;
  };
  const norm = (s) =>
    String(s || "")
      .replace(/[\u2018\u2019\u02bc\u0060]/g, "'")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  const user = norm(username);

  // Textes reconnus (français et anglais). Ajoute d'autres langues ici si besoin.
  const BLOCK = ["block", "bloquer"];
  const UNBLOCK = ["unblock", "débloquer", "debloquer"];
  const LOGIN = ["log in", "se connecter"];
  const NOT_FOUND = [
    "couldn't find this account",
    "impossible de trouver ce compte",
    "ce compte est introuvable",
    "account not found",
    "ce compte n'existe pas"
  ];
  const LIMITED = [
    "too many attempts",
    "trop de tentatives",
    "try again later",
    "réessayez plus tard",
    "verify to continue",
    "vérifier pour continuer",
    "vérifiez pour continuer",
    "drag the slider",
    "faites glisser le curseur"
  ];
  const CLICKABLE = 'button, [role="button"], [role="menuitem"], [aria-label], li';

  const visible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  const label = (el) => norm(el.getAttribute("aria-label") || el.innerText || el.textContent);
  const find = (selector, test) => {
    const all = Array.from(document.querySelectorAll(selector)).filter(visible);
    const hits = all.filter((el) => test(label(el)));
    return hits.find((a) => !hits.some((b) => b !== a && a.contains(b))) || null;
  };
  const isBlock = (t) => BLOCK.indexOf(t) !== -1 || BLOCK.some((w) => t === w + " @" + user || t === w + " " + user);
  const findUnblock = () => find(CLICKABLE, (t) => UNBLOCK.indexOf(t) !== -1);
  const findMore = () => {
    const el = document.querySelector('[data-e2e="user-more"]');
    return el && visible(el) ? el : null;
  };
  const findBlock = () => {
    const confirm = document.querySelector('button[data-e2e="block-popup-block-btn"]');
    if (confirm && visible(confirm)) return confirm;
    return find(CLICKABLE, isBlock);
  };
  const pageText = () => norm(document.body ? document.body.innerText || document.body.textContent : "");
  const limited = () => {
    const txt = pageText();
    if (LIMITED.some((s) => txt.indexOf(s) !== -1)) return true;
    const cap = document.querySelector(".captcha_verify_container, #captcha_container");
    return !!(cap && visible(cap));
  };
  const detect = () => {
    const loginBtn = document.querySelector('[data-e2e="top-login-button"]');
    if (
      (loginBtn && visible(loginBtn)) ||
      location.pathname.indexOf("/login") === 0 ||
      find("button", (t) => LOGIN.indexOf(t) !== -1)
    ) {
      return "login";
    }
    if (findUnblock()) return "unblock";
    const txt = pageText();
    if (NOT_FOUND.some((s) => txt.indexOf(s) !== -1)) return "missing";
    if (findMore()) return "profile";
    return null;
  };
  // Le bouton « Se connecter » peut s'afficher un instant avant le chargement complet :
  // on ne conclut « non connecté » qu'après une seconde vérification.
  const waitState = async (timeout, accepted) => {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      let d = detect();
      if (d === "login") {
        await sleep(3000);
        d = detect();
      }
      if (d && (!accepted || accepted.indexOf(d) !== -1)) return d;
      await sleep(400);
    }
    return null;
  };
  const fire = (el, type) => el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
  const openMenu = (el, n) => {
    if (n % 2 === 0) {
      ["pointerover", "pointerenter", "mouseover", "mouseenter", "mousemove"].forEach((t) => fire(el, t));
    } else {
      reactPress(el);
    }
  };

  if (mode === "verify") {
    const s = await waitState(20000, ["unblock", "login"]);
    if (s === "unblock") return { status: "blocked" };
    if (s === "login") return { status: "login" };
    return { status: "failed", detail: "Le compte n’apparaît pas comme bloqué après rechargement." };
  }

  // mode "block"
  const st = await waitState(30000);
  if (!st) return { status: "failed", detail: "Profil non chargé ou menu « … » introuvable (délai dépassé)." };
  if (st === "login") return { status: "login" };
  if (st === "missing") return { status: "missing" };
  if (st === "unblock") return { status: "already" };
  if (limited()) return { status: "limited" };

  let first = location.pathname.split("/").filter(Boolean)[0] || "";
  try {
    first = decodeURIComponent(first);
  } catch (e) {
    /* garde la valeur brute */
  }
  first = first.toLowerCase();
  if (first !== "@" + user) return { status: "failed", detail: "Redirigé vers /" + first + " au lieu de /@" + user + "." };

  await sleep(1500 + Math.random() * 1500);

  let opens = 0;
  let clicks = 0;
  let lastAction = 0;
  const end = Date.now() + 50000;
  while (Date.now() < end) {
    if (limited()) return { status: "limited" };

    const unblock = findUnblock();
    if (clicks === 0 && unblock) return { status: "already" };
    if (clicks > 0 && unblock) return { status: "clicked", confirmed: true };

    const block = findBlock();
    const since = Date.now() - lastAction;
    if (block && since > 1500 && clicks < 3) {
      await sleep(300 + Math.random() * 500);
      reactPress(block);
      clicks++;
      lastAction = Date.now();
      await sleep(1600);
      continue;
    }
    if (!block && clicks === 0 && opens < 4 && since > 2500) {
      const more = findMore();
      if (more) {
        openMenu(more, opens);
        opens++;
        lastAction = Date.now();
        await sleep(1600);
        continue;
      }
    }
    if (!block && clicks > 0 && since > 6000) return { status: "clicked" };
    await sleep(400);
  }
  return {
    status: "failed",
    detail: clicks
      ? "Confirmation du blocage non détectée."
      : opens
      ? "Option « Bloquer » introuvable dans le menu."
      : "Menu « … » introuvable sur le profil."
  };
}

/* ===== X ===== */
async function pageTaskX(mode, username) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const norm = (s) =>
    String(s || "").replace(/[\u2018\u2019\u02bc\u0060]/g, "'").replace(/\s+/g, " ").trim().toLowerCase();
  const user = norm(username);

  // ---------- Méthode 1 : appel direct de l'API interne de X (rapide, fiable) ----------
  // On réutilise la session déjà ouverte : le cookie ct0 et le jeton de la page. Rien n'est envoyé ailleurs.
  const cookie = (name) => {
    const m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : "";
  };
  const AUTH =
    "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";

  async function lookupUserId() {
    const ct0 = cookie("ct0");
    if (!ct0) return null;
    const vars = encodeURIComponent(JSON.stringify({ screen_name: user }));
    const feats = encodeURIComponent(JSON.stringify({ hidden_profile_subscriptions_enabled: true, profile_label_improvements_pcf_label_in_post_enabled: true, rweb_tipjar_consumption_enabled: true, responsive_web_graphql_exclude_directive_enabled: true, verified_phone_label_enabled: false, subscriptions_verification_info_is_identity_verified_enabled: true, subscriptions_verification_info_verified_since_enabled: true, highlights_tweets_tab_ui_enabled: true, responsive_web_twitter_article_notes_tab_enabled: true, subscriptions_feature_can_gift_premium: true, creator_subscriptions_tweet_preview_api_enabled: true, responsive_web_graphql_skip_user_profile_image_extensions_enabled: false, responsive_web_graphql_timeline_navigation_enabled: true }));
    const urls = [
      "https://x.com/i/api/graphql/G3KGOASz96M-Qu0nwmGXNg/UserByScreenName?variables=" + vars + "&features=" + feats,
      "https://x.com/i/api/graphql/sLVLhk0bGj3MVFEKTdax1w/UserByScreenName?variables=" + vars + "&features=" + feats
    ];
    for (const url of urls) {
      try {
        const r = await fetch(url, {
          headers: { authorization: AUTH, "x-csrf-token": ct0, "x-twitter-active-user": "yes", "x-twitter-auth-type": "OAuth2Session", "content-type": "application/json" },
          credentials: "include"
        });
        if (!r.ok) continue;
        const j = await r.json();
        const id = j && j.data && j.data.user && j.data.user.result && j.data.user.result.rest_id;
        const reason = j && j.data && j.data.user && j.data.user.result && j.data.user.result.__typename;
        if (id) return { id: String(id) };
        if (reason === "UserUnavailable") return { missing: true };
      } catch (e) {
        /* on essaie l'URL suivante */
      }
    }
    return null;
  }

  async function apiBlock(id) {
    const ct0 = cookie("ct0");
    if (!ct0) return "login";
    try {
      const r = await fetch("https://x.com/i/api/1.1/blocks/create.json", {
        method: "POST",
        headers: { authorization: AUTH, "content-type": "application/x-www-form-urlencoded", "x-csrf-token": ct0, "x-twitter-active-user": "yes", "x-twitter-auth-type": "OAuth2Session" },
        body: "user_id=" + encodeURIComponent(id),
        credentials: "include"
      });
      if (r.status === 200) return "blocked";
      if (r.status === 401 || r.status === 403) {
        const t = await r.text();
        if (/already/i.test(t)) return "already";
        return "limited"; // jeton refusé ou vérification demandée
      }
      if (r.status === 429) return "limited";
      if (r.status === 404) return "missing";
      return "fail";
    } catch (e) {
      return "fail";
    }
  }

  if (mode === "block") {
    const ct0 = cookie("ct0");
    if (ct0) {
      const found = await lookupUserId();
      if (found && found.missing) return { status: "missing" };
      if (found && found.id) {
        const r = await apiBlock(found.id);
        if (r === "blocked") return { status: "blocked" };
        if (r === "already") return { status: "already" };
        if (r === "missing") return { status: "missing" };
        if (r === "limited") return { status: "limited" };
        // "fail" ou "login" : on tombe sur la méthode par clic ci-dessous
      }
    }
  }

  // ---------- Méthode 2 : repli par clic (si l'API échoue ou pour la vérification) ----------
  const BLOCK_RE = /^(block|bloquer)( @.+)?$/;
  const BLOCKED_RE = /^(blocked|bloqué|bloquée|unblock|débloquer)( @.+)?$/;
  const NOT_FOUND = ["this account doesn't exist", "ce compte n'existe pas", "account suspended", "compte suspendu", "this page doesn't exist", "cette page n'existe pas"];
  const LIMITED = ["rate limit exceeded", "limite de débit", "try again later", "réessayez plus tard", "unusual activity", "activité inhabituelle", "temporarily restricted", "temporairement restreint", "temporarily locked", "temporairement verrouillé", "verify you are human", "confirm you are human", "vérifiez que vous êtes humain"];
  const visible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  const label = (el) => norm(el.getAttribute("aria-label") || el.innerText || el.textContent);
  const vis = (sel) => { const el = document.querySelector(sel); return el && visible(el) ? el : null; };
  const findBy = (selector, test) => {
    const all = Array.from(document.querySelectorAll(selector)).filter(visible);
    const hits = all.filter((el) => test(label(el)));
    return hits.find((a) => !hits.some((b) => b !== a && a.contains(b))) || null;
  };
  const findMore = () => vis('[data-testid="userActions"]');
  const findBlockItem = () => vis('[data-testid="block"]') || findBy('[role="menuitem"]', (t) => BLOCK_RE.test(t));
  const findConfirm = () => vis('[data-testid="confirmationSheetConfirm"]');
  const findBlocked = () => vis('[data-testid$="-unblock"]') || findBy('button, [role="button"]', (t) => BLOCKED_RE.test(t));
  const messagesText = () => norm(Array.from(document.querySelectorAll('[data-testid="toast"], [role="alert"], [role="alertdialog"], [role="dialog"]')).map((d) => d.innerText || d.textContent).join(" "));
  const limited = () => LIMITED.some((s) => messagesText().indexOf(s) !== -1);
  const loggedIn = () => !!(vis('[data-testid="SideNav_AccountSwitcher_Button"]') || vis('[data-testid="AppTabBar_Home_Link"]'));
  const detect = () => {
    if (!loggedIn()) {
      if (location.pathname.indexOf("/i/flow/login") === 0 || location.pathname.indexOf("/login") === 0 || vis('[data-testid="loginButton"]')) return "login";
      return null;
    }
    if (findBlocked()) return "unblock";
    if (findMore()) return "profile";
    const txt = norm(document.body ? document.body.innerText || document.body.textContent : "");
    if (NOT_FOUND.some((s) => txt.indexOf(s) !== -1)) return "missing";
    return null;
  };
  const waitState = async (timeout, accepted) => {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      let d = detect();
      if (d === "login") { await sleep(3000); d = detect(); }
      if (d && (!accepted || accepted.indexOf(d) !== -1)) return d;
      await sleep(400);
    }
    return null;
  };

  if (mode === "verify") {
    const s = await waitState(20000, ["unblock", "login"]);
    if (s === "unblock") return { status: "blocked" };
    if (s === "login") return { status: "login" };
    return { status: "failed", detail: "Le compte n’apparaît pas comme bloqué après rechargement." };
  }

  const st = await waitState(30000);
  if (!st) return { status: "failed", detail: "Profil non chargé ou menu « … » introuvable (délai dépassé)." };
  if (st === "login") return { status: "login" };
  if (st === "missing") return { status: "missing" };
  if (st === "unblock") return { status: "already" };
  if (limited()) return { status: "limited" };
  const first = (location.pathname.split("/").filter(Boolean)[0] || "").toLowerCase();
  if (first !== user) return { status: "failed", detail: "Redirigé vers /" + first + " au lieu de /" + user + "." };
  await sleep(1200 + Math.random() * 1200);
  let opens = 0, clicks = 0, lastAction = 0;
  const end = Date.now() + 50000;
  while (Date.now() < end) {
    if (limited()) return { status: "limited" };
    const blocked = findBlocked();
    if (clicks === 0 && blocked) return { status: "already" };
    if (clicks > 0 && blocked) return { status: "clicked", confirmed: true };
    const confirm = findConfirm();
    const item = confirm ? null : findBlockItem();
    const since = Date.now() - lastAction;
    const target = confirm || item;
    if (target && since > 1200 && clicks < 4) { await sleep(300 + Math.random() * 500); target.click(); clicks++; lastAction = Date.now(); await sleep(900); continue; }
    if (!target && clicks === 0 && opens < 4 && since > 2500) { const more = findMore(); if (more) { more.click(); opens++; lastAction = Date.now(); await sleep(900); continue; } }
    if (!target && clicks > 0 && since > 6000) return { status: "clicked" };
    await sleep(400);
  }
  return { status: "failed", detail: clicks ? "Confirmation du blocage non détectée." : opens ? "Option « Bloquer » introuvable dans le menu." : "Menu « … » introuvable sur le profil." };
}
/* ---------- Interface générale ---------- */

function clampSettings() {
  let lo = parseInt($("min").value, 10);
  let hi = parseInt($("max").value, 10);
  if (!Number.isFinite(lo)) lo = 20;
  if (!Number.isFinite(hi)) hi = 45;
  lo = Math.max(15, Math.min(600, lo));
  hi = Math.max(lo, Math.min(600, hi));
  state.min = lo;
  state.max = hi;
  $("min").value = lo;
  $("max").value = hi;
}

$("start").addEventListener("click", () => {
  run();
});

$("stop").addEventListener("click", () => {
  stopRequested = true;
  setLine("Arrêt demandé : le compte en cours sera terminé.");
});

// Ajout rapide : colle une liste mélangée (liens ou préfixes instagram:/tiktok:/x:), chaque compte
// est rangé dans le bon réseau. Les comptes déjà présents sont conservés tels quels.
$("qaAdd").addEventListener("click", async () => {
  const raw = $("qa").value;
  const res = parseTokens(raw, null);
  const parts = [];
  PLATFORM_KEYS.forEach((k) => {
    const have = {};
    state.platforms[k].users.forEach((u) => {
      have[u.name] = true;
    });
    let added = 0;
    res.lists[k].forEach((n) => {
      if (!have[n]) {
        state.platforms[k].users.push({ name: n, status: "todo" });
        added++;
      }
    });
    if (added) parts.push(added + " " + PLATFORMS[k].label);
    fillEditor(k);
  });
  await save();
  render();
  let msg = parts.length ? "Ajouté : " + parts.join(", ") + "." : "Aucun nouveau compte ajouté.";
  if (res.ignored.length) {
    msg += " Ignoré (réseau non précisé ou identifiant invalide) : " + res.ignored.join(", ") + ".";
  }
  $("qaMsg").textContent = msg;
  if (parts.length) $("qa").value = "";
});

["min", "max"].forEach((id) => {
  $(id).addEventListener("change", () => {
    clampSettings();
    save();
  });
});

window.addEventListener("beforeunload", (e) => {
  if (running) {
    e.preventDefault();
    e.returnValue = "";
  }
});

(async function init() {
  buildSections();
  await load();
  $("min").value = state.min;
  $("max").value = state.max;
  clampSettings();
  PLATFORM_KEYS.forEach((k) => {
    fillEditor(k);
    ui[k].edit.open = state.platforms[k].users.length === 0;
  });
  render();
})();
