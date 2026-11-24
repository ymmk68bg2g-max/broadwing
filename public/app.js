(() => {
  'use strict';

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const header = $('.site-header');
  const menuButton = $('.menu-toggle');
  const mobileMenu = $('#mobile-menu');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const menuLinks = $$('a', mobileMenu);
  const brand = $('.brand', header);
  const background = $$('main, .site-footer, .skip-link');
  const menuLabel = $('span', menuButton);
  const root = document.documentElement;
  const theme = $('meta[name="theme-color"]');
  const lightColor = theme.content;
  const sections = $$('main > section');
  const footer = $('.site-footer');
  const visualViewport = window.visualViewport;
  let colorStops = [];
  let themeFrame = 0;

  function measurePageColors() {
    const pageY = window.scrollY;
    const stops = [];

    function stop(y, hexColor) {
      const hex = hexColor.trim().slice(1);
      const rgb = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
      stops.push({ y: y + pageY, rgb });
    }

    for (const section of sections) {
      const rect = section.getBoundingClientRect();
      const style = getComputedStyle(section);
      let top = rect.top;
      let bottom = rect.bottom;
      // The shared gradient crosses the section boundary and its margin.
      if (section.id === 'specs') {
        bottom -= parseFloat(getComputedStyle(section, '::after').height);
      }
      if (section.id === 'contact') {
        const field = getComputedStyle(section, '::after');
        top += parseFloat(field.top) + parseFloat(field.height);
      }
      stop(top, style.getPropertyValue('--section-start'));
      stop(bottom, style.getPropertyValue('--section-end'));
    }
    stop(
      footer.getBoundingClientRect().bottom,
      getComputedStyle(root).getPropertyValue('--footer-base')
    );
    colorStops = stops;
    syncBrowserTheme();
  }

  function syncBrowserTheme() {
    let color = lightColor;
    if (colorStops.length) {
      const edge = window.scrollY + (
        visualViewport ? visualViewport.offsetTop + visualViewport.height : window.innerHeight
      );
      const next = colorStops.findIndex(stop => stop.y >= edge);
      const end = next < 0 ? colorStops[colorStops.length - 1] : colorStops[next];
      const start = next > 0 ? colorStops[next - 1] : end;
      const t = end.y === start.y ? 1 : (edge - start.y) / (end.y - start.y);
      const channels = start.rgb.map((value, i) =>
        Math.round(value + (end.rgb[i] - value) * t)
      );
      color = '#' + channels.map(channel => channel.toString(16).padStart(2, '0')).join('');
    }
    if (root.style.getPropertyValue('--viewport-edge') === color) {
      return;
    }
    root.style.setProperty('--viewport-edge', color);
    theme.content = color;
  }

  function scheduleTheme() {
    if (themeFrame) {
      return;
    }
    themeFrame = requestAnimationFrame(() => {
      themeFrame = 0;
      syncBrowserTheme();
    });
  }

  if ('ResizeObserver' in window) {
    const sizeObserver = new ResizeObserver(measurePageColors);
    for (const element of [header, ...sections, footer]) {
      sizeObserver.observe(element);
    }
  }
  window.addEventListener('resize', measurePageColors);
  window.addEventListener('pageshow', measurePageColors);
  window.addEventListener('scroll', scheduleTheme, { passive: true });
  visualViewport?.addEventListener('resize', scheduleTheme);
  visualViewport?.addEventListener('scroll', scheduleTheme);
  measurePageColors();

  function setMenu(open, focusOnClose) {
    if (mobileMenu.hidden === !open) {
      return;
    }
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Закрити меню' : 'Відкрити меню');
    menuLabel.textContent = open ? 'Закрити' : 'Меню';
    mobileMenu.hidden = !open;
    background.forEach(element => {
      element.inert = open;
    });
    if (open) {
      touchY = undefined;
      header.addEventListener('touchstart', beginMenuTouch, { passive: true });
      header.addEventListener('touchmove', moveMenuTouch, { passive: false });
      header.addEventListener('wheel', moveMenuWheel, { passive: false });
      mobileMenu.scrollTop = 0;
      menuLinks[0].focus({ preventScroll: true });
    } else {
      header.removeEventListener('touchstart', beginMenuTouch);
      header.removeEventListener('touchmove', moveMenuTouch);
      header.removeEventListener('wheel', moveMenuWheel);
      if (focusOnClose) {
        focusOnClose.focus({ preventScroll: true });
      }
      scheduleTheme();
    }
  }

  // Let the document keep its native scrollport. Consume only a gesture that
  // would leave the open sheet, including a drag on its non-scrolling header.

  function containMenuGesture(event, delta) {
    if (!event.cancelable || !delta) {
      return;
    }
    const overMenu = mobileMenu.contains(event.target);
    const canScroll = delta < 0
      ? mobileMenu.scrollTop > 0
      : mobileMenu.scrollTop + mobileMenu.clientHeight < mobileMenu.scrollHeight - 1;
    if (!overMenu || !canScroll) {
      event.preventDefault();
    }
  }

  let touchY;

  function beginMenuTouch(event) {
    touchY = event.touches.length === 1 ? event.touches[0].clientY : undefined;
  }

  function moveMenuTouch(event) {
    if (event.touches.length !== 1 || touchY === undefined) {
      return;
    }
    const y = event.touches[0].clientY;
    containMenuGesture(event, touchY - y);
    touchY = y;
  }

  function moveMenuWheel(event) {
    if (!event.ctrlKey) {
      containMenuGesture(event, event.deltaY);
    }
  }

  menuButton.addEventListener('click', () => setMenu(mobileMenu.hidden, menuButton));
  header.addEventListener('click', event => {
    if (
      mobileMenu.hidden ||
      event.defaultPrevented ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    const link = event.target.closest('a');
    if (link) {
      const target = link.hash && document.getElementById(link.hash.slice(1));
      setMenu(false, target === document.body ? brand : target || menuButton);
    } else if (mobileMenu.contains(event.target)) {
      setMenu(false, menuButton);
    }
  });
  document.addEventListener('keydown', event => {
    if (mobileMenu.hidden) {
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setMenu(false, menuButton);
    } else if (event.key === 'Tab') {
      const last = menuLinks[menuLinks.length - 1];
      if (event.shiftKey && document.activeElement === brand) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        brand.focus();
      }
    } else if (!event.ctrlKey && !event.metaKey && !event.altKey) {
      const page = mobileMenu.clientHeight;
      const distances = {
        ArrowDown: 40,
        ArrowUp: -40,
        PageDown: page,
        PageUp: -page,
        Home: -mobileMenu.scrollHeight,
        End: mobileMenu.scrollHeight
      };
      if (event.key === ' ' && event.target !== menuButton) {
        distances[' '] = event.shiftKey ? -page : page;
      }
      if (Object.hasOwn(distances, event.key)) {
        event.preventDefault();
        mobileMenu.scrollTop += distances[event.key];
      }
    }
  });
  window.addEventListener('hashchange', () => {
    if (!mobileMenu.hidden) {
      setMenu(false, document.getElementById(location.hash.slice(1)) || menuButton);
    }
  });
  window.addEventListener('pagehide', () => setMenu(false));
  const mobileNavigation = window.matchMedia('(max-width: 950px)');
  mobileNavigation.addEventListener('change', () => {
    if (!mobileNavigation.matches && !mobileMenu.hidden) {
      setMenu(false, $('.desktop-nav a'));
    }
  });

  function syncNavigation() {
    const height = header.getBoundingClientRect().height;
    document.documentElement.style.setProperty('--nav-height', `${height}px`);
  }
  syncNavigation();
  if ('ResizeObserver' in window) {
    new ResizeObserver(syncNavigation).observe(header);
  } else {
    window.addEventListener('resize', syncNavigation, { passive: true });
  }

  // Native fragment navigation handles clicks, deep links, keyboard focus and history.
  $$('main[id], main > section[id]').forEach(target => {
    target.tabIndex = -1;
  });
  const updateHeader = () => header.classList.toggle('scrolled', window.scrollY > 20);
  window.addEventListener('scroll', updateHeader, { passive: true });
  updateHeader();
  $('#year').textContent = new Date().getFullYear();

  if ('IntersectionObserver' in window && !reducedMotion.matches) {
    document.documentElement.classList.add('js-motion');
    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.remove('pending');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    $$('.reveal').forEach(element => {
      if (element.getBoundingClientRect().top > window.innerHeight * 0.97) {
        element.classList.add('pending');
      }
      revealObserver.observe(element);
    });
    reducedMotion.addEventListener('change', event => {
      if (event.matches) {
        $$('.reveal.pending').forEach(element => element.classList.remove('pending'));
      }
    });
  }

  // Lighting simulator.
  const modes = {
    warm: {
      temperature: '2600–2900',
      name: 'ТЕПЛЕ СВІТЛО',
      alt: 'Світильник BROADWING у теплому режимі',
      description: 'М’який теплий відтінок із діапазоном 2600–2900 K.'
    },
    neutral: {
      temperature: '4500–4600',
      name: 'НЕЙТРАЛЬНЕ СВІТЛО',
      alt: 'Світильник BROADWING у нейтральному режимі',
      description: 'Нейтральний відтінок між теплим і холодним світлом.'
    },
    cold: {
      temperature: '6500–6900',
      name: 'ХОЛОДНЕ СВІТЛО',
      alt: 'Світильник BROADWING у холодному режимі',
      description: 'Холодний відтінок із діапазоном 6500–6900 K.'
    }
  };

  const lightLab = $('.light-lab');
  $$('[data-light]').forEach(button => button.addEventListener('click', () => {
    const key = button.dataset.light;
    const mode = modes[key];
    lightLab.dataset.mode = key;
    $$('[data-light]').forEach(item =>
      item.setAttribute('aria-pressed', String(item === button))
    );

    $('#mode-temperature').replaceChildren(document.createTextNode(`${mode.temperature} `));
    const unit = document.createElement('small');
    unit.textContent = 'K';
    $('#mode-temperature').append(unit);

    $('.live-label').replaceChildren();
    const dot = document.createElement('i');
    dot.className = 'signal-dot';
    $('.live-label').append(dot, document.createTextNode(mode.name));

    const img = $('#mode-lamp');
    img.src = `./assets/mode-${key}.webp`;
    img.alt = mode.alt;
    $('#mode-description').textContent = mode.description;
  }));
  $$('[data-level]').forEach(button => button.addEventListener('click', () => {
    lightLab.dataset.brightness = button.dataset.level;
    $$('[data-level]').forEach(item =>
      item.setAttribute('aria-pressed', String(item === button))
    );
  }));
  ['warm', 'neutral', 'cold'].forEach(key => {
    const img = new Image();
    img.src = `./assets/mode-${key}.webp`;
  });

  // Keep the product options and inquiry fields in sync.
  const preferences = {
    color: 'Потрібна консультація',
    mount: 'Потрібна консультація'
  };
  const formColor = $('#form-color');
  const formMount = $('#form-mount');
  const variantImage = $('#variant-image');

  function syncPreferences() {
    $$('[data-color]').forEach(button =>
      button.setAttribute('aria-pressed', String(button.dataset.color === preferences.color))
    );
    $$('[data-mount]').forEach(button =>
      button.setAttribute('aria-pressed', String(button.dataset.mount === preferences.mount))
    );
    formColor.value = preferences.color;
    formMount.value = preferences.mount;
    const white = preferences.color === 'Білий';
    const src = white ? './assets/broadwing-white.webp' : './assets/broadwing-black.webp';
    if (variantImage.getAttribute('src') !== src) {
      variantImage.src = src;
    }
    variantImage.width = 1680;
    variantImage.height = white ? 952 : 945;
    variantImage.alt = white
      ? 'Біла лампа BROADWING на підставці, оригінальне зображення виробу'
      : 'Чорна лампа BROADWING із кронштейном';
    $('.variant-photo').classList.toggle('white-photo', white);
    $('#variant-caption').textContent = white
      ? 'На фото: білий корпус на підставці.'
      : 'На фото: чорний корпус із кронштейном.';
  }

  $$('[data-color]').forEach(button => button.addEventListener('click', () => {
    preferences.color = button.dataset.color;
    syncPreferences();
  }));
  $$('[data-mount]').forEach(button => button.addEventListener('click', () => {
    preferences.mount = button.dataset.mount;
    syncPreferences();
  }));
  formColor.addEventListener('change', () => {
    preferences.color = formColor.value;
    syncPreferences();
  });
  formMount.addEventListener('change', () => {
    preferences.mount = formMount.value;
    syncPreferences();
  });
  syncPreferences();

  // Inquiry validation and delivery.
  const form = $('#inquiry-form');
  const submitButton = $('.submit-button');
  const status = $('#form-status');
  const config = window.BROADWING_FORM_CONFIG || { endpoint: '' };
  let sending = false;
  let attempted = false;
  let deliveryKey = '';
  let previousPayload = '';

  function setError(id, message) {
    const input = $(`#${id}`);
    $(`#${id}-error`).textContent = message;
    input.setAttribute('aria-invalid', String(Boolean(message)));
    return !message;
  }

  function validateField(id) {
    if (id === 'name') {
      return setError(id, $('#name').value.trim() ? '' : 'Вкажіть, будь ласка, ваше ім’я.');
    }
    if (id === 'phone') {
      const value = $('#phone').value.trim();
      const digits = value.replace(/\D/g, '');
      if (!value) {
        return setError(id, 'Вкажіть, будь ласка, номер телефону.');
      }
      const validCharacters =
        /^[+\d\s().\-]+$/.test(value) &&
        (value.match(/\+/g) || []).length <= 1 &&
        (!value.includes('+') || value.startsWith('+'));
      return setError(
        id,
        validCharacters && digits.length >= 10 && digits.length <= 15
          ? ''
          : 'Введіть номер із 10–15 цифр, наприклад +380 63 123 45 67.'
      );
    }
    if (id === 'consent') {
      return setError(
        id,
        $('#consent').checked ? '' : 'Підтвердьте згоду на обробку даних для відповіді.'
      );
    }
    return true;
  }

  ['name', 'phone', 'consent'].forEach(id => {
    const field = $(`#${id}`);
    field.addEventListener(id === 'consent' ? 'change' : 'input', () => {
      if (attempted) {
        validateField(id);
      }
    });
    field.addEventListener('blur', () => {
      if (attempted) {
        validateField(id);
      }
    });
  });

  function showStatus(message, kind = 'info') {
    status.textContent = message;
    status.dataset.kind = kind;
    status.hidden = false;
    status.focus({ preventScroll: true });
    status.scrollIntoView({
      behavior: reducedMotion.matches ? 'instant' : 'smooth',
      block: 'nearest'
    });
  }
  const normalizePhone = value => {
    const clean = value.replace(/\D/g, '');
    return value.trim().startsWith('+') ? `+${clean}` : clean;
  };
  // Integration contract: a successful HTTP response alone does not prove acceptance.

  async function deliverInquiry(payload) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': deliveryKey },
        body: JSON.stringify(payload),
        signal: controller.signal,
        credentials: 'same-origin'
      });
      let result;
      try {
        result = await response.json();
      } catch {
        throw new Error('unconfirmed');
      }
      if (
        !response.ok ||
        result.accepted !== true ||
        typeof result.requestId !== 'string' ||
        !result.requestId.trim()
      ) {
        throw new Error('unconfirmed');
      }
      return result;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (sending) {
      return;
    }
    attempted = true;
    status.hidden = true;
    const results = ['name', 'phone', 'consent'].map(id => ({ id, valid: validateField(id) }));
    const firstError = results.find(result => !result.valid);
    if (firstError) {
      $(`#${firstError.id}`).focus();
      return;
    }
    if ($('#website').value) {
      showStatus('Не вдалося перевірити запит. Спробуйте ще раз або зателефонуйте нам.', 'error');
      return;
    }
    if (!config.endpoint) {
      showStatus('Онлайн-запит не надіслано. Для консультації зателефонуйте ', 'error');
      const phone = $('.contact-direct a');
      const callLink = document.createElement('a');
      callLink.href = phone.href;
      callLink.textContent = phone.textContent.trim();
      status.append(callLink, '.');
      return;
    }
    const payload = {
      name: $('#name').value.trim(),
      phone: normalizePhone($('#phone').value),
      comment: $('#comment').value.trim(),
      preferences: { ...preferences },
      consent: true,
      consentText: $('.consent-label span').textContent,
      source: 'BROADWING landing',
      locale: 'uk'
    };
    const serialized = JSON.stringify(payload);
    if (serialized !== previousPayload) {
      deliveryKey = window.crypto?.randomUUID
        ? window.crypto.randomUUID()
        : `bw-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      previousPayload = serialized;
    }
    sending = true;
    submitButton.disabled = true;
    form.setAttribute('aria-busy', 'true');
    $('.submit-label').textContent = 'Надсилаємо…';
    try {
      await deliverInquiry(payload);
      showStatus('Дякуємо! Ваш запит прийнято. Ми зв’яжемося з вами за вказаним номером.', 'success');
    } catch (error) {
      showStatus(
        error.name === 'AbortError'
          ? 'Час очікування минув. Доставку запиту не підтверджено. Дані збережені в полях — повторіть спробу або зателефонуйте нам.'
          : 'Доставку запиту не підтверджено. Дані збережені в полях — повторіть спробу або зателефонуйте: +38 044 334 38 34.',
        'error'
      );
    } finally {
      sending = false;
      submitButton.disabled = false;
      form.removeAttribute('aria-busy');
      $('.submit-label').textContent = 'Надіслати запит';
    }
  });
})();

/* Responsive modes controls. */
(() => {
  const toggle = document.querySelector('.mode-guide-toggle');
  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!expanded));
  });
  toggle.hidden = false;
})();

/* Responsive specs controls. */
(() => {
  'use strict';

  const specs = document.querySelector('.specs-table-wrap');
  const filters = [...specs.querySelectorAll('[data-spec-filter]')];
  const groups = [...specs.querySelectorAll('[data-spec-group]')];

  function selectGroup(selected) {
    for (const button of filters) {
      button.setAttribute('aria-pressed', String(button === selected));
    }
    for (const group of groups) {
      group.classList.toggle(
        'selected-specs',
        group.dataset.specGroup === selected.dataset.specFilter
      );
    }
    specs.classList.toggle('shows-resource', selected.dataset.specFilter === 'general');
  }

  for (const button of filters) {
    button.addEventListener('click', () => selectGroup(button));
  }
  selectGroup(filters[0]);
  specs.classList.add('has-spec-filters');
})();
