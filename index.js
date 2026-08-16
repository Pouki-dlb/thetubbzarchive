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
  var elSearchClear = document.getElementById("search-clear");
  var elCollection = document.getElementById("filter-collection");
  var elSize = document.getElementById("filter-size");
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
        q: elSearch.value, collection: elCollection.value, size: elSize.value,
        status: elStatus.value,
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
    elSize.value = v.size || "";
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

  function resetFilters() {
    elSearch.value = "";
    elCollection.value = "";
    elSize.value = "";
    elStatus.value = "";
    render();
    saveView();
  }

  // Clic sur une collection (card de l'index ou fiche duck) : vue neuve filtrée
  // sur cette seule collection. On vide les autres filtres et on remonte en haut.
  function applyCollectionFilter(name) {
    elSearch.value = "";
    elCollection.value = name || "";
    elSize.value = "";
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
    // Filtre taille : ne garde que les TUBBZ qui existent DANS cette taille.
    if (elSize.value && T.sizesOf(fig).indexOf(elSize.value) === -1) return false;

    if (elStatus.value) {
      var owned = T.ownedCountOf(state, fig).owned > 0;
      if (elStatus.value === "wishlist") {
        if (!T.wishesAny(state, fig)) return false;
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

  // Un badge par TAILLE existante — pas par variante : la grille reste lisible, le
  // détail emballage par emballage vit sur la fiche. Le badge est le logo TUBBZ de
  // la taille, en couleur si le visiteur possède au moins un de ses emballages, en
  // noir et blanc atténué sinon ; une taille absente n'a pas de badge du tout.
  // (Max 3 tailles → une seule ligne ; aucun TUBBZ n'en a plus de 2 à ce jour.)
  // data-img liste les images à essayer au survol, figurine nue en tête.
  function sizeBadges(fig) {
    return T.sizesOf(fig).map(function (size) {
      var owned = T.ownsSize(state, fig, size);
      var wished = T.wishesSize(state, fig, size);
      // Le cœur est décoratif (aria-hidden) : l'information entre dans le libellé du
      // badge, sinon un lecteur d'écran annoncerait deux fois la même chose.
      var label = T.sizeLabel(catalog.meta, size) +
        (owned ? " — in your collection" : " — not in your collection") +
        (wished ? ", in your wishlist" : "");
      // Pas de loading="lazy" ici : ce sont 3 fichiers minuscules et partagés par
      // toutes les cards (un seul aller-retour réseau chacun), et le différé les
      // laisserait à hauteur nulle — donc la rangée sauterait au chargement.
      // .tubbz-logo-<taille> porte le ratio natif du logo, partagé avec duck.html.
      return '<span class="size-badge size-' + T.esc(size) + ' ' +
            (owned ? "is-owned" : "is-missing") + '" ' +
          'role="img" aria-label="' + T.esc(label) + '" title="' + T.esc(label) + '" ' +
          'data-img="' + T.esc(T.sizeImageCandidates(fig, size).join("|")) + '">' +
          '<img class="tubbz-logo tubbz-logo-' + T.esc(size) + '" ' +
            'src="' + T.esc(T.sizeLogoFor(size)) + '" alt="" />' +
          (wished ? '<span class="badge-heart" aria-hidden="true">❤</span>' : '') +
        '</span>';
    }).join("");
  }

  // Taille montrée sur la card : celle du filtre quand il est actif (la figurine est
  // forcément dans cette taille, `matches` a filtré), sinon la taille primaire.
  function shownSizeOf(fig) {
    var sizes = T.sizesOf(fig);
    if (elSize.value && sizes.indexOf(elSize.value) !== -1) return elSize.value;
    return sizes[0] || "classic";
  }

  function cardHTML(fig) {
    // Même chaîne de repli qu'au survol d'un badge : figurine nue, puis ses emballages,
    // puis le placeholder. data-default la porte en entier pour que la sortie de survol
    // revienne à l'image FILTRÉE et non à la classique.
    var candidates = T.sizeImageCandidates(fig, shownSizeOf(fig));
    var img = candidates[0];
    var url = "duck.html?id=" + encodeURIComponent(fig.id);

    // La card n'est PAS un lien global : seuls l'image et le nom mènent à la fiche.
    // (Le lien image est en tabindex=-1 pour ne pas doubler la tabulation clavier :
    //  au clavier, on tabule sur le nom, qui pointe au même endroit.)
    return (
      '<div class="card">' +
        '<a class="card-media" href="' + url + '" tabindex="-1" aria-label="' + T.esc(fig.name) + '">' +
          '<img loading="lazy" src="' + T.esc(img) + '" ' +
            'data-default="' + T.esc(candidates.join("|")) + '" ' +
            'alt="' + T.esc(fig.name) + '" ' +
            'onerror="this.onerror=null;this.src=\'' + T.PLACEHOLDER + '\'" />' +
          (fig.number ? '<span class="num-badge">#' + T.esc(fig.number) + '</span>' : '') +
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
          '<div class="card-sizes">' + sizeBadges(fig) + '</div>' +
        '</div>' +
      '</div>'
    );
  }

  /* ---------------------------------------------------------------- */
  /* Grille vide : « ta liste est vide » vs « aucun résultat »         */
  /* ---------------------------------------------------------------- */

  // Combien de TUBBZ le visiteur a dans la liste demandée, TOUS AUTRES FILTRES IGNORÉS.
  // C'est toute la nuance : une liste réellement vide mérite un mode d'emploi, alors
  // qu'une grille vidée par la recherche ou par les filtres collection/taille n'est
  // qu'un « aucun résultat » — y afficher « vous ne possédez aucun TUBBZ » serait faux.
  function listCount(status) {
    return catalog.figurines.filter(function (fig) {
      return status === "wishlist"
        ? T.wishesAny(state, fig)
        : T.ownedCountOf(state, fig).owned > 0;
    }).length;
  }

  // Libellés cités tels quels depuis duck.html : le message n'aide que s'il nomme
  // exactement la commande à chercher sur la fiche.
  var EMPTY_LIST = {
    owned: {
      title: "You don’t own any TUBBZ yet.",
      hint: "Open any TUBBZ and tick “I own it” under the version you have — Classic or " +
            "Mini, in its bathtub or boxed. It shows up in this list right away."
    },
    wishlist: {
      title: "Your wishlist is empty.",
      hint: "Open any TUBBZ and tick “I want it” under the version you are after. It " +
            "shows up in this list, and its card in the grid gets a heart."
    }
  };

  function emptyHTML() {
    var status = elStatus.value;
    var msg = EMPTY_LIST[status];
    if (!msg || listCount(status) > 0) {
      return '<p class="empty">No TUBBZ matches your search.</p>';
    }
    return (
      '<div class="empty empty-list">' +
        '<p class="empty-title">' + msg.title + '</p>' +
        '<p class="empty-hint">' + msg.hint + '</p>' +
        '<button type="button" class="btn" data-reset>Browse all TUBBZ</button>' +
      '</div>'
    );
  }

  function render() {
    var list = catalog.figurines.filter(matches);

    if (list.length === 0) {
      elGrid.innerHTML = emptyHTML();
    } else {
      elGrid.innerHTML = list.map(cardHTML).join("");
    }
    elGrid.setAttribute("aria-busy", "false");
    updateSearchPlaceholder();
    syncSearchClear();
  }

  // Croix d'effacement : visible dès qu'il y a au moins un caractère. Pilotée depuis
  // render(), par lequel passent TOUS les chemins qui touchent au champ (saisie, reset,
  // clic sur une collection, restauration de la vue) — elle ne peut donc pas se
  // désynchroniser du contenu réel du champ.
  function syncSearchClear() {
    elSearchClear.hidden = elSearch.value.length === 0;
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

  // Tailles réellement présentes dans le catalogue, dans l'ordre canonique de meta.sizes
  // (classic → mini → xl → plushies). On ne propose pas une taille que personne n'a :
  // le filtre ne doit pas pouvoir renvoyer une grille vide d'entrée de jeu.
  function populateSizes() {
    var present = {};
    catalog.figurines.forEach(function (f) {
      T.sizesOf(f).forEach(function (s) { present[s] = true; });
    });
    var order = (catalog.meta && catalog.meta.sizes) || [];
    order.filter(function (s) { return present[s]; }).forEach(function (size) {
      var opt = document.createElement("option");
      opt.value = size;
      opt.textContent = T.sizeLabel(catalog.meta, size);
      elSize.appendChild(opt);
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
  /* Survol d'un badge → change l'image de la card (délégation)        */
  /* ---------------------------------------------------------------- */

  // `sources` = une ou plusieurs URL séparées par « | », par ordre de préférence.
  // À chaque échec on passe à la suivante ; le placeholder ferme toujours la liste.
  function setImg(im, sources) {
    var list = String(sources || "").split("|").filter(Boolean);
    list.push(T.PLACEHOLDER);
    var i = 0;
    im.onerror = function () {
      if (++i >= list.length) { this.onerror = null; return; }
      this.src = list[i];
    };
    im.src = list[0];
  }

  // Clic sur un badge → navigue vers la fiche (même destination que l'image / le nom).
  function bindBadgeNav() {
    elGrid.addEventListener("click", function (e) {
      var badge = e.target.closest(".size-badge");
      if (!badge || !elGrid.contains(badge)) return;
      var card = badge.closest(".card");
      var link = card && card.querySelector("a.card-media, a.card-name-link");
      if (link) window.location.href = link.getAttribute("href");
    });
  }

  function bindBadgeHover() {
    elGrid.addEventListener("mouseover", function (e) {
      var badge = e.target.closest(".size-badge");
      if (!badge || !elGrid.contains(badge)) return;
      var card = badge.closest(".card");
      var im = card && card.querySelector(".card-media img");
      var v = badge.getAttribute("data-img");
      if (im && v) setImg(im, v);
    });
    elGrid.addEventListener("mouseout", function (e) {
      var badge = e.target.closest(".size-badge");
      if (!badge || !elGrid.contains(badge)) return;
      var card = badge.closest(".card");
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
    bindBadgeHover();
    bindBadgeNav();
    bindCollectionFilter();

    function onFilterChange() { render(); saveView(); }
    // Le champ texte n'écoute QUE "input" : "change" se déclenche aussi au blur, donc
    // cliquer une carte re-rendrait la grille (change → render) et détruirait le lien
    // sous le curseur entre mousedown et mouseup → le 1er clic ne navigue pas.
    // Les <select> gardent "change" (ils ne détruisent rien sous le pointeur).
    elSearch.addEventListener("input", onFilterChange);

    // Vider le champ par programme ne déclenche PAS l'événement "input" : on relance
    // donc le rendu et la mémorisation à la main. Le focus revient dans le champ, pour
    // pouvoir retaper aussitôt.
    elSearchClear.addEventListener("click", function () {
      elSearch.value = "";
      elSearch.focus();
      render();
      saveView();
    });
    [elCollection, elSize, elStatus].forEach(function (el) {
      el.addEventListener("change", onFilterChange);
    });

    // Un seul « remise à zéro » : le bouton de la barre d'outils et celui de l'état vide
    // (data-reset, injecté dans la grille) appellent la même fonction.
    document.getElementById("btn-reset").addEventListener("click", resetFilters);
    elGrid.addEventListener("click", function (e) {
      if (e.target.closest("[data-reset]")) resetFilters();
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
      populateSizes();
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
