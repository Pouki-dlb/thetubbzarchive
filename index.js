/* index.js — page d'accueil : grille minimale, recherche, filtres, export/import. */
(function () {
  "use strict";

  var T = window.Tubbz;

  var state = T.loadState();
  var catalog = { meta: {}, figurines: [] };

  // Éléments du DOM
  var elGrid = document.getElementById("grid");
  var elWarning = document.getElementById("storage-warning");
  var elSearch = document.getElementById("search");
  var elCollection = document.getElementById("filter-collection");
  var elStatus = document.getElementById("filter-status");
  var elToTop = document.getElementById("to-top");

  /* ---------------------------------------------------------------- */
  /* Mémorisation de la vue (filtres + scroll) pour le retour arrière */
  /* ---------------------------------------------------------------- */

  var VIEW_KEY = "tubbz-index-view";
  var ready = false;
  // On gère nous-mêmes la restauration du scroll (sinon le navigateur interfère).
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";

  function saveView() {
    try {
      sessionStorage.setItem(VIEW_KEY, JSON.stringify({
        q: elSearch.value, collection: elCollection.value, status: elStatus.value,
        scrollY: window.pageYOffset || document.documentElement.scrollTop || 0
      }));
    } catch (e) {}
  }
  function loadView() {
    try { return JSON.parse(sessionStorage.getItem(VIEW_KEY)); } catch (e) { return null; }
  }
  function applyView(v) {
    if (!v) return;
    elSearch.value = v.q || "";
    elCollection.value = v.collection || "";
    elStatus.value = v.status || "";
  }
  function restoreScroll(v) {
    if (v && v.scrollY) window.scrollTo(0, v.scrollY);
  }

  // Bouton « retour en haut » : visible seulement au-delà d'un certain scroll.
  var TO_TOP_AT = 400;
  function updateToTop() {
    var y = window.pageYOffset || document.documentElement.scrollTop || 0;
    elToTop.classList.toggle("is-visible", y > TO_TOP_AT);
  }

  // Clic sur une collection (card de l'index ou fiche duck) : vue neuve filtrée
  // sur cette seule collection. On vide les autres filtres et on remonte en haut.
  function applyCollectionFilter(name) {
    elSearch.value = "";
    elCollection.value = name || "";
    elStatus.value = "";
    render();
    window.scrollTo(0, 0);
    saveView();
  }

  /* ---------------------------------------------------------------- */
  /* Filtrage                                                         */
  /* ---------------------------------------------------------------- */

  function matches(fig) {
    var q = elSearch.value.trim().toLowerCase();
    if (q) {
      var hay = (fig.name + " " + fig.collection).toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    if (elCollection.value && fig.collection !== elCollection.value) return false;

    if (elStatus.value) {
      var owned = T.ownedCountOf(state, fig).owned > 0;
      if (elStatus.value === "wishlist") {
        if (!T.isWished(state, fig.id)) return false;
      } else if (elStatus.value === "owned") {
        if (!owned) return false;
      } else if (elStatus.value === "not-owned") {
        if (owned) return false;
      }
    }
    return true;
  }

  /* ---------------------------------------------------------------- */
  /* Rendu de la grille                                               */
  /* ---------------------------------------------------------------- */

  // Une chip par variante existante : couleur d'emballage + ✓ si possédée, grisée sinon.
  // data-img porte l'image de la variante (utilisée au survol pour changer l'image de la card).
  function variantChips(fig) {
    return (fig.variants || []).map(function (v) {
      var key = T.variantKey(v.size, v.packaging);
      var owned = T.isOwned(state, fig.id, key);
      var cls = "card-chip " + T.packagingClass(v.packaging) + (owned ? " is-owned" : " is-missing");
      var vimg = T.variantImageFor(fig.id, v.size, v.packaging);
      return '<span class="' + cls + '" data-img="' + T.esc(vimg) + '">' +
        (owned ? "✓ " : "") + T.esc(T.variantChipLabel(catalog.meta, v.size, v.packaging)) +
        '</span>';
    }).join("");
  }

  function cardHTML(fig) {
    var wished = T.isWished(state, fig.id);
    var img = T.sizeImageFor(fig.id, (T.sizesOf(fig)[0] || "classic"));
    var url = "duck.html?id=" + encodeURIComponent(fig.id);

    // La card n'est PAS un lien global : seuls l'image et le nom mènent à la fiche.
    // (Le lien image est en tabindex=-1 pour ne pas doubler la tabulation clavier :
    //  au clavier, on tabule sur le nom, qui pointe au même endroit.)
    return (
      '<div class="card">' +
        '<a class="card-media" href="' + url + '" tabindex="-1" aria-label="' + T.esc(fig.name) + '">' +
          '<img loading="lazy" src="' + T.esc(img) + '" data-default="' + T.esc(img) + '" ' +
            'alt="' + T.esc(fig.name) + '" ' +
            'onerror="this.onerror=null;this.src=\'' + T.PLACEHOLDER + '\'" />' +
          (fig.number ? '<span class="num-badge">#' + T.esc(fig.number) + '</span>' : '') +
          (wished ? '<span class="heart" title="In your wishlist" aria-label="Wishlist">❤</span>' : '') +
        '</a>' +
        '<div class="card-body">' +
          '<h3 class="card-name">' +
            '<a class="card-name-link text-link" href="' + url + '">' + T.esc(fig.name) + '</a>' +
          '</h3>' +
          '<p class="card-collection">' +
            '<span class="card-collection-link text-link" role="link" tabindex="0" ' +
              'data-collection="' + T.esc(fig.collection) + '" ' +
              'title="Show all ' + T.esc(fig.collection) + ' TUBBZ">' +
              T.esc(fig.collection) +
            '</span>' +
          '</p>' +
          '<div class="card-chips">' + variantChips(fig) + '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function render() {
    var list = catalog.figurines.filter(matches);

    if (list.length === 0) {
      elGrid.innerHTML = '<p class="empty">No figurine matches your search.</p>';
    } else {
      elGrid.innerHTML = list.map(cardHTML).join("");
    }
    elGrid.setAttribute("aria-busy", "false");
    updateSearchPlaceholder();
  }

  /* ---------------------------------------------------------------- */
  /* Filtres : peupler la liste des licences                          */
  /* ---------------------------------------------------------------- */

  function populateCollections() {
    var names = {};
    catalog.figurines.forEach(function (f) { names[f.collection] = true; });
    Object.keys(names).sort(function (a, b) { return a.localeCompare(b, "fr"); })
      .forEach(function (name) {
        var opt = document.createElement("option");
        opt.value = name;
        opt.textContent = name;
        elCollection.appendChild(opt);
      });
  }

  // Placeholder dynamique de la recherche : compte les TUBBZ uniques (un par id, on
  // n'additionne pas les variantes) et les collections (collections) distinctes.
  // Le décompte reflète les filtres collection + statut en cours (la recherche est
  // vide quand le placeholder s'affiche, donc `matches` équivaut à ces deux filtres).
  // « TUBBZ » est un nom de marque invariable → pas de pluriel.
  function updateSearchPlaceholder() {
    var list = catalog.figurines.filter(matches);
    var tubbz = list.length;
    var names = {};
    list.forEach(function (f) { names[f.collection] = true; });
    var collections = Object.keys(names).length;
    // Une seule collection concernée (ex. filtre sur une collection) → on n'affiche
    // pas « and 1 collection », qui n'apporte rien.
    elSearch.placeholder = "Search across " + tubbz + " TUBBZ" +
      (collections > 1 ? " and " + collections + " collections" : "") + "…";
  }

  /* ---------------------------------------------------------------- */
  /* Export / Import de sauvegarde                                    */
  /* ---------------------------------------------------------------- */

  function exportBackup() {
    var payload = JSON.stringify(state, null, 2);
    var blob = new Blob([payload], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    var stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = "tubbz-collection-" + stamp + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function importBackup(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(reader.result);
        var incoming = T.normalizeState(parsed);
        var ok = window.confirm(
          "Import this backup?\n\n" +
          "It will REPLACE your current collection in this browser."
        );
        if (!ok) return;
        state = incoming;
        T.saveState(state);
        render();
        alert("Backup imported successfully.");
      } catch (e) {
        alert("Invalid file: this backup could not be read.");
      }
    };
    reader.onerror = function () { alert("Could not read the file."); };
    reader.readAsText(file);
  }

  /* ---------------------------------------------------------------- */
  /* Help modal                                                       */
  /* ---------------------------------------------------------------- */

  function bindHelpModal() {
    var modal = document.getElementById("about-modal");
    var openBtn = document.getElementById("btn-about");

    function open() { modal.hidden = false; }
    function close() { modal.hidden = true; }

    openBtn.addEventListener("click", open);
    modal.addEventListener("click", function (e) {
      if (e.target.hasAttribute("data-close")) close();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !modal.hidden) close();
    });
  }

  /* ---------------------------------------------------------------- */
  /* Survol d'une chip → change l'image de la card (délégation)        */
  /* ---------------------------------------------------------------- */

  function setImg(im, src) {
    im.onerror = function () { this.onerror = null; this.src = T.PLACEHOLDER; };
    im.src = src;
  }

  // Clic sur une chip → navigue vers la fiche (même destination que l'image / le nom).
  function bindChipNav() {
    elGrid.addEventListener("click", function (e) {
      var chip = e.target.closest(".card-chip");
      if (!chip || !elGrid.contains(chip)) return;
      var card = chip.closest(".card");
      var link = card && card.querySelector("a.card-media, a.card-name-link");
      if (link) window.location.href = link.getAttribute("href");
    });
  }

  function bindChipHover() {
    elGrid.addEventListener("mouseover", function (e) {
      var chip = e.target.closest(".card-chip");
      if (!chip || !elGrid.contains(chip)) return;
      var card = chip.closest(".card");
      var im = card && card.querySelector(".card-media img");
      var v = chip.getAttribute("data-img");
      if (im && v) setImg(im, v);
    });
    elGrid.addEventListener("mouseout", function (e) {
      var chip = e.target.closest(".card-chip");
      if (!chip || !elGrid.contains(chip)) return;
      var card = chip.closest(".card");
      var im = card && card.querySelector(".card-media img");
      if (im) setImg(im, im.getAttribute("data-default"));
    });
  }

  /* ---------------------------------------------------------------- */
  /* Événements                                                       */
  /* ---------------------------------------------------------------- */

  // Clic (ou Entrée/Espace) sur le nom de collection d'une card → filtre la collection.
  // Le nom est à l'intérieur du lien <a class="card"> : on empêche la navigation vers la fiche.
  function bindCollectionFilter() {
    elGrid.addEventListener("click", function (e) {
      var link = e.target.closest(".card-collection-link");
      if (!link || !elGrid.contains(link)) return;
      e.preventDefault();
      e.stopPropagation();
      applyCollectionFilter(link.getAttribute("data-collection"));
    });
    elGrid.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      var link = e.target.closest(".card-collection-link");
      if (!link || !elGrid.contains(link)) return;
      e.preventDefault();
      e.stopPropagation();
      applyCollectionFilter(link.getAttribute("data-collection"));
    });
  }

  function bindEvents() {
    bindChipHover();
    bindChipNav();
    bindCollectionFilter();

    function onFilterChange() { render(); saveView(); }
    // Le champ texte n'écoute QUE "input" : "change" se déclenche aussi au blur, donc
    // cliquer une carte re-rendrait la grille (change → render) et détruirait le lien
    // sous le curseur entre mousedown et mouseup → le 1er clic ne navigue pas.
    // Les <select> gardent "change" (ils ne détruisent rien sous le pointeur).
    elSearch.addEventListener("input", onFilterChange);
    [elCollection, elStatus].forEach(function (el) {
      el.addEventListener("change", onFilterChange);
    });

    document.getElementById("btn-reset").addEventListener("click", function () {
      elSearch.value = "";
      elCollection.value = "";
      elStatus.value = "";
      render();
      saveView();
    });

    document.getElementById("btn-export").addEventListener("click", exportBackup);

    var fileInput = document.getElementById("import-file");
    document.getElementById("btn-import").addEventListener("click", function () {
      fileInput.click();
    });
    fileInput.addEventListener("change", function () {
      if (fileInput.files && fileInput.files[0]) importBackup(fileInput.files[0]);
      fileInput.value = ""; // permet de réimporter le même fichier
    });

    bindHelpModal();

    elToTop.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    // Mémorise le scroll (débounce) et l'état complet juste avant de quitter la page.
    // La visibilité du bouton « haut » est mise à jour à chaque scroll (non débouncée).
    var scrollTimer = null;
    window.addEventListener("scroll", function () {
      updateToTop();
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(saveView, 120);
    }, { passive: true });
    window.addEventListener("pagehide", saveView);

    // Retour depuis duck.html restauré du cache (bfcache) : le module ne re-tourne pas,
    // donc on recharge la possession, on ré-applique filtres + rendu, puis on restaure le scroll.
    window.addEventListener("pageshow", function (e) {
      if (!e.persisted || !ready) return;
      state = T.loadState();
      var v = loadView();
      applyView(v);
      render();
      restoreScroll(v);
      updateToTop();
    });
  }

  /* ---------------------------------------------------------------- */
  /* Démarrage                                                        */
  /* ---------------------------------------------------------------- */

  function checkStorage() {
    if (T.storageAvailable()) return;
    elWarning.hidden = false;
    elWarning.innerHTML =
      '⚠ Your browser is blocking local storage on this page, so your check marks ' +
      'will not be saved. Open the site from a host (http://) rather than a local file, ' +
      'or allow site data for this file.';
  }

  T.loadCatalog()
    .then(function (data) {
      catalog = data;
      ready = true;
      checkStorage();
      populateCollections();
      bindEvents();
      // Paramètres d'URL :
      //  - "?home"          (logo)     → accueil propre : on efface l'état mémorisé.
      //  - "?collection=<x>" (fiche)    → vue neuve filtrée sur cette collection.
      var params = null;
      try { params = new URLSearchParams(location.search); } catch (e) {}
      var goHome = !!(params && params.has("home"));
      var collectionParam = params ? params.get("collection") : null;

      if (goHome) {
        try { sessionStorage.removeItem(VIEW_KEY); } catch (e) {}
      }
      // URL propre (retire ?home / ?collection) une fois pris en compte.
      if (goHome || collectionParam) {
        try { history.replaceState(null, "", location.pathname); } catch (e) {}
      }

      if (collectionParam) {
        applyCollectionFilter(collectionParam);  // set filtres + render + scroll top + saveView
      } else {
        var v = goHome ? null : loadView();
        applyView(v);      // restaure recherche + filtres (rien si accueil propre)
        render();
        restoreScroll(v);  // restaure la position de scroll (rien si accueil propre)
      }
      updateToTop();       // affiche le bouton « haut » si on arrive déjà scrollé
    })
    .catch(function (err) {
      elGrid.setAttribute("aria-busy", "false");
      elGrid.innerHTML =
        '<div class="error">' +
          '<p><strong>Could not load the catalog.</strong></p>' +
          '<p class="muted">' + T.esc(err.message) + '</p>' +
          '<p class="muted">Make sure the <code>data.js</code> file is present next to ' +
          '<code>index.html</code>.</p>' +
        '</div>';
      console.error(err);
    });
})();
