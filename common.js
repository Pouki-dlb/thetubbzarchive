/* common.js — code partagé entre index.html et duck.html
 * - Chargement du catalogue (data.json, servi statiquement).
 * - Gestion de la collection du visiteur dans localStorage (coches, wishlist, notes).
 *   IMPORTANT : le localStorage ne contient QUE les données personnelles du visiteur,
 *   jamais le catalogue.
 */

// Expose un espace de noms global simple (pas de framework, pas de modules).
window.Tubbz = (function () {
  "use strict";

  var STORAGE_KEY = "tubbz-collection";
  var STATE_VERSION = 1;
  var PLACEHOLDER = "images/placeholder.svg";

  // Convention de nommage des images (convention pure : calculée depuis l'id, jamais stockée).
  // Image par taille    : images/<id>-<taille>.webp             (ex. -c, -m, -x) → figurine « nue »
  // Image de variante   : images/<id>-<taille><emballage>.webp  (ex. -cf, -cb, -mf, -xb) → dans son packaging
  // Image principale    : images/<id>.webp (legacy — plus utilisée par le site, cf. admin/index.html)
  var SIZE_INITIAL = { classic: "c", mini: "m", xl: "x" };
  var PACK_INITIAL = { "first-edition": "f", boxed: "b" };
  var SIZE_ORDER = ["classic", "mini", "xl"];

  function imageFor(id) {
    return "images/" + id + ".webp";
  }

  // Image « nue » d'une taille donnée (hero de duck.html + image par défaut des cards).
  function sizeImageFor(id, size) {
    return "images/" + id + "-" + (SIZE_INITIAL[size] || "") + ".webp";
  }

  // Tailles distinctes présentes dans les variantes, ordonnées classic → mini → xl.
  function sizesOf(fig) {
    var present = {};
    (fig.variants || []).forEach(function (v) { if (v && v.size) present[v.size] = true; });
    return SIZE_ORDER.filter(function (s) { return present[s]; });
  }

  function variantImageFor(id, size, packaging) {
    var s = SIZE_INITIAL[size] || "";
    var p = PACK_INITIAL[packaging] || "";
    return "images/" + id + "-" + s + p + ".webp";
  }

  // Images d'une taille, de la plus « nue » à la plus habillée : la figurine seule
  // d'abord, puis ses emballages en repli si le fichier nu venait à manquer.
  // (Sert au survol des badges de taille de la grille, cf. index.js.)
  function sizeImageCandidates(figurine, size) {
    var list = [sizeImageFor(figurine.id, size)];
    (figurine.variants || []).forEach(function (v) {
      if (v && v.size === size) list.push(variantImageFor(figurine.id, size, v.packaging));
    });
    return list;
  }

  // Logo TUBBZ d'une taille — l'illustration des badges de taille de la grille.
  // À la racine et non dans images/ : c'est un élément d'interface, pas une photo
  // de figurine (images/ ne contient que des fichiers nommés d'après un id).
  var SIZE_LOGO = {
    classic: "logo-tubbz.webp",
    mini: "logo-tubbz-mini.webp",
    xl: "logo-tubbz-xl.webp"
  };
  function sizeLogoFor(size) {
    return SIZE_LOGO[size] || SIZE_LOGO.classic;
  }

  /* ------------------------------------------------------------------ */
  /* Catalogue                                                          */
  /* ------------------------------------------------------------------ */

  // Lit le catalogue depuis window.TUBBZ_DATA (défini par data.js, chargé via <script>).
  // Ce choix rend le site 100 % statique : il fonctionne par simple double-clic sur
  // index.html (file://), sans serveur ni fetch. Renvoie une promesse résolue avec
  // { meta, figurines }, triée par licence puis nom.
  function loadCatalog() {
    return new Promise(function (resolve, reject) {
      var data = window.TUBBZ_DATA;
      if (!data || typeof data !== "object") {
        reject(new Error("Catalogue introuvable : le fichier data.js n'est pas chargé."));
        return;
      }
      var meta = data.meta || {};
      var figurines = Array.isArray(data.figurines) ? data.figurines.slice() : [];
      // Numéro → nombre (parseFloat pour gérer les « 3.1 » qui suivent le « 3 ») ;
      // absent ou invalide = Infinity (rejeté en fin de collection).
      function numOf(v) { var n = parseFloat(v); return isNaN(n) ? Infinity : n; }
      // Tri par défaut : collection (alpha), puis numéro croissant (sans-numéro à la fin),
      // puis nom (départage à numéro égal ou entre sans-numéro).
      figurines.sort(function (a, b) {
        var byCollection = String(a.collection || "").localeCompare(String(b.collection || ""), "fr");
        if (byCollection !== 0) return byCollection;
        var na = numOf(a.number), nb = numOf(b.number);
        if (na !== nb) return na - nb;
        return String(a.name || "").localeCompare(String(b.name || ""), "fr");
      });
      resolve({ meta: meta, figurines: figurines });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Libellés (avec repli si meta.labels absent)                        */
  /* ------------------------------------------------------------------ */

  var DEFAULT_LABELS = {
    sizes: { classic: "Classic", mini: "Mini", xl: "XL" },
    packaging: { "first-edition": "First Edition", boxed: "Boxed" }
  };

  function sizeLabel(meta, size) {
    var l = (meta && meta.labels && meta.labels.sizes) || DEFAULT_LABELS.sizes;
    return l[size] || DEFAULT_LABELS.sizes[size] || size;
  }

  function packagingLabel(meta, packaging) {
    var l = (meta && meta.labels && meta.labels.packaging) || DEFAULT_LABELS.packaging;
    return l[packaging] || DEFAULT_LABELS.packaging[packaging] || packaging;
  }

  // Emoji représentant l'emballage : baignoire (First Edition) / boîte (Boxed).
  var PACK_EMOJI = { "first-edition": "🛁", boxed: "📦" };
  function packagingEmoji(packaging) {
    return PACK_EMOJI[packaging] || "";
  }

  // Classe CSS de couleur associée à l'emballage.
  function packagingClass(packaging) {
    return packaging === "first-edition" ? "pack-fe" : "pack-box";
  }

  // Libellé condensé d'une variante : « Classic 📦 ».
  function variantChipLabel(meta, size, packaging) {
    return sizeLabel(meta, size) + " " + packagingEmoji(packaging);
  }

  /* ------------------------------------------------------------------ */
  /* État visiteur (localStorage)                                       */
  /* ------------------------------------------------------------------ */

  function emptyState() {
    return { version: STATE_VERSION, owned: {}, wishlist: {}, notes: {} };
  }

  // Lecture tolérante : jamais d'exception qui casse la page.
  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return emptyState();
      var parsed = JSON.parse(raw);
      return normalizeState(parsed);
    } catch (e) {
      console.warn("localStorage illisible, réinitialisation en mémoire :", e);
      return emptyState();
    }
  }

  function normalizeState(obj) {
    var s = emptyState();
    if (obj && typeof obj === "object") {
      if (obj.owned && typeof obj.owned === "object") s.owned = obj.owned;
      if (obj.wishlist && typeof obj.wishlist === "object") s.wishlist = obj.wishlist;
      if (obj.notes && typeof obj.notes === "object") s.notes = obj.notes;
    }
    s.version = STATE_VERSION;
    return s;
  }

  // Teste si l'écriture localStorage est réellement possible (certains navigateurs
  // la bloquent en mode fichier local file://, ou en navigation privée).
  function storageAvailable() {
    try {
      var k = "__tubbz_test__";
      localStorage.setItem(k, "1");
      localStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  }

  function saveState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      console.error("Impossible d'écrire dans localStorage :", e);
      return false;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Mutations de l'état                                                */
  /* ------------------------------------------------------------------ */

  function variantKey(size, packaging) {
    return size + "|" + packaging;
  }

  function isOwned(state, id, key) {
    return !!(state.owned[id] && state.owned[id][key]);
  }

  // Bascule la possession d'une variante. Renvoie le nouvel état booléen.
  function toggleOwned(state, id, key) {
    if (!state.owned[id]) state.owned[id] = {};
    if (state.owned[id][key]) {
      delete state.owned[id][key];
      if (Object.keys(state.owned[id]).length === 0) delete state.owned[id];
    } else {
      state.owned[id][key] = true;
    }
    saveState(state);
    return isOwned(state, id, key);
  }

  function isWished(state, id) {
    return !!state.wishlist[id];
  }

  function toggleWishlist(state, id) {
    if (state.wishlist[id]) delete state.wishlist[id];
    else state.wishlist[id] = true;
    saveState(state);
    return isWished(state, id);
  }

  function getNote(state, id) {
    return state.notes[id] || "";
  }

  function setNote(state, id, text) {
    text = (text || "").trim();
    if (text) state.notes[id] = text;
    else delete state.notes[id];
    saveState(state);
  }

  /* ------------------------------------------------------------------ */
  /* Nombre de variantes possédées d'une figurine                       */
  /* ------------------------------------------------------------------ */

  function ownedCountOf(state, figurine) {
    var variants = figurine.variants || [];
    var owned = 0;
    for (var i = 0; i < variants.length; i++) {
      var key = variantKey(variants[i].size, variants[i].packaging);
      if (isOwned(state, figurine.id, key)) owned++;
    }
    return { owned: owned, total: variants.length };
  }

  // Une TAILLE est considérée possédée dès qu'au moins un de ses emballages l'est.
  // La grille n'affiche qu'un badge par taille (tous emballages confondus) : le
  // détail emballage par emballage reste sur la fiche (duck.html).
  function ownsSize(state, figurine, size) {
    var variants = figurine.variants || [];
    for (var i = 0; i < variants.length; i++) {
      if (!variants[i] || variants[i].size !== size) continue;
      if (isOwned(state, figurine.id, variantKey(size, variants[i].packaging))) return true;
    }
    return false;
  }

  /* ------------------------------------------------------------------ */
  /* Petits utilitaires                                                 */
  /* ------------------------------------------------------------------ */

  // Échappe le texte destiné à être injecté en HTML.
  function esc(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /* ------------------------------------------------------------------ */
  /* Layout partagé : header + footer injectés (une seule source)        */
  /* ------------------------------------------------------------------ */
  // Header et footer sont IDENTIQUES entre les pages (à l'action de droite près) :
  // on les définit ICI et on les injecte dans les points de montage
  // <header id="site-header"> / <footer id="site-footer">. Chaque page indique
  // seulement son type via <body data-page="index|duck">.  ► Pour ajouter une
  // page : créer son HTML avec ces deux points de montage + data-page, et
  // ajouter son cas dans headerActionsFor() ci-dessous. Rien à dupliquer.
  // (Injection en JS car le site doit tourner en file:// — pas de fetch/include.)

  var BRAND_HTML =
    '<div class="brand-block">' +
      '<a class="brand" href="index.html?home">' +
        '<span class="brand-text"><strong>The </strong>' +
        '<strong class="brand-name">TUBB<span class="brand-z">Z</span></strong> ' +
        '<strong>Archive</strong></span>' +
      '</a>' +
      '<p class="tagline">Find the tubbz you deserve</p>' +
    '</div>';

  var THEME_BTN_HTML =
    '<button id="theme-toggle" type="button" class="btn btn-ghost theme-toggle" aria-label="Theme"></button>';

  // Action(s) à droite du header, propres à chaque page (le bouton thème est commun).
  function headerActionsFor(page) {
    if (page === "duck") {
      return THEME_BTN_HTML + '<a class="btn btn-ghost" href="index.html">← Back</a>';
    }
    return THEME_BTN_HTML + // index (défaut)
      '<button id="btn-about" type="button" class="btn btn-ghost" aria-haspopup="dialog">About</button>';
  }

  function renderLayout() {
    var page = document.body.getAttribute("data-page") || "index";
    var header = document.getElementById("site-header");
    if (header) {
      header.innerHTML =
        '<div class="wrap header-inner">' +
          BRAND_HTML +
          '<div class="header-actions">' + headerActionsFor(page) + '</div>' +
        '</div>';
    }
    var footer = document.getElementById("site-footer");
    if (footer) {
      footer.innerHTML =
        '<div class="wrap">' +
          '<p class="muted"><strong>This is an unofficial, non-commercial fan project and community archive.</strong> ' +
          'It is not affiliated with, endorsed by, sponsored by, or approved by Rubber Road Ltd, Numskull, or ' +
          'Yellow Bulldog Ltd.</p>' +
          '<p class="muted">TUBBZ® is a registered trademark of Rubber Road Ltd (marketed under the Numskull brand; ' +
          'tubbz.com is operated by Yellow Bulldog Ltd). All product names, character names, likenesses, and images ' +
          'are the property of their respective owners and are used here for identification and informational ' +
          'purposes only. No ownership of, or affiliation with, these trademarks or copyrights is claimed.</p>' +
        '</div>';
    }
  }

  /* ------------------------------------------------------------------ */
  /* Thème : auto (défaut) / light / dark, mémorisé en localStorage      */
  /* ------------------------------------------------------------------ */
  // Le CSS lit l'attribut data-theme sur <html> (light|dark). Un script inline
  // dans le <head> le pose AVANT le rendu (anti-flash) ; ici on gère le bouton
  // et le suivi de l'OS en direct quand le réglage est « auto ».

  var THEME_KEY = "tubbz-theme";
  var THEME_ORDER = ["auto", "light", "dark"]; // ordre de cyclage du bouton
  var darkMQ = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  // Icônes (héritent de la couleur du texte via currentColor).
  var THEME_ICON = {
    auto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 0 0 17z" fill="currentColor" stroke="none"/></svg>',
    light: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4"/></svg>',
    dark: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>'
  };
  var THEME_TITLE = { auto: "Theme: system", light: "Theme: light", dark: "Theme: dark" };

  function getThemePref() {
    var v = null;
    try { v = localStorage.getItem(THEME_KEY); } catch (e) {}
    return (v === "light" || v === "dark") ? v : "auto";
  }
  function setThemePref(pref) {
    try {
      if (pref === "auto") localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, pref);
    } catch (e) {}
  }
  // « auto » suit l'OS ; sinon le réglage forcé.
  function effectiveTheme(pref) {
    if (pref === "light" || pref === "dark") return pref;
    return (darkMQ && darkMQ.matches) ? "dark" : "light";
  }
  function applyTheme(pref) {
    document.documentElement.setAttribute("data-theme", effectiveTheme(pref));
  }
  function renderThemeButton(btn, pref) {
    btn.innerHTML = THEME_ICON[pref];
    btn.setAttribute("title", THEME_TITLE[pref] + " (click to change)");
    btn.setAttribute("aria-label", THEME_TITLE[pref]);
  }
  function initTheme() {
    var pref = getThemePref();
    applyTheme(pref); // ré-applique (le script du <head> l'a déjà fait au 1er rendu)
    // Suit l'OS en direct tant qu'on est en « auto ».
    if (darkMQ) {
      var onChange = function () { if (getThemePref() === "auto") applyTheme("auto"); };
      if (darkMQ.addEventListener) darkMQ.addEventListener("change", onChange);
      else if (darkMQ.addListener) darkMQ.addListener(onChange); // ancien Safari
    }
    var btn = document.getElementById("theme-toggle");
    if (!btn) return;
    renderThemeButton(btn, pref);
    btn.addEventListener("click", function () {
      var next = THEME_ORDER[(THEME_ORDER.indexOf(getThemePref()) + 1) % THEME_ORDER.length];
      setThemePref(next);
      applyTheme(next);
      renderThemeButton(btn, next);
    });
  }
  // Injecte le layout PUIS initialise le thème (qui a besoin de #theme-toggle,
  // rendu par renderLayout). SYNCHRONE, et surtout PAS différé à DOMContentLoaded :
  // common.js est chargé en fin de <body> (les points de montage existent déjà),
  // et index.js câble ses boutons — dont #btn-about, injecté ici — via une promesse
  // qui s'exécute AVANT DOMContentLoaded. Le header doit donc exister dès maintenant.
  renderLayout();
  initTheme();

  return {
    PLACEHOLDER: PLACEHOLDER,
    loadCatalog: loadCatalog,
    loadState: loadState,
    saveState: saveState,
    storageAvailable: storageAvailable,
    normalizeState: normalizeState,
    emptyState: emptyState,
    variantKey: variantKey,
    isOwned: isOwned,
    toggleOwned: toggleOwned,
    isWished: isWished,
    toggleWishlist: toggleWishlist,
    getNote: getNote,
    setNote: setNote,
    ownedCountOf: ownedCountOf,
    ownsSize: ownsSize,
    sizeLabel: sizeLabel,
    packagingLabel: packagingLabel,
    packagingEmoji: packagingEmoji,
    packagingClass: packagingClass,
    variantChipLabel: variantChipLabel,
    imageFor: imageFor,
    sizeImageFor: sizeImageFor,
    sizesOf: sizesOf,
    variantImageFor: variantImageFor,
    sizeImageCandidates: sizeImageCandidates,
    sizeLogoFor: sizeLogoFor,
    esc: esc
  };
})();
