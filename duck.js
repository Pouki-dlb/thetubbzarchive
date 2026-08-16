/* duck.js — page détail « fiche canard ».
 * Lit ?id=... , affiche les photos par variante, gère coches / wishlist / note. */
(function () {
  "use strict";

  var T = window.Tubbz;
  var state = T.loadState();
  var root = document.getElementById("duck-root");

  function getId() {
    return new URLSearchParams(window.location.search).get("id");
  }

  function notFound(id) {
    root.setAttribute("aria-busy", "false");
    root.innerHTML =
      '<div class="error">' +
        '<p><strong>TUBBZ not found.</strong></p>' +
        (id ? '<p class="muted">No TUBBZ with the id "' + T.esc(id) + '".</p>' : '') +
        '<p><a class="btn" href="index.html">← Back to home</a></p>' +
      '</div>';
  }

  /* ---------------------------------------------------------------- */
  /* Rendu                                                            */
  /* ---------------------------------------------------------------- */

  function render(meta, fig) {
    root.setAttribute("aria-busy", "false");

    var wished = T.isWished(state, fig.id);
    // Tailles disponibles (classic → mini → xl) ; le hero part de la 1re (taille primaire).
    var sizes = T.sizesOf(fig);
    if (!sizes.length) sizes = ["classic"];
    var mainImg = T.sizeImageFor(fig.id, sizes[0]);
    // Le hero porte sa taille dans son alt (« Batman — Mini »), comme les tuiles : c'est
    // ce texte que la lightbox reprend en légende. setHeroSize le réécrit à chaque
    // bascule, sinon la légende annoncerait la taille de départ.
    function heroAlt(size) { return fig.name + " — " + T.sizeLabel(meta, size); }

    // Une tuile par EMBALLAGE. La taille n'est plus écrite ici : elle est portée par
    // l'en-tête du groupe, ce qui libère la place pour le nom complet de l'emballage.
    function variantTile(v) {
      var key = T.variantKey(v.size, v.packaging);
      var owned = T.isOwned(state, fig.id, key);
      var img = T.variantImageFor(fig.id, v.size, v.packaging);
      var sizeTxt = T.sizeLabel(meta, v.size);
      // Emballage, ou la taille elle-même quand il n'y en a pas (Plushies).
      var mark = T.variantMarker(meta, v);
      // Sans emballage, le marqueur EST la taille : ne pas écrire « Plushies Plushies ».
      var altTxt = fig.name + " — " + sizeTxt + (mark.label === sizeTxt ? "" : " " + mark.label);

      return (
        '<div class="variant' + (owned ? " is-owned" : "") + '">' +
          '<button type="button" class="variant-media photo-zoom" title="View larger">' +
            '<img loading="lazy" src="' + T.esc(img) + '" alt="' + T.esc(altTxt) + '" ' +
              'onerror="this.onerror=null;this.src=\'' + T.PLACEHOLDER + '\'" />' +
          '</button>' +
          (v.limitedTo ? '<p class="variant-limited">🔒 Limited to ' +
            T.esc(Number(v.limitedTo).toLocaleString("en-US")) + ' units</p>' : '') +
          // L'emoji tient sur la MÊME ligne que la case à cocher, calé à droite : plus de
          // pastille ni de ligne dédiée. Le placer DANS le <label> est délibéré — il
          // agrandit la zone cliquable et son aria-label entre dans le nom accessible de
          // la case (« I own it, First Edition »), ce qui distingue enfin deux tuiles
          // voisines qui annonçaient toutes deux « I own it ».
          '<label class="variant-check">' +
            '<input type="checkbox" data-key="' + T.esc(key) + '"' + (owned ? " checked" : "") + ' />' +
            '<span>I own it</span>' +
            '<span class="variant-pack" role="img" ' +
              'title="' + T.esc(mark.label) + '" aria-label="' + T.esc(mark.label) + '">' +
              T.esc(mark.emoji) +
            '</span>' +
          '</label>' +
        '</div>'
      );
    }

    // Un groupe par taille, coiffé du logo TUBBZ correspondant. Le logo reste TOUJOURS
    // en couleur ici — contrairement à la grille, où il porte la possession faute de
    // mieux : sur la fiche, les coches et les bordures vertes le disent déjà, et un
    // logo grisé se lirait à tort comme « cette taille n'existe pas ».
    // Quand il y a plusieurs tailles, l'en-tête est un bouton qui bascule le hero
    // dessus (sinon un simple bloc : pas de commande morte sur les fiches à 1 taille).
    var multiSize = sizes.length > 1;
    var groupsHTML = sizes.map(function (size) {
      var tiles = (fig.variants || [])
        .filter(function (v) { return v.size === size; })
        .map(variantTile).join("");
      if (!tiles) return "";

      var sizeTxt = T.sizeLabel(meta, size);
      var headInner =
        '<img class="tubbz-logo tubbz-logo-' + T.esc(size) + ' size-group-logo" ' +
          'src="' + T.esc(T.sizeLogoFor(size)) + '" alt="" />' +
        '<span class="size-group-label">' + T.esc(sizeTxt) + '</span>';
      var head = multiSize
        ? '<button type="button" class="size-group-head" data-size="' + T.esc(size) + '" ' +
            'title="Show ' + T.esc(sizeTxt) + ' in the main photo">' + headInner + '</button>'
        : '<div class="size-group-head">' + headInner + '</div>';

      return '<section class="size-group">' + head +
        '<div class="variants">' + tiles + '</div></section>';
    }).join("");

    root.innerHTML =
      '<article class="duck">' +
        '<div class="duck-hero">' +
          '<div class="duck-hero-figure">' +
            '<button type="button" class="duck-hero-media photo-zoom" title="View larger">' +
              '<img id="hero-img" src="' + T.esc(mainImg) + '" alt="' + T.esc(heroAlt(sizes[0])) + '" ' +
                'onerror="this.onerror=null;this.src=\'' + T.PLACEHOLDER + '\'" />' +
            '</button>' +
            (sizes.length > 1 ?
              '<button id="hero-flip" class="hero-flip" type="button" ' +
                'title="Show ' + T.esc(T.sizeLabel(meta, sizes[1])) + '">' +
                '⇄ ' + T.esc(T.sizeLabel(meta, sizes[0])) +
              '</button>' : '') +
          '</div>' +
          '<div class="duck-hero-info">' +
            '<h1 class="duck-name">' +
              (fig.number ? '#' + T.esc(fig.number) + ' ' : '') + T.esc(fig.name) +
            '</h1>' +
            '<div class="duck-subhead">' +
              '<div class="duck-subinfo">' +
                '<p class="duck-collection">' +
                  '<a class="collection-link text-link" href="index.html?collection=' +
                    encodeURIComponent(fig.collection) + '" ' +
                    'title="Show all ' + T.esc(fig.collection) + ' TUBBZ">' +
                    T.esc(fig.collection) +
                  '</a>' +
                '</p>' +
                '<dl class="duck-meta">' +
                  '<div><dt>Release year</dt><dd>' + (fig.releaseYear ? T.esc(fig.releaseYear) : 'Unknown') + '</dd></div>' +
                '</dl>' +
              '</div>' +
              '<button id="btn-wish" type="button" class="btn btn-wish' + (wished ? " is-active" : "") + '">' +
                (wished ? "❤ In wishlist" : "♡ Add to wishlist") +
              '</button>' +
            '</div>' +
            (fig.description ? '<p class="duck-description">' + T.esc(fig.description) + '</p>' : '') +
          '</div>' +
        '</div>' +

        '<section class="duck-section">' +
          '<h2>Available versions</h2>' +
          (groupsHTML || '<p class="muted">No variant listed.</p>') +
        '</section>' +

        '<section class="duck-section">' +
          '<h2>My note</h2>' +
          '<textarea id="note" class="note" rows="3" placeholder="Write whatever you want here.">' + T.esc(T.getNote(state, fig.id)) + '</textarea>' +
        '</section>' +
      '</article>';

    bindEvents(fig);

    // Deux commandes pointent sur la même taille de hero : le bouton « flip » (qui
    // cycle) et les en-têtes de groupe (qui ciblent). Elles passent donc toutes deux
    // par setHeroSize, seul endroit qui écrit l'image, le libellé du bouton et
    // l'en-tête actif — sinon les deux se désynchronisent.
    if (multiSize) {
      var heroIdx = 0;
      var heroImg = document.getElementById("hero-img");
      var flip = document.getElementById("hero-flip");
      var heads = root.querySelectorAll(".size-group-head[data-size]");

      function setHeroSize(idx) {
        heroIdx = idx;
        var size = sizes[heroIdx];
        heroImg.onerror = function () { this.onerror = null; this.src = T.PLACEHOLDER; };
        heroImg.src = T.sizeImageFor(fig.id, size);
        heroImg.alt = heroAlt(size);
        flip.textContent = "⇄ " + T.sizeLabel(meta, size);
        flip.title = "Show " + T.sizeLabel(meta, sizes[(heroIdx + 1) % sizes.length]);
        heads.forEach(function (h) {
          h.classList.toggle("is-active", h.getAttribute("data-size") === size);
        });
      }

      flip.addEventListener("click", function () {
        setHeroSize((heroIdx + 1) % sizes.length);
      });
      heads.forEach(function (h) {
        h.addEventListener("click", function () {
          setHeroSize(sizes.indexOf(h.getAttribute("data-size")));
        });
      });

      setHeroSize(0); // marque l'en-tête de la taille déjà affichée dans le hero
    }
  }

  /* ---------------------------------------------------------------- */
  /* Interactions                                                     */
  /* ---------------------------------------------------------------- */

  function bindEvents(fig) {
    // Coches de possession
    root.querySelectorAll('.variant-check input[type="checkbox"]').forEach(function (cb) {
      cb.addEventListener("change", function () {
        var key = cb.getAttribute("data-key");
        T.toggleOwned(state, fig.id, key);
        cb.closest(".variant").classList.toggle("is-owned", cb.checked);
      });
    });

    // Wishlist
    var btnWish = document.getElementById("btn-wish");
    btnWish.addEventListener("click", function () {
      var now = T.toggleWishlist(state, fig.id);
      btnWish.classList.toggle("is-active", now);
      btnWish.textContent = now ? "❤ In wishlist" : "♡ Add to wishlist";
    });

    // Note (sauvegarde à la volée, débounce léger)
    var note = document.getElementById("note");
    var timer = null;
    note.addEventListener("input", function () {
      clearTimeout(timer);
      timer = setTimeout(function () { T.setNote(state, fig.id, note.value); }, 300);
    });
    note.addEventListener("blur", function () { T.setNote(state, fig.id, note.value); });
  }

  /* ---------------------------------------------------------------- */
  /* Lightbox : une photo cliquée s'ouvre à sa taille native          */
  /* ---------------------------------------------------------------- */

  // Câblée une fois pour toutes, en délégation sur #duck-root : les photos n'existent
  // pas encore au chargement (le catalogue arrive plus tard) et le hero change de src.
  function bindPhotoZoom() {
    var modal = document.getElementById("photo-modal");
    var modalImg = document.getElementById("photo-modal-img");
    var caption = document.getElementById("photo-modal-caption");
    var opener = null; // pour rendre le focus au bouton d'origine à la fermeture

    function open(btn) {
      var im = btn.querySelector("img");
      var src = im.src;
      // .src est DÉJÀ la source retenue (onerror a pu basculer sur le placeholder) :
      // inutile de recalculer un chemin. Surtout PAS .currentSrc, qui décrit l'image
      // *chargée* : juste après un flip du hero il pointe encore sur la taille
      // précédente. Et on n'agrandit pas un placeholder — voir en grand « image
      // manquante » n'apprend rien.
      if (!src || src.indexOf(T.PLACEHOLDER) !== -1) return;
      opener = btn;
      modalImg.src = src;
      modalImg.alt = im.alt;
      caption.textContent = im.alt;
      modal.hidden = false;
      modal.querySelector(".modal-close").focus();
    }

    function close() {
      modal.hidden = true;
      modalImg.removeAttribute("src");
      if (opener) { opener.focus(); opener = null; }
    }

    root.addEventListener("click", function (e) {
      var btn = e.target.closest(".photo-zoom");
      if (btn) open(btn);
    });
    modal.addEventListener("click", function (e) {
      if (e.target.hasAttribute("data-close")) close();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !modal.hidden) close();
    });
  }

  /* ---------------------------------------------------------------- */
  /* Démarrage                                                        */
  /* ---------------------------------------------------------------- */

  bindPhotoZoom();

  var id = getId();
  T.loadCatalog()
    .then(function (data) {
      var fig = data.figurines.filter(function (f) { return f.id === id; })[0];
      if (!fig) { notFound(id); return; }
      document.title = fig.name + " — The TUBBZ Archive";
      render(data.meta, fig);
    })
    .catch(function (err) {
      root.setAttribute("aria-busy", "false");
      root.innerHTML =
        '<div class="error"><p><strong>Could not load the catalog.</strong></p>' +
        '<p class="muted">' + T.esc(err.message) + '</p>' +
        '<p><a class="btn" href="index.html">← Back</a></p></div>';
      console.error(err);
    });
})();
