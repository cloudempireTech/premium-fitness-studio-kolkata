/* ==========================================================================
   PREMIUM FITNESS STUDIO (PFS GYM) - MAIN INTERACTIVE ENGINE
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Mobile Menu Drawer Toggle
  const mobileToggle = document.querySelector('.mobile-toggle');
  const navLinks = document.querySelector('.nav-links');

  if (mobileToggle && navLinks) {
    mobileToggle.addEventListener('click', () => {
      mobileToggle.classList.toggle('active');
      navLinks.classList.toggle('active');
      document.body.style.overflow = navLinks.classList.contains('active') ? 'hidden' : '';
    });

    // Close drawer on any nav-link click
    navLinks.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        mobileToggle.classList.remove('active');
        navLinks.classList.remove('active');
        document.body.style.overflow = '';
      });
    });
  }

  // 2. Typewriter Dynamic Text Animation in Hero Title
  const typewriterEl = document.querySelector('.dynamic-typewriter');
  if (typewriterEl) {
    const phrases = [
      "Olympic Strength Lifting",
      "Biomechanical Hypertrophy",
      "Functional HIIT & Cardio",
      "1-on-1 Personal Coaching",
      "Body Recomposition & Diet"
    ];

    let phraseIndex = 0;
    let charIndex = 0;
    let isDeleting = false;

    // Ensure cursor exists
    let cursor = typewriterEl.nextElementSibling;
    if (!cursor || !cursor.classList.contains('typewriter-cursor')) {
      cursor = document.createElement('span');
      cursor.className = 'typewriter-cursor';
      cursor.textContent = '|';
      typewriterEl.parentNode.insertBefore(cursor, typewriterEl.nextSibling);
    }

    function typeLoop() {
      const currentPhrase = phrases[phraseIndex];

      if (isDeleting) {
        charIndex--;
        typewriterEl.textContent = currentPhrase.substring(0, charIndex);
      } else {
        charIndex++;
        typewriterEl.textContent = currentPhrase.substring(0, charIndex);
      }

      let delta = isDeleting ? 35 : 70;

      if (!isDeleting && charIndex === currentPhrase.length) {
        delta = 2200; // Pause at complete word
        isDeleting = true;
      } else if (isDeleting && charIndex === 0) {
        isDeleting = false;
        phraseIndex = (phraseIndex + 1) % phrases.length;
        delta = 400; // Pause before typing new word
      }

      setTimeout(typeLoop, delta);
    }

    setTimeout(typeLoop, 600);
  }

  // 3. Hero Video Pause / Play Toggle
  const video = document.querySelector('.hero-video');
  const videoControlBtn = document.querySelector('.video-control-btn');

  if (video && videoControlBtn) {
    videoControlBtn.addEventListener('click', () => {
      if (video.paused) {
        video.play();
        videoControlBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16"></rect>
            <rect x="14" y="4" width="4" height="16"></rect>
          </svg>
        `;
        videoControlBtn.setAttribute('aria-label', 'Pause Hero Video');
      } else {
        video.pause();
        videoControlBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
        `;
        videoControlBtn.setAttribute('aria-label', 'Play Hero Video');
      }
    });
  }

  // 4. Animated Count-Up Telemetry Numbers
  const counters = document.querySelectorAll('.stat-counter');
  if (counters.length > 0) {
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const counter = entry.target;
          const target = parseFloat(counter.getAttribute('data-target') || '0');
          const isDecimal = counter.getAttribute('data-decimal') === 'true';
          const duration = 1600; // ms
          const startTime = performance.now();

          function updateCount(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Ease-out cubic
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const currentVal = target * easeOut;

            if (isDecimal) {
              counter.textContent = currentVal.toFixed(1);
            } else {
              counter.textContent = Math.floor(currentVal);
            }

            if (progress < 1) {
              requestAnimationFrame(updateCount);
            } else {
              counter.textContent = isDecimal ? target.toFixed(1) : target;
            }
          }

          requestAnimationFrame(updateCount);
          obs.unobserve(counter);
        }
      });
    }, { threshold: 0.2 });

    counters.forEach(c => observer.observe(c));
  }

  // 5. Sticky Floating Tab Filter Rail (offerings.html)
  const filterBtns = document.querySelectorAll('.filter-tab-btn');
  const cards = document.querySelectorAll('.offering-card, .dish-card');

  if (filterBtns.length > 0) {
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        // Toggle active
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Smooth scroll tab into view
        btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });

        const filter = btn.getAttribute('data-filter') || 'all';

        cards.forEach(card => {
          const cat = card.getAttribute('data-category') || '';
          if (filter === 'all' || cat.toLowerCase().includes(filter.toLowerCase())) {
            card.style.display = 'flex';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
          } else {
            card.style.display = 'none';
          }
        });
      });
    });
  }

  // 6. Interactive Value / Calorie Transformation Calculator
  const daysSlider = document.getElementById('calc-days');
  const timeSlider = document.getElementById('calc-time');
  const daysValDisplay = document.getElementById('calc-days-val');
  const timeValDisplay = document.getElementById('calc-time-val');
  const caloriesResult = document.getElementById('calc-calories');
  const conditioningResult = document.getElementById('calc-conditioning');
  const proteinResult = document.getElementById('calc-protein');

  function updateCalculator() {
    if (!daysSlider || !timeSlider) return;
    const days = parseInt(daysSlider.value, 10);
    const mins = parseInt(timeSlider.value, 10);

    if (daysValDisplay) daysValDisplay.textContent = `${days} Days / Wk`;
    if (timeValDisplay) timeValDisplay.textContent = `${mins} Mins / Session`;

    // Pure portfolio calculation:
    // Avg ~8.5 kcal/min for high-performance training
    const weeklyCalories = Math.round(days * mins * 8.5);
    const conditioningScore = Math.min(Math.round((days * mins) / 12), 48); // % progression
    const recommendedProtein = (1.4 + (days * 0.1)).toFixed(1); // g per kg

    if (caloriesResult) caloriesResult.textContent = weeklyCalories.toLocaleString();
    if (conditioningResult) conditioningResult.textContent = `+${conditioningScore}%`;
    if (proteinResult) proteinResult.textContent = `${recommendedProtein}g / kg`;
  }

  if (daysSlider && timeSlider) {
    daysSlider.addEventListener('input', updateCalculator);
    timeSlider.addEventListener('input', updateCalculator);
    updateCalculator();
  }

  // 7. Bespoke WhatsApp Form Handoff
  const forms = document.querySelectorAll('.inquiry-form');
  forms.forEach(form => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = form.querySelector('[name="name"]')?.value || 'Guest';
      const phone = form.querySelector('[name="phone"]')?.value || 'Not provided';
      const discipline = form.querySelector('[name="discipline"]')?.value || 'General Fitness';
      const goal = form.querySelector('[name="goal"]')?.value || 'Gym Membership & Coaching';
      const notes = form.querySelector('[name="message"]')?.value || '';

      const text = `*New Studio Inquiry — Premium Fitness Studio (Santoshpur)*\n\n` +
        `👤 *Name:* ${name}\n` +
        `📞 *Phone:* ${phone}\n` +
        `🏋️ *Discipline:* ${discipline}\n` +
        `🎯 *Fitness Goal:* ${goal}\n` +
        (notes ? `💬 *Notes:* ${notes}\n` : '') +
        `\n_Sent via Premium Fitness Studio Official Web Portfolio_`;

      const encoded = encodeURIComponent(text);
      // Primary desk: +91 89104 46703
      const waUrl = `https://wa.me/918910446703?text=${encoded}`;
      window.open(waUrl, '_blank');
    });
  });
});
