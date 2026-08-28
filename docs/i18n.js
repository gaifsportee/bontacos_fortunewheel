// Simple EN/PL localization for the player UI.
(function () {
  var DICT = {
    en: {
      welcome_sub: 'Play the wheel — everyone wins a treat.',
      start: 'Start',
      enter_code: "Enter today's code",
      ask_code: 'Ask your server for the code.',
      code_err: "That code isn't right — check with your server.",
      demo_hint: 'Demo mode — code pre-filled, just tap Unlock.',
      unlock: 'Unlock',
      tap_spin: 'Tap to spin!',
      spin: 'SPIN',
      spinning: 'SPINNING…',
      show_server: 'Show your server before it expires:',
      expires_in: 'Expires in',
      expired: 'Expired — ask your server',
      next: 'Next',
      how_was_it: 'How was it?',
      either_way: 'Your prize is yours either way 🌮',
      skip: 'Skip',
      sorry: 'Sorry about that 🙏',
      tell_us: 'Tell us what went wrong — it comes straight to us.',
      what_happened: 'What happened?',
      send: 'Send',
      want_coupon: 'Want your coupon emailed?',
      save_it: 'Save it',
      no_thanks: 'No thanks',
      see_you: 'See you again at BON TACOS.',
    },
    pl: {
      welcome_sub: 'Zakręć kołem — każdy wygrywa nagrodę!',
      start: 'Start',
      enter_code: 'Wpisz dzisiejszy kod',
      ask_code: 'Poproś obsługę o kod.',
      code_err: 'Ten kod jest błędny — zapytaj obsługę.',
      demo_hint: 'Tryb demo — kod wpisany, kliknij Odblokuj.',
      unlock: 'Odblokuj',
      tap_spin: 'Kliknij, aby zakręcić!',
      spin: 'ZAKRĘĆ',
      spinning: 'KRĘCI SIĘ…',
      show_server: 'Pokaż obsłudze zanim wygaśnie:',
      expires_in: 'Wygasa za',
      expired: 'Wygasło — zapytaj obsługę',
      next: 'Dalej',
      how_was_it: 'Jak było?',
      either_way: 'Nagroda i tak jest Twoja 🌮',
      skip: 'Pomiń',
      sorry: 'Przepraszamy 🙏',
      tell_us: 'Napisz, co poszło nie tak — trafi prosto do nas.',
      what_happened: 'Co się stało?',
      send: 'Wyślij',
      want_coupon: 'Wysłać kupon e-mailem?',
      save_it: 'Zapisz',
      no_thanks: 'Nie, dziękuję',
      see_you: 'Do zobaczenia w BON TACOS.',
    },
  };

  var lang = 'en';
  function t(key) { return (DICT[lang] && DICT[lang][key]) || DICT.en[key] || key; }

  function apply(l) {
    lang = DICT[l] ? l : 'en';
    try { localStorage.setItem('bt_lang', lang); } catch (e) {}
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(function (el) {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph')));
    });
    // headline image per language
    var hl = document.getElementById('headline-spin');
    if (hl) hl.src = lang === 'pl' ? 'assets/headline-spin-pl.png' : 'assets/headline-spin.png';
    document.querySelectorAll('.lang-switch button').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-lang') === lang);
    });
    if (window.onLangChange) window.onLangChange(lang);
  }

  function init() {
    var saved = 'en';
    try { saved = localStorage.getItem('bt_lang') || 'en'; } catch (e) {}
    apply(saved);
    document.querySelectorAll('.lang-switch button').forEach(function (b) {
      b.addEventListener('click', function () { apply(b.getAttribute('data-lang')); });
    });
  }

  window.I18N = { t: t, apply: apply, init: init, get lang() { return lang; } };
})();
