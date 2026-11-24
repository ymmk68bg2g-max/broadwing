(() => {
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (motion.matches || !('IntersectionObserver' in window)) {
    return;
  }

  const metrics = [...document.querySelectorAll('.key-spec')].map(card => {
    const number = card.querySelector('.metric-number');
    return { card, number, value: Number(number.textContent), frame: 0 };
  });
  const byCard = new Map(metrics.map(metric => [metric.card, metric]));

  function finish(metric) {
    cancelAnimationFrame(metric.frame);
    metric.number.textContent = String(metric.value);
    delete metric.card.dataset.motion;
  }

  function play(metric, delay) {
    const start = performance.now() + delay;
    const duration = 780;
    metric.card.style.setProperty('--metric-delay', `${delay}ms`);
    metric.card.dataset.motion = 'playing';
    metric.number.textContent = '0';

    function tick(now) {
      const elapsed = Math.max(0, now - start);
      if (elapsed >= duration) {
        finish(metric);
        return;
      }
      const progress = elapsed / duration;
      const count = Math.floor(metric.value * (1 - (1 - progress) ** 2));
      const display = String(count);
      if (metric.number.textContent !== display) {
        metric.number.textContent = display;
      }
      metric.frame = requestAnimationFrame(tick);
    }
    metric.frame = requestAnimationFrame(tick);
  }

  const observer = new IntersectionObserver(entries => {
    let delay = 0;
    for (const entry of entries) {
      if (!entry.isIntersecting || entry.intersectionRatio < 0.2) {
        continue;
      }
      observer.unobserve(entry.target);
      if (motion.matches) {
        continue;
      }
      play(byCard.get(entry.target), delay);
      delay += 85;
    }
  }, { threshold: 0.2 });

  function showAll() {
    observer.disconnect();
    metrics.forEach(finish);
  }

  for (const { card } of metrics) {
    card.dataset.motion = 'waiting';
    observer.observe(card);
  }
  motion.addEventListener('change', event => {
    if (event.matches) {
      showAll();
    }
  });
  window.addEventListener('beforeprint', showAll, { once: true });
})();

(() => {
  if (!('IntersectionObserver' in window)) {
    return;
  }
  const specs = document.getElementById('specs');
  let inView = false;
  function updateReflection() {
    specs.classList.toggle('cri-in-view', inView && !document.hidden);
  }
  const visibility = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    updateReflection();
  });
  visibility.observe(specs);
  document.addEventListener('visibilitychange', updateReflection);
})();
