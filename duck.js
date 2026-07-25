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

    var variantsHTML = (fig.variants || []).map(function (v) {
      var key = T.variantKey(v.size, v.packaging);
      var owned = T.isOwned(state, fig.id, key);
      var img = T.variantImageFor(fig.id, v.size, v.packaging);
      var sizeTxt = T.sizeLabel(meta, v.size);
      var packTxt = T.packagingLabel(meta, v.packaging);
      var packClass = T.packagingClass(v.packaging);
      var chipTxt = T.variantChipLabel(meta, v.size, v.packaging);

      return (
        '<div class="variant ' + (owned ? "is-owned " : "") + packClass + '">' +
          '<div class="variant-media">' +
            '<img loading="lazy" src="' + T.esc(img) + '" alt="' + T.esc(fig.name + " — " + sizeTxt + " " + packTxt) + '" ' +
              'onerror="this.onerror=null;this.src=\'' + T.PLACEHOLDER + '\'" />' +
          '</div>' +
          '<div class="variant-info">' +
            '<span class="chip ' + packClass + '">' + T.esc(chipTxt) + '</span>' +
          '</div>' +
          (v.limitedTo ? '<p class="variant-limited">🔒 Limited to ' +
            T.esc(Number(v.limitedTo).toLocaleString("en-US")) + ' units</p>' : '') +
          '<label class="variant-check">' +
            '<input type="checkbox" data-key="' + T.esc(key) + '"' + (owned ? " checked" : "") + ' />' +
            '<span>I own it</span>' +
          '</label>' +
        '</div>'
      );
    }).join("");

    root.innerHTML =
      '<article class="duck">' +
        '<div class="duck-hero">' +
          '<div class="duck-hero-figure">' +
            '<div class="duck-hero-media">' +
              '<img id="hero-img" src="' + T.esc(mainImg) + '" alt="' + T.esc(fig.name) + '" ' +
                'onerror="this.onerror=null;this.src=\'' + T.PLACEHOLDER + '\'" />' +
            '</div>' +
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
          '<div class="variants">' + (variantsHTML || '<p class="muted">No variant listed.</p>') + '</div>' +
        '</section>' +

        '<section class="duck-section">' +
          '<h2>My note</h2>' +
          '<textarea id="note" class="note" rows="3" placeholder="Write whatever you want here.">' + T.esc(T.getNote(state, fig.id)) + '</textarea>' +
        '</section>' +
      '</article>';

    bindEvents(fig);

    // Flip du hero : cycle sur les tailles disponibles (uniquement si >1).
    if (sizes.length > 1) {
      var heroIdx = 0;
      var heroImg = document.getElementById("hero-img");
      var flip = document.getElementById("hero-flip");
      flip.addEventListener("click", function () {
        heroIdx = (heroIdx + 1) % sizes.length;
        heroImg.onerror = function () { this.onerror = null; this.src = T.PLACEHOLDER; };
        heroImg.src = T.sizeImageFor(fig.id, sizes[heroIdx]);
        flip.textContent = "⇄ " + T.sizeLabel(meta, sizes[heroIdx]);
        flip.title = "Show " + T.sizeLabel(meta, sizes[(heroIdx + 1) % sizes.length]);
      });
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
  /* Démarrage                                                        */
  /* ---------------------------------------------------------------- */

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
