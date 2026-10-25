/* Site-wide tracking for achrafahmadi.com
 * GA4 + automatic conversion events. Included on every page with:
 *   <script src="/track.js" defer></script>
 * Pages that already load GA4 inline (the popup-form pages) are detected and not loaded twice.
 *
 * Events sent to GA4:
 *   whatsapp_click   any link to wa.me
 *   begin_checkout   any Stripe buy link (with price in MAD)
 *   purchase         first visit to a Stripe success page (once per browser)
 *   book_call        a call booked in an embedded Calendly
 *   calendly_click / skool_click / click_instagram
 * Story links: add ?s=<story-name> (e.g. achrafahmadi.com/?s=bio) to tag the Instagram story.
 */
(function () {
  var GA4 = 'G-6WBC7C57V2';

  // Stripe payment link id → price in MAD
  var PRICES = { '9B64gybpvbH3652fwL7Re0v': 79, '8x200i79f3ax9he5Wb7Re0t': 299 };
  // Success page (without .html) → [product, price in MAD]
  var PURCHASE_PAGES = {
    '/trt-protocol-success': ['TRT Protocol PDF', 79],
    '/thank-you-testguide': ['Testosterone Guide', 299]
  };

  if (!window.gtag) {
    var sc = document.createElement('script');
    sc.async = true;
    sc.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA4;
    document.head.appendChild(sc);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { dataLayer.push(arguments); };
    gtag('js', new Date());
    var q = new URLSearchParams(location.search), s = q.get('s'), cfg = {};
    if (s && !q.get('utm_source')) cfg = { campaign_source: 'instagram', campaign_medium: 'story', campaign_name: s };
    gtag('config', GA4, cfg);
  }

  function ev(name, p) {
    p = p || {};
    p.page_path = location.pathname;
    try { gtag('event', name, p); } catch (e) {}
  }

  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var h = a.href, label = (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    if (/wa\.me\//.test(h)) ev('whatsapp_click', { link_text: label });
    else if (/buy\.stripe\.com\//.test(h)) {
      var id = h.split('/').pop().split('?')[0], v = PRICES[id] || 0;
      ev('begin_checkout', { value: v, currency: 'MAD', items: [{ item_id: id, item_name: document.title, price: v, quantity: 1 }] });
    }
    else if (/skool\.com/.test(h)) ev('skool_click', { link_text: label });
    else if (/calendly\.com/.test(h)) ev('calendly_click', { link_text: label });
    else if (/instagram\.com/.test(h)) ev('click_instagram', {});
  }, true);

  // Booked a call in an embedded Calendly widget
  window.addEventListener('message', function (e) {
    if (String(e.origin).indexOf('calendly.com') > -1 && e.data && e.data.event === 'calendly.event_scheduled') ev('book_call', {});
  });

  // Purchase: first time this browser lands on a Stripe success page
  var path = location.pathname.replace(/\.html$/, '').replace(/\/$/, '');
  var P = PURCHASE_PAGES[path];
  if (P) {
    try {
      var k = 'purchase:' + path;
      if (!localStorage.getItem(k)) {
        var tid = 'web-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        localStorage.setItem(k, tid);
        ev('purchase', { transaction_id: tid, value: P[1], currency: 'MAD', items: [{ item_name: P[0], price: P[1], quantity: 1 }] });
      }
    } catch (e) {}
  }
})();
