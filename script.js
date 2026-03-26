/* ============================================
   Karen Safo-Barnieh — Portfolio Script
   ============================================ */

// --- Reveal on Scroll (skip hero — handled by cinematic intro) ---
const revealElements = document.querySelectorAll('.reveal');

const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry, index) => {
        if (entry.isIntersecting) {
            const parent = entry.target.closest('.section, .hero, .section-quote');

            // Skip hero elements — they're handled by the cinematic intro
            if (parent && parent.classList.contains('hero')) return;

            const siblings = parent ? parent.querySelectorAll('.reveal') : [];
            const siblingIndex = Array.from(siblings).indexOf(entry.target);

            setTimeout(() => {
                entry.target.classList.add('visible');
            }, siblingIndex * 100);

            revealObserver.unobserve(entry.target);
        }
    });
}, {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
});

revealElements.forEach(el => revealObserver.observe(el));

// --- Cinematic Hero Intro ---
setTimeout(() => {
    const hero = document.querySelector('.hero');
    hero.classList.add('revealed');

    // Stagger hero text reveals after photo fades
    const heroReveals = hero.querySelectorAll('.reveal');
    heroReveals.forEach((el, i) => {
        setTimeout(() => {
            el.classList.add('visible');
        }, 800 + (i * 200));
    });
}, 4000);

// --- Navigation Scroll Effect ---
const nav = document.getElementById('nav');

let navTicking = false;
window.addEventListener('scroll', () => {
    if (!navTicking) {
        requestAnimationFrame(() => {
            if (window.scrollY > 50) {
                nav.classList.add('scrolled');
            } else {
                nav.classList.remove('scrolled');
            }
            navTicking = false;
        });
        navTicking = true;
    }
});

// --- Mobile Navigation Toggle ---
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');

navToggle.addEventListener('click', () => {
    navLinks.classList.toggle('open');
    navToggle.classList.toggle('active');
});

// Close mobile nav on link click
navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
        navLinks.classList.remove('open');
        navToggle.classList.remove('active');
    });
});

// --- Active Nav Link ---
const sections = document.querySelectorAll('section[id]');

const navObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const id = entry.target.getAttribute('id');
            document.querySelectorAll('.nav-links a').forEach(link => {
                link.classList.remove('active');
                if (link.getAttribute('href') === `#${id}`) {
                    link.classList.add('active');
                }
            });
        }
    });
}, {
    threshold: 0.3
});

sections.forEach(section => navObserver.observe(section));

// --- FAQ Accordion ---
const faqItems = document.querySelectorAll('.faq-item');

faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');

    question.addEventListener('click', () => {
        const isActive = item.classList.contains('active');

        // Close all other items
        faqItems.forEach(other => other.classList.remove('active'));

        // Toggle current item
        if (!isActive) {
            item.classList.add('active');
        }
    });
});

// --- Contact Form ---
const contactForm = document.getElementById('contactForm');

contactForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const btn = contactForm.querySelector('button[type="submit"]');
    const originalText = btn.textContent;

    btn.textContent = 'Sending...';
    btn.disabled = true;

    // Simulate form submission
    setTimeout(() => {
        btn.textContent = 'Message Sent!';
        btn.style.background = '#A68845';

        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.background = '';
            btn.disabled = false;
            contactForm.reset();
        }, 2500);
    }, 1000);
});

// --- Smooth Scroll for anchor links ---
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            const offset = 80;
            const targetPosition = target.getBoundingClientRect().top + window.scrollY - offset;
            window.scrollTo({
                top: targetPosition,
                behavior: 'smooth'
            });
        }
    });
});

/* ============================================
   WOW — Cinematic Interactions
   ============================================ */

// --- Number Counting Animation ---
function animateCount(el, start, end, duration) {
    const startTime = performance.now();
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(start + (end - start) * eased);
        el.textContent = current;
        if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
}

const counters = document.querySelectorAll('.accolade-number');
const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const el = entry.target;
            const text = el.textContent.trim();
            const num = parseInt(text);
            if (!isNaN(num)) {
                el.textContent = '0';
                // Delay to sync with reveal animation
                setTimeout(() => {
                    animateCount(el, 0, num, 1800);
                }, 400);
            }
            counterObserver.unobserve(el);
        }
    });
}, { threshold: 0.5 });

counters.forEach(c => counterObserver.observe(c));

// --- Custom Cursor (desktop only) ---
if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const cursor = document.createElement('div');
    cursor.classList.add('custom-cursor');
    document.body.appendChild(cursor);

    let mouseX = 0, mouseY = 0;
    let cursorX = 0, cursorY = 0;

    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
        if (!cursor.classList.contains('visible')) {
            cursor.classList.add('visible');
        }
    });

    document.addEventListener('mouseleave', () => {
        cursor.classList.remove('visible');
    });

    document.addEventListener('mouseenter', () => {
        cursor.classList.add('visible');
    });

    function updateCursor() {
        // Smooth follow with lerp
        cursorX += (mouseX - cursorX) * 0.15;
        cursorY += (mouseY - cursorY) * 0.15;
        cursor.style.left = cursorX + 'px';
        cursor.style.top = cursorY + 'px';
        requestAnimationFrame(updateCursor);
    }
    updateCursor();

    // Grow cursor on interactive elements
    const interactiveElements = document.querySelectorAll('a, button, .faq-question, input, textarea, select');
    interactiveElements.forEach(el => {
        el.addEventListener('mouseenter', () => cursor.classList.add('cursor-hover'));
        el.addEventListener('mouseleave', () => cursor.classList.remove('cursor-hover'));
    });
}

// --- Parallax Effects ---
let parallaxTicking = false;
window.addEventListener('scroll', () => {
    if (!parallaxTicking) {
        requestAnimationFrame(() => {
            const scrollY = window.scrollY;

            // Hero intro image subtle zoom as you scroll
            const heroIntro = document.querySelector('.hero-intro-image img');
            if (heroIntro && scrollY < window.innerHeight) {
                heroIntro.style.transform = `scale(${1 + scrollY * 0.0003})`;
            }

            // Pull quote background parallax
            const quoteSection = document.querySelector('.section-quote');
            if (quoteSection) {
                const rect = quoteSection.getBoundingClientRect();
                if (rect.top < window.innerHeight && rect.bottom > 0) {
                    const progress = rect.top / window.innerHeight;
                    quoteSection.style.backgroundPosition = `center ${50 + (progress * 20)}%`;
                }
            }

            parallaxTicking = false;
        });
        parallaxTicking = true;
    }
});
