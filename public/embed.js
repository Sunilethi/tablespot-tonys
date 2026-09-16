/**
 * Tablespot embeddable widget.
 *
 * Add this one line to any page on tonysristorante.de (Webflow: Page
 * Settings → Custom Code → Footer Code, or a raw HTML embed element):
 *
 *   <script src="https://booking.tonysristorante.de/embed.js"></script>
 *
 * That's the whole integration — no build step, no dependencies. It
 * injects a "Reserve a Table" button (bottom-right, or wherever you
 * place a target element — see below) that opens the real booking flow
 * in an overlay, without ever leaving tonysristorante.de.
 *
 * Optional: instead of the floating button, embed the trigger inline
 * anywhere on the page by adding an element with this id and letting
 * the widget fill it in:
 *
 *   <div id="tablespot-widget-target"></div>
 *
 * If that element isn't found on the page, the floating button is used
 * automatically as a fallback — so this script is safe to drop onto any
 * page without extra configuration.
 */

(function () {
  var WIDGET_ORIGIN = (function () {
    // Derives "https://booking.tonysristorante.de" from this very
    // script's own src, so the same file works correctly whether it's
    // loaded from the production domain or the Railway *.up.railway.app
    // address, without hardcoding either.
    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
      var src = scripts[i].src || '';
      if (src.indexOf('/embed.js') !== -1) {
        var a = document.createElement('a');
        a.href = src;
        return a.protocol + '//' + a.host;
      }
    }
    return '';
  })();

  function injectStyles() {
    var style = document.createElement('style');
    style.textContent =
      '.tsp-fab{position:fixed;bottom:24px;right:24px;z-index:999998;' +
      'background:#8B2E23;color:#fff;border:none;border-radius:999px;' +
      'padding:14px 22px;font-family:Inter,sans-serif;font-size:15px;' +
      'font-weight:600;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,0.25);}' +
      '.tsp-fab:hover{background:#6E2019;}' +
      '.tsp-inline-btn{background:#8B2E23;color:#fff;border:none;border-radius:999px;' +
      'padding:14px 28px;font-family:Inter,sans-serif;font-size:15px;font-weight:600;cursor:pointer;}' +
      '.tsp-inline-btn:hover{background:#6E2019;}' +
      '.tsp-overlay{position:fixed;inset:0;background:rgba(15,15,15,0.6);' +
      'z-index:999999;display:flex;align-items:center;justify-content:center;padding:20px;}' +
      '.tsp-overlay-box{position:relative;width:100%;max-width:560px;height:90vh;max-height:800px;' +
      'background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.4);}' +
      '.tsp-overlay-close{position:absolute;top:10px;right:10px;z-index:2;' +
      'width:34px;height:34px;border-radius:50%;border:none;background:rgba(0,0,0,0.55);' +
      'color:#fff;font-size:18px;cursor:pointer;line-height:1;}' +
      '.tsp-overlay-close:hover{background:rgba(0,0,0,0.75);}' +
      '.tsp-overlay iframe{width:100%;height:100%;border:0;display:block;}' +
      '@media(max-width:480px){.tsp-overlay-box{height:95vh;border-radius:8px;}}';
    document.head.appendChild(style);
  }

  function openOverlay() {
    var overlay = document.createElement('div');
    overlay.className = 'tsp-overlay';

    var box = document.createElement('div');
    box.className = 'tsp-overlay-box';

    var closeBtn = document.createElement('button');
    closeBtn.className = 'tsp-overlay-close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.textContent = '\u00D7';
    closeBtn.onclick = function () { document.body.removeChild(overlay); };

    var iframe = document.createElement('iframe');
    iframe.src = WIDGET_ORIGIN + '/';
    iframe.title = "Tony's — Reserve a table";

    box.appendChild(closeBtn);
    box.appendChild(iframe);
    overlay.appendChild(box);

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) document.body.removeChild(overlay);
    });

    document.body.appendChild(overlay);
  }

  function init() {
    if (!WIDGET_ORIGIN) return; // couldn't determine our own origin — fail silently, don't break the host page
    injectStyles();

    var inlineTarget = document.getElementById('tablespot-widget-target');
    if (inlineTarget) {
      var inlineBtn = document.createElement('button');
      inlineBtn.className = 'tsp-inline-btn';
      inlineBtn.textContent = 'Reserve a Table';
      inlineBtn.onclick = openOverlay;
      inlineTarget.appendChild(inlineBtn);
    } else {
      var fab = document.createElement('button');
      fab.className = 'tsp-fab';
      fab.textContent = 'Reserve a Table';
      fab.onclick = openOverlay;
      document.body.appendChild(fab);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
